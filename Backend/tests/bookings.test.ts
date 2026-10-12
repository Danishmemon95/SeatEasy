import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { as, mapStatuses } from "./helpers/api";
import { bookingRow, cancelScreeningRow, closeDb, expireHolds, inventoryProblems, liveHeldIds, resetDb, seatRow, startScreening } from "./helpers/db";
import { createUser, seedScreening, type TestUser } from "./helpers/factories";

/*
 * Bookings and the mock payment, one request at a time (docs/test-plan.md §5).
 * Seats 0-5 are gold (250.00), seats 6-11 platinum (400.00).
 */

let alice: TestUser;
let bob: TestUser;
let screeningId: number;
let seatIds: number[];

/** Holds the seats and checks out, returning the pending booking's id. */
const checkout = async (user: TestUser, ids: number[], onScreening = screeningId) => {
    await as(user).hold(onScreening, ids).expect(200);
    const res = await as(user).createBooking(onScreening).expect(201);
    return res.body.booking.id as number;
};

const bookingSeatIds = async (user: TestUser, bookingId: number) =>
    (await as(user).booking(bookingId).expect(200)).body.booking.seats.map((s: { id: number }) => s.id).sort((a: number, b: number) => a - b);

beforeEach(async () => {
    await resetDb();
    alice = await createUser();
    bob = await createUser();
    ({ screeningId, seatIds } = await seedScreening());
});

afterAll(closeDb);

describe("creating a booking", () => {
    it("B1: turns my holds into a pending booking priced by the server", async () => {
        const ids = [seatIds[0], seatIds[1], seatIds[6]];
        await as(alice).hold(screeningId, ids).expect(200);

        const res = await as(alice).createBooking(screeningId).expect(201);

        expect(res.body.booking.status).toBe("pending");
        expect(res.body.booking.totalAmount).toBe("900.00");
        expect(res.body.booking.seats).toHaveLength(3);
        for (const id of ids) expect((await seatRow(id)).bookingId).toBe(res.body.booking.id);
    });

    it("B2: a total or seat list in the request is ignored", async () => {
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);

        const res = await as(alice)
            .createBooking(screeningId, { totalAmount: "1.00", seatIds: [seatIds[6], seatIds[7]] })
            .expect(201);

        expect(res.body.booking.totalAmount).toBe("250.00");
        expect(res.body.booking.seats.map((s: { id: number }) => s.id)).toEqual([seatIds[0]]);
    });

    it("B3: with nothing held it is a 409", async () => {
        await as(alice).createBooking(screeningId).expect(409);
    });

    it("B4: with expired holds it is a 409 and no booking is created", async () => {
        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        await expireHolds(alice.id, screeningId);

        await as(alice).createBooking(screeningId).expect(409);
        expect((await as(alice).myBookings()).body.bookings).toEqual([]);
    });

    it("B5: checking out twice leaves one pending booking", async () => {
        const first = await checkout(alice, [seatIds[0], seatIds[1]]);
        const second = (await as(alice).createBooking(screeningId).expect(201)).body.booking.id;

        expect((await bookingRow(first)).status).toBe("cancelled");
        expect((await bookingRow(second)).status).toBe("pending");
        expect(await bookingSeatIds(alice, second)).toEqual([seatIds[0], seatIds[1]]);
        expect(await bookingSeatIds(alice, first)).toEqual([]);
    });

    it("B6: a draft, cancelled or started screening can't be booked", async () => {
        const draft = await seedScreening({ showStatus: "draft" });
        await as(alice).createBooking(draft.screeningId).expect(404);

        await as(alice).hold(screeningId, [seatIds[0]]).expect(200);
        await cancelScreeningRow(screeningId);
        await as(alice).createBooking(screeningId).expect(409);

        const started = await seedScreening();
        await as(alice).hold(started.screeningId, [started.seatIds[0]]).expect(200);
        await startScreening(started.screeningId);
        await as(alice).createBooking(started.screeningId).expect(409);
    });

    it("B7: adding a seat and checking out again books all of them", async () => {
        const first = await checkout(alice, [seatIds[0], seatIds[1]]);
        await as(alice).hold(screeningId, [seatIds[2]]).expect(200);

        const second = (await as(alice).createBooking(screeningId).expect(201)).body.booking;

        expect(second.totalAmount).toBe("750.00");
        expect(await bookingSeatIds(alice, second.id)).toEqual(seatIds.slice(0, 3));
        expect((await bookingRow(first)).status).toBe("cancelled");
    });

    it("B8: bad input and signed-out requests are refused", async () => {
        await as().createBooking(screeningId).expect(401);
        await as(alice).createBooking("abc" as unknown as number).expect(400);
        await as(alice).createBooking(999_999).expect(404);
    });
});

