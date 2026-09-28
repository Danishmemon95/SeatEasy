# Plan: Venues, Seat Layouts, Events (Shows) & Screenings — Frontend

**Status:** Proposed, not yet implemented
**Scope:** `Frontend/src` (plus three small, optional backend additions in §9)
**Depends on:** backend commits `4fd316b` → `e8e561a` (venues, seats, shows, screenings)

---

## 1. What the backend gives us

Everything below is organizer/admin-only (`protectRoute` + `requireRole`).
There are **no public/buyer endpoints yet**, so this plan covers the organizer
portal. Buyer browsing and the seat map for booking come later (§11).

### 1.1 Domain model

```
users (organizer)
 ├── venues (ownerId)               a physical place, owned by one organizer
 │    └── seats (venueId)           one row per physical seat: rowLabel + seatNumber + category
 └── shows (orgId)                  UI name: "Event". draft → published (one-way)
      └── screenings (showId, venueId)   one show, at one venue, at one time
           ├── screening_prices     one price per seat category the venue has
           └── screening_seats      inventory: one row per venue seat, copied at create time
                                    status available | held | booked
```

Rules that shape the UI:

| Rule | Where enforced | UI consequence |
| :--- | :--- | :--- |
| Organizers see only their own venues/shows/screenings; admins see all. Others' records are a **404**, not a 403. | `ownerScope` | "Not found" page is the correct response to a foreign id. |
| Only **organizers** can `POST` a venue or a show (admins get 403). | routes | Hide "New venue" / "New event" for admins. |
| Seat layout can't change while the venue has an **upcoming, scheduled** screening (409). | `lockVenueForLayoutChange` | Layout editor needs a "locked" read-only mode. |
| A seat used by a past screening can't be deleted (409). | FK | Surface the 409 message inline; don't retry. |
| A venue with **any** screening can't be deleted (409). | FK | Delete is offered but explains the 409 when it happens. |
| Show `durationMinutes` is locked while it has scheduled screenings (409). | `updateShow` | Disable the duration field with a helper note. |
| Publishing is one-way; there is no unpublish. | `publishShow` | Confirm dialog saying it can't be undone. |
| `PUT /shows/:id` is `.strict()`, so sending `status` or `orgId` is a 400. | zod | Send only the fields that changed. |
| Screening `startsAt` must be ISO with an offset, **≥ 24 h** ahead and **≤ 180 days** ahead. | zod | Build `YYYY-MM-DDTHH:mm:00+05:30`; clamp the date picker min/max. |
| `endsAt = startsAt + show.durationMinutes`; screenings at one venue need a **15-min buffer** (409 names the clash). | `screeningRules` | Show the computed end time and the buffer in the form. |
| Prices must cover **exactly** the categories the venue has (400 missing/extra; 409 if the venue has no seats). | `assertPricesMatchVenue` | Render price inputs only for the venue's categories. |
| The screening's venue must belong to the **show's organizer**, even when an admin is scheduling. | `createScreening` | The admin venue picker must filter by the show's `orgId`. |
| Once any seat is held or booked, the screening's venue, time and prices are locked; it can only be cancelled. Past or cancelled screenings can't be edited. | `updateScreening` | Edit is disabled with a reason; Cancel stays available. |
| A screening or show with held/booked seats can't be deleted; cancel instead (409). | `hasSoldSeats` | Delete is offered; the 409 steers to Cancel. |

### 1.2 Endpoint inventory

Base: `VITE_API_URL` (default `http://localhost:5000/api`), cookies via `credentials: 'include'`.

**Venues:** `/api/venues`

| Method | Path | Body / query | Response |
| :--- | :--- | :--- | :--- |
| GET | `/venues` | `?page&pageSize` (≤100) | `{ venues: Venue[], pagination }` |
| GET | `/venues/:venueId` | — | `{ venue }` |
| POST | `/venues` | `{ name, city, address }` (organizer only) | 201 `{ venue }` |
| PUT | `/venues/:venueId` | partial of the above | `{ venue }` |
| DELETE | `/venues/:venueId` | — | `{ venue }` / 409 |

**Seats:** `/api/venues/:venueId/seats`

| Method | Path | Body | Response |
| :--- | :--- | :--- | :--- |
| GET | `/seats` | — | `{ seats: Seat[], summary: { gold, platinum, sofa, total } }`, ordered A…Z, AA… then seat number |
| POST | `/seats` | `{ rows: [{ row: "A", seats: 12, category }] }` (1–100 rows, 1–100 seats each, unique labels) | 201 `{ seats }` / 409 row exists / 409 locked |
| PATCH | `/seats/:seatId` | `{ category }` | `{ seat }` / 409 locked |
| DELETE | `/seats/:seatId` | — | `{ seat }` / 409 |
| DELETE | `/seats/rows/:row` | — | `{ message }` / 409 |

