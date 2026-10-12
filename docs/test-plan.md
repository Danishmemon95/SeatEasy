# Plan: Automated tests (seat holds first, then the rest)

**Status:** T0–T3 are built (`Backend/tests/`, run with `npm test` in
`Backend/`): 80 tests covering hold rules, hold races, bookings, payment and
their races. One is marked as an expected failure for a known bug (G5: a
booking replaced after its hold expired still lists the expired seats). T4–T7
are not built. This replaces milestone 5 of
[`buyer-flow-plan.md`](buyer-flow-plan.md) and covers the whole project.

**Goal:** prove that two buyers can never end up with the same seat, that a hold
always expires cleanly, and that a booking and its seats never disagree. After
that, cover auth, the organizer rules and the frontend helpers.

**Priority:** T0 → T1 → T2 → T3 are the ones that matter. If time is short,
stop after T4.

---

## 0. What I need from you

| Decision | Default |
| :--- | :--- |
| Where the test database lives | A local Postgres database named `seatease_test`. A Neon branch also works but makes the race tests slow. |
| Who writes the tests | Undecided: say which milestones you want built for you. |
| The six behaviours in §10 | Each is what the code does today. Confirm or change before the tests pin them. |

---

## 1. Decisions (defaults; change any before we start)

1. **Vitest + supertest for the backend.** Tests call the real Express app and a
   real Postgres. Nothing in the hold logic is mocked: the row locks and the
   advisory lock are the thing under test, and a mock cannot prove them.
2. **A separate test database, never the dev one.** The suite truncates every
   table between tests. A global setup refuses to run unless the database name
   ends in `_test`.
3. **Time is controlled through SQL, not fake timers.** Expiry reads the
   database clock (`now()`), so a test expires a hold with
   `UPDATE screening_seats SET held_until = now() - interval '1 second'`.
   "Screening already started" is tested the same way, by moving `starts_at`.
4. **Users are created directly in the database** (verified, with a JWT cookie
   signed from `JWT_SECRET`). Only the auth tests go through `/register` and
   `/login`. This avoids bcrypt on every test and the register rate limiter
   (100 per hour outside production, shared by the whole run).
5. **Mail is never sent.** `MAIL_TRANSPORT=console`, and the auth tests mock
   `sendMail` to capture the link, because the database stores only the token's
   hash.
6. **Test files run one at a time** (`fileParallelism: false`): they share one
   database. Concurrency inside a test comes from `Promise.all`.
7. **Every race test runs 20 times in a loop.** A race that passes once proves
   little.
8. **Vitest for the frontend too** (it already uses Vite), for pure functions
   only. Browser tests (Playwright) are optional and last.

---

## 2. Milestone T0: Test setup

| Item | Change |
| :--- | :--- |
| `Backend/src/app.ts` (new) | Move the Express app out of `server.ts` and export it. `server.ts` keeps only `app.listen` and the boot checks. This is the only production-code change: today importing `server.ts` starts listening, so supertest cannot use it. |
| `Backend/package.json` | Add `vitest`, `supertest`, `@types/supertest`; scripts `test` and `test:races`. |
| `Backend/vitest.config.mts` | `fileParallelism: false`, a 20 s timeout, and the test env values set here. `env.ts` calls `dotenv.config()`, which does not override variables that are already set, so values set by Vitest win over `Backend/.env`. |
| `Backend/.env.test.example` | `NODE_ENV=test`, `DATABASE_URL=...seatease_test`, a `JWT_SECRET`, `MAIL_TRANSPORT=console`. |
| `Backend/tests/globalSetup.ts` | Abort unless the database name ends in `_test`, then run the Drizzle migrations. |
| `Backend/tests/helpers/db.ts` | `resetDb()` (truncate all tables, restart ids), `expireHolds(userId, screeningId)`, `startScreening(id)`, `seatRow(id)`. |
| `Backend/tests/helpers/factories.ts` | `createUser(role)` returning `{ user, cookie }`, and `seedScreening({ rows, seatsPerRow, prices })`, which inserts organizer, venue, seats, published show, screening, prices and `screening_seats`, and returns the seat ids. |

The pool's default size is 10 connections. Keep parallel requests in one test
at 10 or fewer, or the extra requests wait for a connection and slow the test.

**Done when:** `npm test` runs one trivial test against `seatease_test`, and
pointing `DATABASE_URL` at the dev database makes the run abort before it
touches anything.

