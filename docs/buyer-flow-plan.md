# Plan: Buyer flow (browse → seats → hold → book)

**Status:** Backend milestones 1–4 implemented (schema, public catalog, holds, bookings). Milestone 5 (tests) skipped for now. Frontend (Milestone 6) not started.

**Decisions made:** any signed-in, verified user can buy (no role check); holds last 10 minutes and booking stays open until the screening starts; at most 10 seats held at once per screening (later bookings may add more); adding seats joins the existing hold window instead of restarting it; no `optionalAuth` (the frontend reads its own holds from `holds/me`).
**Scope:** Backend (public catalog, holds, bookings) and Frontend (buyer pages, seat map, checkout).
**Builds on:** the organizer flow (venues, seat layouts, events, screenings) and the
`screening_seats` inventory that `createScreening` already fills.

How to use this doc: do the milestones **in order**. Each one ends with a
**Done when** check. Run it, then ask for a review before moving on. Backend
milestones come first because the frontend can't be tested without them.

---

## 0. The flow in one picture

```
Browse published events ──► Event page (its upcoming screenings)
        │                              │
        │                              ▼
        │                  Seat map for one screening   (anyone can look)
        │                              │ select seats locally (max 10)
        │                              ▼
        │                  "Continue" ─► POST holds      (must be signed in)
        │                              │ 10-minute timer starts
        │                              ▼
        │                  Checkout ─► POST booking (pending) ─► POST pay (mock)
        │                              │
        ▼                              ▼
   My bookings  ◄──────────────  Booking confirmed: seats are now "booked"
```

A seat's life in `screening_seats`:

```
available ──hold──► held (heldBy = me, heldUntil = now + 10 min)
   ▲                   │            │
   │   expires/release │            │ pay
   └───────────────────┘            ▼
                                 booked (bookingId set)  ← this row IS the ticket
```

**Lazy expiry:** there is no background job. A `held` seat whose `heldUntil` is
in the past is treated as `available` everywhere it is read or written.
Write that rule once as a helper and use it everywhere (§2.3).

---

## 1. Milestone 1: Schema changes (one migration)

The current schema can't say **who** holds a seat. Without that, "release my
holds" and "book my held seats" are impossible.

| Change | Why |
| :--- | :--- |
| `screening_seats.held_by` → `integer`, nullable, FK `users.id` | Whose hold it is |
| index on `screening_seats (screening_id, status)` | Seat map and hold queries filter on both |
| index on `bookings (user_id)` | "My bookings" |
| *(optional)* `bookings.confirmed_at` timestamp | Show when it was paid |

Steps: edit `db/schema.ts`, then `npx drizzle-kit generate`, read the SQL it
writes into `drizzle/`, then apply it the way earlier migrations were applied.

**Rules to keep in mind from now on:**
- `held_by` and `held_until` are set **together** and cleared **together**.
- `booking_id` is set when a booking is created from holds, and stays set once booked.

**Done when:** the migration applies cleanly and the existing organizer flow
still works. Scheduling a screening must still build its inventory.

---

## 2. Milestone 2: Public catalog API (read-only, no login)

New module: `src/Catalog/` (routes + controller + schemas), mounted at
`/api/catalog`. There's **no `protectRoute`**: buyers browse signed out.

### 2.1 Endpoints

| Method | Path | Returns |
| :--- | :--- | :--- |
| GET | `/catalog/events?city=&date=&type=&page=` | Published events that have **at least one upcoming scheduled screening**, plus each event's next showtime and its cities. |
| GET | `/catalog/events/:showId` | One published event, plus its upcoming scheduled screenings (venue name/city, start/end, min price). |
| GET | `/catalog/screenings/:screeningId/seats` | The seat map: every seat with row, number, category, price and **effective status**. Also the screening, event title and per-category prices. |

### 2.2 Rules