**Shows (Events):** `/api/shows`

| Method | Path | Body / query | Response |
| :--- | :--- | :--- | :--- |
| GET | `/shows` | `?page&pageSize&status=draft\|published` | `{ shows, pagination }` |
| GET | `/shows/:showId` | — | `{ show: Show & { screenings: ScheduleItem[] } }` |
| POST | `/shows` | `{ title, description, type, genre?, language, durationMinutes, ageRating, posterUrl? }` (organizer only) | 201 `{ show }` (draft) |
| PUT | `/shows/:showId` | strict partial (`genre`/`posterUrl` may be `null` to clear) | `{ show }` / 409 duration |
| POST | `/shows/:showId/publish` | — | `{ show }` / 409 already published |
| DELETE | `/shows/:showId` | — | `{ show }` / 409 sold |

**Screenings**

| Method | Path | Body / query | Response |
| :--- | :--- | :--- | :--- |
| GET | `/shows/:showId/screenings` | `?page&pageSize&status=scheduled\|cancelled` | `{ screenings: ScreeningDetail[], pagination }` |
| POST | `/shows/:showId/screenings` | `{ venueId, startsAt, prices: { gold?, platinum?, sofa? } }` | 201 `{ screening }` |
| GET | `/screenings/:screeningId` | — | `{ screening }` |
| PUT | `/screenings/:screeningId` | strict, at least one of `venueId`, `startsAt`, `prices` | `{ screening }` |
| POST | `/screenings/:screeningId/cancel` | — | `{ screening }` |
| DELETE | `/screenings/:screeningId` | — | `{ screening }` |

`ScreeningDetail` = screening columns + `show { id, title, durationMinutes, status }` + `venue { id, name, city }` + `prices: Partial<Record<Category, "250.00">>` + `seats: { available, held, booked, total }`.

**Error shape (all endpoints):** `{ message }`, plus `errors: [{ field, message }]` on 400s from zod. The existing `getFieldErrors` / `getRtkErrorMessage` helpers in `api/authApi.ts` already read this. Every 409 message is written for humans and can be shown as is.

---

## 2. Where the frontend stands

- **Stack:** React 19, Vite, Tailwind v4 with the CSS tokens from `design.md` in `index.css`, Redux Toolkit + **RTK Query**, react-router v7 data router, lucide icons.
- **API layer:** one `createApi` per domain (`authApi`, `applicationApi`), each with its own copy of `fetchBaseQuery`. Tags are scoped per API.
- **Auth:** `useAuth()` derives everything from the single `checkAuth` query. `ProtectedRoute allowedRoles` guards the route groups.
- **Shells:** `AuthedLayout` (global `AppHeader`) → `OrganizerShell` / `AdminShell` (`SectionSidebar`). Sidebar already lists **Events** and **Venues** as disabled "Soon" entries.
- **UI kit:** `Button`, `Input`, `Card`, `Badge`, `Alert`. Missing pieces for this work: Select, Textarea, Modal/ConfirmDialog, Tabs, data Table, Pagination, EmptyState, Skeleton, Toast.
- **Validation:** hand-written validators in `utils/validation.ts` that mirror the backend's zod messages.
- **Page pattern** (from `AdminApplicationsPage`): caption eyebrow + display-serif title, filter pills, `Alert` for errors, card-wrapped list with loading/empty states.

---

## 3. API architecture (frontend)

### 3.1 One shared base query, one catalog API

Screenings, venues, seats and shows invalidate each other. Creating a screening
locks the venue's layout, and deleting a show removes its screenings. RTK Query
tags only work inside one `createApi`, so these four resources go in **one API
slice** split across files with `injectEndpoints`.

```
src/api/
  baseQuery.ts            NEW  shared fetchBaseQuery (baseUrl, credentials, JSON header)
  authApi.ts              use baseQuery (no behaviour change)
  applicationApi.ts       use baseQuery (no behaviour change)
  catalogApi.ts           NEW  createApi({ reducerPath: 'catalogApi', baseQuery, tagTypes, endpoints: () => ({}) })
  catalog/
    venueEndpoints.ts     NEW  injectEndpoints
    seatEndpoints.ts      NEW
    showEndpoints.ts      NEW
    screeningEndpoints.ts NEW
  errors.ts               NEW  move getFieldErrors / getApiErrorCode / getRtkErrorMessage here; re-export from authApi to avoid churn
```

Register `catalogApi.reducer` and `catalogApi.middleware` in `app/store.ts`.

