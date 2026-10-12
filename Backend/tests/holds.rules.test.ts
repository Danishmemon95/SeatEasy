import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";
import { as, mapStatuses } from "./helpers/api";
import { cancelScreeningRow, closeDb, expireHolds, liveHeldIds, resetDb, seatRow, seatRows, startScreening } from "./helpers/db";
import { createUser, seedScreening, type TestUser } from "./helpers/factories";
import { db } from "../src/config/db";
import { sql } from "drizzle-orm";

/*
 * Seat holds, one request at a time (docs/test-plan.md §3). The races are in
 * holds.races.test.ts.
 */

let alice: TestUser;
let bob: TestUser;
let screeningId: number;
let seatIds: number[];

/** Hold, book and pay: leaves the seats booked. */
const buy = async (user: TestUser, onScreening: number, ids: number[]) => {
    await as(user).hold(onScreening, ids).expect(200);
    const created = await as(user).createBooking(onScreening).expect(201);
    await as(user).pay(created.body.booking.id).expect(200);
    return created.body.booking.id as number;
};

beforeEach(async () => {
    await resetDb();
    alice = await createUser();
    bob = await createUser();
    // 3 rows of 8: A gold, B platinum, C sofa.
    ({ screeningId, seatIds } = await seedScreening({ rows: ["gold", "platinum", "sofa"], seatsPerRow: 8 }));
});

afterAll(closeDb);

describe("holding seats", () => {
    it("H1: holds free seats for about ten minutes", async () => {
        const ids = [seatIds[0], seatIds[8]]; // one gold, one platinum
        const res = await as(alice).hold(screeningId, ids).expect(200);

        expect(res.body.seats.map((s: { id: number }) => s.id).sort()).toEqual([...ids].sort());
        expect(res.body.total).toBe("650.00");

        const msLeft = new Date(res.body.heldUntil).getTime() - Date.now();
        expect(msLeft).toBeGreaterThan(9.5 * 60_000);
        expect(msLeft).toBeLessThan(10.5 * 60_000);

        for (const id of ids) {
            const row = await seatRow(id);
            expect(row.status).toBe("held");
            expect(row.heldBy).toBe(alice.id);
        }
    });

    it("H2: the seat map shows them as held", async () => {
        await as(alice).hold(screeningId, [seatIds[0], seatIds[1]]).expect(200);

        const map = await as().seatMap(screeningId).expect(200);
        expect(map.body.summary).toEqual({ available: 22, held: 2, booked: 0, total: 24 });
        expect(await mapStatuses(screeningId, [seatIds[0], seatIds[1], seatIds[2]])).toEqual(["held", "held", "available"]);
    });

    it("H3: a seat held by someone else is refused", async () => {
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);

        const res = await as(bob).hold(screeningId, [seatIds[0]]).expect(409);
        expect(res.body.unavailable).toEqual([seatIds[0]]);
        expect((await seatRow(seatIds[0])).heldBy).toBe(alice.id);
    });

    it("H4: a booked seat is refused", async () => {
        await buy(alice, screeningId, [seatIds[0]]);

        const res = await as(bob).hold(screeningId, [seatIds[0]]).expect(409);
        expect(res.body.unavailable).toEqual([seatIds[0]]);
        expect((await seatRow(seatIds[0])).status).toBe("booked");
    });

    it("H5: one taken seat means nothing is held (all-or-nothing)", async () => {
        await as(alice).hold(screeningId, [seatIds[1]]).expect(200);

        const res = await as(bob).hold(screeningId, [seatIds[0], seatIds[1], seatIds[2]]).expect(409);
        expect(res.body.unavailable).toEqual([seatIds[1]]);
        expect(await liveHeldIds(bob.id, screeningId)).toEqual([]);
        expect((await seatRow(seatIds[0])).status).toBe("available");
    });

    it("H6: holding the same seats again changes nothing", async () => {
        const first = await as(alice).hold(screeningId, [seatIds[0], seatIds[1]]).expect(200);
        const second = await as(alice).hold(screeningId, [seatIds[0], seatIds[1]]).expect(200);

        expect(second.body.heldUntil).toBe(first.body.heldUntil);
        expect(second.body.seats).toHaveLength(2);
    });

    it("H7: adding seats joins the existing window instead of restarting it", async () => {
        const first = await as(alice).hold(screeningId, [seatIds[0], seatIds[1]]).expect(200);
        // Age the window, so a restarted timer would be visibly later.
        await db.execute(sql`UPDATE screening_seats SET held_until = held_until - interval '4 minutes' WHERE held_by = ${alice.id}`);

        const second = await as(alice).hold(screeningId, [seatIds[2]]).expect(200);

        expect(await liveHeldIds(alice.id, screeningId)).toEqual([seatIds[0], seatIds[1], seatIds[2]]);
        const aged = new Date(first.body.heldUntil).getTime() - 4 * 60_000;
        expect(new Date(second.body.heldUntil).getTime()).toBe(aged);
        expect((await seatRow(seatIds[2])).heldUntil!.getTime()).toBe(aged);
    });

    it("H8: a seat id from another screening is a 400", async () => {
        const other = await seedScreening();

        const res = await as(alice).hold(screeningId, [seatIds[0], other.seatIds[0]]).expect(400);
        expect(res.body.unknown).toEqual([other.seatIds[0]]);
        expect(await liveHeldIds(alice.id, screeningId)).toEqual([]);
        expect((await seatRow(other.seatIds[0])).status).toBe("available");
    });

    it("H9: unknown ids are reported before taken ones", async () => {
        await as(bob).hold(screeningId, [seatIds[0]]).expect(200);

        const res = await as(alice).hold(screeningId, [seatIds[0], 999_999]).expect(400);
        expect(res.body.unknown).toEqual([999_999]);
    });

    it("H10: the total is exact across categories", async () => {
        const priced = await seedScreening({
            rows: ["gold", "platinum", "sofa"],
            seatsPerRow: 2,
            prices: { gold: "199.99", platinum: "0.01", sofa: "250.50" },
        });

        const res = await as(alice).hold(priced.screeningId, [priced.seatIds[0], priced.seatIds[2], priced.seatIds[4]]).expect(200);
        expect(res.body.total).toBe("450.50");
    });
});