- Only `shows.status = 'published'`. A draft is a **404**, not a 403, the same "not yours looks missing" rule as `ownerScope`.
- "Upcoming" means `screenings.status = 'scheduled' AND starts_at > now()`.
  A cancelled or started screening's seat map should be a 404, or at least read-only.
- `city` filters on `venues.city` (case-insensitive). `date` is an IST calendar day. Convert it to a UTC range on the server.
- The seat-map response must not leak **who** holds a seat: never send `heldBy`.
- The response is the same for everyone. To show "your" held seats, the frontend
  also calls `GET /screenings/:id/holds/me` (Milestone 3, signed in only) and
  marks those ids itself. So there's no auth middleware on the catalog at all.

### 2.3 Effective status (write once, reuse)

```
effective = booked                              if status = 'booked'
          = held                                if status = 'held' and held_until > now()
          = available                           otherwise (including expired holds)
```

Do it in SQL (`CASE WHEN … END`) so the seat map is one query: a join of
`screening_seats` → `seats` ordered by row label length, label, seat number
(the same order as `GET /venues/:id/seats`).

### 2.4 Hint: avoid N+1 on the events list

Get the page of events first, then **one** query for "next screening + cities"
for those event ids, then merge in JS. `loadPricesAndCounts` in
`screeningController.ts` uses the same pattern. Copy its shape.

**Done when:** with an organizer's published event and a scheduled screening,
you can `curl` all three endpoints **without a cookie**. A draft event returns
404, and the seat map shows every seat as `available`.

---

## 3. Milestone 3: Seat holds (the hard part)

Module `src/Holds/` (or inside a `Booking/` module). Signed in: `protectRoute`.
Any role can buy.

| Method | Path | Body | Result |
| :--- | :--- | :--- | :--- |
| POST | `/screenings/:screeningId/holds` | `{ seatIds: number[] }` (screening_seats ids, 1–10) | `{ heldUntil, seats }`, or **409** `{ message, unavailable: [ids] }` |
| DELETE | `/screenings/:screeningId/holds` | — | Releases all of **my** holds on that screening |
| GET | `/screenings/:screeningId/holds/me` | — | My current holds plus `heldUntil` (so a page refresh can resume the timer) |

### 3.1 The transaction, step by step

```
BEGIN
1. Check the screening: scheduled, starts_at > now, show published. Otherwise 404/409.
2. SELECT the requested screening_seats rows
     WHERE screening_id = :id AND id IN (:seatIds)
     ORDER BY id                       ← always the same order, which prevents deadlocks
     FOR UPDATE                        ← two buyers can't both pass step 3
3. Every row must exist and be effectively available, or already held by me.
   If any isn't, ROLLBACK and return 409 with the ids that aren't (all-or-nothing).
4. Count my other live holds on this screening. More than 10 in total → 409.
5. UPDATE those rows: status='held', held_by=me, held_until=now()+10 min.
   One hold window for all my seats on this screening: also refresh
   held_until on my existing holds, so the timer is single.
COMMIT
```

**Why `FOR UPDATE` matters:** without it, two requests can both read
"available" before either writes, and both buyers "win" the same seat. This is
the race your docs promise to handle, and it's what the tests in Milestone 5 prove.

### 3.2 Rules

- Seat ids are `screening_seats.id`, not `seats.id`. They're already per-screening.
- Use the `HttpError` + `db.transaction` pattern from `screeningController.ts`.
- Release only touches rows where `held_by = me AND status = 'held'`.
- Update `hasSoldSeats` (in `screeningRules.ts`) so an **expired** hold no longer
  counts as sold. Otherwise organizers stay locked out of editing forever after
  an abandoned hold.

**Done when:** two terminals holding the same seat at the same moment (two
`curl`s run with `&`) give exactly one 200 and one 409. A hold expires after 10
minutes with no cleanup job (the seat map shows it available). Release frees
the seats immediately.

---

