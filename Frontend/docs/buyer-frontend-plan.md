# Plan: Buyer frontend (browse → seat map → checkout → tickets)

**Status:** Frontend not started. The backend for §0 (city, home, cities) is done (B0.5); migration `0009` adds `users.city` and must be applied before running the backend.
**Scope:** `Frontend/src` only. The backend is done (`docs/buyer-flow-plan.md`, Milestones 1–4).
**Spec:** design.md §10 (seat map), §10.7 (timer), §10.8 (conflict recovery), §10.9 (polling), §11.1 (customer surface).

---

## 0. City-first home (the BookMyShow pattern)

Everything a buyer sees is **for one city**. The city is chosen once, saved,
shown in the header, and changeable at any time. The home page `/` is where
everyone lands: signed out, after login, and after verifying their email.

### 0.1 Where the city comes from

| Who | Where it's stored | Notes |
| :--- | :--- | :--- |
| Signed-out visitor | `localStorage['seatease:city']` | Asked on the first visit to `/` |
| Signed-in user | `users.city` on the server (new column) | Follows them across devices; returned by `checkAuth`/login |

**The current city** is the user's `city` when signed in, otherwise the
`localStorage` value, otherwise none, which opens the picker.

**On login or verification:** if the server has no city but `localStorage`
does, save it to the server silently (`PATCH /auth/me`). If both exist, **the
server wins**, and `localStorage` is overwritten. One rule, no prompt.

**Every change is saved:** when a signed-in user picks a city, call
`PATCH /auth/me { city }` immediately, then write the returned `user` into the
`checkAuth` cache (`authApi.util.upsertQueryData`), as verify-email already does.
That avoids a refetch, and the header updates at once. Also write `localStorage`,
so a later sign-out keeps the same city.

**A city is required** (decided). With no city, `/` shows only the blocking
picker: no header content, no sections.

### 0.2 The flows

```
First visit (signed out)
  /  ──no city──►  City picker (blocking modal)  ──pick──►  localStorage  ──►  Home for that city

Register
  /register ─► "check your email" ─► click the link ─► /verify (now signed in)
       ─► user.city empty? ─► City picker (prefilled with the localStorage city, if any)
       ─► PATCH /auth/me { city } ─► redirect to /

Login
  /login ─► (state.from set? go there : go to /)
       ─► user.city empty? ─► City picker on arrival (same component)

Change city (any time)
  Header "📍 Bhavnagar ▾" ─► City picker (closable modal) ─► save
       (PATCH when signed in, localStorage otherwise) ─► home reloads for the new city
```

Every role lands on `/`. Organizers and admins reach their portals from the
header ("Organizer", "Admin"), as today.

### 0.3 The city picker (one component, two modes)

- **Blocking** (no city yet): a modal or full-screen sheet on mobile that can't be dismissed.
- **Closable** (changing city): the same UI, with a close button.
- Content:
  - a search box, filtering as you type
  - **"Popular cities"**: cities that have upcoming events, each with its count ("Bhavnagar · 12 events"), from a new `GET /catalog/cities`
  - "Detect my location" is **out of scope**: it needs a geocoding service.
- Picking a city with no events is impossible from the list, because the list
  only has cities with events. A typed city that matches nothing shows "No
  events in Rajkot yet" with the list still visible.

### 0.4 Header

- **Left:** logo → `/`.
- **Next to it:** a **city button** showing the current city name with a pin and
  a chevron, on every buyer page and in both signed-out and signed-in states.
  On mobile it collapses to the pin and a short name.
- **Right, signed out:** "Sign in", "Create account".
  **Signed in:** "My bookings", plus Organizer/Admin by role, plus the user menu.

### 0.5 Home `/`: sections for the current city

From top to bottom:

1. **Hero carousel**: up to 5 events with the **soonest showtimes in this city**
   (the next 7 days). Large poster, title, "Tonight 7:30 pm · Mexus Cinemas", "Book" →
   the event page. Auto-advance is **off** (calm, design.md §1.4). Arrows, dots and swipe.