**401 handling:** wrap `baseQuery` so a 401 from any catalog call dispatches
`authApi.util.invalidateTags(['User'])`. The session re-check then sends the
user to `/login` through `ProtectedRoute`, with no per-page handling.

### 3.2 Tags

```ts
tagTypes: ['Venue', 'VenueSeats', 'Show', 'Screening']
```

| Endpoint | provides | invalidates (on success only, same `result ? [...] : []` idiom as authApi) |
| :--- | :--- | :--- |
| `getVenues` | `Venue:LIST`, `Venue:id…` | — |
| `getVenue` | `Venue:id` | — |
| `createVenue` | — | `Venue:LIST` |
| `updateVenue` | — | `Venue:id`, `Venue:LIST` |
| `deleteVenue` | — | `Venue:LIST` |
| `getVenueSeats` | `VenueSeats:venueId` | — |
| `addSeatRows` / `updateSeat` / `deleteSeat` / `deleteSeatRow` | — | `VenueSeats:venueId` |
| `getShows` | `Show:LIST`, `Show:id…` | — |
| `getShow` | `Show:id` | — |
| `createShow` | — | `Show:LIST` |
| `updateShow` / `publishShow` | — | `Show:id`, `Show:LIST` |
| `deleteShow` | — | `Show:LIST`, `Screening:LIST` |
| `getShowScreenings` | `Screening:LIST-show-{id}`, `Screening:id…` | — |
| `getScreening` | `Screening:id` | — |
| `createScreening` | — | `Screening:LIST-show-{showId}`, `Show:{showId}`, `VenueSeats:{venueId}` (layout now locked) |
| `updateScreening` | — | `Screening:id`, `Screening:LIST-show-{showId}`, `Show:{showId}`, `VenueSeats` for old + new venue |
| `cancelScreening` / `deleteScreening` | — | same as update (a cancel can unlock a layout) |

### 3.3 Types: `src/types/catalog.types.ts`

```ts
export type SeatCategory = 'gold' | 'platinum' | 'sofa';
export const SEAT_CATEGORIES: SeatCategory[] = ['gold', 'platinum', 'sofa']; // price-ladder order
export type ShowType = 'movie' | 'concert' | 'play' | 'comedy' | 'sports' | 'other';
export type AgeRating = 'U' | 'UA' | 'A';
export type ShowStatus = 'draft' | 'published';
export type ScreeningStatus = 'scheduled' | 'cancelled';

export interface Pagination { page: number; pageSize: number; total: number; totalPages: number }
export interface PageQuery { page?: number; pageSize?: number }

export interface Venue { id: number; ownerId: number; name: string; city: string; address: string; createdAt: string; updatedAt: string }
export interface Seat { id: number; venueId: number; rowLabel: string; seatNumber: number; category: SeatCategory; createdAt: string; updatedAt: string }
export type SeatSummary = Record<SeatCategory, number> & { total: number };

export interface Show {
  id: number; orgId: number; title: string; description: string; type: ShowType;
  genre: string | null; language: string; durationMinutes: number; ageRating: AgeRating;
  posterUrl: string | null; status: ShowStatus; publishedAt: string | null;
  createdAt: string; updatedAt: string;
}
export interface ScheduleItem { id: number; venueId: number; venueName: string; venueCity: string; startsAt: string; endsAt: string; status: ScreeningStatus }

export type Prices = Partial<Record<SeatCategory, string>>;          // server: "250.00"
export type PricesInput = Partial<Record<SeatCategory, number>>;     // client → server
export interface SeatCounts { available: number; held: number; booked: number; total: number }
export interface Screening {
  id: number; showId: number; venueId: number; startsAt: string; endsAt: string;
  status: ScreeningStatus; cancelledAt: string | null; createdAt: string; updatedAt: string;
  show?: { id: number; title: string; durationMinutes: number; status: ShowStatus };
  venue: { id: number; name: string; city: string };
  prices: Prices; seats: SeatCounts;
}
// + request/response envelopes: { success, message, venue } etc.
```

### 3.4 Time handling: `src/utils/datetime.ts`

All venues are in India. The API needs an explicit offset and stores UTC.

- `toApiDateTime(date: 'YYYY-MM-DD', time: 'HH:mm') => \`${date}T${time}:00+05:30\``
- `formatShowtime(iso)` → `Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday:'short', day:'numeric', month:'short', hour:'numeric', minute:'2-digit' })`
- `splitForForm(iso)` → `{ date, time }` in IST, to prefill the edit form
- `minStartDate()` = now + 24 h, `maxStartDate()` = now + 180 d, used as the date input's `min` / `max`
- `formatDuration(mins)` → `2h 15m`
- `formatINR(value: string | number)` → `Intl.NumberFormat('en-IN', { style:'currency', currency:'INR' })`, tabular figures