---

## 3. Milestone T1: Hold rules, one buyer at a time

File `tests/holds.rules.test.ts`. Endpoints: `POST`, `DELETE`
`/api/screenings/:id/holds` and `GET .../holds/me`.

### 3.1 Holding

| # | Case | Expect |
| :--- | :--- | :--- |
| H1 | Hold 2 free seats | 200; `seats` has both; `total` is the sum of their prices; `heldUntil` is about 10 minutes ahead; rows are `held`, `held_by` = me |
| H2 | Seat map after H1 | Those seats read `held`; `summary.held` = 2 |
| H3 | Hold a seat another buyer holds | 409 with `unavailable: [id]` |
| H4 | Hold a booked seat | 409 with `unavailable: [id]` |
| H5 | Hold [free, taken] | 409, `unavailable` lists only the taken one, and the free one is **not** held (all-or-nothing) |
| H6 | Hold the same seats twice | 200 both times; `heldUntil` is unchanged; no duplicates |
| H7 | Hold [1,2], then hold [3] | 200; I now hold 1, 2 and 3; `heldUntil` is still the first window's |
| H8 | Seat id from another screening | 400 with `unknown: [id]`; nothing held |
| H9 | [unknown id, taken id] | 400 (`unknown` is reported first) |
| H10 | Total across categories, e.g. `199.99` + `0.01` + `250.50` | Exactly `"450.50"` (no float drift) |

### 3.2 The 10-seat limit

| # | Case | Expect |
| :--- | :--- | :--- |
| L1 | 10 seats in one request | 200 |
| L2 | 11 seat ids in one request | 400 (validation) |
| L3 | Hold 6, then 4 more | 200, holding 10 |
| L4 | Hold 6, then 5 more | 409 with the "at most 10" message; still holding exactly the first 6 |
| L5 | Hold 10, then re-send the same 10 | 200 (seats already mine are not counted twice) |
| L6 | Hold 10, expire them, hold 10 different seats | 200 (expired holds do not count) |
| L7 | Hold 10 on screening A, then 10 on screening B | 200 (the limit is per screening) |
| L8 | Buy 10, then hold 10 more on the same screening | 200 today; see §10 |

### 3.3 Expiry (lazy, no cleanup job)

| # | Case | Expect |
| :--- | :--- | :--- |
| E1 | Expire my hold, read the seat map | Seats read `available`; `summary` agrees |
| E2 | Expire my hold, `GET holds/me` | 200, `seats: []`, `heldUntil: null`, `total: "0.00"` |
| E3 | Another buyer holds my expired seat | 200; `held_by` is now them, with a fresh `heldUntil` |
| E4 | I re-hold my own expired seats | 200 with a **new** window, not the old expired one |
| E5 | `held_until` exactly equal to `now()` | Treated as expired |
| E6 | Seat [1] expired, seat [2] live (set by SQL), then hold [3] | Joins the live window; seat 1 is not revived |
| E7 | Organizer edits or deletes a screening whose only holds are expired | Allowed (an abandoned checkout must not lock the organizer out) |

### 3.4 Release

| # | Case | Expect |
| :--- | :--- | :--- |
| D1 | Release my holds | 200, `released` = count; rows are `available` with `held_by`, `held_until` and `booking_id` all null |
| D2 | Release with nothing held | 200, `released: 0` |
| D3 | Release does not touch another buyer's holds | Their rows are unchanged |
| D4 | Release does not touch my booked seats | Still `booked`, still linked to the booking |
| D5 | Release with a pending booking | The booking becomes `cancelled`; a later pay returns 409 |
| D6 | Release only affects this screening | My holds on another screening are unchanged |

### 3.5 Access and input

| # | Case | Expect |
| :--- | :--- | :--- |
| A1 | No cookie | 401 on all three endpoints |
| A2 | Unverified user | 403 with `code: EMAIL_NOT_VERIFIED` |
| A3 | Organizer or admin holds seats | 200 (any verified role can buy) |
| A4 | Screening of a draft show, or an id that does not exist | 404 |
| A5 | Cancelled screening | 409 |
| A6 | Screening that has started | 409 |
| A7 | `seatIds` empty, missing, duplicated, zero, negative, or not a number | 400 |
| A8 | `:screeningId` is not a positive integer | 400 |
| A9 | `GET holds/me` never returns another buyer's seats | Only mine |