2. **"This weekend"** row: events with a screening this Saturday or Sunday (IST). Hidden if empty.
3. **One row per category**, in this order: Movies, Concerts, Plays, Comedy, Sports, Other.
   Each row is a horizontal scroll of poster cards (2:3, title, language · age,
   "From ₹250"), with **"See all →"** linking to `/explore?type=movie`.
   **Rows with no events are hidden.** If every row is empty, show "Nothing on in
   Bhavnagar yet", the "Popular cities" list and a "Change city" button.

Carousels and rows: CSS `scroll-snap`, keyboard reachable, arrow buttons on
desktop, swipe on touch, and no horizontal page scroll. No new library is needed.

### 0.6 Explore `/explore`: the full filtered list

This is §4.1's browse page, moved off `/`. It's the "See all" target.
- Filters: type and date chips, all in the URL. The city is **not** a filter here,
  because it always uses the current city from the header.

### 0.7 Backend for this (done)

| Change | Shape |
| :--- | :--- |
| `users.city` varchar(100), nullable (migration `0009`) | — |
| `city` in session responses | `user: { id, username, email, role, isVerified, city }` from `checkAuth`, login and verify |
| `PATCH /auth/me` (signed in, any role; not rate-limited, like `checkAuth`) | Body `{ city }` (trimmed, 2–100, strict: other fields → 400). Returns `{ user }` in the same shape as `checkAuth`. |
| `GET /catalog/cities` (public) | `cities: [{ city, eventCount }]`: only cities with at least one bookable published event, most events first; case variants merged |
| `GET /catalog/home?city=` (public; `city` required) | `{ city, featured: Card+{ nextScreening: { id, startsAt, venue { id, name, city } } }[] (≤5, next 7 days, soonest first), weekend: { total, events: Card[] (≤12) }, sections: [{ type, total, events: Card[] (≤12) }] }`. Empty sections are omitted. |

`Card = { id, title, type, genre, language, durationMinutes, ageRating, posterUrl, nextScreeningAt, minPrice }`.
`GET /catalog/events?city=&type=&date=` (the explore and "See all" list) now also returns `minPrice` on each event.

**City spelling risk:** venue cities are free text typed by organizers, so
"Ahmedabad" and "Ahmadabad" would be two cities. Matching is already
case-insensitive. A real fix (a cities table, plus a dropdown in the organizer's
venue form) is noted for later; it isn't needed to ship this.

---

## 1. What the backend gives us

Base `VITE_API_URL` (default `http://localhost:5000/api`), cookies via `credentials: 'include'`.

### 1.1 Public catalog (no login)

| Endpoint | Response (inside `{ success, message, … }`) |
| :--- | :--- |
| `GET /catalog/events?city&date&type&page&pageSize` | `events: CatalogEvent[]`, `pagination`. Each event: `id, title, type, genre, language, durationMinutes, ageRating, posterUrl, nextScreeningAt, cities: string[]`. Only published events with an upcoming screening (matching the filters). `date` is an IST day `YYYY-MM-DD`. |
| `GET /catalog/events/:showId` | `event: { …CatalogEvent fields, description, screenings: Showtime[] }`. Each showtime: `id, startsAt, endsAt, venue { id, name, city, address }, minPrice ("250.00" or null), seatsAvailable, seatsTotal`. Upcoming only, soonest first. 404 for a draft or missing event. |
| `GET /catalog/screenings/:id/seats` | `screening { id, startsAt, endsAt, status, bookable }`, `event { id, title, durationMinutes, ageRating, posterUrl }`, `venue { id, name, city, address }`, `prices { gold?, platinum?, sofa? }`, `seats: MapSeat[]`, `summary { available, held, booked, total }`. `MapSeat = { id, rowLabel, seatNumber, category, price, status: 'available' \| 'held' \| 'booked' }`, ordered A…Z, AA…, then by number. **`id` is the screening-seat id used by holds.** |

### 1.2 Holds (signed in, any role)