### 3.5 Client validation: `src/utils/catalogValidation.ts`

Mirror the zod rules and messages exactly, as `utils/validation.ts` does for auth. The
server stays the authority; on a 400, map `errors[].field` onto the form with
`getFieldErrors`.

- Venue: name 2–100, city 2–100, address 5–300 (trimmed)
- Seat row: label `/^[A-Z]{1,3}$/` (uppercase on input), seats 1–100 whole, category required, labels unique in the batch and not already in the venue
- Show: title 2–100, description 10–5000, genre 2–50 or empty, language 2–50, duration 1–720 whole, poster `https://` URL ≤ 2000 or empty
- Screening: venue required, start inside the [+24 h, +180 d] window, every venue category priced 0–100000 with at most 2 decimals

---

## 4. Routes & navigation

UI vocabulary: **Events** (backend `shows`), **Venues**, **Screenings** (a
showtime of an event at a venue). Code keeps the backend names (`showId`,
`showApi`) so the mapping stays one hop.

```
/organizer/dashboard                          (existing; wire real numbers)
/organizer/venues                             VenueListPage
/organizer/venues/new                         VenueFormPage (create)          organizer only
/organizer/venues/:venueId                    VenueDetailPage  → tabs: Layout (default) | Details
/organizer/venues/:venueId/edit               VenueFormPage (edit)
/organizer/events                             EventListPage
/organizer/events/new                         EventFormPage (create)          organizer only
/organizer/events/:showId                     EventDetailPage  → tabs: Screenings (default) | Details
/organizer/events/:showId/edit                EventFormPage (edit)
/organizer/events/:showId/screenings/new      ScreeningFormPage (create)
/organizer/screenings/:screeningId            ScreeningDetailPage
/organizer/screenings/:screeningId/edit       ScreeningFormPage (edit)
```

- Add these under the existing `OrganizerShell` group in `routes/index.tsx`, and **lazy-load** the page modules (`lazy: () => import(...)`) with `RouteFallback`. This keeps the organizer bundle out of buyer sessions.
- `organizer/venues/new` and `organizer/events/new` are wrapped in a nested `ProtectedRoute allowedRoles={['organizer']}`, matching the backend 403 for admins.
- `OrganizerShell`: enable **Events** and **Venues** (drop `disabled` / `badge`). Change the `NavLink` `end` prop to `false` for these two items so `/organizer/events/12` keeps "Events" active.
- **Admins** reach the same pages through the organizer routes; the role guard already allows them. `AdminShell`'s "Events" entry becomes a link to `/organizer/events`. Create buttons are hidden for admins, and lists show an **Owner** column (`ownerId` / `orgId`) so admins can tell organizers apart.
- Every page sets `document.title` (`Venues · SeatEasy`).

---

## 5. Shared UI to add first (`src/components/ui/`)

Built to `design.md` §9, tokens only, with no new dependencies.

| Component | Notes |
| :--- | :--- |
| `Select` | Same shell as `Input` (44px, caption label, error slot). Native `<select>` for accessibility. |
| `Textarea` | Same as `Input`, with a character counter (`1240 / 5000`) in tabular figures. |
| `Modal` + `ConfirmDialog` | Centered on desktop, bottom sheet under `sm`. Warm overlay, focus trap, Esc closes unless `busy`. `ConfirmDialog` takes `tone: 'danger' \| 'accent'` and never mixes accent with danger (§3.4). |
| `Tabs` | Caption labels with a sliding 2px accent indicator. State lives in the URL (`?tab=details`). |
| `DataTable` | §9.4: sunken caption header, 48px rows, hairlines, right-aligned numeric columns, row click → navigate. Stacks to cards under `md`. |
| `Pagination` | "Page 2 of 5 · 43 venues", prev/next. Reads `pagination` from the response; state lives in `?page=`. |
| `EmptyState` | §8: `h3` line, `body-sm` muted explanation, one action. No illustration. |
| `Skeleton` | `paper-sunken` blocks for table rows and posters. No spinners inside content areas. |
| `Toast` (+ `useToast`) | Non-blocking bottom-right (bottom-center on mobile), 4s, `aria-live="polite"`. For "Venue created", "Row C deleted" and similar. Small `toastSlice` in Redux. |
| `PageHeader` | Extracts the repeated eyebrow + serif title + actions block from the existing pages. |
| `StatusBadge` | Maps `draft` / `published` / `scheduled` / `cancelled` / `past` to `Badge` variants: neutral, success, info, danger, neutral. Always text, never color alone. |
| `SeatSwatch` / `CategoryLegend` | Category border hue from `--seat-*` tokens plus name, used in the layout editor and price forms. |

