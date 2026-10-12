import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { as } from "./helpers/api";
import { closeDb, expireHolds, inventoryProblems, liveHeldIds, resetDb, seatRow } from "./helpers/db";
import { createUser, seedScreening, type TestUser } from "./helpers/factories";

/*
 * Seat hold races (docs/test-plan.md §4). Requests are fired together and the
 * outcome is checked in the database, not only in the status codes. Each case
 * repeats, because a race that passes once proves little.
 */

const ROUNDS = 20;

let screeningId: number;
let seatIds: number[];

const buyers = (n: number) => Promise.all(Array.from({ length: n }, () => createUser()));
const statuses = (responses: { status: number }[]) => responses.map((r) => r.status).sort();
const count = (responses: { status: number }[], status: number) => responses.filter((r) => r.status === status).length;

const fresh = async () => {
    await resetDb();
    ({ screeningId, seatIds } = await seedScreening({ rows: ["gold", "gold"], seatsPerRow: 6 }));
};

/** Runs `round` ROUNDS times, each on a clean database, then checks the inventory. */
const repeat = async (round: () => Promise<void>) => {
    for (let i = 0; i < ROUNDS; i++) {
        await fresh();
        await round();
        expect(await inventoryProblems(screeningId)).toEqual([]);
    }
};

beforeEach(fresh);
afterAll(closeDb);

describe("hold races", () => {
    it("R1: ten buyers ask for the same seat, exactly one gets it", async () => {
        await repeat(async () => {
            const users = await buyers(10);
            const responses = await Promise.all(users.map((u) => as(u).hold(screeningId, [seatIds[0]])));

            expect(count(responses, 200)).toBe(1);
            expect(count(responses, 409)).toBe(9);

            const winner = users[responses.findIndex((r) => r.status === 200)];
            expect((await seatRow(seatIds[0])).heldBy).toBe(winner.id);
        });
    });

    it("R2: overlapping sets, one wins and the loser holds nothing", async () => {
        await repeat(async () => {
            const [a, b] = await buyers(2);
            const [ra, rb] = await Promise.all([
                as(a).hold(screeningId, [seatIds[0], seatIds[1]]),
                as(b).hold(screeningId, [seatIds[1], seatIds[2]]),
            ]);

            expect(statuses([ra, rb])).toEqual([200, 409]);

            const [winner, loser, lost] = ra.status === 200 ? [a, b, rb] : [b, a, ra];
            expect(lost.body.unavailable).toEqual([seatIds[1]]);
            expect(await liveHeldIds(loser.id, screeningId)).toEqual([]);
            expect(await liveHeldIds(winner.id, screeningId)).toHaveLength(2);
        });
    });

    it("R3: the same seats in opposite order never deadlock", async () => {
        await repeat(async () => {
            const [a, b] = await buyers(2);
            const forward = seatIds.slice(0, 4);
            const [ra, rb] = await Promise.all([
                as(a).hold(screeningId, forward),
                as(b).hold(screeningId, [...forward].reverse()),
            ]);

            expect(statuses([ra, rb])).toEqual([200, 409]);
            const loser = ra.status === 200 ? b : a;
            expect(await liveHeldIds(loser.id, screeningId)).toEqual([]);
        });
    });

    it("R4: eight buyers ask for overlapping random sets, nobody is left half-held", async () => {
        await repeat(async () => {
            const users = await buyers(8);
            const wanted = users.map(() => [...seatIds].sort(() => Math.random() - 0.5).slice(0, 3));
            const responses = await Promise.all(users.map((u, i) => as(u).hold(screeningId, wanted[i])));

            for (const [i, res] of responses.entries()) {
                expect([200, 409]).toContain(res.status);
                const held = await liveHeldIds(users[i].id, screeningId);
                expect(held).toEqual(res.status === 200 ? [...wanted[i]].sort((x, y) => x - y) : []);
            }
            expect(count(responses, 200)).toBeGreaterThanOrEqual(1);
        });
    });

    it("R5: one buyer in two tabs can't get past ten seats", async () => {
        await repeat(async () => {
            const [a] = await buyers(1);
            const responses = await Promise.all([
                as(a).hold(screeningId, seatIds.slice(0, 6)),
                as(a).hold(screeningId, seatIds.slice(6, 12)),
            ]);

            expect(statuses(responses)).toEqual([200, 409]);
            expect(await liveHeldIds(a.id, screeningId)).toHaveLength(6);
        });
    });

    it("R6: a double click holds the seats once, in one window", async () => {
        await repeat(async () => {
            const [a] = await buyers(1);
            const ids = seatIds.slice(0, 4);
            const [r1, r2] = await Promise.all([as(a).hold(screeningId, ids), as(a).hold(screeningId, ids)]);

            expect(statuses([r1, r2])).toEqual([200, 200]);
            expect(r1.body.heldUntil).toBe(r2.body.heldUntil);
            expect(await liveHeldIds(a.id, screeningId)).toEqual(ids);
        });
    });

    it("R7: several buyers race for a seat whose hold just expired", async () => {
        await repeat(async () => {
            const [old, ...rest] = await buyers(6);
            await as(old).hold(screeningId, [seatIds[0]]).expect(200);
            await expireHolds(old.id, screeningId);

            const responses = await Promise.all(rest.map((u) => as(u).hold(screeningId, [seatIds[0]])));

            expect(count(responses, 200)).toBe(1);
            expect(count(responses, 409)).toBe(4);
            const winner = rest[responses.findIndex((r) => r.status === 200)];
            expect((await seatRow(seatIds[0])).heldBy).toBe(winner.id);
        });
    });

    it("R8: a release racing another buyer's hold leaves one clear owner", async () => {
        await repeat(async () => {
            const [a, b] = await buyers(2);
            const ids = seatIds.slice(0, 3);
            await as(a).hold(screeningId, ids).expect(200);

            const [released, taken] = await Promise.all([as(a).release(screeningId), as(b).hold(screeningId, ids)]);

            expect(released.status).toBe(200);
            expect([200, 409]).toContain(taken.status);
            expect(await liveHeldIds(a.id, screeningId)).toEqual([]);
            expect(await liveHeldIds(b.id, screeningId)).toEqual(taken.status === 200 ? ids : []);
        });
    });

    it("R9: releasing and re-holding in two tabs ends in one of the two clean states", async () => {
        await repeat(async () => {
            const [a] = await buyers(1);
            const ids = seatIds.slice(0, 3);
            await as(a).hold(screeningId, ids).expect(200);

            const [released, held] = await Promise.all([as(a).release(screeningId), as(a).hold(screeningId, ids)]);

            expect([released.status, held.status]).toEqual([200, 200]);
            const after = await liveHeldIds(a.id, screeningId);
            expect([[], ids]).toContainEqual(after);
        });
    });
});