| Endpoint | Success | Errors |
| :--- | :--- | :--- |
| `POST /screenings/:id/holds` `{ seatIds }` (1–10) | `MyHolds` | 400 `{ unknown: ids }`, **409 `{ message, unavailable: ids }`** (taken), 409 limit (more than 10 held), 409 screening cancelled/started, 404 |
| `DELETE /screenings/:id/holds` | `{ released }` | — (also cancels my pending booking) |
| `GET /screenings/:id/holds/me` | `MyHolds` (empty: `seats: []`, `heldUntil: null`) | — |

`MyHolds = { screeningId, heldUntil (ISO, server clock), seats: [{ id, rowLabel, seatNumber, category, price }], total: "1234.50" }`.
Holds last **10 minutes**. Adding seats **joins the existing window** and doesn't restart it.

### 1.3 Bookings (signed in)

| Endpoint | Success | Errors |
| :--- | :--- | :--- |
| `POST /bookings` `{ screeningId }` | 201 `{ booking }` (pending; total from the server) | 409 "no seats held / hold expired" |
| `POST /bookings/:id/pay` | `{ booking }` (confirmed) | **409 = the booking was cancelled and its seats released** (hold expired, or screening cancelled/started); 409 already paid |
| `GET /bookings/me?status&page` | `{ bookings, pagination }`, newest first | — |
| `GET /bookings/:id` | `{ booking }` | 404 (also someone else's) |

`Booking = { id, status: pending|confirmed|cancelled, totalAmount, createdAt, confirmedAt, screening { id, startsAt, endsAt, status }, event { id, title, posterUrl, ageRating }, venue { id, name, city, address }, seats: [{ id, rowLabel, seatNumber, category, price }] }`.
A cancelled booking has `seats: []`, because its seats went back to the screening.

---

## 2. Architecture

### 2.1 API slice: `src/api/buyerApi.ts` (new `createApi`)

The buyer slice is separate from `catalogApi`, which is organizer data with different tags. Holds and bookings live in it so they can invalidate the seat map.

| Endpoint | provides | invalidates (on success) |
| :--- | :--- | :--- |
| `getCatalogEvents(query)` | `CatalogEvent:LIST` | — |
| `getCatalogEvent(showId)` | `CatalogEvent:{id}` | — |
| `getSeatMap(screeningId)` | `SeatMap:{id}` | — |
| `getMyHolds(screeningId)` | `MyHolds:{id}` | — |
| `holdSeats({ screeningId, seatIds })` | — | `SeatMap:{id}`, `MyHolds:{id}`. **Also on 409**, so the map shows who took what. |
| `releaseHolds(screeningId)` | — | `SeatMap:{id}`, `MyHolds:{id}`, `Booking:LIST` |
| `createBooking({ screeningId })` | — | `Booking:LIST` |
| `payBooking({ bookingId, screeningId })` | — | `Booking:LIST`, `Booking:{id}`, `SeatMap:{screeningId}`, `MyHolds:{screeningId}`. Also on 409, because the seats were released. |
| `getMyBookings(query)` / `getBooking(id)` | `Booking:LIST` / `Booking:{id}` | — |

- Use the shared `baseQuery.ts`. Copy the 401 → `authApi.util.invalidateTags(['User'])` wrapper from `catalogApi.ts`.
- **Logout must reset this slice** (`buyerApi.util.resetApiState()`), so the next user never sees the previous user's holds or bookings.
- Register the reducer and middleware in `app/store.ts`.

### 2.2 Types: `src/types/buyer.types.ts`

`CatalogEvent`, `CatalogEventDetail`, `Showtime`, `SeatMapResponse`, `MapSeat`, `MapSeatStatus`, `MyHolds`, `Booking`, `BookingStatus`, plus the query types. Reuse `SeatCategory`, `ShowType`, `AgeRating` and `Pagination` from `catalog.types.ts`.

### 2.3 Reuse from the organizer work

| Piece | Reuse as |
| :--- | :--- |
| `buildRows` in `features/venues/SeatLayoutMap.tsx` (rows in API order, gaps as aisles) | **Move to `features/seatmap/layout.ts`** and import it from both maps. Don't copy it. |
| `datetime.ts` | `formatShowtime`, `formatDay`, `formatTime`, `formatDuration`, `formatINR`, `istDateKey` |
| `Poster`, `StatusBadge`, `SeatSwatch`/`CategoryLegend`, `FilterPills`, `Pagination`, `EmptyState`, `Skeleton`, `QueryErrorState`, `Modal`/`ConfirmDialog`, toasts | as is |
| `groupByDay` (screenings) | Generalise to accept anything with `startsAt`, then use it for the event page's showtimes |
| `app/urlState.ts` | Filters in the URL (`?city=&date=&type=`) |

---

## 3. Routes and layout

### 3.1 Header and layout change (do first)

Today `AppHeader` returns `null` when signed out, and it only mounts inside `ProtectedRoute → AuthedLayout`. Buyer pages are public, so:

- **`AppHeader` signed-out variant:** logo, "Sign in" (ghost) and "Create account" (primary), with `state.from` = the current URL so login comes back here.
- **Signed in:** add **"My bookings"** to the nav for everyone, and make the logo link to `/` (the catalog).
- New **`SiteLayout`** (header + `<main>`) that works for both states. `AuthedLayout` can become `ProtectedRoute` + `SiteLayout`, or stay as a thin wrapper.

### 3.2 Routes

```
/                                   HomePage (city sections, §0.5)   public
/explore                            ExplorePage (§0.6, was "Browse") public
/events/:showId                     EventPage             public
/screenings/:screeningId            SeatMapPage           public to view; holding needs login
/checkout/:screeningId              CheckoutPage          ProtectedRoute
/bookings                           MyBookingsPage        ProtectedRoute
/bookings/:bookingId                TicketPage            ProtectedRoute
```

- Lazy-load these with a `buyerPage(...)` helper, the same way as the organizer pages.
- `/` currently redirects to `/account`. It becomes the home page (§0).
- After login: `state.from` if set, otherwise `/`. After email verification: the city picker if there's no city, then `/`.
- `ProtectedRoute` already sends a signed-out user to `/login` with `state.from` and brings them back afterwards. Reuse it.

---

## 4. Screens

Customer surface (design.md §11.1): `container-default`, generous space, serif display titles, 48px section gaps, posters as the colour.

### 4.1 Explore: `/explore` (the home page itself is §0.5)
- Header: serif "Events in Bhavnagar", then filters: **date** (chips: Today · Tomorrow · the next 5 days as IST dates, plus "Any") and **type** pills (All · Movie · Concert · Play · Comedy · Sports · Other). Both live in the URL. The city always comes from the header (§0).
- Grid of event cards: a 2:3 framed `Poster`, title, `TYPE · AGE` caption, language · duration, "Next: Sat 12 Oct, 7:30 pm" and the cities. The whole card links to `/events/:id`.
- Grid: 2 columns on mobile, 3 on `md`, 4 on `xl`. `Pagination` at the bottom. A skeleton grid while loading.
- Empty: "Nothing on for these filters." plus "Clear filters". Network error: `QueryErrorState` with Retry.

### 4.2 Event: `/events/:showId`
- Hero: a larger poster, serif title, `TYPE · AGE` caption, language · duration · genre, and the description.
- **Showtimes**, grouped by IST day (sticky day headers, like the organizer tab). Each showtime: time range, venue · city, "From ₹250", seats left (with "Almost full" when below 10%; "Sold out" disables it). It links to `/screenings/:id`.
- An optional **city filter chip row** when the showtimes span more than one city (client-side).
- 404 → the in-page "This event doesn't exist" with a link to browse.

### 4.3 Seat map: `/screenings/:screeningId` (the core screen)

**Layout.** On top: the event title, `Sat 12 Oct · 7:30 pm`, venue. In the middle: the map canvas. At the bottom on mobile (on the right on desktop): a **sticky summary bar** showing the selected seats ("C5, C6"), the total, and the primary **Continue** button.

**Seat states** (design.md §10.2):

| State | Source | Look |
| :--- | :--- | :--- |
| available | map `status = available` | category border, `paper-raised` |
| selected | local selection, not yet held | `accent` fill, `accent-ink` number |
| yours (held) | id in `getMyHolds.seats` | same as selected, plus a small check. These are seats you already hold. |
| held by others | map `status = held` and not in my holds | `paper-sunken`, **dashed** `rule-strong` border, not clickable |
| booked | `status = booked` | `paper-sunken`, 40% opacity, not clickable |
| gap | missing seat number | empty space |

The canvas follows §10.3: `paper-sunken`, a curved **SCREEN** or **STAGE** line (SCREEN for movies, STAGE otherwise), and row labels on both edges. **The legend is always visible** (§10.4): each category with its price, plus the state swatches.

**Selection** is local until Continue:
- Clicking toggles a seat. The maximum is 10 minus the seats already held. Over the limit, a toast says "You can choose up to 10 seats".
- The selection is kept in `sessionStorage` under `seatease:selection:{screeningId}`, so it survives the login redirect and a refresh.
- Keyboard: roving tabindex and arrow keys (copy from `SeatLayoutMap`). Each seat gets an `aria-label` like "Row C, seat 5, Gold, ₹250, available" or "…, selected".

**Continue:**
- **Signed out:** go to `/login` with `state.from` = this page. When you return, the selection is restored; tap Continue again. Don't auto-hold, because the user should confirm.
- **Signed in:** call `holdSeats({ seatIds: selection })`. Already-held seats can be sent too; the server keeps them.
  - **200:** clear the stored selection and navigate to `/checkout/:screeningId`.
  - **409 with `unavailable`:** conflict recovery (§5).
  - **409 limit, cancelled or started:** an inline warning `Alert` with the server's message.
- If `screening.bookable === false`, show the map read-only with a banner ("This screening has been cancelled" or "has started"). There's no Continue.

**Live updates** (§10.9): `pollingInterval` is 8000 ms, or 3000 when `summary.booked + summary.held > 80%` of the total. Poll only while the tab is visible (RTK's `skipPollingIfUnfocused`). On each update, any **selected** seat that is now held or booked triggers conflict recovery for that seat.

### 4.4 Checkout: `/checkout/:screeningId`
- Load `getMyHolds`. No seats (expired or never held): redirect to the seat map with a toast "Your seats were released".
- Show the event, showtime and venue, the seat list with each seat's price, and the **server's total**.
- **Countdown** to `heldUntil` (§6), shown at the top and quiet until 2 minutes are left.
- **Pay ₹1,234.50** (primary, mock): `createBooking` then `payBooking`, with the button disabled while it runs.
  - **200:** navigate to `/bookings/:id` and toast "Booking confirmed".
  - **409 from pay:** the booking is already cancelled on the server. Show a calm modal ("Your hold ran out, so the seats were released") offering "Choose seats again", which goes to the map with the previous seats preselected (written to `sessionStorage`).
- **Cancel:** confirm, then `releaseHolds`, then back to the map. Don't rely on page unload: the hold simply expires.
- Leaving with the browser back button is fine; the hold expires on its own.

### 4.5 My bookings: `/bookings`
- Filter pills: Upcoming · Past · Cancelled, worked out on the client from `status` and `screening.startsAt`. Or All, with the `status` param.
- Each row: a small poster, the title, the showtime, venue · city, seats ("C5, C6"), the total and a `StatusBadge`. When `screening.status === 'cancelled'`, add a "Screening cancelled" note.
- Empty: "No bookings yet" plus "Browse events".

### 4.6 Ticket: `/bookings/:bookingId`
- Big serif showtime, the event, venue and address, the seats with category swatches, the total, and the booking reference (`#000123`) in mono.
- `pending` → "Payment not completed" with a link back to the event. `cancelled` → an explanation.
- A QR code is out of scope (backend §8).

---

## 5. Conflict recovery (design.md §10.8)

When a seat you selected is taken (from a hold 409 or a poll):
1. Remove it from the selection, and let the seat animate once (150 ms) to "held". No flashing.
2. Show a non-blocking toast: **"C14 was just taken."**
3. **Suggest up to 3 replacements**, computed on the client from the latest map:
   - same category, status available, not already selected
   - ranked by distance: |row index difference| × 2 + |seat number difference|, so the same row wins
   - when several seats were lost, prefer a run of adjacent free seats of the same size in one row
4. One tap swaps the suggestion in (or adds a group); another dismisses. Never "please start over".

Put the ranking in a pure function (`features/seatmap/suggest.ts`) so it can be unit-tested later.

---

## 6. The countdown (design.md §10.7)

- **Use the server's clock, not the browser's.** `heldUntil` comes from the database clock. Read the response's `Date` header (via the base query's `meta.response`) to get a server–client offset, and count down to `heldUntil − offset`. If that header can't be read, the fallback is the client clock, which is acceptable.
- Styling: over 2 minutes, `ink-muted`; 2 minutes to 30 seconds, `warning` at weight 500; under 30 seconds, `danger` at 600. A thin progress hairline sits underneath. No pulsing.
- `aria-live="polite"` announcements at 2:00 and 0:30 only, never every second.
- **At 0:** refetch `getMyHolds` (the server is the truth). If it's empty, open the "seats released" modal from §4.4. If the server still holds them (clock skew), keep going.

---

## 7. Conventions (same as the organizer work)

- Server state only in RTK Query. Selection lives in component state plus `sessionStorage`. Filters live in the URL.
- **No optimistic updates** on holds or payment. The server decides; the UI shows spinners on buttons and keeps the previous data visible while refetching.
- Errors: 400 maps to fields or an alert; 409 to an inline warning near the action; 404 to the in-page "doesn't exist"; network errors to Retry.
- Money is always `formatINR` with tabular figures; times are always IST via `datetime.ts`.
- Every screen is checked at 375px. On the seat map, the canvas scrolls sideways inside itself, the summary bar is sticky, and the page never scrolls sideways.

---

## 8. Phases

Each phase ends in something usable.

| # | Phase | Contents | Size |
| :- | :--- | :--- | :--- |
| B0 | Foundations | `User.city` in `auth.types.ts` and an `updateMe` mutation in `authApi` (upserts `checkAuth`), `useCurrentCity()` hook (§0.1), `buyer.types.ts`, `buyerApi` + store + reset on logout, `SiteLayout` + signed-out `AppHeader`, routes with placeholder pages, `buildRows` moved to `features/seatmap/layout.ts` | M |
| B0.5 | City (backend) | **Done.** `users.city`, `PATCH /auth/me`, city in session responses, `GET /catalog/cities`, `GET /catalog/home` (§0.7) | S–M |
| B1 | City + home + event | City picker (both modes), header city button, `localStorage` ↔ server sync, home sections + carousels (§0.5), explore (§4.1), event page (§4.2), post-login/verify redirects | L |
| B2 | Seat map, read-only | Canvas, states, legend, polling, read-only banner | M |
| B3 | Selection + hold | Selection, `sessionStorage`, the login handoff, Continue → hold, conflict recovery + suggestions (§5) | L |
| B4 | Checkout | Holds/me, countdown with server offset, pay flow, expiry modal, cancel | M |
| B5 | Bookings | My bookings and ticket | S–M |
| B6 | Polish | 375px pass, keyboard pass on the map, empty/error review, dashboard link "View as buyer" (optional) | S |

**Verification (manual, against the real backend):**
1. Signed out: browse → event → seat map. Select seats → Continue → log in → back on the map with the seats still selected.
2. Continue → checkout → the timer runs → Pay → ticket. A second browser sees those seats as booked within 8 seconds.
3. Two browsers select the same seat; the second Continue gets the toast and suggestions.
4. Hold, then wait out the timer (or shorten `HOLD_MINUTES` locally): the modal appears, Pay fails cleanly, and the seats are free again.
5. An organizer cancels a screening: its map shows read-only, and the buyer's ticket shows "Screening cancelled".

---

## 9. Open questions (decide before B0)

Resolved by §0: `/` is the city home for everyone; after login it's `state.from`, otherwise `/`; the city comes from a picker backed by `GET /catalog/cities`.

Also decided: the hero shows the soonest showtimes (no "featured" flag); a city is required before anything else; every city change is saved to the database.

1. **Organizers buying:** the backend allows any signed-in user to book, including an organizer booking their own event. Is that fine for the UI too, with no warning?