**Done when:** all of §3 passes, and every 409 and 400 case also asserts the
database rows are unchanged.

---

## 4. Milestone T2: Hold races

File `tests/holds.races.test.ts`. Each case fires its requests together with
`Promise.all` and runs 20 times.

| # | Case | Expect |
| :--- | :--- | :--- |
| R1 | 10 buyers hold the same seat at once | Exactly one 200 and nine 409; the row's `held_by` is the winner |
| R2 | A holds [1,2] while B holds [2,3] | Exactly one wins; the loser holds **none** of its seats; the loser's 409 names seat 2 |
| R3 | A holds [1,2,3] while B sends [3,2,1] | Same as R2, and never a 500 (no deadlock) |
| R4 | 8 buyers each ask for 3 random seats out of 12 | No 500; every winner holds all 3 of its seats; every loser holds 0 |
| R5 | One buyer, two tabs: 6 seats and 6 different seats at once | Exactly one 200 and one 409; the buyer holds 6, never 12 |
| R6 | One buyer double-clicks: the same 4 seats twice at once | Both 200, the same `heldUntil`, 4 rows held |
| R7 | B holds a seat at the moment A's hold on it expires | B gets 200 or 409, and the row ends up owned by exactly one live holder |
| R8 | A releases while B holds the same seats | B gets 200 or 409; if 200, B owns all of them |
| R9 | A releases and re-holds at the same time (two tabs) | No 500; the end state is either "holding them" or "holding none" |

**Checking the tests can fail:** once, remove `.for("update")` from the seat
lock in `holdController.ts` and confirm R1 and R2 fail, then put it back. Do
the same with `lockBuyerScreening` for R5. A race test that still passes
without the lock is not testing the lock.

**Done when:** `npm run test:races` passes 5 runs in a row.

---

## 5. Milestone T3: Bookings and payment

File `tests/bookings.test.ts`, plus `tests/bookings.races.test.ts`.

### 5.1 Create

| # | Case | Expect |
| :--- | :--- | :--- |
| B1 | Hold 3 seats, `POST /bookings` | 201, `pending`, `totalAmount` = the sum of the seat prices, seats linked by `booking_id` |
| B2 | Body includes an extra `totalAmount` or seat list | Ignored; the total comes from the inventory |
| B3 | No holds on that screening | 409 |
| B4 | Holds expired | 409; no booking row is created |
| B5 | Create twice | The first becomes `cancelled`; exactly one `pending` remains and it owns the seats |
| B6 | Draft show, cancelled screening, started screening | 404, 409, 409 |
| B7 | Hold [1,2], create, hold [3], create again | The new booking holds 1, 2 and 3; the old one is cancelled |

### 5.2 Pay

| # | Case | Expect |
| :--- | :--- | :--- |
| P1 | Pay a pending booking with live holds | 200 `confirmed`, `confirmedAt` set; seats `booked` with `held_by` and `held_until` null; the seat map shows `booked` |
| P2 | Pay after the hold expired | 409; booking `cancelled`; seats `available` and unlinked |
| P3 | Pay after another buyer re-held the expired seats | 409; my booking is cancelled; **their** hold is untouched |
| P4 | Pay twice | The second returns 409 "already paid"; nothing changes |
| P5 | Pay a cancelled booking | 409 |
| P6 | Pay someone else's booking | 404 (not 403); the booking is untouched |
| P7 | Screening cancelled after checkout | 409; booking cancelled; seats released |
| P8 | Screening started after checkout | 409; booking cancelled; seats released |
| P9 | Hold expired, I re-held the same seats, then pay the **old** booking | 409; the old booking is cancelled; my new hold survives |
| P10 | Hold [1,2], create, hold [3], pay the first booking | Seats 1 and 2 are booked; seat 3 is still only held |

### 5.3 Read

| # | Case | Expect |
| :--- | :--- | :--- |
| G1 | `GET /bookings/me` | Only mine, newest first, with event, venue, screening and seats |
| G2 | `?status=` filter and pagination | Correct subset and `pagination` meta; an invalid status is 400 |
| G3 | `GET /bookings/:id` for mine, for another buyer's, for a missing id | 200, 404, 404 |
| G4 | A cancelled booking | `seats: []` |

### 5.4 Races