Feature components go under `src/features/venues`, `src/features/events` and `src/features/screenings`, following `features/auth`.

---

## 6. Screen-by-screen UX

Organizer surface (design.md §11.2): `container-wide`, 32px section gaps, a serif page title only, tables and forms first.

### 6.1 Organizer dashboard (update the existing page)

- Replace the three placeholder cards with live tiles:
  - **Events**: `getShows({ pageSize: 1 })` → `pagination.total`, with a drafts count from `status=draft`
  - **Venues**: `getVenues({ pageSize: 1 })` → `total`
- **Next steps** checklist for a new organizer: *Add a venue → Build its seat layout → Create an event → Schedule a screening → Publish*. Each step links to the right page, and the first incomplete step is the one primary button (§1.3).
- Keep "View Application" as a secondary link.

### 6.2 Venues list: `/organizer/venues`

- `PageHeader`: eyebrow `VENUES`, title "Your venues" ("All venues" for admin), primary **New venue** (organizers only).
- `DataTable` columns: Name, City, Address (truncated), Created, and Owner for admins. Row → detail.
- Pagination in the URL, `pageSize=20`.
- Empty: "No venues yet". "Add the places you run events. You'll draw each one's seat layout next." Action: **New venue**.
- Capacity per row needs §9-B. Until then the column is omitted rather than loaded N+1.

### 6.3 Venue create / edit: `/organizer/venues/new`, `/:venueId/edit`

- `container-narrow` form with Name, City and Address (textarea). Real `<label>`s, inline validation on blur, server field errors mapped with `getFieldErrors`.
- Edit sends **only the changed fields** and disables Save until something changes.
- On create, navigate to `/organizer/venues/:id?tab=layout` and toast "Venue created. Add its seat rows." This moves straight into the next decision.
- Unsaved-changes guard: `useBlocker` when the form is dirty.

### 6.4 Venue detail: `/organizer/venues/:venueId`

Header: venue name (serif), `city · address` in muted text. Secondary **Edit
details**, ghost **Delete venue** (danger confirm). On a 409 the dialog stays
open and shows *"This venue has screenings and cannot be deleted"*.

**Tab: Layout (default).** This is the seat layout editor, the most important organizer screen.

1. **Summary strip**: `TOTAL 180 · GOLD 120 · PLATINUM 40 · SOFA 20` in caption style with tabular figures, taken from `summary`.
2. **Lock banner** (info `Alert`, not danger): *"This venue has upcoming screenings, so its layout is read-only until they finish or are cancelled."* When locked, the add/edit/delete controls are hidden and the map stays viewable. Detection:
   - With §9-A, read `layoutLocked` from `GET /seats`.
   - Without it, show nothing up front. On the first 409 from a layout mutation, switch the editor to locked mode and show the banner. This is correct but reactive.
3. **Layout preview map** (read/edit):
   - `paper-sunken` canvas, a curved `SCREEN / STAGE` hairline at the top (label by show type is unknown here, so "STAGE / SCREEN"), and row labels on both edges in caption style.
   - Seats are grouped by `rowLabel` in the API order (length, then alpha) and positioned by `seatNumber`. **Missing numbers render as gaps**, so deleting A5 creates an aisle at that spot. This is the only aisle mechanism the schema supports, and the UI should say so: helper text reads "Delete a seat to leave a gap, such as an aisle."
   - Seat is 28px (32px mobile), `radius-xs`, 6px gap, 1.5px category-colored border on `paper-raised`, with the number inside. The hit area is at least 44px on touch.
   - Horizontal scroll inside the canvas for wide rows; the page itself never scrolls sideways.
   - Always-visible `CategoryLegend` with counts.
4. **Editing (unlocked):**
   - Click or Enter on a seat opens a popover: category segmented control (Gold / Platinum / Sofa) → `PATCH`; **Remove seat** (danger, inline confirm) → `DELETE`.
   - Click a row label for a row menu: **Delete row A (12 seats)** with a danger confirm → `DELETE /rows/A`.
   - Keyboard: arrow keys move between seats (a roving tabindex), Enter opens the popover, Esc closes it. Each seat has `aria-label="Row A, seat 5, Gold"`.
   - **Bulk category change** (nice to have): shift-click a range in a row, then set the category. This is N PATCH calls run sequentially with a progress toast, since the backend has no bulk endpoint.
