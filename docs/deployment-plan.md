# Plan: Deployment (Vercel + Render + Neon, free plans)

**Status:** planned, not started.

**Decided:** frontend on **Vercel**, Express backend on **Render** (free web
service), Postgres on **Neon** (free). Free-plan limits change, so re-check
each provider's pricing page when setting up.

```
Browser ──► https://<app>.vercel.app            (static Vite build)
              │  /api/*  rewrite (server-side proxy)
              ▼
            https://<api>.onrender.com/api/*     (Express, Singapore)
              │  TLS, pooled connections
              ▼
            Neon Postgres                        (Singapore, aws-ap-southeast-1)

UptimeRobot ──every 5 min──► https://<api>.onrender.com/api/health
Razorpay webhook ──────────► https://<api>.onrender.com/api/payments/webhook
```

---

## 1. Decisions

1. **The browser only ever talks to the Vercel domain.** Vercel rewrites
   `/api/*` to Render, so the auth cookie is first-party. The current cookie
   (`sameSite: "strict"`, `secure` in production, `utils/cookieOptions.ts`)
   works unchanged. Cross-site cookies would be blocked by Safari and
   increasingly by Chrome.
2. **Everything is in Singapore.** Render and Neon must be in the same region,
   because each request runs several queries. Singapore is the closest free
   region to India for both.
3. **Keep the backend awake** with an external pinger on a database-free
   health route. It's the **only** always-on free service in that Render
   workspace, because the roughly 750 free hours a month are shared by the
   whole workspace.
4. **Run migrations from your machine** against Neon's direct (non-pooled) URL.
   Don't run them on every deploy, because Render's pre-deploy command isn't on
   the free plan.
5. **Machine-to-machine calls go straight to Render,** not through Vercel: the
   pinger and the Razorpay webhook.

---

## 2. Milestone D1: Code changes before the first deploy (small)

| Where | Change | Why |
| :--- | :--- | :--- |
| Backend: new `GET /api/health` | Returns `{ ok: true }`. **No database query**, no auth, no rate limiter. Mount it before the other routers. | The pinger target. If it queried Neon, Neon would never sleep and would burn its free compute hours. |
| `Backend/src/server.ts`: `trust proxy` | The chain is browser → Vercel → Render's proxy → app, so `1` may make every user look like a Vercel IP. That puts all users in one rate-limit bucket. After the first deploy, log `req.ip` and `req.ips` once, then set the hop count so `req.ip` is the real client (probably `2`). Remove the log afterwards. | The login and register limiters key on IP |
| `Backend/package.json` | Add `"engines": { "node": "22.x" }` (or 24.x LTS). | Render then uses a known Node version instead of its default. Local Node is 26, so also test the build on the pinned version. |
| `Frontend/vercel.json` (new) | Rewrites in this order: `/api/(.*)` → `https://<api>.onrender.com/api/$1`, then `/(.*)` → `/index.html`. | The proxy, plus the SPA fallback so deep links like `/bookings/12` don't 404 |
| Frontend env | `VITE_API_URL=/api` in the Vercel project settings. `baseQuery.ts` already reads it; a relative URL keeps calls same-origin. | |
| `.env.example` files | Document the production values from §4. | |

**Done when:** `npm run build` passes in both apps. Locally,
`curl localhost:5000/api/health` returns `ok` without touching the database.

---

## 3. Milestone D2: Neon

1. Create a project in **AWS Singapore (ap-southeast-1)** on Postgres 16 or newer.
2. Copy two connection strings:
   - **Direct** (no `-pooler` in the host): for `drizzle-kit migrate` from your machine
   - **Pooled** (`-pooler` host): for Render's `DATABASE_URL`

   Both need `?sslmode=require`.
3. From `Backend/`, run the migrations once with the direct URL:
   `DATABASE_URL=<direct> npx drizzle-kit migrate`. Then check the tables in
   Neon's SQL editor.
4. Create the first admin. Register through the deployed app, then promote the
   user in the SQL editor (`UPDATE users SET role = 'admin' WHERE email = …`),
   the same way as locally.
5. Optional: seed demo data (a venue, an event, screenings) through the UI so
   the city-first home page isn't empty.

**Later:** each new migration is generated locally, committed, then applied to
Neon with the direct URL **before** deploying the code that needs it.

---

## 4. Milestone D3: Render (backend)

