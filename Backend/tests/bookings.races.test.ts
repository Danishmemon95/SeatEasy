import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import app from "../src/app";
import { db } from "../src/config/db";
import { as } from "./helpers/api";
import { bookingRow, closeDb, expireHolds, inventoryProblems, liveHeldIds, resetDb, seatRows } from "./helpers/db";
import { createUser, seedScreening, type TestUser } from "./helpers/factories";

/*
 * Booking and payment races (docs/test-plan.md §5.4). Whatever order the
 * requests land in, a booking and its seats must agree afterwards.
 */

const ROUNDS = 20;

let alice: TestUser;
let bob: TestUser;
let organizer: TestUser;
let screeningId: number;
let seatIds: number[];

const fresh = async () => {
    await resetDb();
    alice = await createUser();
    bob = await createUser();
    ({ screeningId, seatIds, organizer } = await seedScreening());
};

const repeat = async (round: () => Promise<void>) => {
    for (let i = 0; i < ROUNDS; i++) {
        await fresh();
        await round();
        expect(await inventoryProblems(screeningId)).toEqual([]);
    }
};

const checkout = async (user: TestUser, ids: number[]) => {
    await as(user).hold(screeningId, ids).expect(200);
    return (await as(user).createBooking(screeningId).expect(201)).body.booking.id as number;
};

const bookingStatuses = async () => {
    const result = await db.execute<{ status: string }>(sql`SELECT status FROM bookings ORDER BY id`);
    return result.rows.map((r) => r.status);
};

const seatStatuses = async (ids: number[]) =>
    (await seatRows(screeningId)).filter((r) => ids.includes(r.id)).map((r) => r.status);

beforeEach(fresh);
afterAll(closeDb);

describe("booking races", () => {
    it("BR1: two checkouts at once leave exactly one pending booking", async () => {
        await repeat(async () => {
            const ids = seatIds.slice(0, 3);
            await as(alice).hold(screeningId, ids).expect(200);

            const [r1, r2] = await Promise.all([as(alice).createBooking(screeningId), as(alice).createBooking(screeningId)]);

            expect([r1.status, r2.status]).toEqual([201, 201]);
            expect((await bookingStatuses()).sort()).toEqual(["cancelled", "pending"]);

            const [pending] = (await db.execute<{ id: number }>(sql`SELECT id FROM bookings WHERE status = 'pending'`)).rows;
            expect((await seatRows(screeningId)).filter((r) => r.bookingId === pending.id).map((r) => r.id)).toEqual(ids);
        });
    });

    it("BR2: two payments for one booking confirm it once", async () => {
        await repeat(async () => {
            const bookingId = await checkout(alice, seatIds.slice(0, 2));

            const responses = await Promise.all([as(alice).pay(bookingId), as(alice).pay(bookingId)]);

            expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
            expect((await bookingRow(bookingId)).status).toBe("confirmed");
            expect(await seatStatuses(seatIds.slice(0, 2))).toEqual(["booked", "booked"]);
        });
    });

    it("BR3: paying and releasing at once ends paid or cancelled, never in between", async () => {
        await repeat(async () => {
            const ids = seatIds.slice(0, 2);
            const bookingId = await checkout(alice, ids);

            const [paid, released] = await Promise.all([as(alice).pay(bookingId), as(alice).release(screeningId)]);

            expect(released.status).toBe(200);
            const status = (await bookingRow(bookingId)).status;
            if (paid.status === 200) {
                expect(status).toBe("confirmed");
                expect(await seatStatuses(ids)).toEqual(["booked", "booked"]);
            } else {
                expect(paid.status).toBe(409);
                expect(status).toBe("cancelled");
                expect(await seatStatuses(ids)).toEqual(["available", "available"]);
            }
        });
    });

    it("BR4a: paying a live hold beats another buyer's attempt on the same seats", async () => {
        await repeat(async () => {
            const ids = seatIds.slice(0, 2);
            const bookingId = await checkout(alice, ids);

            const [paid, taken] = await Promise.all([as(alice).pay(bookingId), as(bob).hold(screeningId, ids)]);

            expect([paid.status, taken.status]).toEqual([200, 409]);
            expect(await seatStatuses(ids)).toEqual(["booked", "booked"]);
            expect(await liveHeldIds(bob.id, screeningId)).toEqual([]);
        });
    });

    it("BR4b: paying an expired hold loses to another buyer taking the seats", async () => {
        await repeat(async () => {
            const ids = seatIds.slice(0, 2);
            const bookingId = await checkout(alice, ids);
            await expireHolds(alice.id, screeningId);

            const [paid, taken] = await Promise.all([as(alice).pay(bookingId), as(bob).hold(screeningId, ids)]);

            expect([paid.status, taken.status]).toEqual([409, 200]);
            expect((await bookingRow(bookingId)).status).toBe("cancelled");
            expect(await liveHeldIds(bob.id, screeningId)).toEqual(ids);
        });
    });

    it("BR5: paying while the organizer cancels the screening stays consistent", async () => {
        await repeat(async () => {
            const ids = seatIds.slice(0, 2);
            const bookingId = await checkout(alice, ids);

            const [paid, cancelled] = await Promise.all([
                as(alice).pay(bookingId),
                request(app).post(`/api/screenings/${screeningId}/cancel`).set("Cookie", organizer.cookie),
            ]);

            expect(cancelled.status).toBe(200);
            const status = (await bookingRow(bookingId)).status;
            if (paid.status === 200) {
                expect(status).toBe("confirmed");
                expect(await seatStatuses(ids)).toEqual(["booked", "booked"]);
            } else {
                expect(paid.status).toBe(409);
                expect(status).toBe("cancelled");
                expect(await seatStatuses(ids)).toEqual(["available", "available"]);
            }
        });
    });

    it("BR6: holding while the organizer cancels never leaves a payable booking on a cancelled screening", async () => {
        await repeat(async () => {
            const ids = seatIds.slice(0, 2);

            const [held, cancelled] = await Promise.all([
                as(alice).hold(screeningId, ids),
                request(app).post(`/api/screenings/${screeningId}/cancel`).set("Cookie", organizer.cookie),
            ]);

            expect(cancelled.status).toBe(200);
            expect([200, 409]).toContain(held.status);
            await as(alice).createBooking(screeningId).expect(409);
        });
    });
});
