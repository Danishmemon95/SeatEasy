# Plan: Email (verification, password reset, booking mails)

**Status:** planned, not started. Nothing in this plan is built yet.

**Today:** no email is sent. `register` prints the verification link to the
server console (`Backend/src/Auth/authController.ts`), and that link points at
the **backend** `GET /api/auth/verify`, which returns JSON. The frontend already
has a `/verify?token=` page that calls the same endpoint. "Forgot password?" on
the login form does nothing, and there is no way to resend a verification
email.

**Goal:** real emails for the account flows (verify, resend, forgot and reset
password, password changed), and later for bookings (confirmation with the
ticket, refund notice). The booking mails are planned here so the mail layer
is built once, but they ship with the payments plan (`docs/razorpay-payments-plan.md`, milestone P7).

---

## 0. What I need from you

**Provider: Brevo, through its HTTPS API (not SMTP).** The backend runs on
Render's free plan (`docs/deployment-plan.md`), and Render's free plan blocks
outbound SMTP ports. HTTPS works. Brevo's free plan sends about 300 emails a
day, and it can send from a single verified address (your Gmail) without
owning a domain.

| Item | Where to find it | Goes in |
| :--- | :--- | :--- |
| `BREVO_API_KEY` | Brevo → SMTP & API → **API keys** (not the SMTP key) | `Backend/.env` locally; the Render env vars in production |
| `MAIL_FROM_EMAIL` | The address you verify under Brevo → Senders | Same |
| `MAIL_FROM_NAME` | The name people see, e.g. `SeatEase` | Same |

Put these in the env files yourself. Don't paste the API key into chat.

