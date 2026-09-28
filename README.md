# SeatEase

An event-ticketing platform (BookMyShow-style), branded **SeatEasy** in the UI:

- Buyers pick seats for a showtime.
- Organizers run venues, events and screenings.
- Admins approve who becomes an organizer.

It's built to model relational data properly and to handle concurrent seat booking safely with PostgreSQL transactions and row locks.

**Stack:** Node.js · Express 5 · TypeScript · PostgreSQL · Drizzle ORM · zod · JWT (httpOnly cookie) — React 19 · Vite · Redux Toolkit / RTK Query · React Router 7 · Tailwind CSS 4

📖 **Full documentation:** [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md). It covers the motive, roles, user flows, architecture, database, every API endpoint, the frontend, setup and the roadmap.

## Quick start

```bash
# Backend: needs PostgreSQL with a database named book_tickets
cd Backend
npm install
cp .env.example .env         # set DATABASE_URL and JWT_SECRET (≥ 32 chars)
npx drizzle-kit migrate
npm run dev                  # http://localhost:5000

# Frontend
cd ../Frontend
npm install
npm run dev                  # http://localhost:5173
```

Verification emails aren't sent yet. After registering, copy the token from the link printed in the backend console, then open `http://localhost:5173/verify?token=<token>`.

To make yourself an admin, run this in the database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

## Repository layout

| Path | What's there |
| :--- | :--- |
| `Backend/` | REST API. Feature modules under `src/` (Auth, Applications, Venues, Seats, Shows, Screenings), schema in `src/db/schema.ts`, migrations in `drizzle/` |
| `Frontend/` | React SPA. Design system in `design.md`, feature plans in `docs/` |
| `docs/` | Project documentation |