describe("the 10-seat limit", () => {
    it("L1: ten seats in one request are allowed", async () => {
        const res = await as(alice).hold(screeningId, seatIds.slice(0, 10)).expect(200);
        expect(res.body.seats).toHaveLength(10);
    });

    it("L2: eleven seat ids in one request are a validation error", async () => {
        await as(alice).hold(screeningId, seatIds.slice(0, 11)).expect(400);
        expect(await liveHeldIds(alice.id, screeningId)).toEqual([]);
    });

    it("L3: six then four more makes ten", async () => {
        await as(alice).hold(screeningId, seatIds.slice(0, 6)).expect(200);
        const res = await as(alice).hold(screeningId, seatIds.slice(6, 10)).expect(200);
        expect(res.body.seats).toHaveLength(10);
    });

    it("L4: six then five more is refused, and the first six stay held", async () => {
        await as(alice).hold(screeningId, seatIds.slice(0, 6)).expect(200);

        const res = await as(alice).hold(screeningId, seatIds.slice(6, 11)).expect(409);
        expect(res.body.message).toMatch(/at most 10/);
        expect(await liveHeldIds(alice.id, screeningId)).toEqual(seatIds.slice(0, 6));
    });

    it("L5: seats already mine are not counted twice", async () => {
        await as(alice).hold(screeningId, seatIds.slice(0, 10)).expect(200);
        const res = await as(alice).hold(screeningId, seatIds.slice(0, 10)).expect(200);
        expect(res.body.seats).toHaveLength(10);
    });

    it("L6: expired holds do not count", async () => {
        await as(alice).hold(screeningId, seatIds.slice(0, 10)).expect(200);
        await expireHolds(alice.id, screeningId);

        await as(alice).hold(screeningId, seatIds.slice(10, 20)).expect(200);
        expect(await liveHeldIds(alice.id, screeningId)).toEqual(seatIds.slice(10, 20));
    });

    it("L7: the limit is per screening", async () => {
        const other = await seedScreening({ rows: ["gold", "gold"], seatsPerRow: 6 });

        await as(alice).hold(screeningId, seatIds.slice(0, 10)).expect(200);
        await as(alice).hold(other.screeningId, other.seatIds.slice(0, 10)).expect(200);
    });

    it("L8: seats already bought do not count towards the limit", async () => {
        await buy(alice, screeningId, seatIds.slice(0, 10));
        await as(alice).hold(screeningId, seatIds.slice(10, 20)).expect(200);
    });
});