| # | Case | Expect |
| :--- | :--- | :--- |
| BR1 | Two `POST /bookings` at once | Both 201, but exactly one `pending` booking at the end |
| BR2 | Two pays for one booking at once | One 200 and one 409; confirmed once |
| BR3 | Pay and release at once | Either confirmed with booked seats, or cancelled with free seats |
| BR4 | A pays while B holds A's just-expired seats | Either B holds them and A's booking is cancelled, or A's seats are booked and B got 409 |
| BR5 | Pay while the organizer cancels the screening | No 500; the result matches one of the two orders |

**The invariants, checked after every race test:**

- a `booked` seat always points at a `confirmed` booking;
- a `confirmed` booking always has at least one seat, all `booked`, and their prices sum to `total_amount`;
- a `cancelled` booking has no seats;
- no `available` seat has `held_by`, `held_until` or `booking_id` set by a release or a failed payment.

Put these in one helper, `assertInventoryConsistent(screeningId)`, and call it
at the end of every test in T2 and T3.

**Done when:** all of §5 passes and the races pass 5 runs in a row.

---

## 6. Milestone T4: Organizer actions against live holds

File `tests/screenings.holds.test.ts`. This is where the organizer and buyer
lock orders meet.

| # | Case | Expect |
| :--- | :--- | :--- |
| O1 | Edit a screening with a live hold, or with a booked seat | 409 |
| O2 | Edit after the only hold expired | 200 |
| O3 | Delete a screening with a live hold or a booked seat | 409 |
| O4 | Delete a screening that only has cancelled bookings | 409 from the foreign-key backstop, not a 500 |
| O5 | Cancel a screening that has holds and confirmed bookings | 200; confirmed bookings stay `confirmed` and show the screening as cancelled |
| O6 | After a cancel: hold, create booking | 409 for both |
| O7 | Seat map of a cancelled or started screening | 200 with `bookable: false` |
| O8 | Hold and organizer cancel at the same time | No 500 and no deadlock; a hold that returned 200 can no longer be paid |
| O9 | Delete a show with a live hold or sold seats | 409 |
| O10 | Change a venue's seat layout while it has an upcoming screening | 409 (layout locked) |

**Done when:** all pass, and O8 passes 20 times in a row.

---

## 7. Milestone T5: Auth and account mails

File `tests/auth.test.ts`, with `sendMail` mocked to capture links.

| Area | Cases |
| :--- | :--- |
| Register | Valid input creates an unverified user and sends one mail. Duplicate email or username is rejected. Weak password and bad email are 400. The stored token is a hash, never the raw token. |
| Verify | A valid token verifies the user. A used, wrong or expired token is 400. |
| Resend | Sends a new link and invalidates the old one. Same response for an unknown email and an already verified one (no account enumeration). |
| Login | Correct credentials set the cookie. Wrong password and unknown email return the same 401. An unverified user gets 403 `EMAIL_NOT_VERIFIED`. |
| Session | `checkAuth` with a valid, missing, tampered and expired cookie. Logout clears the cookie. A deleted user's token is 401. |
| Forgot / reset | An unknown email gets the same response and no mail. The token is single use and expires after 30 minutes. After a reset, the old password fails, the new one works, and every older session returns 401. A "password changed" mail is sent. |
| Change password | A wrong current password is 400. Success invalidates other sessions. |
| Profile | `PATCH /me` updates the allowed fields only; `role` and `isVerified` cannot be changed through it. |
| Roles | `requireRole` returns 403 for the wrong role on one route per router. |

Lower priority, same milestone:

- **Mail templates** (unit): each has a subject, contains the link and the username, and never prints `undefined`.
- **`mailer.ts`** (unit, `fetch` mocked): console mode sends nothing; a non-2xx from Brevo is logged and never thrown; a timeout does not reject.
- **`sendCap.ts`** (unit): stops at the cap, and resets when the IST date changes.
- **`env.ts`**: `MAIL_TRANSPORT=brevo` without a key fails validation.
- **Rate limiters**: one test that the login limiter returns 429 after its limit. Needs `NODE_ENV=production` for that file, or it takes 100 requests.

**Done when:** all pass with no real mail sent.

---

## 8. Milestone T6: Organizer catalog, applications, public catalog

One file per module. These are ordinary request tests; the rules are listed in
`DOCUMENTATION.md`.