**Deliverability caveat:** mail "from" a `@gmail.com` address sent through
Brevo can land in spam, because Brevo isn't Gmail's own server. That's fine for
a demo. A domain of your own (with Brevo's DNS records) fixes it later; see §8.

---

## 1. Decisions (defaults; change any before we start)

1. **One mail layer that calls Brevo's HTTPS API** (`POST https://api.brevo.com/v3/smtp/email`, `api-key` header)
   with Node's built-in `fetch`. No `nodemailer` and no Brevo SDK: it's one
   JSON request. A provider change later (Resend, Mailtrap) touches only this
   one function.
2. **Console fallback.** `MAIL_TRANSPORT=console` (the default in development)
   logs the mail, with its links, instead of sending. That way the project keeps
   working without a Brevo key, and tests never send mail.
3. **Send after commit, never inside a transaction.** A failed send is logged
   and never fails the request: the user can always use "resend". No
   outbox/queue table for now (see §8).
4. **Links point at the frontend:** `${CLIENT_URL}/verify?token=…` and
   `${CLIENT_URL}/reset-password?token=…`.
5. **Token lifetimes:** verification 24 h (as today), password reset 30 min,
   single use.
6. **No account enumeration.** Forgot-password and resend-verification always
   answer `202` with the same message, whether or not the email exists.
7. **A password reset logs out every existing session.** A new
   `password_changed_at` column; `protectRoute` rejects a JWT issued before it.
8. **A completed reset also verifies the email.** Opening a link sent to that
   inbox proves the user owns the address.
9. **Daily send cap: 250 emails, below Brevo's ~300.** Past the cap, account
   mails are skipped and logged, so a flood never hits Brevo's limit or gets
   the key flagged. The user sees the normal message and can retry tomorrow.
   This sits on top of the per-IP and per-email limiters.

---

## 2. Milestone M1: Mail layer (backend)

**New module `Backend/src/Mail/`:**

| File | Job |
| :--- | :--- |
| `mailer.ts` | Exposes `sendMail({ to, subject, html, text })`. With `brevo`, it POSTs `{ sender: { email, name }, to: [{ email }], subject, htmlContent, textContent }` to Brevo with a 10 s timeout (`AbortSignal.timeout`). With `console`, it prints the mail. Logs any non-2xx response with Brevo's error body and the recipient, never the API key. Never throws to callers. |
| `sendCap.ts` | The daily cap from decision 9: an in-memory counter that resets at midnight IST. Render runs a single always-on process, so in-memory is accurate there; it resets on restart, which only makes the cap more lenient. `sendMail` checks it first. |
| `layout.ts` | One shared HTML shell: logo wordmark, content slot, footer. Table layout with inline styles, because email clients ignore `<style>` and CSS variables. Brand colors are copied as hex from `design.md`. |
| `templates/*.ts` | One function per mail, returning `{ subject, html, text }`. Always include a plain-text version. |

**`env.ts` additions** (zod, same fail-fast style):
- `MAIL_TRANSPORT`: `brevo | console`, default `console`
- `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`: required **only** when the transport is `brevo` (a zod `superRefine`), so a half-filled config crashes at boot rather than at the first send.
- `MAIL_DAILY_CAP`: default `250`

Add the same keys to `.env.example`, with comments.

**Boot check:** with Brevo, call `GET https://api.brevo.com/v3/account` once at
startup and log whether the key works. Like the DB check, don't make it fatal.

**Done when:**
- one test send to your own inbox arrives, and Brevo's **Transactional → Logs**
  shows it as delivered
- with `MAIL_TRANSPORT=console`, the mail is printed instead
- a wrong API key logs a clear error, and the request that triggered the mail
  still succeeds

---

## 3. Milestone M2: Verification emails (backend)

1. **`register`:** replace the two `console.log(Verify link…)` lines with
   `sendVerificationEmail(user, token)`, called after the insert or update
   succeeds. The link becomes `${CLIENT_URL}/verify?token=…`.
2. **New `POST /api/auth/resend-verification`** with `{ email }`:
   - always `202` with the same message
   - if a matching unverified user exists, rotate the token (same code path as
     the re-register branch in `register`) and send
   - limiter: keyed on IP + email, about 3 per hour per email in production
3. **Optional welcome mail** after `verifyUser` succeeds. It's cheap, but it's a
   second template, so it's up to you.

**Done when:**
- registering sends a mail
- clicking the link opens the frontend `/verify` page, which verifies and signs in
- resending invalidates the old link

---

## 4. Milestone M3: Forgot and reset password (backend)

**Migration** (one file, `drizzle-kit generate`), on `users`:
- `password_reset_token_hash varchar(64)`, nullable
- `password_reset_expires timestamptz`, nullable
- `password_changed_at timestamptz`, nullable

**Reuse `utils/verificationToken.ts`.** Generalise it into a
`createOneTimeToken(ttlMs)` that keeps `hashVerificationToken` (sha256). Only
the hash is stored, never the raw token.

| Endpoint | Body | Behaviour |
| :--- | :--- | :--- |
| `POST /api/auth/forgot-password` | `{ email }` | Always `202`. If a user exists, store a new reset hash with a 30-minute expiry, overwriting any earlier one, then send the mail. This works for unverified users too. |
| `POST /api/auth/reset-password` | `{ token, password }` | Validate the password with the **same rules as register** (reuse the zod piece). In one `UPDATE … WHERE hash = $1 AND expires > now() RETURNING`: set the new bcrypt hash, clear the reset hash and expiry, set `password_changed_at = now()` and `is_verified = true`, and clear any verification token. If no row matches, return `400` "invalid or expired link". On success, send a "password changed" mail. Don't log the user in; send them to login. |
| `PATCH /api/auth/me/password` | `{ currentPassword, newPassword }` | Signed in. Check the current password with bcrypt, then the same update as above. Re-issue this session's cookie, so this device stays signed in and others are logged out. Send the "password changed" mail. |

**Session invalidation:** in `authMiddleware.protectRoute`, after loading the
user, reject with `401` if `password_changed_at` is later than the JWT's `iat`.
Allow about a second of slack, because `iat` has one-second resolution.

**Limiters:** forgot-password on IP + email (about 3 per hour), reset-password
on IP (about 10 per 15 min). Same style as `rateLimiters.ts`.

**Done when:**
- a reset link works once, then fails
- an expired link fails
- after a reset, a second browser that was signed in gets `401` on its next request

---

## 5. Milestone M4: Frontend for the account mails

| Where | Change |
| :--- | :--- |
| `api/authApi.ts` | Add mutations: `resendVerification`, `forgotPassword`, `resetPassword`, `changePassword`. |
| `LoginForm` | Point "Forgot password?" at `/forgot-password`, prefilled with the typed email. When login fails with the email-not-verified code (the form already shows `MailWarning`), add a "Resend verification email" button with a 60 s cooldown. |
| `RegisterForm` | On the "check your inbox" success state, add "Didn't get it? Resend", with the same cooldown. |
| **New** `/forgot-password` page | Email field, then a neutral "If an account exists, we've sent a link" confirmation. Inside `PublicOnlyRoute`, like `/login`. |
| **New** `/reset-password?token=` page | New password + confirm. Use the same strength rules and meter as `RegisterForm` (reuse `utils/validation`). Read the token once, then strip it from the URL with `replace`. Add `<meta name="referrer" content="no-referrer">` while mounted. On success: toast, then `/login`. Invalid or expired: a clear message plus a "Send a new link" button. |
| `AccountPage` | "Change password" card: current, new, confirm. On success: toast "Password changed. Other devices were signed out." |
| `VerifyEmailPage` | When the link is expired or used, show an email field and a resend button, instead of only "go to login". |

Use the `AuthLayout` and `Card` pattern from `AuthPage`. Add the two routes in
`routes/index.tsx`.

**Done when:** you can go through signup, then the email, then `/verify`,
signed in, all from a real inbox. The same goes for forgot password, the
email, reset and login.

---

## 6. Booking mails (built later, with payments milestone P7)

The templates are listed here so the layout is designed once:

| Mail | Trigger | Content |
| :--- | :--- | :--- |
| Booking confirmed / ticket | Booking flips to `confirmed` (after commit) | Event title and poster, showtime in IST, venue and address, seats with categories, total paid, the booking reference in large monospace, the Razorpay payment id, and a "View ticket" button linking to `/bookings/:id`. Optional: an `.ics` calendar attachment. |
| Payment refunded | Payment captured but the booking couldn't be confirmed (the hold expired mid-payment) | Apology, amount, refund id, "the refund was issued in test mode" note |
| Screening cancelled | The organizer cancels a screening with confirmed bookings | Which booking, and a note that refunds aren't automated (matches today's rule) |