describe("expiry", () => {
    it("E1: an expired hold reads as available on the seat map", async () => {
        await as(alice).hold(screeningId, [seatIds[0], seatIds[1]]).expect(200);
        await expireHolds(alice.id, screeningId);

        const map = await as().seatMap(screeningId).expect(200);
        expect(map.body.summary).toEqual({ available: 24, held: 0, booked: 0, total: 24 });
    });

    it("E2: my holds come back empty after expiry", async () => {
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        await expireHolds(alice.id, screeningId);

        const res = await as(alice).myHolds(screeningId).expect(200);
        expect(res.body.seats).toEqual([]);
        expect(res.body.heldUntil).toBeNull();
        expect(res.body.total).toBe("0.00");
    });

    it("E3: another buyer can take an expired seat", async () => {
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        await expireHolds(alice.id, screeningId);

        const res = await as(bob).hold(screeningId, [seatIds[0]]).expect(200);

        const row = await seatRow(seatIds[0]);
        expect(row.heldBy).toBe(bob.id);
        expect(new Date(res.body.heldUntil).getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
        expect((await as(alice).myHolds(screeningId)).body.seats).toEqual([]);
    });

    it("E4: re-holding my own expired seats starts a new window", async () => {
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        await expireHolds(alice.id, screeningId);

        const res = await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        expect(new Date(res.body.heldUntil).getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
    });

    it("E5: a hold whose expiry is exactly now has expired", async () => {
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        await expireHolds(alice.id, screeningId, 0);

        await as(bob).hold(screeningId, [seatIds[0]]).expect(200);
    });

    it("E6: a new seat joins the live window and does not revive an expired seat", async () => {
        await as(alice).hold(screeningId, [seatIds[0], seatIds[1]]).expect(200);
        await db.execute(sql`UPDATE screening_seats SET held_until = now() - interval '1 second' WHERE id = ${seatIds[0]}`);
        const liveUntil = (await seatRow(seatIds[1])).heldUntil!.getTime();

        const res = await as(alice).hold(screeningId, [seatIds[2]]).expect(200);

        expect(await liveHeldIds(alice.id, screeningId)).toEqual([seatIds[1], seatIds[2]]);
        expect(new Date(res.body.heldUntil).getTime()).toBe(liveUntil);
    });

    it("E7: an expired hold does not stop the organizer deleting the screening", async () => {
        const { organizer } = await seedScreening();
        const mine = await seedScreening();

        await as(alice).hold(mine.screeningId, [mine.seatIds[0]]).expect(200);
        await request(app).delete(`/api/screenings/${mine.screeningId}`).set("Cookie", mine.organizer.cookie).expect(409);

        await expireHolds(alice.id, mine.screeningId);
        await request(app).delete(`/api/screenings/${mine.screeningId}`).set("Cookie", mine.organizer.cookie).expect(200);

        // Another organizer's screening looks missing.
        await request(app).delete(`/api/screenings/${screeningId}`).set("Cookie", organizer.cookie).expect(404);
    });
});

describe("releasing holds", () => {
    it("D1: release frees the seats completely", async () => {
        await as(alice).hold(screeningId, [seatIds[0], seatIds[1]]).expect(200);

        const res = await as(alice).release(screeningId).expect(200);
        expect(res.body.released).toBe(2);

        for (const id of [seatIds[0], seatIds[1]]) {
            const row = await seatRow(id);
            expect([row.status, row.heldBy, row.heldUntil, row.bookingId]).toEqual(["available", null, null, null]);
        }
    });

    it("D2: releasing nothing is still a 200", async () => {
        const res = await as(alice).release(screeningId).expect(200);
        expect(res.body.released).toBe(0);
    });

    it("D3: release leaves another buyer's holds alone", async () => {
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        await as(bob).hold(screeningId, [seatIds[1]]).expect(200);

        await as(alice).release(screeningId).expect(200);
        expect(await liveHeldIds(bob.id, screeningId)).toEqual([seatIds[1]]);
    });

    it("D4: release leaves my booked seats alone", async () => {
        const bookingId = await buy(alice, screeningId, [seatIds[0]]);
        await as(alice).hold(screeningId, [seatIds[1]]).expect(200);

        const res = await as(alice).release(screeningId).expect(200);
        expect(res.body.released).toBe(1);

        const row = await seatRow(seatIds[0]);
        expect([row.status, row.bookingId]).toEqual(["booked", bookingId]);
    });

    it("D5: release cancels the pending booking made from those holds", async () => {
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        const created = await as(alice).createBooking(screeningId).expect(201);

        await as(alice).release(screeningId).expect(200);

        expect((await as(alice).booking(created.body.booking.id)).body.booking.status).toBe("cancelled");
        await as(alice).pay(created.body.booking.id).expect(409);
        expect((await seatRow(seatIds[0])).status).toBe("available");
    });

    it("D6: release only affects this screening", async () => {
        const other = await seedScreening();
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        await as(alice).hold(other.screeningId, [other.seatIds[0]]).expect(200);

        await as(alice).release(screeningId).expect(200);
        expect(await liveHeldIds(alice.id, other.screeningId)).toEqual([other.seatIds[0]]);
    });
});

describe("access and input", () => {
    it("A1: signed-out requests are 401", async () => {
        await as().hold(screeningId, [seatIds[0]]).expect(401);
        await as().release(screeningId).expect(401);
        await as().myHolds(screeningId).expect(401);
    });

    it("A2: an unverified user is refused", async () => {
        const unverified = await createUser("buyer", { verified: false });
        const res = await as(unverified).hold(screeningId, [seatIds[0]]).expect(403);
        expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
    });

    it("A3: organizers and admins can buy too", async () => {
        await as(await createUser("organizer")).hold(screeningId, [seatIds[0]]).expect(200);
        await as(await createUser("admin")).hold(screeningId, [seatIds[1]]).expect(200);
    });

    it("A4: a draft show's screening, or a missing one, is a 404", async () => {
        const draft = await seedScreening({ showStatus: "draft" });
        await as(alice).hold(draft.screeningId, [draft.seatIds[0]]).expect(404);
        await as(alice).hold(999_999, [seatIds[0]]).expect(404);
    });

    it("A5: a cancelled screening can't be held", async () => {
        await cancelScreeningRow(screeningId);
        await as(alice).hold(screeningId, [seatIds[0]]).expect(409);
    });

    it("A6: a started screening can't be held", async () => {
        await startScreening(screeningId);
        await as(alice).hold(screeningId, [seatIds[0]]).expect(409);
    });

    it("A7: bad seat lists are 400 and hold nothing", async () => {
        const bad: unknown[] = [[], [seatIds[0], seatIds[0]], [0], [-1], ["abc"], [1.5], "nope", null];
        for (const value of bad) {
            await as(alice).hold(screeningId, value).expect(400);
        }
        await as(alice).holdBody(screeningId, {}).expect(400);

        expect((await seatRows(screeningId)).every((r) => r.status === "available")).toBe(true);
    });

    it("A8: a bad screening id is a 400", async () => {
        await as(alice).hold("abc", [seatIds[0]]).expect(400);
        await as(alice).myHolds("0").expect(400);
        await as(alice).release("-3").expect(400);
    });

    it("A9: my holds never include another buyer's seats", async () => {
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        await as(bob).hold(screeningId, [seatIds[1], seatIds[2]]).expect(200);

        const res = await as(alice).myHolds(screeningId).expect(200);
        expect(res.body.seats.map((s: { id: number }) => s.id)).toEqual([seatIds[0]]);
    });
});