| Module | Cases |
| :--- | :--- |
| Applications | A buyer applies once (a second is 409). Only an admin lists and decides. Approve changes the role to organizer. A second decision is 409. |
| Venues | CRUD. Another organizer's venue is 404. An admin sees all. A venue with screenings cannot be deleted (409). |
| Seats | Add rows; a duplicate row is 409. Edit and delete a seat or a row. Any layout change is 409 while an upcoming screening exists. A seat used by a past screening cannot be deleted. |
| Shows | Create as draft. Publish is one-way (a second publish is 409). Duration cannot change while screenings exist. Delete rules. |
| Screenings | Create builds one `screening_seats` row per seat with the category price. Missing or extra category prices are 400. A venue with no seats is 409. Overlap including the 15-minute buffer on both sides, with the exact boundary allowed. Only the organizer's own venue. A cancelled or started screening cannot be edited. |
| Public catalog | Draft shows never appear. Cities, home and events filters and pagination. An event page lists only scheduled, future screenings. No sign-in is needed. |
| Full path | One test through the API only: apply → approve → venue → seats → show → publish → screening → hold → booking → pay → ticket. It proves the API-built inventory works with holds, since the other tests seed by SQL. |

**Done when:** all pass.

---

## 9. Milestone T7: Frontend

Vitest in `Frontend/`, pure functions first.

| File | Cases |
| :--- | :--- |
| `features/seatmap/suggest.ts` | Same category only. Never a seat already selected or the lost seat itself. Ranked by distance (row difference counts double). At most 3. An adjacent run is found when one exists, with a fallback when it does not. A run must be consecutive seat numbers, not just neighbours in the filtered list. |
| `features/seatmap/selection.ts` | Save and load round trip. Corrupt JSON and non-integer entries return `[]`. Blocked storage does not throw. |
| `features/seatmap/layout.ts` | Seats group into rows in the order A…Z, then AA. |
| `utils/validation.ts`, `utils/catalogValidation.ts` | Each rule, including the boundaries. They must agree with the backend zod schemas. |
| `utils/datetime.ts`, `screenings/groupByDay.ts` | Day grouping around midnight, and formatting. |
| `api/errors.ts` | Code and message extraction, including `EMAIL_NOT_VERIFIED`. |
| `CheckoutPage` countdown (fake timers) | Counts down from `heldUntil`. Applies the server clock offset. Shows the expired modal once at zero. |

Optional, last: **Playwright**, two browser contexts on one screening. Both
select the same seat and click Continue: one reaches checkout, and the other
sees the "just taken" message with suggestions. Then let a hold expire
(shortened by SQL) and check the expired modal and that the seat returns.

**Done when:** `npm test` passes in `Frontend/`.

---

## 10. Behaviours to confirm before the tests pin them

Each is what the code does now. Some differ from the older plan text.

1. **11 seat ids in one request is a 400**, while going over 10 across two
   requests is a 409. `buyer-flow-plan.md` says 409 for both.
2. **Adding seats does not extend the timer.** New seats join the existing
   window. `buyer-flow-plan.md` §3.1 step 5 says the timer is refreshed; the
   code comment explains why it is not.
3. **The limit counts live holds only.** A buyer can pay for 10 seats and then
   hold 10 more on the same screening (case L8).
4. **Cancelling a screening does not clear its live holds.** They stay `held`
   on the seat map until they expire.
5. **Unknown seat ids take priority over taken ones**: a request with both gets
   400, not 409.
6. **`seatIds` values are coerced to numbers**, so `"5"` is accepted, and so is
   `true` (as seat 1). Harmless, but `z.number()` would be stricter.

---

## 11. Out of scope (later)

- Load or stress testing beyond the 10-way races.
- Razorpay: covered by payments milestone P8, which reuses T0 and the invariants helper.
- Booking mails: tested with payments milestone P7.
- Visual regression and accessibility audits.
- **CI:** a GitHub Action with a Postgres service that runs both suites on each push. Add it once T3 is stable.

---

## 12. Order and size

| # | Milestone | Size | Depends on |
| :--- | :--- | :--- | :--- |
| T0 | Setup: `app.ts` split, Vitest, test database, helpers | S | A test database |
| T1 | Hold rules (40 cases) | M | T0 |
| T2 | Hold races (9 cases) | M | T1 |
| T3 | Bookings and payment (26 cases) | M | T1 |
| T4 | Organizer actions against holds (10 cases) | S | T3 |
| T5 | Auth and account mails | M | T0 |
| T6 | Organizer catalog, applications, public catalog | L | T0 |
| T7 | Frontend unit tests (+ optional Playwright) | M | none |