## 4. Milestone 4: Bookings (mock payment)

Module `src/Bookings/`, `protectRoute`.

| Method | Path | Body | Result |
| :--- | :--- | :--- | :--- |
| POST | `/bookings` | `{ screeningId }` | Creates a **pending** booking from **my live holds** on that screening. 201 `{ booking }`, or 409 if I hold nothing (or my holds expired). |
| POST | `/bookings/:bookingId/pay` | — | Mock payment: confirms the booking and flips its seats to `booked`. |
| GET | `/bookings/me` | `?page` | My bookings, newest first: event, venue, showtime, seats (row + number), total, status. |
| GET | `/bookings/:bookingId` | — | One of **my** bookings (someone else's is a 404). This is the ticket page. |

### 4.1 Create (in one transaction)

1. Lock my live held seats for the screening `FOR UPDATE`, ordered by id.
2. None → 409 "Your seats were released. Please choose again."
3. `total_amount` = the sum of their `price`, calculated **on the server** and never taken from the client.
4. Insert the booking (`pending`), then set `booking_id` on those seats.

### 4.2 Pay (in one transaction)

1. Lock the booking (`FOR UPDATE`). It must be mine and `pending`.
2. Lock its seats. Every one must still be `held` by me with `held_until > now()`.
   If not, mark the booking `cancelled`, clear those seats, and return 409.
3. Seats → `status='booked'`, `held_until=null`. Keep `held_by`, or clear it, but stay consistent.
4. Booking → `confirmed` (+ `confirmed_at`, `updated_at`).

### 4.3 Edge cases to decide (write your decision in a code comment)

- A pending booking abandoned before paying: its seats expire like any hold, and
  a later `pay` fails cleanly per 4.2 step 2.
- An organizer cancels a screening that has confirmed bookings: bookings stay, and
  "My bookings" shows the screening as cancelled. Refunds are out of scope.

**Done when:** hold → create booking → pay gives a confirmed booking whose
seats show `booked` on the seat map. Paying after the 10 minutes expire gives
409, and the booking ends `cancelled`.

---

## 5. Milestone 5: Tests for the races (before the frontend)

The project has no tests yet. Start here, because this is where bugs hide.
Suggested: **Vitest** + a separate test database (`DATABASE_URL` for tests),
calling the controllers through `supertest`.

Minimum set:
1. **Double hold:** 10 parallel hold requests for the same seat → exactly 1 succeeds.
2. **Overlapping sets:** A holds [1,2], B holds [2,3] at the same time → one fails, and nothing is half-held.
3. **Expiry:** set `held_until` in the past directly in SQL → the seat map shows available, and another buyer can hold it.
4. **Book after expiry:** pay fails, the booking is cancelled, and the seats are free.
5. **Limit:** 11 seats → 409.

**Done when:** the suite passes repeatedly (run it 5 times; race tests must not be flaky).

---

## 6. Milestone 6: Buyer frontend

> **Superseded by the detailed plan in [`Frontend/docs/buyer-frontend-plan.md`](../Frontend/docs/buyer-frontend-plan.md).** The outline below is kept for history.

### 6.1 API slice

New `api/buyerApi.ts` with one `createApi`, so that holds and bookings can
invalidate the seat map:
- tags: `CatalogEvent`, `SeatMap`, `MyHolds`, `Booking`
- `holdSeats` / `releaseHolds` invalidate `SeatMap:{screeningId}` and `MyHolds:{screeningId}`
- `createBooking` / `payBooking` invalidate `Booking` and `SeatMap`
- The seat map is the public seat query plus `getMyHolds` (skipped when signed out).
- Use the shared `baseQuery.ts`. Copy the 401 handling idea from `catalogApi.ts`.
- Types in `types/buyer.types.ts`.

### 6.2 Routes (public, no `ProtectedRoute` for browsing)

```
/                              → event browse (replace the current redirect to /account)
/events/:showId                → event page with its showtimes, grouped by day
/screenings/:screeningId/seats → seat map (public to view)
/checkout/:screeningId         → checkout                   ProtectedRoute
/bookings                      → My bookings                ProtectedRoute
/bookings/:bookingId           → ticket                     ProtectedRoute
```

Buyer pages use a **buyer layout** (header + wide content), not the organizer
shell. `AppHeader` currently shows only for signed-in users, so you need a
version for signed-out visitors (logo, "Sign in"). Add a "My bookings" link for
signed-in users.

### 6.3 Seat map (design.md §10 is the spec. Read it first.)

- **Reuse, don't copy:** the row-building logic in `features/venues/SeatLayoutMap.tsx`
  (`buildRows`, gaps as aisles, row labels) works the same here. Move it to a
  shared file and give the buyer map its own seat rendering for the five states
  (available, selected, held, booked, and held-by-me).
- **Selection is local** until "Continue": clicking toggles "selected" in
  component state (max 10). No request per click.
- **Continue** → if signed out, go to `/login` with `state.from` (the seat map URL),
  then come back. Keep the selection in `sessionStorage` so it survives.
  If signed in, call `holdSeats(selected)`:
  - 200 → go to checkout.
  - 409 → **conflict recovery** (§10.8): mark the `unavailable` seats taken, toast
    "C14 was just taken", and offer up to 3 same-category seats nearby. Never "start over".
- **Polling:** `pollingInterval: 8000` on the seat-map query (3000 when more than 80% sold).
  If a selected seat becomes held or booked by someone else, apply the same conflict recovery.
- **Legend** always visible: categories with prices, plus state swatches.
- Keyboard: copy the roving-tabindex approach from `SeatLayoutMap`.

### 6.4 Checkout and timer

- The timer counts down to `heldUntil` **from the server** (`GET holds/me`), never
  a client-side 10:00, so a refresh resumes correctly. Styling rules: design.md §10.7.
- At 0: a calm modal ("Your seats were released"), offering to re-select them if still free.
- Show the seats, per-seat price and total from the **server's** booking response.
- "Pay" (mock) → `createBooking` then `payBooking` → the ticket page with a toast.
- Leaving checkout should call `releaseHolds` (on a Cancel button; don't rely on page unload).

### 6.5 My bookings and the ticket

- A list with `StatusBadge` (reuse the component): confirmed / pending / cancelled, plus "Screening cancelled" when the screening is.
- Ticket page: event, venue, showtime (IST, using `formatShowtime`), seats, total, booking id.
  A QR code is out of scope.

**Done when:** the full path works signed out → sign in → back on the seat map
with your selection → hold → checkout → pay → ticket. A second browser sees
those seats as booked within 8 seconds.

---

## 7. Order and size (rough)

| # | Milestone | Size | Depends on |
| :- | :--- | :--- | :--- |
| 1 | Schema: `held_by` + indexes | S | — |
| 2 | Public catalog API | M | 1 |
| 3 | Holds | M–L | 1, 2 |
| 4 | Bookings + mock pay | M | 3 |
| 5 | Race tests | M | 3, 4 |
| 6a | Browse + event page | M | 2 |
| 6b | Seat map + conflict recovery | L | 2, 3 |
| 6c | Checkout, timer, My bookings, ticket | M | 4 |

6a can start as soon as 2 is done, in parallel with 3–5.

## 8. Out of scope (later)

Real payments, refunds on organizer cancellation, booking cancellation by the
buyer, emailed tickets and QR codes, zone/GA seating, zoom/pan maps (design.md §10.5–10.6).

## 9. How we work

- One milestone at a time. When its **Done when** passes, ask me to review.
  I'll read the diff for correctness (especially locking and expiry), not style.
- Stuck? Tell me the milestone and step, what you tried, and the exact error.
  I'll point you to the fix rather than rewrite it, unless you ask me to.