New **Web Service** from the GitHub repo:

| Setting | Value |
| :--- | :--- |
| Region | Singapore |
| Root directory | `Backend` |
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build`. TypeScript is a dev dependency, and `NODE_ENV=production` would otherwise skip it. |
| Start command | `npm start` (`node dist/server.js`) |
| Health check path | `/api/health` |
| Instance type | Free |
| Auto-deploy | On, from `main` |

**Environment variables:**

| Key | Value |
| :--- | :--- |
| `NODE_ENV` | `production`. This turns on `secure` cookies and the strict rate limits. |
| `DATABASE_URL` | Neon **pooled** URL |
| `JWT_SECRET` | A new random 48-byte value. Not the local one. |
| `CLIENT_URL` | `https://<app>.vercel.app`, used for CORS and email links |
| `SERVER_URL` | `https://<api>.onrender.com` |
| Later | `MAIL_TRANSPORT=brevo`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` (email plan), and the Razorpay values (payments plan) |

`PORT` is set by Render; `env.ts` already reads it.

**Done when:** `https://<api>.onrender.com/api/health` returns `ok`, and
`/api/catalog/cities` returns JSON from Neon.

---

## 5. Milestone D4: Vercel (frontend)

New project from the same repo:

| Setting | Value |
| :--- | :--- |
| Root directory | `Frontend` |
| Framework preset | Vite (build `npm run build`, output `dist`) |
| Env | `VITE_API_URL=/api` |

`vercel.json` from D1 handles the proxy and the deep links.

**Done when:**
- a hard refresh on `/explore` and on `/bookings/1` loads the app, not a 404
- the browser's Network tab shows calls going to `<app>.vercel.app/api/...`, not
  to onrender.com
- signing in sets the cookie on the Vercel domain

---

## 6. Milestone D5: Keep-alive and monitoring

- **UptimeRobot** (free): an HTTP monitor on `https://<api>.onrender.com/api/health`
  every 5 minutes, with email alerts on.
- Optional second pinger: cron-job.org every 10 minutes on the same URL.
- Check Render's **Events** tab after the first day: there should be no
  "spun down" events.
- Check the workspace's free-hour usage once a month. No other always-on free
  service should share this workspace.

**Known gap:** if Render is asleep or restarting, the first request through
Vercel's rewrite can take long enough to time out (a cold start is about
30–60 s). The pinger makes this rare. It's another reason the Razorpay webhook
points at Render directly, and Razorpay retries webhooks anyway.

---

## 7. Milestone D6: Smoke test in production

Go through each flow once on the deployed URLs:
1. Register, verify (console-logged link until email ships; read it from
   Render's logs), log in, log out, and refresh while logged in.
2. Apply for organizer, approve it as admin, then create a venue with a
   layout, an event, a screening, and publish.
3. Sign in as a buyer in a second browser: browse by city, hold seats, check
   out (mock payment), and see the ticket in My bookings.
4. Hit login with a wrong password 11 times to confirm the limiter is keyed per
   client (see the D1 `trust proxy` check).

---

## 8. How this connects to the other plans

- **Email (`docs/email-plan.md`):** Render's free plan blocks outbound SMTP,
  so mail goes through **Brevo's HTTPS API** (no nodemailer). Set
  `CLIENT_URL` to the Vercel URL so links open the frontend.
- **Rate limiting:** `express-rate-limit`'s in-memory store is accurate on
  Render, because the free plan runs one always-on process. Counts reset only
  on a restart or deploy. The email plan's daily send cap relies on the same
  thing. The one fix needed is the `trust proxy` hop count (D1).
- **Payments (`docs/razorpay-payments-plan.md`):** add the Razorpay env vars on
  Render. Point the webhook at `https://<api>.onrender.com/api/payments/webhook`
  directly, and use test-mode keys only.
- **CI (roadmap):** later, a GitHub Action running build and tests on each push.
  Vercel and Render keep deploying from `main` on their own.

## 9. Order and size

| # | Milestone | Size |
| :- | :--- | :--- |
| D1 | Health route, trust proxy, engines, vercel.json | S |
| D2 | Neon + migrations + first admin | S |
| D3 | Render service | S |
| D4 | Vercel project | S |
| D5 | Keep-alive + monitoring | S |
| D6 | Production smoke test | S |

This can go live before the email and payment work. Each of those then
deploys by pushing to `main` and adding its env vars.