describe("paying", () => {
    it("P1: paying confirms the booking and books the seats", async () => {
        const ids = [seatIds[0], seatIds[6]];
        const bookingId = await checkout(alice, ids);

        const res = await as(alice).pay(bookingId).expect(200);

        expect(res.body.booking.status).toBe("confirmed");
        expect(res.body.booking.confirmedAt).not.toBeNull();
        for (const id of ids) {
            const row = await seatRow(id);
            expect([row.status, row.heldBy, row.heldUntil, row.bookingId]).toEqual(["booked", null, null, bookingId]);
        }
        expect(await mapStatuses(screeningId, ids)).toEqual(["booked", "booked"]);
        expect((await as(alice).myHolds(screeningId)).body.seats).toEqual([]);
        expect(await inventoryProblems(screeningId)).toEqual([]);
    });

    it("P2: paying after the hold expired cancels the booking and frees the seats", async () => {
        const ids = [seatIds[0], seatIds[1]];
        const bookingId = await checkout(alice, ids);
        await expireHolds(alice.id, screeningId);

        await as(alice).pay(bookingId).expect(409);

        expect((await bookingRow(bookingId)).status).toBe("cancelled");
        for (const id of ids) {
            const row = await seatRow(id);
            expect([row.status, row.heldBy, row.heldUntil, row.bookingId]).toEqual(["available", null, null, null]);
        }
        expect(await inventoryProblems(screeningId)).toEqual([]);
    });

    it("P3: paying after someone else took the expired seats leaves their hold alone", async () => {
        const ids = [seatIds[0], seatIds[1]];
        const bookingId = await checkout(alice, ids);
        await expireHolds(alice.id, screeningId);
        await as(bob).hold(screeningId, ids).expect(200);

        await as(alice).pay(bookingId).expect(409);

        expect((await bookingRow(bookingId)).status).toBe("cancelled");
        expect(await liveHeldIds(bob.id, screeningId)).toEqual(ids);
        // Bob can still complete his purchase.
        const bobs = (await as(bob).createBooking(screeningId).expect(201)).body.booking.id;
        await as(bob).pay(bobs).expect(200);
        expect(await inventoryProblems(screeningId)).toEqual([]);
    });

    it("P4: paying twice is refused the second time", async () => {
        const bookingId = await checkout(alice, [seatIds[0]]);
        await as(alice).pay(bookingId).expect(200);

        const res = await as(alice).pay(bookingId).expect(409);
        expect(res.body.message).toMatch(/already paid/);
        expect((await seatRow(seatIds[0])).status).toBe("booked");
    });

    it("P5: a cancelled booking can't be paid", async () => {
        const bookingId = await checkout(alice, [seatIds[0]]);
        await as(alice).release(screeningId).expect(200);

        await as(alice).pay(bookingId).expect(409);
        expect((await bookingRow(bookingId)).status).toBe("cancelled");
    });

    it("P6: someone else's booking is a 404 and stays untouched", async () => {
        const bookingId = await checkout(alice, [seatIds[0]]);

        await as(bob).pay(bookingId).expect(404);
        await as(bob).booking(bookingId).expect(404);

        expect((await bookingRow(bookingId)).status).toBe("pending");
        await as(alice).pay(bookingId).expect(200);
    });

    it("P7: paying after the screening was cancelled cancels the booking and frees the seats", async () => {
        const bookingId = await checkout(alice, [seatIds[0]]);
        await cancelScreeningRow(screeningId);

        const res = await as(alice).pay(bookingId).expect(409);
        expect(res.body.message).toMatch(/cancelled/);
        expect((await bookingRow(bookingId)).status).toBe("cancelled");
        expect((await seatRow(seatIds[0])).status).toBe("available");
    });

    it("P8: paying after the screening started cancels the booking and frees the seats", async () => {
        const bookingId = await checkout(alice, [seatIds[0]]);
        await startScreening(screeningId);

        const res = await as(alice).pay(bookingId).expect(409);
        expect(res.body.message).toMatch(/started/);
        expect((await bookingRow(bookingId)).status).toBe("cancelled");
        expect((await seatRow(seatIds[0])).status).toBe("available");
    });

    it("P9: an old booking can't be paid with a newer hold on the same seats", async () => {
        const ids = [seatIds[0], seatIds[1]];
        const oldBooking = await checkout(alice, ids);
        await expireHolds(alice.id, screeningId);
        await as(alice).hold(screeningId, ids).expect(200);

        await as(alice).pay(oldBooking).expect(409);

        expect((await bookingRow(oldBooking)).status).toBe("cancelled");
        expect(await liveHeldIds(alice.id, screeningId)).toEqual(ids);
    });

    it("P10: a seat added after checkout is not part of the paid booking", async () => {
        const bookingId = await checkout(alice, [seatIds[0], seatIds[1]]);
        await as(alice).hold(screeningId, [seatIds[2]]).expect(200);

        const res = await as(alice).pay(bookingId).expect(200);

        expect(res.body.booking.totalAmount).toBe("500.00");
        expect(await mapStatuses(screeningId, seatIds.slice(0, 3))).toEqual(["booked", "booked", "held"]);
        expect(await liveHeldIds(alice.id, screeningId)).toEqual([seatIds[2]]);
        expect(await inventoryProblems(screeningId)).toEqual([]);
    });

    it("P11: bad ids and signed-out requests are refused", async () => {
        await as().pay(1).expect(401);
        await as(alice).pay("abc").expect(400);
        await as(alice).pay(999_999).expect(404);
    });
});