5. **Add rows panel** (below or beside the map, at the right on `xl`):
   - An editable row list, each line holding `Row [A] · Seats [12] · Category [Gold ▾] · ✕`.
   - **+ Add row** auto-suggests the next free label (A → B … Z → AA) and copies the previous line's count and category.
   - **Quick fill** helper: "Rows [F] to [J], [14] seats each, [Platinum]" expands into lines.
   - A **live preview**: pending rows appear on the map in a dashed "draft" style before saving.
   - Client checks: duplicate labels in the batch, a label that already exists in the venue (known from `seats`), and the 1–100 limits. The server 409 names the clashing rows.
   - A single primary **Save N rows (M seats)** → `POST /seats`, followed by a toast.
6. **Empty layout:** EmptyState "No seats yet". "Describe the venue a row at a time. Row A is nearest the stage." The Add rows panel is open by default.

**Tab: Details.** Read-only name, city, address, created/updated dates and Owner (admin), with an **Edit** button.

### 6.5 Events list: `/organizer/events`

- `PageHeader` with eyebrow `EVENTS`, title "Your events", primary **New event** (organizers only).
- Filter pills `All / Draft / Published` bound to `?status=`, in the same pill style as `AdminApplicationsPage`.
- Rows show a 2:3 poster thumbnail (40×60, framed, skeleton or initials fallback), Title with type and age-rating chips, Language, Duration (`2h 15m`), `StatusBadge`, Created date, and Owner for admins.
- Empty state per filter, for example "No drafts." / "Create your first event".

### 6.6 Event create / edit: `/organizer/events/new`, `/:showId/edit`

A single `container-narrow` form in sections separated by caption dividers:

- **BASICS**: Title; Type (Select: Movie, Concert, Play, Comedy, Sports, Other); Genre (optional); Language; Age rating (segmented `U / UA / A` with a one-line meaning tooltip).
- **TIMING**: Duration in minutes, with the live helper "= 2h 15m". In **edit** mode, if the event has scheduled screenings (known from `show.screenings`), the field is disabled with the note "Locked while screenings are scheduled. Cancel them to change the duration." The server 409 is the fallback.
- **DESCRIPTION**: Textarea with a 5000-character counter.
- **POSTER**: an https URL input and a live **2:3 framed preview** that falls back to a skeleton on load error. Clearing the field sends `posterUrl: null` on edit.
- Footer: Cancel (ghost) and primary **Save draft** (create) or **Save changes** (edit). Edit sends a strict diff, with no `status` or `orgId`.
- After create, go to `/organizer/events/:id` with the toast "Draft saved. Schedule a screening next."

### 6.7 Event detail: `/organizer/events/:showId`

**Header:** poster (2:3, framed, 120px wide) · eyebrow `{TYPE} · {AGE}` · serif title · `language · 2h 15m · genre` · `StatusBadge`.

**Actions** (one primary per region):
- A draft shows primary **Publish**, which opens a confirm dialog (accent tone): *"Publishing makes this event visible to buyers. It can't be unpublished."* If no scheduled screenings exist, the dialog adds a warning line: "It has no screenings yet". Publishing is not blocked, since the backend allows it.
- A published event shows primary **Schedule screening**.
- Secondary **Edit**; the overflow menu holds **Delete event** (danger confirm, which surfaces the 409 "cancel its screenings instead").

**Tab: Screenings (default)**, backed by `getShowScreenings(showId, { status, page })`:
- Filter pills: `Upcoming / Past / Cancelled / All`. "Upcoming" and "past" are derived client-side from `startsAt` vs now within `status=scheduled`. `status` is the only server filter; see §9-C for doing this server-side.
- Screenings are grouped **by date** (sticky caption date headers such as `SAT 12 OCT`). Each row shows time `7:30 PM – 9:45 PM` (IST, tabular), venue and city, price chips per category (`GOLD ₹250`), a sold meter (`booked / total`, a hairline bar with text; held is shown as its own count), `StatusBadge`, and a chevron → screening detail.
- Primary **Schedule screening** → `/organizer/events/:showId/screenings/new`.
- Empty: "No screenings yet". "Pick a venue, a time and prices for each seat category."

**Tab: Details**: the full description (`container-prose` measure), metadata list with caption labels, and published/created timestamps.

### 6.8 Schedule / edit screening: `/events/:showId/screenings/new`, `/screenings/:id/edit`

This form follows the "one decision per screen" principle as a **single page with three stacked steps**. Each step is enabled once the previous one is valid.