A QR code is out of scope (as in the buyer plan). The booking reference is the ticket.

---

## 7. Testing

- Unit-test each template function: subject plus key fields present, no `undefined` in the output.
- Run the flows with `MAIL_TRANSPORT=console` and read the printed links.
- Run the real flows through Brevo to your own inbox (Gmail and one other
  provider, e.g. Outlook). Check that links work, the layout renders, and
  whether mail lands in spam.
- Check `202` responses for unknown emails (no enumeration).
- Set `MAIL_DAILY_CAP=2` locally and trigger three mails. The third should be
  skipped and logged, and the request should still succeed.
- **On Render:** after deploying, trigger one mail and confirm it in Brevo's
  logs. This proves the HTTPS route works where SMTP doesn't.

## 8. Out of scope (later)

- An outbox table with retries and a worker
- Bounce and complaint webhooks (Brevo can send these)
- Email change with re-verification
- Marketing mails or unsubscribe links
- **Your own sending domain:** add Brevo's DKIM/SPF/DMARC DNS records and send
  from `no-reply@yourdomain`. This is the fix for mail landing in spam. Only
  `MAIL_FROM_EMAIL` changes.

## 9. Order and size

| # | Milestone | Size | Depends on |
| :- | :--- | :--- | :--- |
| M1 | Mail layer (Brevo API + console) + daily cap + env | S | Your Brevo API key and verified sender (console mode works without them) |
| M2 | Verification mails + resend | S | M1 |
| M3 | Forgot/reset/change password + session invalidation | M | M1 |
| M4 | Frontend pages | M | M2, M3 |