describe("reading bookings", () => {
    it("G1: my bookings are mine only, newest first, with their details", async () => {
        const first = await checkout(alice, [seatIds[0]]);
        await as(alice).pay(first).expect(200);
        const second = await checkout(alice, [seatIds[1]]);
        await checkout(bob, [seatIds[2]]);

        const res = await as(alice).myBookings().expect(200);

        expect(res.body.bookings.map((b: { id: number }) => b.id)).toEqual([second, first]);
        const ticket = res.body.bookings[1];
        expect(ticket.event.title).toBe("Test Show");
        expect(ticket.venue.name).toBe("Test Hall");
        expect(ticket.screening.id).toBe(screeningId);
        expect(ticket.seats).toEqual([expect.objectContaining({ rowLabel: "A", seatNumber: 1, category: "gold", price: "250.00" })]);
    });

    it("G2: the status filter and paging work", async () => {
        const paid = await checkout(alice, [seatIds[0]]);
        await as(alice).pay(paid).expect(200);
        await checkout(alice, [seatIds[1]]);

        const confirmed = await as(alice).myBookings("?status=confirmed").expect(200);
        expect(confirmed.body.bookings.map((b: { id: number }) => b.id)).toEqual([paid]);

        const page = await as(alice).myBookings("?page=2&pageSize=1").expect(200);
        expect(page.body.bookings.map((b: { id: number }) => b.id)).toEqual([paid]);

        await as(alice).myBookings("?status=refunded").expect(400);
    });

    it("G3: one booking: mine, someone else's, missing", async () => {
        const bookingId = await checkout(alice, [seatIds[0]]);

        await as(alice).booking(bookingId).expect(200);
        await as(bob).booking(bookingId).expect(404);
        await as(alice).booking(999_999).expect(404);
        await as().booking(bookingId).expect(401);
    });

    it("G4: a cancelled booking lists no seats", async () => {
        const bookingId = await checkout(alice, [seatIds[0]]);
        await as(alice).release(screeningId).expect(200);

        expect(await bookingSeatIds(alice, bookingId)).toEqual([]);
    });

    // KNOWN BUG, so marked `fails`: createBooking cancels the earlier pending
    // booking but only re-links seats that are still live-held, so seats whose
    // hold expired keep pointing at the cancelled booking and still show on it.
    // Remove `.fails` once that is fixed.
    it.fails("G5: a booking replaced after its hold expired lists no seats", async () => {
        const stale = await checkout(alice, [seatIds[0], seatIds[1]]);
        await expireHolds(alice.id, screeningId);
        await checkout(alice, [seatIds[2]]);

        expect((await bookingRow(stale)).status).toBe("cancelled");
        expect(await bookingSeatIds(alice, stale)).toEqual([]);
    });
});