1. **VENUE**: a radio-card list of venues (name, city, capacity and category chips).
   - Data: `getVenues({ pageSize: 100 })`. For **admins**, filter to `venue.ownerId === show.orgId` (§9-C adds a server-side `ownerId` filter to make this exact).
   - Selecting a venue loads `getVenueSeats(venueId)`, whose `summary` gives the categories and counts.
   - Venues with `summary.total === 0` are shown disabled, with "No seats yet · Build layout →" linking to the venue's layout tab.
   - Empty (no venues): "You need a venue first." → **New venue**.
2. **DATE & TIME**: a date input (`min` = today + 24 h, `max` = +180 d) plus a time input (15-min step).
   - Live readout: *"Sat 12 Oct, 7:30 PM – 9:45 PM IST (2h 15m). The venue must be free from 7:15 PM to 10:00 PM."* This explains the 15-min buffer before the server has to.
   - The small note "All times are India Standard Time" is always shown.
   - On a 409 overlap, show the server message inline under this step (warning tone, not danger). The UX suggestion is to offer "Try 10:00 PM" by adding the buffer to the clashing screening's `endsAt`, parsed from the message only if §9-D is adopted; otherwise just show the message.
3. **PRICES**: one currency input per category **the venue actually has**, in ladder order (Gold → Platinum → Sofa), each with its swatch and seat count (`Gold · 120 seats`).
   - `₹` prefix adornment, `inputmode="decimal"`, 2-decimal clamp.
   - A live summary line: **Potential gross ₹48,000** (Σ price × count), in tabular figures and not animated.
   - Soft warning (not a block) if a higher tier is priced below a lower one.

Footer: primary **Schedule screening** / **Save changes**.

**Edit mode specifics:**
- The page is prefilled from `getScreening`. Only changed fields are sent (`venueId`, `startsAt`, `prices`).
- **Changing the venue** requires prices for the new venue's categories, so the price step re-renders with the new categories and keeps matching values.
- **Read-only states** replace the form with an explanation and a link back:
  - `status === 'cancelled'` → "Cancelled screenings can't be changed."
  - `startsAt <= now` → "This screening has started."
  - `seats.held + seats.booked > 0` → "Seats are held or booked, so venue, time and prices are locked. You can still cancel it."

On success: navigate to the screening detail and toast "Screening scheduled", then invalidate per §3.2.

### 6.9 Screening detail: `/organizer/screenings/:screeningId`

- Breadcrumb: `Events / {show.title} / Screening`.
- Header: serif date/time (`Sat 12 Oct · 7:30 PM`), `venue · city`, `StatusBadge`.
- **Inventory** stat row: `AVAILABLE 162 · HELD 6 · BOOKED 12 · TOTAL 180` plus one stacked hairline bar (booked solid, held dashed, available empty), matching the seat-map state language.
- **Prices** table: category (swatch), price, seats in that category.
- Actions:
  - **Edit** (secondary; disabled with a tooltip giving the reason from §6.8).
  - **Cancel screening** (danger confirm): *"Buyers will no longer be able to book. Existing holds and bookings are kept for refunds."* Hidden once cancelled or started.
  - **Delete** (overflow menu, danger). A 409 steers the user to Cancel.
- A per-seat occupancy map is **out of scope**: the API only returns counts. See §11.

---

## 7. State, loading & error conventions

- **Server state lives in RTK Query only.** Redux slices hold UI-only state (toasts). Filters and pagination live in the URL (`useSearchParams`) so they survive refresh and can be shared.
- **Loading:** skeletons shaped like the content (table rows, poster, stat strip). Buttons use their `isLoading` prop. Mutations disable the form and never show optimistic updates, because the server enforces locks and conflicts and optimism would lie.
- **Errors:**
  - A 400 with `errors[]` maps to field errors via `getFieldErrors`, and the first message also goes into a form-level `Alert`.
  - A 409 goes into an inline `Alert` near the action that caused it (warning tone for "try something else", such as an overlap or a lock; danger only for failed destructive actions). The dialog stays open.
  - A 404 on a detail page renders an in-shell "Not found" `EmptyState` with a link back to the list. This also covers another organizer's ids.
  - A 403 on create (an admin) can't happen via the UI; it falls through to the generic `Alert`.
  - Network (`FETCH_ERROR`) shows the existing `getRtkErrorMessage` text with a **Retry** button (`refetch`).
- **Confirmations:** every delete, cancel and publish uses `ConfirmDialog`. The confirm button's label names the action ("Delete row C", not "OK").
- **Money:** always shown with `formatINR` and tabular figures. Sent as `number` and received as `"250.00"` strings; parse with `Number()` for display math only.

---

## 8. Accessibility & responsive checklist

