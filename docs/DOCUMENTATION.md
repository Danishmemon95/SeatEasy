# SeatEase: Technical Documentation

> The complete reference for the SeatEase ticket-booking platform: why it exists, how it works, who uses it, how the code is organised, what the database looks like, every API endpoint, and how the frontend is built.
>
> **Audience:** any developer joining the project. No prior context is assumed.
> **Last updated:** 2026-09-28 (matches commit `e8e561a`).

---

## Table of contents

1. [What SeatEase is](#1-what-seatease-is)
2. [Glossary](#2-glossary)
3. [Roles and permissions](#3-roles-and-permissions)
4. [User flows](#4-user-flows)
5. [System architecture](#5-system-architecture)
6. [Technology stack](#6-technology-stack)
7. [Repository structure](#7-repository-structure)
8. [Backend architecture](#8-backend-architecture)
9. [Backend modules](#9-backend-modules)
10. [Database](#10-database)
11. [API reference](#11-api-reference)
12. [Frontend architecture](#12-frontend-architecture)
13. [Design system](#13-design-system)
14. [Local setup and operations](#14-local-setup-and-operations)
15. [Conventions: how to add a feature](#15-conventions-how-to-add-a-feature)
16. [Known limitations and gaps](#16-known-limitations-and-gaps)
17. [Roadmap](#17-roadmap)
18. [Related documents](#18-related-documents)

---

## 1. What SeatEase is

### 1.1 The product

SeatEase is an event-ticketing platform in the style of BookMyShow. It covers movies, concerts, plays, comedy and sports.

- **Buyers** browse events, pick a showtime at a venue, choose seats on a seat map and book them.
- **Organizers** register venues, draw each venue's seat layout, create events, and schedule screenings (showtimes) with a price per seat category.
- **Admins** decide who may become an organizer.

The product brand shown in the UI is **SeatEasy**. The repository and codebase are named **SeatEase**. Both names refer to the same product.

### 1.2 Why it exists (motive)

SeatEase is a **learning project with a production-grade bar**. It has two goals.

1. **Relational modelling.** It moves from MongoDB/Mongoose to **PostgreSQL + Drizzle ORM**, modelling real relationships (organizer → venue → seats; show → screening → seat inventory) with foreign keys, unique constraints and enums enforced by the database.
2. **Safe concurrency.** Seat booking is the classic race condition: two people must never buy the same seat. SeatEase handles this with **SQL transactions and row locks** (`SELECT … FOR UPDATE`) instead of application-level hope. The scheduling module already uses a strict locking discipline (§8.7), and the booking module will build on it.

Beyond those goals the code aims for security that holds up in production (enumeration-resistant auth, hashed tokens, rate limits), a considered editorial UI (`Frontend/design.md`), and code that explains its own decisions in comments.

### 1.3 Current status

| Area | Status |
| :--- | :--- |
| Auth: register, verify email, login, logout, session | ✅ Built (backend + frontend) |
| Organizer applications: apply, admin review, role promotion | ✅ Built (backend + frontend) |
| Global navigation, organizer/admin shells | ✅ Built (frontend) |
| Venues and seat layouts | ✅ Built (backend + frontend) |
| Events (shows): draft/publish | ✅ Built (backend + frontend) |
| Screenings: scheduling, pricing, seat inventory | ✅ Built (backend + frontend) |
| Organizer dashboard: live counts, next-steps checklist | ✅ Built (frontend) |
| Public browsing for buyers: city-first home, explore, event page | ✅ Built (backend + frontend) |
| Seat holds (10 min, max 10 seats) and the per-seat seat map | ✅ Built (backend + frontend) |
| Bookings with a **mock** payment step, My bookings, ticket page | ✅ Built (backend + frontend) |
| Real payments (Razorpay, test mode) | 📝 Planned: [`docs/razorpay-payments-plan.md`](razorpay-payments-plan.md) |
| Email delivery (verify, resend, password reset, booking mails) | 📝 Planned: [`docs/email-plan.md`](email-plan.md). Today, verification links are only logged to the server console. |
| Automated tests (including the hold/booking race tests) | ❌ None yet |
| Deployment (Render) | ❌ Not configured |

---

## 2. Glossary

| Term | Meaning |
| :--- | :--- |
| **User** | Anyone with an account. Has exactly one role. |
| **Buyer** | Default role. Books tickets and may apply to become an organizer. |
| **Organizer** | Runs events. Owns venues and shows. |
| **Admin** | Platform operator. Reviews applications and can manage every organizer's data. |
| **Org application** | A buyer's request to become an organizer (`org_applications`). |
| **Venue** | A physical place (cinema hall, auditorium). Owned by one organizer. |
| **Seat** | One physical seat in a venue, identified by row label + seat number (e.g. `C12`), with a **category**. |
| **Seat category** | Price tier: `gold` (entry) → `platinum` (mid) → `sofa` (premium). |
| **Show / Event** | The abstract thing being staged, such as the film "Dune: Part Three". The database and API call it a **show**; the UI calls it an **event**. |
| **Screening / Showtime** | One show at one venue at one time. This is what a buyer actually picks. |
| **Screening price** | Price for one seat category at one screening. |
| **Screening seat (inventory)** | One row per seat per screening, holding that seat's price and status (`available` / `held` / `booked`) for that screening. It is the ticket. |
| **Hold** | A temporary reservation (10 min) of a seat while the buyer pays. |
| **Booking** | One payment event covering one or more seats of one screening. Planned. |

---

## 3. Roles and permissions

### 3.1 How roles work

- A role is stored in `users.role` as a Postgres enum: `buyer | organizer | admin`.
- Every new account is a **buyer**.
- A buyer becomes an **organizer** only when an admin approves their application. The status change and the role change happen in **one transaction** (§9.2). Organizer status is never self-serve, which keeps fraudulent events off the platform.
- There is **no API to create an admin**. The first admin is promoted by hand in the database (§14.5).
- The backend is the authority on roles. The frontend's role checks only decide what to show and where to navigate.

### 3.2 Permission matrix

| Capability | Buyer | Organizer | Admin |
| :--- | :---: | :---: | :---: |
| Register / verify / log in / log out | ✅ | ✅ | ✅ |
| View own session (`checkAuth`) | ✅ | ✅ | ✅ |
| Submit an organizer application | ✅ (once) | ❌ | ❌ |
| View own application | ✅ | ✅ | ✅ |
| List all applications, approve/reject | ❌ | ❌ | ✅ |
| **Create** a venue | ❌ | ✅ (own) | ❌ ¹ |
| View / edit / delete venues | ❌ | own only | all |
| Add / edit / delete seats | ❌ | own venues | all venues |
| **Create** a show (event) | ❌ | ✅ (own) | ❌ ¹ |
| View / edit / publish / delete shows | ❌ | own only | all |
| Schedule / edit / cancel / delete screenings | ❌ | own shows | all shows ² |
| Browse published events (no login needed) | ✅ | ✅ | ✅ |
| Hold seats, book, view own bookings (verified account) | ✅ | ✅ | ✅ |

¹ Every venue and show needs an organizer owner, and ownership always comes from the session, never the request body. An admin therefore has no one to create them for.
² The screening's venue must still belong to the **show's organizer**, even when an admin schedules it.

### 3.3 "Not yours" returns 404

Organizers can only reach their own records. Ownership is added to the SQL `WHERE` clause itself (`ownerScope`, §8.6), so another organizer's venue behaves exactly like a missing one and returns **404 Not Found**, not 403. This stops organizers probing which ids exist.

---

## 4. User flows

### 4.1 Account lifecycle (built)

```mermaid
sequenceDiagram
    actor U as User
    participant FE as Frontend
    participant API as Backend
    participant DB as Postgres

    U->>FE: Fill register form
    FE->>API: POST /api/auth/register
    API->>DB: insert user (buyer, unverified, sha256(token))
    API-->>API: log verify link (email not wired yet)
    API-->>FE: 202 "If that email is available, a link has been sent"
    U->>FE: Open /verify?token=…
    FE->>API: GET /api/auth/verify?token=…
    API->>DB: UPDATE … WHERE token_hash AND not verified AND not expired
    API-->>FE: 200 + Set-Cookie jwt (user is now signed in)
    FE-->>U: "Email verified" → Account page
    Note over U,API: Later sessions
    U->>FE: Sign in
    FE->>API: POST /api/auth/login
    API-->>FE: 200 + Set-Cookie jwt  (403 EMAIL_NOT_VERIFIED if unverified)
```

Rules:
- **An unverified user cannot log in at all.** `protectRoute` also rejects unverified users.
- The verification token is valid for **24 hours** and can be used once.
- Registering again with an unverified email issues a **fresh** link.

### 4.2 Becoming an organizer (built)

```mermaid
stateDiagram-v2
    [*] --> Buyer
    Buyer --> Pending: POST /api/application (description)
    Pending --> Approved: admin approves
    Pending --> Rejected: admin rejects
    Approved --> [*]: users.role = organizer (same transaction)
    Rejected --> [*]: stays buyer (cannot re-apply today)
```

### 4.3 Organizer: from venue to sellable showtime (built)

```mermaid
flowchart LR
    A[Create venue] --> B[Add seat rows<br/>A: 12 gold, B: 12 gold, …]
    B --> C[Create event<br/>starts as draft]
    C --> D[Schedule screening<br/>venue + time + price per category]
    D --> E[Seat inventory built<br/>one row per seat]
    C --> F[Publish event<br/>one-way]
    E --> G((Ready for buyers))
    F --> G
```

What each step enforces:
1. **Venue:** name, city, address. The venue is owned by the creating organizer.
2. **Seat layout:** added a whole row at a time (`{ row: "A", seats: 12, category: "gold" }`). The server expands each row into seats `A1…A12`. The layout **locks** while the venue has any upcoming scheduled screening.
3. **Event:** title, description, type, language, duration, age rating, optional genre and poster. It starts as a **draft**, visible only to its organizer and admins.
4. **Screening:**
   - Must start at least **24 h** and at most **180 days** ahead.
   - Needs a **15-minute** gap from any other screening at the venue.
   - Must set a price for **exactly** the categories that venue has.
   - Creating it copies every venue seat into `screening_seats` as `available` at its category's price.
5. **Publish:** one-way. There is no unpublish.

After seats are held or booked, a screening's venue, time and prices are frozen, and it can only be **cancelled**.

### 4.4 Buyer: booking (built; payment is a mock)

```mermaid
flowchart LR
    A[Browse published events<br/>by city] --> B[Pick a screening]
    B --> C[Seat map: pick ≤ 10 seats]
    C --> D[Seats held 10 min<br/>status=held, held_until]
    D --> E{Paid in time?}
    E -- yes --> F[Booking confirmed<br/>seats → booked]
    E -- no --> G[Hold lapses<br/>seat back to available]
```

Detailed design: [`docs/buyer-flow-plan.md`](buyer-flow-plan.md) (backend) and [`Frontend/docs/buyer-frontend-plan.md`](../Frontend/docs/buyer-frontend-plan.md). Payment is still a mock "Pay" button; Razorpay is planned (§17).

Business rules:
- Any signed-in, verified user can buy, whatever their role.
- A buyer holds **at most 10 seats** per screening at once. Adding seats joins the existing hold window instead of restarting it.
- Booking stays open until the screening starts.
- **Tickets are non-refundable.**
- Hold expiry is **lazy**: a hold whose `held_until < NOW()` is treated as expired the next time the seat is read or written. There is no background job.
- A `screening_seats` row with `status = booked` and a `booking_id` **is** the ticket. There is no separate tickets table.

### 4.5 Admin (built)

Admins review pending applications at `/admin/applications` and approve or reject them. Through the organizer endpoints they can also view and manage every venue, show and screening.

---

## 5. System architecture

### 5.1 High-level view

```mermaid
flowchart LR
    subgraph Browser
        SPA["React SPA (Vite)<br/>Redux Toolkit + RTK Query<br/>React Router"]
    end
    subgraph Server["Node.js / Express 5 (TypeScript)"]
        MW["cors · json(100kb) · cookie-parser"]
        R["Routers<br/>/api/auth · /api/application<br/>/api/venues · /api/shows · /api/screenings"]
        G["protectRoute (JWT cookie)<br/>requireRole(...)<br/>rate limiters (auth)"]
        C["Controllers<br/>zod validation → Drizzle queries/transactions"]
    end
    DB[("PostgreSQL<br/>book_tickets")]

    SPA -- "fetch, credentials: include<br/>httpOnly cookie 'jwt'" --> MW --> R --> G --> C
    C -- "node-postgres Pool" --> DB
```

- **Two independent apps** live in one repository: `Backend/` (REST API) and `Frontend/` (single-page app). They talk over JSON via HTTP.
- **Sessions are stateless JWTs** stored in an `httpOnly` cookie named `jwt`. The browser attaches the cookie automatically, and JavaScript can never read it.
- **CORS** allows exactly one origin (`CLIENT_URL`) with credentials.

### 5.2 Life of a request

Example: `PUT /api/venues/7`.

1. `cors` checks that the origin is `CLIENT_URL`. `express.json` parses the body (100 KB max) and `cookie-parser` reads `jwt`.
2. The router matches `/api/venues/:venueId`.
3. `protectRoute`:
   - verifies the JWT signature and expiry
   - loads `{ id, username, email, role, isVerified }` from the database
   - rejects the request if the user no longer exists or is unverified
   - attaches the result to `req.user`
4. `requireRole("organizer", "admin")` returns 403 for any other role.
5. The controller:
   - parses `req.params` and `req.body` with **zod** (400 with field errors on failure)
   - runs a Drizzle query whose `WHERE` includes `ownerScope(...)`
   - uses a transaction with row locks where invariants matter
6. The response is JSON: `{ success, message, venue }` on success, or `{ message }` with the right status code.

---

## 6. Technology stack

### 6.1 Languages

| Language | Where |
| :--- | :--- |
| **TypeScript** | All backend and frontend code (strict mode) |
| **SQL (PostgreSQL dialect)** | Generated migrations in `Backend/drizzle/`, plus a few raw `sql` fragments in queries |
| **CSS** (Tailwind v4 + custom properties) | `Frontend/src/index.css` and utility classes |
| **HTML** | `Frontend/index.html` shell |

### 6.2 Backend libraries

| Package | Version | Used for |
| :--- | :--- | :--- |
| `express` | 5.x | HTTP server and routing. Express 5 forwards rejected async handlers to the error handler. |
| `pg` | 8.x | PostgreSQL driver (`Pool` in `config/db.ts`) |
| `drizzle-orm` | 0.45 | Type-safe SQL query builder: schema definition, queries, transactions, `.for("update")` row locks |
| `drizzle-kit` (dev) | 0.31 | Generates SQL migrations from `schema.ts` and applies them |
| `zod` | 4.x | Validates request bodies, params and queries, and the environment variables at boot |
| `jsonwebtoken` | 9.x | Signs and verifies session JWTs (HS256, 7-day expiry) |
| `bcrypt` | 6.x | Password hashing (10 salt rounds) |
| `cookie-parser` | 1.x | Reads the `jwt` cookie into `req.cookies` |
| `cors` | 2.x | Allows the frontend origin with credentials |
| `express-rate-limit` | 8.x | Throttles login, register, verify and the auth router as a whole |
| `dotenv` | 17.x | Loads `.env` |
| `tsx` (dev) | 4.x | Runs TypeScript directly with file watching (`npm run dev`) |
| `typescript` (dev) | 7.x | Compiles to `dist/` (`npm run build`) |
| Node `crypto` | built-in | Random verification tokens and their SHA-256 hashes |

### 6.3 Frontend libraries

| Package | Version | Used for |
| :--- | :--- | :--- |
| `react`, `react-dom` | 19.x | UI |
| `react-router-dom` | 7.x | Data router (`createBrowserRouter`), nested layouts, route guards |
| `@reduxjs/toolkit` | 2.x | Store setup, slices, and **RTK Query** for all server data (fetching, caching, invalidation) |
| `react-redux` | 9.x | React bindings (`Provider`, typed hooks) |
| `lucide-react` | — | Icon set (1.5px stroke, per the design system) |
| `vite` (dev) | 8.x | Dev server (port 5173) and production bundler |
| `@vitejs/plugin-react` (dev) | 6.x | React Fast Refresh, JSX transform |
| `tailwindcss` + `@tailwindcss/vite` (dev) | 4.x | Utility CSS. Colors come from CSS variables in `index.css`, not the Tailwind palette. |
| `oxlint` (dev) | 1.x | Linter (`npm run lint`), with react, typescript and oxc plugins |
| `typescript` (dev) | 6.x | Type checking (`tsc -b` as part of `npm run build`) |
| Google Fonts | — | Fraunces (display serif), Inter (UI sans), JetBrains Mono (codes) |

### 6.4 Infrastructure

| Piece | Choice |
| :--- | :--- |
| Database | PostgreSQL. Local development uses Postgres.app with database `book_tickets`. |
| Backend port | `5000` (`PORT`) |
| Frontend port | `5173` (Vite default) |
| Deployment target | Render (backend). Not configured yet. |

---

## 7. Repository structure

```
SeatEase/
├── .gitignore                       ignores node_modules, dist, .env*, editor files
├── README.md                        entry point → links here
├── docs/
│   └── DOCUMENTATION.md             this file
│
├── Backend/
│   ├── package.json                 scripts: dev / build / start
│   ├── tsconfig.json                CommonJS, ES2020, strict, src → dist
│   ├── drizzle.config.ts            drizzle-kit: schema path, ./drizzle output, DATABASE_URL
│   ├── .env.example                 every required environment variable, documented
│   ├── drizzle/                     generated SQL migrations 0000…0007 + meta snapshots
│   └── src/
│       ├── server.ts                app bootstrap: middleware, route mounting, listen
│       ├── config/
│       │   ├── env.ts               zod-validated env; exits on bad config
│       │   └── db.ts                pg Pool + Drizzle instance
│       ├── db/
│       │   └── schema.ts            ★ single source of truth for tables, enums, constraints
│       ├── middleware/
│       │   ├── authMiddleware.ts    protectRoute, requireRole, Express Request typing
│       │   └── rateLimiters.ts      login/register/verify/auth limiters
│       ├── utils/
│       │   ├── access.ts            isAdmin, ownerScope (ownership in SQL)
│       │   ├── httpError.ts         HttpError(status, message)
│       │   ├── validation.ts        sendValidationError, idParam, pagination helpers
│       │   ├── pgErrors.ts          Postgres error codes → 409 handling
│       │   ├── cookieOptions.ts     shared cookie flags (set + clear can't drift)
│       │   ├── generateToken.ts     sign JWT + set cookie
│       │   ├── password.ts          bcrypt hash/compare
│       │   └── verificationToken.ts random token + sha256 hash + 24h expiry
│       ├── Auth/                    register · verify · login · logout · checkAuth
│       ├── Applications/            organizer applications + admin decision
│       ├── Venues/                  venue CRUD (mounts Seats under /:venueId/seats)
│       ├── Seats/                   seat layout (rows, single seats)
│       ├── Shows/                   events: CRUD + publish (mounts show screenings)
│       └── Screenings/              scheduling, pricing, inventory + screeningRules.ts
│
└── Frontend/
    ├── package.json                 scripts: dev / build / lint / preview
    ├── index.html                   HTML shell, fonts, <div id="root">
    ├── vite.config.ts               react + tailwind plugins
    ├── design.md                    ★ the design system (tokens, components, seat map)
    ├── docs/
    │   ├── navigation-plan.md       header + sidebar navigation plan (implemented)
    │   └── venues-events-screenings-plan.md   organizer venues/events/screenings plan (implemented)
    └── src/
        ├── main.tsx                 mounts <Provider store> + <RouterProvider>
        ├── App.tsx                  root layout route: restores session once
        ├── index.css                design tokens (CSS vars), dark tokens, base styles
        ├── app/                     store.ts, typed hooks, urlState (?tab/?page/filters), useDocumentTitle
        ├── api/                     baseQuery, errors, authApi, applicationApi, catalogApi + catalog/* endpoints
        ├── features/
        │   ├── auth/                LoginForm, RegisterForm, authSlice, useAuth
        │   ├── venues/              VenueForm, seat layout editor (map, add-rows panel, seat popover)
        │   ├── events/              EventForm, EventPublishDialog, Poster
        │   ├── screenings/          ScreeningForm, ShowScreeningsTab, ScreeningDateGroup
        │   └── toast/               toast slice, container, useToast
        ├── routes/                  route tree, ProtectedRoute, PublicOnlyRoute, RouteFallback
        ├── pages/                   route screens (account, apply, verify, admin/, organizer/{venues,events,screenings})
        ├── components/
        │   ├── layout/              AppHeader, AuthedLayout, AuthLayout, OrganizerShell, AdminShell, SectionSidebar
        │   ├── ui/                  primitives (§12.9)
        │   └── application/         ApplicationDetailPanel (admin review)
        ├── types/                   auth, application and catalog types
        └── utils/                   validation, catalogValidation, catalogDisplay, datetime (IST, INR)
```

---

## 8. Backend architecture

### 8.1 Boot sequence (`src/server.ts`)

1. `import { env } from "./config/env"` comes **first**. It validates `process.env` with zod and calls `process.exit(1)` with a readable list of problems if anything is missing or malformed. `JWT_SECRET` must be at least 32 characters.
2. Create the Express app and set `trust proxy = 1`, so `req.ip` is the real client behind Render's proxy. The rate limiters depend on this.
3. Global middleware: `cors({ origin: CLIENT_URL, credentials: true })`, `express.json({ limit: "100kb" })`, `cookieParser()`.
4. Mount routers:

   | Prefix | Router |
   | :--- | :--- |
   | `/api/auth` | `Auth/authRoutes` |
   | `/api/application` | `Applications/orgApplicationRoutes` |
   | `/api/venues` | `Venues/venueRoutes`, which nests `/:venueId/seats` → `Seats/seatRoutes` |
   | `/api/shows` | `Shows/showRoutes`, which nests `/:showId/screenings` → `showScreeningRoutes` |
   | `/api/screenings` | `Screenings/screeningRoutes` |

5. `listen(PORT)`, then `SELECT NOW()` as a connectivity check (logged, not fatal).

### 8.2 Module pattern

Every feature folder has the same three files:

| File | Responsibility |
| :--- | :--- |
| `xxxRoutes.ts` | URL → middleware chain → handler. Declares auth and role requirements. Nested routers use `Router({ mergeParams: true })` to see parent params. |
| `xxxSchemas.ts` | zod schemas for body, params and query. Error messages are written for end users. Enum value lists are duplicated from `schema.ts` on purpose, so schema files have no database import. |
| `xxxController.ts` | Handlers: parse, then authorize (ownership in SQL), then query or transact, then respond. Each handler catches its own errors and maps known ones to status codes. |

Shared rules that span modules live in their own file. For example, `Screenings/screeningRules.ts` is used by both Seats and Screenings.

### 8.3 Middleware

**`protectRoute`** (`middleware/authMiddleware.ts`)

| Outcome | Status | Body |
| :--- | :--- | :--- |
| No `jwt` cookie | 401 | `Unauthorized - No token provided` |
| Expired token | 401 | `Unauthorized - Token expired` |
| Bad signature or malformed token | 401 | `Unauthorized - Invalid Token` |
| User deleted since token issued | 401 | `Unauthorized - Session no longer valid` |
| User not verified | 403 | `{ message, code: "EMAIL_NOT_VERIFIED" }` |
| OK | — | `req.user = { id, username, email, role, isVerified }` (never the password hash) |

The user is re-read from the database on **every** request, so a role change such as a promotion to organizer takes effect immediately without a new token.

**`requireRole(...roles)`** returns 403 `Forbidden` unless `req.user.role` is in the list.

**Rate limiters** (`middleware/rateLimiters.ts`) apply only to the credential routes. Limits are relaxed outside production.

| Limiter | Window | Prod / dev limit | Key | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `loginLimiter` | 15 min | 10 / 100 | IP (/64 for IPv6) + email | Successful logins don't count |
| `registerLimiter` | 60 min | 5 / 100 | IP | |
| `verifyLimiter` | 15 min | 20 / 200 | IP | |
| `authLimiter` | 15 min | 50 / 500 | IP | Backstop across register, login and verify |

`checkAuth` and `logout` are deliberately **not** throttled. They are cheap, run on every page load, and a user must always be able to sign out.

### 8.4 Shared utilities

| Utility | What it does |
| :--- | :--- |
| `HttpError(status, message)` | Throw inside a `db.transaction()` callback. This rolls the transaction back, and the handler's `catch` turns it into the right status code. |
| `sendValidationError(res, zodError, fallback)` | Sends the standard 400 body: `{ message: firstIssue, errors: [{ field, message }] }`. |
| `idParam("venueId")` | zod schema for a positive-integer route param. |
| `paginationSchema` / `paginationMeta` | `?page` (≥1, default 1) and `?pageSize` (1–100, default 20), and returns `{ page, pageSize, total, totalPages }`. |
| `hasPgErrorCode(err, code)` | Detects `23505` (unique) and `23503` (foreign key) on the error or its Drizzle-wrapped `cause`. Used to turn constraint violations into 409s. |
| `ownerScope(column, user)` | `eq(column, user.id)` for organizers and `undefined` (no filter) for admins. See §8.6. |
| `authCookieOptions` | `{ httpOnly: true, sameSite: "strict", secure: isProduction }`, shared by set and clear so the two can't drift apart. |

### 8.5 Authentication and security design

| Concern | How it's handled |
| :--- | :--- |
| Password storage | bcrypt, 10 rounds. Passwords must be 8–72 chars with upper, lower, digit and symbol (72 is bcrypt's byte limit). |
| Session | JWT `{ userId }`, HS256, 7-day expiry, in an `httpOnly`, `sameSite=strict` cookie (`secure` in production). |
| Verification token | 32 random bytes as hex, emailed as-is; only its **SHA-256 hash** is stored. A database leak therefore doesn't leak usable links. 24 h expiry, single use. |
| Verify race safety | One `UPDATE … WHERE hash = ? AND is_verified = false AND expires > now() RETURNING`. Of two concurrent clicks, exactly one wins. |
| Account enumeration: register | Always returns **202** with the same message, whether or not the email or username exists. An existing unverified email gets a new link; a username collision gets nothing. |
| Account enumeration: login | One message for "no user" and "wrong password", and bcrypt always runs (against a dummy hash if there is no user) so timing reveals nothing. `EMAIL_NOT_VERIFIED` is only returned **after** the password matches. |
| Login format leakage | The login schema is deliberately lax (just "non-empty"), so the error doesn't say whether an address is even well-formed. |
| Brute force | Rate limits (§8.3). |
| Payload abuse | JSON bodies are capped at 100 KB. zod caps every string length to match the column limits. |
| Mass assignment | Ownership (`ownerId`/`orgId`) always comes from `req.user`. `PUT /shows/:id` and screening updates use `.strict()` schemas, so unknown fields such as `status` or `orgId` are a 400. |
| Config safety | The process refuses to boot with a weak or missing `JWT_SECRET` or `DATABASE_URL`. |
| XSS / mixed content | Poster URLs must be `https`. |

### 8.6 Access control: ownership in SQL

```ts
// utils/access.ts
export const ownerScope = (column, user) =>
    isAdmin(user) ? undefined : eq(column, user.id);

// usage
db.select().from(venues)
  .where(and(eq(venues.id, venueId), ownerScope(venues.ownerId, req.user!)))
```

- Drizzle's `and()` ignores `undefined`, so admins get no extra filter.
- A foreign record simply doesn't match, and the handler returns **404**. There is no separate "is this yours?" check that could be forgotten or could leak existence.
- Screenings have no owner column. Their access follows the show: the query joins `screenings` to `shows` and scopes on `shows.orgId`.

### 8.7 Concurrency and locking (scheduling)

Scheduling has invariants a naive "check, then write" can break under concurrency. For example, "no two screenings overlap at a venue" or "the seat layout doesn't change while a screening depends on it". SeatEase closes these races with **row locks inside transactions**.

**The convention** (documented in `screeningRules.ts`):

- Any write that depends on a venue's schedule or seat layout first locks the **venue row** (`SELECT … FOR UPDATE`). Writes for the same venue then run one after another, so the check and the write can't be separated by another transaction.
- When several rows are locked, the order is always **show → venue(s) by ascending id → screening**. Every transaction takes locks in the same order, which prevents deadlocks.
- Show locks come in two strengths:
  - `FOR UPDATE` when editing or deleting the show.
  - `FOR SHARE` when adding or moving a screening. This still blocks a concurrent duration change or delete, but lets several screenings of one show be created in parallel.

| Operation | Locks taken | Invariant protected |
| :--- | :--- | :--- |
| Add/edit/delete seats | venue (update) | No layout change while an upcoming screening exists |
| Create screening | show (share) → venue (update) | No overlap; prices match the layout; duration can't change mid-create |
| Update screening | show (share) → old and new venue (update, by id) → screening (update) | Same as above, plus "nothing sold yet" |
| Cancel / delete screening | screening (update) | Status transitions and the "nothing sold" check stay consistent |
| Update show | show (update) | Duration can't change while screenings are scheduled |
| Delete show | show (update) → its screenings (update) | Nothing sold across all its screenings |

The database backs these checks up. Foreign keys block deleting referenced rows, and unique constraints block duplicate seats. When a race slips past a check, the constraint violation is caught and returned as a **409**.

Why the overlap check is safe: `findOverlappingScreening` runs **after** the venue lock, so no other transaction can insert a screening for that venue between the check and the insert.

### 8.8 Error model and status codes

Every error is JSON with a human-readable `message`. The UI can show it as is.

```json
// 400 validation
{ "message": "Title must be at least 2 characters",
  "errors": [ { "field": "title", "message": "Title must be at least 2 characters" } ] }

// 403 with machine-readable code
{ "message": "Please verify your email address to continue.", "code": "EMAIL_NOT_VERIFIED" }

// 409 business rule
{ "message": "This venue has upcoming screenings, so its seat layout can't change" }
```

| Status | Meaning in this API |
| :--- | :--- |
| 200 | OK |
| 201 | Created (venue, seats, show, screening, application) |
| 202 | Accepted (register, which is deliberately ambiguous) |
| 400 | Validation failed, or a business input error (such as a missing price for a category) |
| 401 | Not signed in, or the session is invalid |
| 403 | Wrong role, or email not verified |
| 404 | Not found **or not yours** |
| 409 | Conflict with current state (locked layout, overlap, sold seats, duplicate row, FK-protected delete, already published or cancelled) |
| 429 | Rate limited |
| 500 | Unexpected. Logged server-side; the client gets `Internal server error`. |

---

## 9. Backend modules

Each module below covers purpose, rules and endpoints. Full request and response shapes are in §11.

### 9.1 Auth (`src/Auth`)

**Purpose:** account creation, email verification, sessions.

| Endpoint | Guard | Behaviour |
| :--- | :--- | :--- |
| `POST /api/auth/register` | authLimiter + registerLimiter | Validate → create unverified buyer (or refresh the link for an existing unverified email) → log the verify link → **202** |
| `GET /api/auth/verify?token=` | authLimiter + verifyLimiter | Atomic verify (§8.5) → set the cookie (auto sign-in) → `{ message, user }` |
| `POST /api/auth/login` | authLimiter + loginLimiter | Constant-time check → 401 / 403 `EMAIL_NOT_VERIFIED` / 200 + cookie |
| `POST /api/auth/logout` | none | Clears the cookie |
| `GET /api/auth/checkAuth` | protectRoute | Returns `req.user` |

### 9.2 Organizer applications (`src/Applications`)

**Purpose:** the only path from buyer to organizer.

| Endpoint | Guard | Behaviour |
| :--- | :--- | :--- |
| `GET /api/application` | protectRoute | The caller's latest application (404 if none) |
| `POST /api/application` | protectRoute + buyer | `{ description }` (10–2000 chars). One application per user; a second attempt returns 409. |
| `GET /api/application/all` | protectRoute + admin | Every application, newest first (not paginated) |
| `POST /api/application/decision` | protectRoute + admin | `{ applicationId, status: "approved" \| "rejected" }`. One transaction: only a **pending** application can be decided (otherwise 409); it sets status, reviewer, review time and `updatedAt`, and on `approved` promotes the requester to `organizer` **only if they are still a buyer**, so an admin is never downgraded. |

### 9.3 Venues (`src/Venues`)

**Purpose:** the physical places an organizer runs events in.

- Fields: `name` (2–100), `city` (2–100), `address` (5–300). The city is separate so buyers can later filter by city.
- `POST` is organizer-only, and ownership comes from the session.
- `DELETE` also deletes the venue's seats (FK `ON DELETE CASCADE`). It is **blocked (409)** if any screening ever used the venue, because the screenings FK has no cascade.
- Lists are paginated and newest first.

### 9.4 Seats (`src/Seats`), mounted at `/api/venues/:venueId/seats`

**Purpose:** the fixed physical layout of a venue.

- A seat is `rowLabel` (1–3 uppercase letters) + `seatNumber` (1–100) + `category`. `(venue, row, number)` is unique.
- **Created a row at a time:** `{ rows: [{ row: "A", seats: 12, category: "gold" }] }` becomes seats `A1…A12`. At most 100 rows per request, and labels must be unique within the request and not already in the venue (409 naming the clashes).
- **Listing order:** by label length, then label, then number, so the order is `A…Z, AA…`. The response includes a `summary` count per category.
- **Editing:** change one seat's category, delete one seat, or delete a whole row.
- **Layout lock:** every change first locks the venue and fails with **409** if the venue has an upcoming (`scheduled`, not yet ended) screening. Screening inventory is copied from the layout, so changing the layout under a live screening would desynchronise them.
- **History protection:** a seat referenced by a past screening's inventory can't be deleted (FK → 409).
- Deleting a single seat leaves a gap in the numbering. The UI plan uses those gaps to draw aisles.

### 9.5 Shows / Events (`src/Shows`)

**Purpose:** the event itself, independent of when or where it runs.

- Fields:

  | Field | Rule |
  | :--- | :--- |
  | `title` | 2–100 chars |
  | `description` | 10–5000 chars |
  | `type` | `movie`, `concert`, `play`, `comedy`, `sports` or `other` |
  | `genre` | Optional, 2–50 chars |
  | `language` | 2–50 chars |
  | `durationMinutes` | 1–720 |
  | `ageRating` | `U`, `UA` or `A` |
  | `posterUrl` | Optional, https only, up to 2000 chars |

- **Lifecycle:** created as `draft` → `POST /publish` → `published` (sets `publishedAt`). This is one-way; publishing an already-published show returns 409. The `UPDATE` matches on `status = 'draft'`, so two concurrent publishes can't both succeed.
- **Update** is a strict partial: `status` and `orgId` can't be sent. `genre` and `posterUrl` accept `null` to clear them.
- **Duration lock:** `durationMinutes` can't change while the show has any `scheduled` screening, because each screening's stored `endsAt` depends on it.
- **Delete:** blocked (409) if any of its screenings has held or booked seats. Otherwise it deletes inventory, prices, screenings and the show in FK order, in one transaction.
- `GET /shows/:showId` includes a compact schedule: each screening with venue name, city, times and status.

### 9.6 Screenings (`src/Screenings`)

**Purpose:** a sellable showtime, meaning one show at one venue at one time, with prices and a seat inventory.

**Create** (`POST /api/shows/:showId/screenings`, body `{ venueId, startsAt, prices }`):
1. Validate `startsAt`. It needs an ISO date-time **with a timezone offset** (such as `2026-10-05T19:30:00+05:30`), must be at least 24 h ahead, and at most 180 days ahead. It is stored as UTC.
2. Lock the show (share). A 404 means the show doesn't exist or isn't yours.
3. Lock the venue, which must belong to the **show's** organizer.
4. Prices must cover exactly the venue's seat categories:
   - a missing category → 400
   - an extra category → 400
   - a venue with no seats → 409
   - each price must be 0–100000 with at most 2 decimals
5. `endsAt = startsAt + durationMinutes`. Reject overlaps with any `scheduled` screening at the venue, including a **15-minute** buffer on both sides (409 naming the clash).
6. Insert the screening, the prices, and the **inventory**: one `INSERT … SELECT` that copies every venue seat into `screening_seats` at its category's price with `status = available`. A single statement works for any venue size.

**Update** (`PUT /api/screenings/:id`, any of `venueId`, `startsAt`, `prices`):
- Refused (409) if the screening is cancelled, has already started, or has **any held or booked seat**.
- Moving it to another venue or changing prices rebuilds the prices and inventory. If a venue change sends no prices, the current prices are reused and must cover the new venue's categories.

**Cancel** (`POST /api/screenings/:id/cancel`):
- Allowed until the screening starts. Sets `status = cancelled` and `cancelledAt`.
- Inventory, holds and bookings are **kept**, so a future booking or refund module knows who held what.

**Delete** (`DELETE /api/screenings/:id`):
- Only if nothing is held or booked. Otherwise 409: cancel it instead.

**Responses** include `show`, `venue`, `prices` per category and `seats: { available, held, booked, total }`.

**Shared rules** (`screeningRules.ts`):

| Rule | Detail |
| :--- | :--- |
| `SCREENING_BUFFER_MINUTES` | 15 |
| `screeningEndsAt(startsAt, durationMinutes)` | Computes the end time |
| `lockShow`, `lockVenue` | Row locks |
| `hasUpcomingScreenings(venueId)` | A scheduled screening that hasn't ended yet |
| `findOverlappingScreening` | Buffered range query |
| `hasSoldSeats(screeningIds)` | Any seat that is held or booked. Expired holds still count until the booking module adds expiry. |

---

## 10. Database

### 10.1 Entity-relationship diagram

```mermaid
erDiagram
    users ||--o{ venues : "owns (owner_id)"
    users ||--o{ shows : "organizes (org_id)"
    users ||--o{ org_applications : "requests (requester_id)"
    users ||--o{ org_applications : "reviews (approver_id)"
    users ||--o{ bookings : "makes (user_id)"
    venues ||--o{ seats : "has (cascade delete)"
    venues ||--o{ screenings : "hosts"
    shows ||--o{ screenings : "scheduled as"
    screenings ||--o{ screening_prices : "priced by"
    screenings ||--o{ screening_seats : "inventory"
    screenings ||--o{ bookings : "sold in"
    seats ||--o{ screening_seats : "appears in"
    bookings |o--o{ screening_seats : "covers"

    users {
        serial id PK
        varchar username UK
        varchar email UK
        varchar password_hash
        user_roles role
        date dob
        text address
        boolean is_verified
        varchar verification_token_hash
        timestamptz verification_token_expires
    }
    venues {
        serial id PK
        int owner_id FK
        varchar name
        varchar city
        text address
    }
    seats {
        serial id PK
        int venue_id FK
        varchar row_label
        int seat_number
        seat_category category
    }
    shows {
        serial id PK
        int org_id FK
        varchar title
        text description
        show_type type
        varchar genre
        varchar language
        int duration_minutes
        age_rating age_rating
        text poster_url
        show_status status
        timestamptz published_at
    }
    screenings {
        serial id PK
        int show_id FK
        int venue_id FK
        timestamptz starts_at
        timestamptz ends_at
        screening_status status
        timestamptz cancelled_at
    }
    screening_prices {
        serial id PK
        int screening_id FK
        seat_category category
        numeric price
    }
    screening_seats {
        serial id PK
        int screening_id FK
        int seat_id FK
        int booking_id FK
        numeric price
        seat_status status
        timestamptz held_until
    }
    bookings {
        serial id PK
        int user_id FK
        int screening_id FK
        booking_status status
        numeric total_amount
    }
    org_applications {
        serial id PK
        int requester_id FK
        text description
        application_status status
        int approver_id FK
        timestamp reviewed_at
    }
```

Every table also has `created_at` and `updated_at` (`timestamp DEFAULT now()`), omitted from the diagram.

### 10.2 Enums (Postgres `ENUM` types)

| Enum | Values |
| :--- | :--- |
| `user_roles` | `admin`, `organizer`, `buyer` |
| `seat_category` | `gold`, `platinum`, `sofa` |
| `show_type` | `movie`, `concert`, `play`, `comedy`, `sports`, `other` |
| `age_rating` | `U`, `UA`, `A` |
| `show_status` | `draft`, `published` |
| `screening_status` | `scheduled`, `cancelled` |
| `seat_status` | `available`, `held`, `booked` |
| `booking_status` | `pending`, `confirmed`, `cancelled` |
| `application_status` | `pending`, `approved`, `rejected` |

Postgres enums are used for every fixed-value field, so the **database itself** rejects invalid values, not just the app.

### 10.3 Tables in detail

#### `users`
| Column | Type | Constraints / notes |
| :--- | :--- | :--- |
| id | serial | PK |
| username | varchar(50) | NOT NULL, UNIQUE (the API allows 3–30 of `[A-Za-z0-9_-]`) |
| email | varchar(150) | NOT NULL, UNIQUE, stored lowercase |
| password_hash | varchar(255) | bcrypt |
| role | user_roles | default `buyer` |
| dob, address | date, text | nullable, currently unused by the API |
| is_verified | boolean | default false. Login is blocked while false. |
| verification_token_hash | varchar(64) | SHA-256 hex, nulled after verify. **Indexed.** |
| verification_token_expires | timestamptz | nullable. A null value counts as expired. |

#### `venues`
| Column | Type | Notes |
| :--- | :--- | :--- |
| owner_id | int → users.id | NOT NULL. **Indexed** (`venues_owner_id_idx`). |
| name, city | varchar(100) | NOT NULL |
| address | text | NOT NULL (API: 5–300) |

#### `seats`
| Column | Type | Notes |
| :--- | :--- | :--- |
| venue_id | int → venues.id | **ON DELETE CASCADE** |
| row_label | varchar(3) | `A`–`ZZZ` |
| seat_number | int | 1-based position in the row |
| category | seat_category | |
| — | UNIQUE | `(venue_id, row_label, seat_number)` |

#### `shows`
| Column | Type | Notes |
| :--- | :--- | :--- |
| org_id | int → users.id | **Indexed** |
| title | varchar(100) | |
| description | text | |
| type | show_type | |
| genre | varchar(50) | nullable |
| language | varchar(50) | |
| duration_minutes | int | |
| age_rating | age_rating | |
| poster_url | text | nullable, https |
| status | show_status | default `draft` |
| published_at | timestamptz | set on publish |

#### `screenings`
| Column | Type | Notes |
| :--- | :--- | :--- |
| show_id | int → shows.id | **Indexed** |
| venue_id | int → venues.id | |
| starts_at | timestamptz | UTC |
| ends_at | timestamptz | Stored rather than computed, so overlap checks are a plain range query. It can't drift, because duration is locked while screenings exist. |
| status | screening_status | default `scheduled` |
| cancelled_at | timestamptz | |
| — | INDEX | `(venue_id, starts_at)` for overlap and upcoming queries |

#### `screening_prices`
| Column | Type | Notes |
| :--- | :--- | :--- |
| screening_id | int → screenings.id | |
| category | seat_category | |
| price | numeric(10,2) | |
| — | UNIQUE | `(screening_id, category)` |

#### `screening_seats` (the inventory and the ticket)
| Column | Type | Notes |
| :--- | :--- | :--- |
| screening_id | int → screenings.id | |
| seat_id | int → seats.id | |
| booking_id | int → bookings.id | nullable. Set once booked. |
| held_by | int → users.id | nullable. The buyer holding the seat, set only while `held`. |
| price | numeric(10,2) | Copied from `screening_prices` at build time |
| status | seat_status | default `available` |
| held_until | timestamptz | Set only while `held` (lazy expiry) |
| — | UNIQUE | `(screening_id, seat_id)`: one inventory row per seat per screening |

#### `bookings`
| Column | Type | Notes |
| :--- | :--- | :--- |
| user_id | int → users.id | |
| screening_id | int → screenings.id | **Indexed.** A booking is restricted to one screening. |
| status | booking_status | default `pending` |
| total_amount | numeric(10,2) | |

#### `org_applications`
| Column | Type | Notes |
| :--- | :--- | :--- |
| requester_id | int → users.id | |
| description | text | 10–2000 via API |
| status | application_status | default `pending` |
| approver_id | int → users.id | nullable. Named `reviewerId` in code. |
| reviewed_at | timestamp | nullable |

### 10.4 Design decisions worth knowing

- **Money is always `numeric(10,2)`**, never float. Drizzle returns it as a **string** (`"250.00"`) so no precision is lost; convert it only for display.
- **Price lives on the screening, not the seat.** The same seat can cost different amounts at different showtimes.
- **Availability lives on `screening_seats`, not `seats`.** A seat's state is per screening.
- **Delete behaviour:** every FK is `NO ACTION` (a delete is blocked while referenced) except `seats.venue_id`, which is `CASCADE`. The API turns blocked deletes into readable 409s.
- **`updated_at` is not automatic.** `DEFAULT now()` fires on insert only, so every `UPDATE` in the code sets `updatedAt: new Date()` explicitly. Remember this when writing new updates.
- **Timestamps:** domain times (`starts_at`, `ends_at`, `published_at`, `held_until`, token expiry) are `timestamptz`. The audit columns `created_at` and `updated_at` are plain `timestamp`.

### 10.5 Migrations

- Source of truth: `Backend/src/db/schema.ts`.
- Generated SQL: `Backend/drizzle/0000…0007_*.sql`, with snapshots in `drizzle/meta/`.
- History (from git):

  | Migration | Change |
  | :--- | :--- |
  | 0000 | `users` |
  | 0001 | `venues`, `seats`, enums `seat_category` and `user_roles`, `users.role` |
  | 0002 | `shows`, `screenings`, `screening_seats`, `bookings`, enums `seat_status` and `booking_status` |
  | 0003 | `org_applications`, enum `application_status`, the `admin` role value |
  | 0004 | Hashed verification tokens (`verification_token_hash`) |
  | 0005 | Intentionally a no-op |
  | 0006 | Seat `row_label` and the `(venue, row, number)` unique constraint, cascade from venue |
  | 0007 | Venue `owner_id`, show metadata and `status`, screening `ends_at`/`status`/`cancelled_at`, `screening_prices`, `bookings.screening_id`, the new enums, and all the FK indexes |

- Workflow: edit `schema.ts`, run `npx drizzle-kit generate`, review the SQL, then run `npx drizzle-kit migrate`. See §14.

---

## 11. API reference

Base URL: `http://localhost:5000/api` (dev). All bodies are JSON. Authenticated endpoints need the `jwt` cookie; from a browser, send requests with `credentials: 'include'`.

Common success envelope: `{ "success": true, "message": "…", <resource>: … }`. The auth endpoints omit `success`.

Common list envelope: `{ …, "<items>": [...], "pagination": { "page": 1, "pageSize": 20, "total": 43, "totalPages": 3 } }`.

### 11.1 Endpoint index

| # | Method | Path | Auth | Roles |
| :- | :--- | :--- | :--- | :--- |
| 1 | POST | `/auth/register` | — | — |
| 2 | GET | `/auth/verify?token=` | — | — |
| 3 | POST | `/auth/login` | — | — |
| 4 | POST | `/auth/logout` | — | — |
| 5 | GET | `/auth/checkAuth` | ✅ | any |
| 6 | GET | `/application` | ✅ | any |
| 7 | POST | `/application` | ✅ | buyer |
| 8 | GET | `/application/all` | ✅ | admin |
| 9 | POST | `/application/decision` | ✅ | admin |
| 10 | GET | `/venues` | ✅ | organizer, admin |
| 11 | GET | `/venues/:venueId` | ✅ | organizer, admin |
| 12 | POST | `/venues` | ✅ | organizer |
| 13 | PUT | `/venues/:venueId` | ✅ | organizer, admin |
| 14 | DELETE | `/venues/:venueId` | ✅ | organizer, admin |
| 15 | GET | `/venues/:venueId/seats` | ✅ | organizer, admin |
| 16 | POST | `/venues/:venueId/seats` | ✅ | organizer, admin |
| 17 | PATCH | `/venues/:venueId/seats/:seatId` | ✅ | organizer, admin |
| 18 | DELETE | `/venues/:venueId/seats/:seatId` | ✅ | organizer, admin |
| 19 | DELETE | `/venues/:venueId/seats/rows/:row` | ✅ | organizer, admin |
| 20 | GET | `/shows` | ✅ | organizer, admin |
| 21 | GET | `/shows/:showId` | ✅ | organizer, admin |
| 22 | POST | `/shows` | ✅ | organizer |
| 23 | PUT | `/shows/:showId` | ✅ | organizer, admin |
| 24 | POST | `/shows/:showId/publish` | ✅ | organizer, admin |
| 25 | DELETE | `/shows/:showId` | ✅ | organizer, admin |
| 26 | GET | `/shows/:showId/screenings` | ✅ | organizer, admin |
| 27 | POST | `/shows/:showId/screenings` | ✅ | organizer, admin |
| 28 | GET | `/screenings/:screeningId` | ✅ | organizer, admin |
| 29 | PUT | `/screenings/:screeningId` | ✅ | organizer, admin |
| 30 | POST | `/screenings/:screeningId/cancel` | ✅ | organizer, admin |
| 31 | DELETE | `/screenings/:screeningId` | ✅ | organizer, admin |

| 32 | PATCH | `/auth/me` (city) | ✅ | any |
| 33 | GET | `/catalog/cities` | — | — |
| 34 | GET | `/catalog/home` | — | — |
| 35 | GET | `/catalog/events` (city, date incl. `weekend`, type, page) | — | — |
| 36 | GET | `/catalog/events/:showId` | — | — |
| 37 | GET | `/catalog/screenings/:screeningId/seats` | — | — |
| 38 | POST | `/screenings/:screeningId/holds` | ✅ | any |
| 39 | DELETE | `/screenings/:screeningId/holds` | ✅ | any |
| 40 | GET | `/screenings/:screeningId/holds/me` | ✅ | any |
| 41 | POST | `/bookings` | ✅ | any |
| 42 | GET | `/bookings/me` | ✅ | any |
| 43 | GET | `/bookings/:bookingId` | ✅ | any (own) |
| 44 | POST | `/bookings/:bookingId/pay` (mock) | ✅ | any (own) |

For organizers, "organizer, admin" endpoints are further limited to **their own** records (§8.6). Endpoints 33–44 are the buyer flow; request and response shapes are in `docs/buyer-flow-plan.md` and `Frontend/src/types/buyer.types.ts`.

### 11.2 Auth

**POST `/auth/register`**
```json
// request
{ "username": "clara_k", "email": "clara@example.com", "password": "Str0ng!pass" }
// 202 (always, whether or not the account exists)
{ "message": "If that email is available, a verification link has been sent. Please check your inbox." }
```
Errors: 400 (field errors), 429.

**GET `/auth/verify?token=<64 hex>`**
```json
// 200 + Set-Cookie: jwt=…
{ "message": "Email verified successfully",
  "user": { "id": 3, "username": "clara_k", "email": "clara@example.com", "role": "buyer", "isVerified": true } }
```
Errors: 400 `This verification link is invalid, expired, or already used.`, 429.

**POST `/auth/login`**
```json
// request
{ "email": "clara@example.com", "password": "Str0ng!pass" }
// 200 + Set-Cookie
{ "message": "Login successful", "user": { "id": 3, "username": "clara_k", "email": "…", "role": "buyer", "isVerified": true } }
```
Errors: 400, 401 `Invalid email or password`, 403 `{ code: "EMAIL_NOT_VERIFIED" }`, 429.

**POST `/auth/logout`** returns `200 { "message": "Logout successful" }` and clears the cookie.

**GET `/auth/checkAuth`** returns `200 { "success": true, "message": "Authenticated", "user": { … } }`, or the 401/403 responses from §8.3.

### 11.3 Organizer applications

**GET `/application`** returns `200 { success, message, application }` (the caller's latest), or 404 `No application found`.

**POST `/application`** (buyer)
```json
// request
{ "description": "We run a 3-screen cinema in Pune and want to list our shows." }
// 201
{ "success": true, "message": "Application sent", "application": { "id": 5, "requesterId": 3, "status": "pending", … } }
```
Errors: 400 validation, 409 `You have already submitted an application`, 403 for non-buyers.

**GET `/application/all`** (admin) returns `200 { success, message, applications: OrgApplication[] }`, newest first.

**POST `/application/decision`** (admin)
```json
// request
{ "applicationId": 5, "status": "approved" }
// 200
{ "success": true, "message": "Application approved",
  "application": { "id": 5, "status": "approved", "reviewerId": 1, "reviewedAt": "…", … },
  "user": { "id": 3, "role": "organizer" } }   // only id and role; null unless a buyer was promoted
```
A rejection returns `"message": "Application rejected"`. Errors: 400 (status must be `approved` or `rejected`), 404 `Application not found`, 409 `This application has already been reviewed`.

### 11.4 Venues

`Venue = { id, ownerId, name, city, address, createdAt, updatedAt }`

| Endpoint | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| GET `/venues?page=1&pageSize=20&ownerId=` | `ownerId` optional (admins: one organizer's venues) | `{ venues: (Venue & { seatCount })[], pagination }`, newest first | 400 query |
| GET `/venues/:venueId` | — | `{ venue }` | 404 |
| POST `/venues` | `{ name, city, address }` | 201 `{ venue }` | 400, 403 admin |
| PUT `/venues/:venueId` | any subset of the create fields | `{ venue }` | 400 (including an empty body), 404 |
| DELETE `/venues/:venueId` | — | `{ venue }` | 404, 409 `This venue has screenings and cannot be deleted` |

### 11.5 Seats

`Seat = { id, venueId, rowLabel, seatNumber, category, createdAt, updatedAt }`

**GET `/venues/:venueId/seats`**
```json
{ "success": true, "message": "Seats fetched successfully",
  "seats": [ { "id": 1, "venueId": 7, "rowLabel": "A", "seatNumber": 1, "category": "gold", … }, … ],
  "summary": { "gold": 120, "platinum": 40, "sofa": 20, "total": 180 },
  "layoutLocked": false }   // true while an upcoming screening depends on the layout
```

**POST `/venues/:venueId/seats`**
```json
// request (1–100 rows; row = 1–3 letters, auto-uppercased; seats = 1–100)
{ "rows": [ { "row": "A", "seats": 12, "category": "gold" },
            { "row": "B", "seats": 12, "category": "platinum" } ] }
// 201
{ "success": true, "message": "24 seats created", "seats": [ … ] }
```
Errors: 400, 404 venue, 409 `Row(s) already exist in this venue: A`, 409 layout locked.

| Endpoint | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| PATCH `/seats/:seatId` | `{ category }` | `{ seat }` | 404, 409 locked |
| DELETE `/seats/:seatId` | — | `{ seat }` | 404, 409 locked, 409 used by a past screening |
| DELETE `/seats/rows/:row` | — | `{ message: "Row C deleted (14 seats)" }` | 404, 409 locked, 409 past screening |

The layout-locked message is always: `This venue has upcoming screenings, so its seat layout can't change`.

### 11.6 Shows (Events)

`Show = { id, orgId, title, description, type, genre|null, language, durationMinutes, ageRating, posterUrl|null, status, publishedAt|null, createdAt, updatedAt }`

**POST `/shows`**
```json
// request
{ "title": "Dune: Part Three", "description": "The final chapter…", "type": "movie",
  "genre": "Sci-fi", "language": "English", "durationMinutes": 165, "ageRating": "UA",
  "posterUrl": "https://cdn.example.com/dune3.jpg" }
// 201
{ "success": true, "message": "Show created", "show": { "id": 12, "status": "draft", … } }
```

| Endpoint | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| GET `/shows?status=draft&page=1` | — | `{ shows, pagination }` | 400 |
| GET `/shows/:showId` | — | `{ show: Show & { screenings: [{ id, venueId, venueName, venueCity, startsAt, endsAt, status }] } }` | 404 |
| PUT `/shows/:showId` | strict partial of the create fields (`null` clears `genre`/`posterUrl`) | `{ show }` | 400 (unknown field, empty body), 404, 409 duration locked |
| POST `/shows/:showId/publish` | — | `{ show }` (status `published`) | 404, 409 already published |
| DELETE `/shows/:showId` | — | `{ show }` | 404, 409 sold or held seats |

### 11.7 Screenings

```ts
Screening = {
  id, showId, venueId, startsAt, endsAt, status, cancelledAt, createdAt, updatedAt,
  show:   { id, title, durationMinutes, status },   // on single-screening responses
  venue:  { id, name, city },
  prices: { gold?: "250.00", platinum?: "400.00", sofa?: "900.00" },
  seats:  { available, held, booked, total }
}
```

**POST `/shows/:showId/screenings`**
```json
// request
{ "venueId": 7, "startsAt": "2026-10-12T19:30:00+05:30",
  "prices": { "gold": 250, "platinum": 400, "sofa": 900 } }
// 201
{ "success": true, "message": "Screening created",
  "screening": { "id": 40, "startsAt": "2026-10-12T14:00:00.000Z", "endsAt": "2026-10-12T16:45:00.000Z",
                 "status": "scheduled", "venue": { … }, "show": { … },
                 "prices": { "gold": "250.00", … }, "seats": { "available": 180, "held": 0, "booked": 0, "total": 180 } } }
```

Errors for create and update:

| Status | Cause |
| :--- | :--- |
| 400 | startsAt missing an offset, less than 24 h ahead, or more than 180 d ahead |
| 400 | Price invalid, missing for a venue category, or given for a category the venue lacks |
| 404 | Show or venue not found, or the venue isn't owned by the show's organizer |
| 409 | Venue has no seats |
| 409 | Overlaps screening #N (message includes times and the 15-min buffer) |

| Endpoint | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| GET `/shows/:showId/screenings?status=scheduled&when=upcoming&page=1` | `status` and `when` (`upcoming` = not yet started, `past` = started) are optional | `{ screenings: Screening[], pagination }`, by start time; `when=past` is most recent first | 404 show |
| GET `/screenings/:screeningId` | — | `{ screening }` | 404 |
| PUT `/screenings/:screeningId` | strict: at least one of `venueId`, `startsAt`, `prices` | `{ screening }` | as create, plus 409 cancelled / started / seats sold / changed concurrently |
| POST `/screenings/:screeningId/cancel` | — | `{ screening }` | 404, 409 already cancelled / started |
| DELETE `/screenings/:screeningId` | — | `{ screening }` | 404, 409 seats held or booked (cancel instead) |

---

## 12. Frontend architecture

### 12.1 Overview

```mermaid
flowchart TD
    main["main.tsx<br/>Provider(store) + RouterProvider"] --> App["App (root layout route)<br/>useAuth() → checkAuth once"]
    App --> Public["/verify · /forbidden · *"]
    App --> PO["PublicOnlyRoute<br/>/login · /register"]
    App --> PR["ProtectedRoute"]
    PR --> AL["AuthedLayout (AppHeader)"]
    AL --> Acc["/account · /apply-for-organization"]
    AL --> OrgG["ProtectedRoute organizer|admin<br/>→ OrganizerShell (sidebar)"]
    OrgG --> OD["/organizer/dashboard"]
    OrgG --> Cat["/organizer/venues · /organizer/events<br/>/organizer/screenings (lazy-loaded)"]
    AL --> AdmG["ProtectedRoute admin<br/>→ AdminShell (sidebar)"]
    AdmG --> AA["/admin/applications"]
```

The frontend is a Vite + React 19 single-page app. **Server state** (anything that comes from the API) lives in the RTK Query cache. **UI state** lives in small Redux slices or component state. Routing uses the React Router v7 data router with **layout routes** for guards and shells.

### 12.2 Entry and session restoration

- `main.tsx` wraps the app in `<Provider store>` and `<RouterProvider router>`.
- `App.tsx` is the **root layout route**. It calls `useAuth()`, which starts the single `GET /auth/checkAuth` request. Until that settles it shows `RouteFallback` ("RESTORING SESSION").
- The `<Outlet/>` stays **mounted but hidden** during restoration, rather than unmounted. Unmounting would tear down the only query subscription, reset the cache entry and refire the request in a loop. The code comments explain this in detail.

### 12.3 Session state: `useAuth()`

`features/auth/useAuth.ts` is the **single source of truth** for "who is signed in". It is derived entirely from the `checkAuth` query cache, and nothing is mirrored into a slice.

```ts
{ user, isAuthenticated, isInitialized, isLoading, isFetching, hasRole(...roles) }
```

- `isInitialized = isSuccess || isError`. A 401 is a real answer ("signed out"), not an undecided state.
- Login and logout mutations **invalidate the `User` tag**, so `checkAuth` refetches automatically and every consumer updates.
- Verify-email writes the returned user straight into the `checkAuth` cache (`upsertQueryData`) instead of using tags, so a single-use token is never refetched.

### 12.4 Routing and guards (`src/routes`)

| Route | Element | Guard |
| :--- | :--- | :--- |
| `/` | → `/account` | — |
| `/verify` | `VerifyEmailPage` | public (must work signed out) |
| `/forbidden` | `ForbiddenPage` | public |
| `/login`, `/register` | `AuthPage mode=…` | `PublicOnlyRoute` (signed-in users are redirected back) |
| `/account` | `AccountPage` | `ProtectedRoute` |
| `/apply-for-organization` | `ApplyForOrganizationPage` | `ProtectedRoute` |
| `/organizer`, `/organizer/dashboard` | `OrganizerDashboardPage` in `OrganizerShell` | `ProtectedRoute allowedRoles={['organizer','admin']}` |
| `/organizer/venues`, `/:venueId`, `/:venueId/edit` | venue list, detail (Layout · Details tabs), edit | same, lazy-loaded |
| `/organizer/events`, `/:showId`, `/:showId/edit` | event list, detail (Screenings · Details tabs), edit | same, lazy-loaded |
| `/organizer/events/:showId/screenings/new`, `/organizer/screenings/:id`, `/:id/edit` | schedule, screening detail, edit | same, lazy-loaded |
| `/organizer/venues/new`, `/organizer/events/new` | create forms | nested `ProtectedRoute allowedRoles={['organizer']}` (the API 403s admins) |
| `/admin`, `/admin/applications` | `AdminApplicationsPage` in `AdminShell` | `ProtectedRoute allowedRoles={['admin']}` |
| `*` | `NotFoundPage` | — |

`ProtectedRoute` behaviour:
- It waits while `!isInitialized` or while re-fetching after login, which prevents a bounce back to `/login` just after signing in.
- A signed-out user goes to `/login` with `state.from` set. After login, `LoginForm` sends them back to `state.from`.
- A signed-in user with the wrong role goes to `/forbidden`.
- Client guards only control navigation. The server enforces access.

### 12.5 API layer (`src/api`)

| File | reducerPath | Endpoints | Tags |
| :--- | :--- | :--- | :--- |
| `authApi.ts` | `authApi` | `checkAuth` (query), `login`, `register`, `logout` (mutations), `verifyEmail` (query) | `User` |
| `applicationApi.ts` | `applicationApi` | `getMyApplication`, `applyForOrganization`, `getApplicationList`, `applicationDecision` | `Application`, `ApplicationList`, `User` |
| `catalogApi.ts` + `catalog/*Endpoints.ts` | `catalogApi` | venues, seats, shows and screenings, added with `injectEndpoints` | `Venue`, `VenueSeats`, `Show`, `Screening` |

Venues, seats, shows and screenings share **one** API slice because they invalidate each other (scheduling a screening locks its venue's layout; deleting a show removes its screenings), and RTK Query tags only work within one `createApi`. A 401 from any catalog call invalidates the `User` tag, so an expired session sends the user to `/login` without per-page handling.

Shared conventions:
- One `baseQuery.ts`: `fetchBaseQuery({ baseUrl: VITE_API_URL || 'http://localhost:5000/api', credentials: 'include' })`, so the cookie travels with every call.
- Mutations invalidate tags **only on success**: `invalidatesTags: (result) => result ? [...] : []`. The exception is a 409 that means the cached copy is stale (layout locked, screening became read-only, show already published): that also refetches, so the page catches up.
- Error helpers live in `errors.ts` (re-exported from `authApi.ts` for older imports):
  - `getRtkErrorMessage(err)`: the best human message, with fallbacks for network, 401, 403, 404 and 500.
  - `getFieldErrors(err)`: turns the API's `errors[]` into `{ field: message }` for forms.
  - `getApiErrorCode(err)`: reads the machine `code` (for example `EMAIL_NOT_VERIFIED`).
  - `getErrorStatus(err)`: the HTTP status, or null for network failures.

The store (`app/store.ts`) registers each API's reducer and middleware, the `auth` UI slice, and `setupListeners` (refetch on focus/reconnect). Use the typed hooks `useAppDispatch` / `useAppSelector` from `app/hooks.ts`.

### 12.6 Redux slices

| Slice | State | Purpose |
| :--- | :--- | :--- |
| `auth` (`features/auth/authSlice.ts`) | `{ successMessage }` | A UI message that must survive a tab or route switch (for example "check your email"). Session data is **not** stored here. |
| `toast` (`features/toast/toastSlice.ts`) | queued toasts | Non-blocking confirmations ("Venue created", "Row C deleted"), shown in an `aria-live="polite"` region. Use `useToast()`. |

Filters, tabs and pagination live in the URL (`app/urlState.ts`: `useTabParam`, `usePageParam`, `useChoiceParam`), so they survive a refresh and can be shared as links.

### 12.7 Pages

| Page | What it does |
| :--- | :--- |
| `AuthPage` | Sign-in and create-account tabs driven by the route, with a sliding accent indicator. Keeps the post-login redirect target when switching tabs. |
| `LoginForm` | Validates on blur and on submit. Shows a dedicated calm panel for `EMAIL_NOT_VERIFIED` and a dismissible `Alert` for other failures. Redirects to `state.from` or `/account`. |
| `RegisterForm` | Username, email and password with a strength meter and rule checklist. Maps server field errors. Shows the neutral 202 message. |
| `VerifyEmailPage` | Reads `?token`, calls verify, and shows verified, failed or retry states. Replaces the URL on exit so the token isn't kept in history. |
| `AccountPage` | Profile card (avatar initial, role, verified badge), role-aware shortcut cards, sign out. |
| `ApplyForOrganizationPage` | Five states: admin (no need to apply), organizer (already approved), loading, existing application (pending / approved / rejected with its text), or the application form. |
| `AdminApplicationsPage` | Filter pills with counts (all / pending / approved / rejected), expandable rows, and `ApplicationDetailPanel` with approve/reject. |
| `OrganizerDashboardPage` | Live event and venue counts, and a next-steps checklist (venue → seat layout → event → screening → publish) whose first unfinished step is the primary action. Admins see the counts only. |
| `VenueListPage` / `VenueFormPage` / `VenueDetailPage` | Paginated list with seat counts (Owner column for admins); create/edit sending only changed fields; detail with the seat **layout editor** (map with gaps as aisles, add rows with quick fill, per-seat category/remove, row delete, read-only lock banner) and delete. |
| `EventListPage` / `EventFormPage` / `EventDetailPage` | List with All/Draft/Published filter and posters; create/edit with poster preview and the duration lock; detail with publish (one-way, confirmed), delete, and the Screenings tab (Upcoming/Past/Cancelled/All, grouped by IST day). |
| `ScreeningFormPage` / `ScreeningDetailPage` | Three-step schedule/edit form (venue → date & time with the buffer spelled out → prices per category); read-only once cancelled, started or sold. Detail shows inventory, prices, cancel and delete. |
| `ForbiddenPage`, `NotFoundPage` | 403 and 404 screens. |

### 12.8 Layout components

| Component | Role |
| :--- | :--- |
| `AppHeader` | Sticky 56px bar for signed-in users: logo, role-gated nav (Account · Apply · Organizer · Admin) with active state, and a user dropdown with role badge, account link and sign out. |
| `AuthedLayout` | Mounts `AppHeader` **once** around every authenticated route. |
| `AuthLayout` | Narrow centered column (440px card) with brand header and editorial footer, used by the auth, verify, account and apply pages. |
| `SectionSidebar` | 224px left rail on desktop and a horizontal pill scroller on mobile. Supports disabled "Soon" items. |
| `OrganizerShell` / `AdminShell` | Sidebar + `<Outlet/>`. Organizer items: Dashboard, Events, Venues (live); Analytics (Soon). Admin items: Applications (live), Users (Soon), Events (links to `/organizer/events`). The content column is `min-w-0` with no `overflow`, so sticky elements inside pages stick to the viewport. |

### 12.9 UI primitives (`components/ui`)

| Component | API highlights |
| :--- | :--- |
| `Button` | `variant: primary | secondary | ghost | danger | danger-ghost | link`, `size: sm | md | lg`, `isLoading`, `leftIcon`/`rightIcon`, forwardRef. Micro-lift hover and a focus-visible ring. |
| `Input` | `label` (caption style), `error` (danger border and message with icon, `aria-invalid` / `aria-describedby`), `helperText`, optional `leftIcon`, `rightAdornment` (such as a password reveal). |
| `Card` | `elevation: 0–3`, `isInteractive` (hover lift and stronger border). |
| `Badge` | `variant: neutral | accent | success | warning | danger | info`, caption style. |
| `Alert` | `variant: danger | success | warning | info`, `title`, optional `onClose`, `role="alert"`. |
| `Select`, `Textarea` | Same shell as `Input`; `Textarea` takes `maxChars` for a tabular counter. |
| `Modal`, `ConfirmDialog` | Focus-trapped dialog (bottom sheet on mobile); `ConfirmDialog` takes `tone: danger | accent`, a confirm label naming the action, and an inline `error` so a 409 keeps it open. |
| `Tabs` / `TabPanel` | Caption tabs with a sliding indicator; state in `?tab=`. |
| `DataTable`, `Pagination` | Table that stacks to cards under `md`; "Page 2 of 5 · 43 venues". |
| `FilterPills` | Segmented filter (`aria-pressed`), used for status filters. |
| `PageHeader` | Breadcrumbs, eyebrow, serif title, `meta`, `media` (e.g. a poster) and actions. |
| `EmptyState`, `Skeleton`, `QueryErrorState` | Empty state with one action; content-shaped loading blocks; in-shell 404 "not found" or error with Retry. |
| `StatusBadge`, `SeatSwatch` / `CategoryLegend` | Draft/published/scheduled/cancelled/past as text badges; seat category swatches. |
| `UnsavedChangesGuard` | Blocks navigation away from a dirty form. |

### 12.10 Client validation and formatting (`utils/`)

Validators mirror the backend zod rules and messages: `validateEmail`, `validateUsername`, `validatePassword`, `validateLoginPassword`, `evaluatePasswordStrength` (score 0–4 with a per-rule checklist) and `sanitizeInput`. `catalogValidation.ts` does the same for venues, seat rows, events and screenings. `datetime.ts` handles IST (`toApiDateTime` sends `+05:30`; showtimes always render in `Asia/Kolkata`) and INR formatting. **The backend remains the authority.** These checks only give faster feedback.

### 12.11 Frontend configuration

| Setting | Value |
| :--- | :--- |
| `VITE_API_URL` | API base URL (defaults to `http://localhost:5000/api`) |
| TypeScript | `strict`-style checks: `noUnusedLocals`/`Parameters`, `verbatimModuleSyntax`, bundler resolution |
| Lint | oxlint with `react/rules-of-hooks: error` |

---

## 13. Design system

The full specification is in [`Frontend/design.md`](../Frontend/design.md). The essentials:

- **Principles:**
  - *Content is the color.* Near-monochrome warm neutrals.
  - *Space over lines.*
  - *One decision per screen.*
  - *Calm under pressure.* Timers and errors get quieter, not louder.
- **Brand:** premium and editorial, light theme first.
- **Color tokens** are CSS custom properties in `src/index.css`, used in Tailwind as `bg-[var(--paper)]`:
  - Paper and ink neutrals: `--paper #FBFAF7`, `--ink #1A1815`. Pure black and pure white are not used for text or backgrounds.
  - One accent, **oxblood** `--accent #6B2737`.
  - Desaturated semantic colors (`--success`, `--warning`, `--danger`, `--info`). Danger and accent never appear together.
  - A seat-category **value ramp**: `--seat-gold` → `--seat-platinum` → `--seat-sofa` (light to deep).
- **Typography:**
  - **Fraunces** for display, tuned with `SOFT 60, WONK 0`. At most two serif elements per screen, and never in controls.
  - **Inter** for the interface.
  - **JetBrains Mono** for codes.
  - `.text-caption` is the uppercase, letter-spaced label motif.
  - `tabular-nums` is required on prices, times and counts.
- **Shape:** radius scales with element size (4, 6, 10, 16 px). Shadows are warm-tinted and rare.
- **Motion:** 150–400 ms and no bounce. Timers, prices and availability are never animated. `prefers-reduced-motion` is honored globally.
- **Dark mode:** tokens are defined under `[data-theme="dark"]`. There is no toggle yet.
- **Accessibility:** WCAG AA contrast, real labels, visible focus, and no state communicated by color alone. The seat map will be keyboard-navigable with live-region announcements.
- **Surfaces:** customer app (full editorial), organizer dashboard (denser, `container-wide`), admin (utilitarian, no serif).

---

## 14. Local setup and operations

### 14.1 Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+ (on macOS, Postgres.app is simplest), with a database named `book_tickets`

### 14.2 Backend

```bash
cd Backend
npm install
cp .env.example .env          # then edit DATABASE_URL and JWT_SECRET
# generate a secret:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

npx drizzle-kit migrate       # apply migrations in ./drizzle to DATABASE_URL
npm run dev                   # tsx watch → http://localhost:5000
```

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `dev` | `tsx watch src/server.ts` | Development with reload |
| `build` | `tsc` | Compile to `dist/` |
| `start` | `node dist/server.js` | Run the compiled server |

### 14.3 Environment variables (`Backend/.env`)

| Variable | Required | Default | Notes |
| :--- | :--- | :--- | :--- |
| `PORT` | no | 5000 | |
| `NODE_ENV` | no | development | `production` turns on secure cookies and strict rate limits |
| `CLIENT_URL` | no | http://localhost:5173 | The CORS origin. Must match the frontend exactly. |
| `SERVER_URL` | no | http://localhost:5000 | Used to build the logged verification link |
| `DATABASE_URL` | **yes** | — | `postgresql://user:pass@host:5432/book_tickets` |
| `JWT_SECRET` | **yes** | — | At least 32 characters |

### 14.4 Frontend

```bash
cd Frontend
npm install
# optional: echo "VITE_API_URL=http://localhost:5000/api" > .env.local
npm run dev                   # http://localhost:5173
npm run build                 # tsc -b && vite build → dist/
npm run lint                  # oxlint
```

### 14.5 Common operations

**Verify an account in development.** Emails aren't sent yet. After registering, the backend console prints:
```
Verify link: http://localhost:5000/api/auth/verify?token=<64 hex>
```
Open the **frontend** version, `http://localhost:5173/verify?token=<same token>`, so the SPA verifies you and updates its session. Opening the backend URL directly also verifies the account and sets the cookie, but it shows raw JSON.

**Create the first admin.** There is no API for this by design:
```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```
The change is picked up on the next request, because `protectRoute` re-reads the user every time.

**Make someone an organizer.** Have them apply at `/apply-for-organization`, then approve the application at `/admin/applications`.

**Change the schema.**
1. Edit `Backend/src/db/schema.ts`.
2. Run `npx drizzle-kit generate`, which writes a new `drizzle/000N_*.sql`.
3. Review the SQL, especially enum changes, renames and NOT NULL additions on populated tables.
4. Run `npx drizzle-kit migrate`.
5. Commit the schema, the SQL and the `meta/` snapshot together.

---

## 15. Conventions: how to add a feature

### 15.1 Backend module checklist

1. **Schema:** add tables and enums to `db/schema.ts`. Index every FK you'll filter by. Add unique constraints for real-world uniqueness. Use `numeric(10,2)` for money and `timestamptz` for domain times.
2. **Migration:** generate, review, then migrate (§14.5).
3. **`XxxSchemas.ts`:** write zod schemas whose limits match the columns and whose messages users can read. Use `.strict()` on update bodies, `idParam()` for ids, and `paginationSchema` for lists.
4. **`XxxController.ts`:**
   - `safeParse` everything and call `sendValidationError` on failure.
   - Scope by owner in the `WHERE` clause (`ownerScope`). Never trust ids from the body for ownership.
   - Use `db.transaction` with row locks whenever a check must stay true until the write. Follow the lock order show → venue → screening, and extend it deliberately if you add new lockable rows.
   - Throw `HttpError` inside transactions, and map `23505` and `23503` to 409 with `hasPgErrorCode`.
   - Set `updatedAt: new Date()` on every update.
   - Respond with `{ success: true, message, <resource> }` and log unexpected errors before returning 500.
5. **`XxxRoutes.ts`:** use `protectRoute`, then `requireRole(...)`, then the handler. Use `Router({ mergeParams: true })` for nested resources.
6. **Mount** the router in `server.ts`.
7. Add a comment wherever a rule is non-obvious. Comments in this codebase explain **why**.

### 15.2 Frontend feature checklist

1. **Types** in `src/types/<domain>.types.ts`, matching the API JSON exactly. Money arrives as `string` and dates as ISO `string`.
2. **API:** RTK Query endpoints with `providesTags` and `invalidatesTags`, invalidating only on success. Keep resources that invalidate each other in the same API slice.
3. **Validation:** mirror the backend rules in `utils/`, and map server errors with `getFieldErrors`.
4. **Pages** under `src/pages/<area>/` and feature components under `src/features/<domain>/`. Use the UI primitives and CSS tokens only, with no raw hex or Tailwind palette colors.
5. **Routes:** add to `routes/index.tsx` inside the correct guard and shell, and enable the sidebar item.
6. **UX:** loading skeletons, empty states with one action, calm inline errors, a confirm dialog for destructive actions, and a check at 375px width.

### 15.3 Git conventions

- Commit messages are imperative and describe the outcome, for example "Add screening scheduling with seat inventory".
- Group related changes. The schema, its migration and the code that uses it go together.

---

## 16. Known limitations and gaps

These are the known issues in the current code, useful when picking up work.

| # | Area | Limitation |
| :- | :--- | :--- |
| 1 | Email | Verification links are only logged. No email provider is integrated. Planned: `docs/email-plan.md`. |
| 2 | Email | The logged link points at the **backend** `/api/auth/verify` (returns JSON), not the frontend `/verify` page. Fixed by the email plan, M2. |
| 3 | Auth | No password reset or change. The "Forgot password?" button does nothing. No resend-verification endpoint (re-registering resends). Planned: email plan, M3–M4. |
| 4 | Applications | A rejected user can't re-apply (409). An application can only be decided once, so a mistaken decision can't be reversed in the app. |
| 5 | Applications | `GET /application/all` isn't paginated and returns requester ids, not names or emails. |
| 6 | Payments | Payment is a mock "Pay" button: no money flow, no payment record. Planned: `docs/razorpay-payments-plan.md`. |
| 7 | Booking | No booking confirmation or ticket email. Buyers can't cancel a booking, and an organizer cancelling a screening doesn't refund or notify anyone (confirmed bookings show the screening as cancelled). |
| 8 | Booking | The hold and booking race conditions (row locks, lazy expiry) have no automated tests yet (buyer plan milestone 5). |
| 9 | Timezone | The API accepts any offset. The product assumes India (IST) for display. |
| 10 | DB | `updated_at` isn't trigger-maintained. Code must set it on every update. |
| 11 | Frontend | `AccountPage` and `ApplyForOrganizationPage` still render inside `AuthLayout`, which has its own brand header, so they show two headers under the global `AppHeader`. |
| 12 | Frontend | Analytics and Admin Users are still "Soon". The dashboard's checklist judges the screening and publish steps by the newest event only (no cross-event screening count in the API). The venue picker when scheduling loads at most 100 venues. |
| 13 | Frontend | Dark-mode tokens exist, but there is no theme toggle. |
| 14 | Quality | No automated tests (backend or frontend). No CI. |
| 15 | Ops | No deployment config. Cross-domain cookies need `sameSite`/CORS changes once the frontend and backend run on different domains. |
| 16 | Ops | No structured logging, request ids or health endpoint. A failed DB check at boot is logged but not fatal. |

---

## 17. Roadmap

This is a suggested order. Each step builds on the previous one.

**Done**
1. ~~Organizer UI for venues, seat layouts, events and screenings.~~ See `Frontend/docs/venues-events-screenings-plan.md`. Still open from it: the optional bulk seat-category change.
2. ~~Public catalog API, seat holds, bookings with a mock payment.~~ See `docs/buyer-flow-plan.md`.
3. ~~Buyer UI: city-first home, explore, event page, seat map, checkout with the hold timer, My bookings, ticket.~~ See `Frontend/docs/buyer-frontend-plan.md`.

**Next**

4. **Email** ([`docs/email-plan.md`](email-plan.md)):
   - M1: mail layer (SMTP via nodemailer, console fallback)
   - M2: verification mail and resend
   - M3: forgot/reset/change password, with session invalidation
   - M4: the frontend pages
5. **Razorpay payments, test mode** ([`docs/razorpay-payments-plan.md`](razorpay-payments-plan.md)):
   - P1: `payments` table
   - P2: server-created orders
   - P3: signature verify and a shared idempotent confirm, with refund-on-lost-seats
   - P4: failed attempts
   - P5: webhook
   - P6: Checkout.js on the checkout page
   - P7: booking confirmation, refund and cancellation emails
   - P8: tests
6. **Race tests and CI:** the buyer plan's milestone 5 race tests (double hold, overlapping sets, expiry, pay after expiry, the 10-seat limit) plus the payment cases, run in CI on every push.

**After that**

7. **Deployment:**
   - Render (backend and Postgres) and a static frontend host
   - cross-site cookie settings (`sameSite: "none"`, `secure`) and CORS
   - a health endpoint
   - the Razorpay webhook URL pointed at production
8. **Cleanup of §16:**
   - the double header on Account/Apply
   - re-applying after a rejection
   - a paginated admin applications list with names
   - the theme toggle
9. **Product features:**
   - buyer booking cancellation
   - automatic refunds when an organizer cancels a screening
   - organizer analytics (sales per screening, the "Soon" item)
   - admin user management
   - QR tickets

---

## 18. Related documents

| Document | What it covers |
| :--- | :--- |
| [`Frontend/design.md`](../Frontend/design.md) | Full design system: tokens, type, components, seat-map spec, accessibility |
| [`Frontend/docs/navigation-plan.md`](../Frontend/docs/navigation-plan.md) | The header and section-sidebar navigation (implemented) |
| [`Frontend/docs/venues-events-screenings-plan.md`](../Frontend/docs/venues-events-screenings-plan.md) | The organizer venue, seat layout, event and screening UI (implemented) |
| [`docs/buyer-flow-plan.md`](buyer-flow-plan.md) | Buyer backend: public catalog, holds, bookings (implemented except the race tests) |
| [`Frontend/docs/buyer-frontend-plan.md`](../Frontend/docs/buyer-frontend-plan.md) | Buyer UI: home, explore, seat map, checkout, bookings (implemented) |
| [`docs/email-plan.md`](email-plan.md) | Email: verification, resend, password reset/change, booking mails (planned) |
| [`docs/razorpay-payments-plan.md`](razorpay-payments-plan.md) | Razorpay test-mode payments, webhook, refunds (planned) |
| `Backend/src/db/schema.ts` | The authoritative data model |
| `Backend/src/Screenings/screeningRules.ts` | The locking convention and scheduling rules |