- Every input has a real `<label>`, and errors use `aria-describedby`, following the existing `Input` pattern.
- The seat layout map supports keyboard use (§6.4), announces a label per seat, and uses `aria-live="polite"` for "Row C added (14 seats)".
- Status and category are never shown by color alone: badges carry text and seats carry a border hue plus the legend.
- Tables collapse to stacked cards under `md`. The seat canvas scrolls horizontally inside itself, and the page never does.
- Verify every screen at 375px. The screening form's steps stack, and the footer CTA becomes a sticky bottom bar.
- Respect `prefers-reduced-motion`, which `index.css` already handles globally.

---

## 9. Small backend additions (recommended, optional)

The frontend works without these, using the fallbacks noted above. Each one removes a workaround.

| # | Change | Why |
| :--- | :--- | :--- |
| **A** | `GET /venues/:venueId/seats` adds `layoutLocked: boolean` (reuses `hasUpcomingScreenings`). | Lets the layout editor show read-only mode up front instead of after a 409. |
| **B** | `GET /venues` adds `seatCount` per venue (a `LEFT JOIN seats … GROUP BY`) and an optional `?ownerId=` filter for admins. | Capacity column; exact venue picker when an admin schedules for an organizer. |
| **C** | `GET /shows/:showId/screenings` accepts `?when=upcoming\|past`. | Server-side Upcoming/Past tabs that stay correct across pagination. |
| **D** | Overlap 409 includes `code: 'SCREENING_OVERLAP'` and `clash: { id, startsAt, endsAt }`. | Structured "try 10:00 PM" suggestion instead of parsing the message. |

Recommendation: do **A** and **B** before Phase 3. They are about 20 lines each and use the same patterns already in `seatController`/`venueController`.

---

## 10. Implementation phases

Each phase ends in a working, shippable state.

**Phase 0: Foundations**
1. `api/baseQuery.ts`, `api/errors.ts`; point `authApi` and `applicationApi` at them (no behaviour change).
2. `catalogApi` shell registered in the store; `types/catalog.types.ts`; `utils/datetime.ts`; `utils/catalogValidation.ts`.
3. UI kit additions from §5.
4. Routes (lazy) and sidebar entries enabled, with placeholder pages.

**Phase 1: Venues**
5. `venueEndpoints` and the list, create/edit and detail pages (Details tab), plus delete.

**Phase 2: Seat layouts**
6. `seatEndpoints`, the `SeatLayoutMap` component (read-only first), then the Add rows panel, the seat popover (category/remove), row delete and lock mode.
7. (Backend §9-A / §9-B if accepted.)

**Phase 3: Events**
8. `showEndpoints`, the list with status filter, the create/edit form with poster preview and duration lock, the detail page (Details tab), publish and delete.

**Phase 4: Screenings**
9. `screeningEndpoints`, the event detail's Screenings tab (grouped by date), the three-step schedule form, edit mode with its read-only states, and the screening detail with cancel and delete.

**Phase 5: Polish**
10. Dashboard live tiles and the next-steps checklist; admin Owner columns and the AdminShell "Events" link; a 375px pass; a keyboard pass on the seat map; empty/error state review against §7.

---

## 11. Out of scope (next plan)

These need backend work that doesn't exist yet:

- **Buyer browsing:** public `GET` for published events, by city and by date, and a screening's per-seat inventory (`screening_seats` with status and price).
- **Buyer seat map** (design.md §10: states, hold timer, conflict recovery, 8s/3s polling) and **holds/bookings** (`SELECT … FOR UPDATE`, 10-seat cap, lazy hold expiry).
- **Organizer occupancy map** per screening, which needs the same per-seat inventory endpoint.
- Poster **upload** (currently URL only), analytics, and refunds on cancellation.

---

## 12. Verification

- `npm run build` (`tsc -b`) and `npm run lint` are clean.
- Manual run against the local backend, as an organizer:
  1. Create a venue.
  2. Add rows A–E (gold) and F–G (sofa); remove A5 and confirm the gap renders; change the category of one seat; delete row G.
  3. Create an event and edit it (the diff only); confirm the poster preview.
  4. Schedule a screening. Confirm the venue layout is now locked and the banner shows.
  5. Try to schedule an overlapping slot and confirm the inline 409.
  6. Try to change the event's duration and confirm it's disabled or returns a 409.
  7. Edit the screening's time and prices.
  8. Publish the event and confirm the dialog.
  9. Cancel the screening; confirm the layout unlocks once nothing upcoming remains.
  10. Delete the screening, the event and the venue in order, confirming each 409 appears where expected.
- As an admin: lists show every organizer's records with an Owner column, no create buttons appear, and scheduling for another organizer's event only offers that organizer's venues.
- As a second organizer: opening the first organizer's `/organizer/venues/:id` shows the in-shell Not found.
