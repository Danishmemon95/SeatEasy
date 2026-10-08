# Plan: Razorpay payments (test mode)

**Status:** planned, not started. Nothing in this plan is built yet.

**Today:** payment is a mock. `CheckoutPage` calls `POST /bookings` to create a
`pending` booking from the caller's holds, then `POST /bookings/:id/pay`. That
endpoint locks the booking, then the screening, then the seats; checks the
holds are still the caller's and the total still matches; and flips the seats
to `booked` and the booking to `confirmed` in one transaction
(`Backend/src/Bookings/bookingController.ts`). Holds last 10 minutes.

**Goal:** replace the mock "Pay" button with Razorpay Checkout in **test mode**.
Real cards are never charged; Razorpay's test cards and UPI IDs simulate success
and failure. The money-moving part stays a demo, but the integration is built
the production way: a server-created order, signature verification, an
idempotent confirm, and a webhook backup.

The confirm transaction we already have stays exactly as it is. Razorpay only
changes **what proves the payment happened**: a verified signature instead of a
button press.

---

## 0. What I need from you

| Item | Where to find it | Goes in |
| :--- | :--- | :--- |
| `RAZORPAY_KEY_ID` (starts with `rzp_test_`) | Dashboard → Test mode → Account & Settings → API Keys | `Backend/.env` |
| `RAZORPAY_KEY_SECRET` | Shown once when you generate the key | `Backend/.env` only. Never the frontend, never chat. |
| `RAZORPAY_WEBHOOK_SECRET` (optional, milestone P5) | You choose it when adding the webhook | `Backend/.env` |
| Payment capture setting | Dashboard → Settings → Payment capture. Set it to **automatic**. | Dashboard |

The frontend needs no Razorpay env: the backend returns the public key id with
each order.

---

## 1. The flow

```
CheckoutPage            Backend                                  Razorpay
     │ POST /bookings  ─────► pending booking (unchanged)
     │ POST /bookings/:id/payment-order
     │                 ─────► lock booking, check holds, ≥ 2 min left
     │                        create order (amount in paise) ───────► order_id
     │                        save payments row (status=created)
     │ ◄──── { keyId, orderId, amount, currency, timeoutSeconds, prefill }
     │ open Checkout.js modal ──────────────────────────────────────► buyer pays
     │ ◄───────── handler({ razorpay_payment_id, order_id, signature })
     │ POST /bookings/:id/payment-verify
     │                 ─────► HMAC check → existing confirm transaction
     │                        payments.status = paid; booking confirmed
     │ ◄──── booking  → navigate /bookings/:id   (+ confirmation mail)
                         ▲
     POST /api/payments/webhook (payment.captured) ─ same confirm, idempotent
```

---

## 2. Decisions (defaults; change any before we start)

1. **One payment per attempt, many attempts per booking.** A new `payments`
   table, not columns on `bookings`, so a failed attempt and a retry are both
   on record.
2. **Amounts are integer paise.** Convert the `numeric` string `"250.00"` to
   `25000` by string arithmetic, not by `parseFloat * 100`.
3. **The server decides the amount.** It comes from `bookings.total_amount`,
   never from the client.
4. **Signature check:** `HMAC_SHA256(order_id + "|" + payment_id, KEY_SECRET)`,
   compared with `crypto.timingSafeEqual`.
5. **Confirm is idempotent.** Verify and the webhook can both arrive. Whichever
   locks the booking second sees `confirmed` and returns success.
6. **Hold vs. payment time:** refuse to create an order with less than 2
   minutes of hold left. Pass Checkout `timeout` = seconds left − 60, so the
   modal closes before the hold lapses.
7. **Paid but the seats were lost** (rare: the hold lapsed between paying and
   verifying): cancel the booking, refund through the Razorpay Refunds API
   (works in test mode), mark the payment `refunded`, send the refund mail, and
   tell the buyer clearly.
8. **Keep the mock.** `PAYMENT_MODE=mock|razorpay`, default `mock`. The mock
   `/pay` route is mounted only in mock mode, so tests and keyless development
   still work.
9. **Tickets stay non-refundable** for buyers. Refunds happen only in case 7.

---

## 3. Milestone P1: Schema + config (backend)

**Migration:** new enum `payment_status`: `created | paid | failed | refunded`.

New table `payments`:

| Column | Type | Notes |
| :--- | :--- | :--- |
| id | serial PK | |
| booking_id | int → bookings.id | indexed |
| provider | varchar(20) | `razorpay` (or `mock`) |
| provider_order_id | varchar(64) | **unique** |
| provider_payment_id | varchar(64) | **unique**, nullable until paid |
| amount_paise | integer | |
| currency | varchar(3) | `INR` |
| status | payment_status | default `created` |
| method | varchar(30) | card / upi / netbanking, from the payment entity, nullable |
| error_code, error_description | varchar / text | from a failed attempt, nullable |
| refund_id | varchar(64) | nullable |
| created_at, updated_at, paid_at | timestamptz | |

**`env.ts`:**
- `PAYMENT_MODE`
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, required when the mode is `razorpay`
- `RAZORPAY_WEBHOOK_SECRET`, optional

Update `.env.example`.

**Dependency:** the official `razorpay` Node SDK (orders, payments, refunds).
Signature checks use Node's `crypto`, not the SDK.

**New module `Backend/src/Payments/`:** `razorpayClient.ts` (a single SDK
instance), `paymentController.ts`, `paymentRoutes.ts`, `paymentSchemas.ts`, and
`paymentRules.ts` (paise conversion, signature checks).

---

## 4. Milestone P2: Create order (backend)

`POST /api/bookings/:bookingId/payment-order` (signed in, own booking):

1. In a transaction, lock the booking `FOR UPDATE`, following the existing lock
   order.
2. Reject if the booking isn't `pending` (`409`), the screening is cancelled or
   has started, or the caller's holds have **less than 2 minutes** left (`409`
   with a "choose seats again" message).
3. If an unused `created` payment for this booking exists and its amount still
   matches, **reuse that order**. This keeps double-clicks and page refreshes
   from creating many orders.
4. Otherwise, call `razorpay.orders.create({ amount, currency: "INR", receipt: "BK-<id>", notes: { bookingId, userId } })`
   **outside** the transaction. Don't hold row locks across a network call.
   Then insert the `payments` row.
5. Respond with:
   - `keyId`, `orderId`, `amount`, `currency`
   - `timeoutSeconds` (hold left − 60)
   - `prefill: { name: username, email }`
   - `description`: event title and showtime

**Done when:** calling it twice returns the same order, and calling it with an
expired hold returns `409`.

---

## 5. Milestone P3: Verify + confirm (backend)

`POST /api/bookings/:bookingId/payment-verify` with
`{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`:

1. Find the `payments` row by order id, and check it belongs to this booking
   and caller. Otherwise `404`.
2. Check the signature. On a mismatch, return `400` and mark the attempt
   `failed` with "signature mismatch". Never confirm.
3. **Refactor:** move the body of today's `payBooking` transaction into
   `confirmBookingTx(tx, bookingId, userId)`, so the mock route, verify and the
   webhook share it. It returns `paid`, `already_confirmed` or `failed(reason)`.
4. `paid` or `already_confirmed`: set the payment to `paid`, with its payment id
   and `paid_at`, in the **same transaction**. Fetch `method` from
   `payments.fetch` after commit; it's display-only.
5. `failed(reason)`: the confirm transaction has already cancelled the booking
   and released the seats (existing behaviour). After commit, call
   `razorpay.payments.refund(paymentId)`, store the `refund_id`, set the status
   to `refunded`, and send the refund mail. Respond `409` with
   `{ code: "PAID_BUT_RELEASED", refunded: true }` so the UI can explain it.

**Done when:**
- a correct signature confirms the booking
- a tampered signature doesn't
- calling verify twice is harmless
- if `held_until` is pushed into the past before verify, the booking is
  cancelled and a refund is issued

---

## 6. Milestone P4: Failed and abandoned payments

- **The frontend reports failures:** `POST /api/bookings/:bookingId/payment-failed`
  with `{ orderId, code, description }` from Checkout's `payment.failed` event.
  Store them on the attempt, for support and debugging. The booking stays
  `pending`, so the buyer can retry while the hold lasts (P2 reuses or creates
  the order).
- **Modal dismissed:** nothing to do server-side. The hold expires lazily, as
  today.
- **Booking responses:** `GET /bookings/me` and `GET /bookings/:id` include the
  latest payment: status, method, provider payment id, refund id.

---

## 7. Milestone P5: Webhook (recommended, needs a public URL)

**Why:** if the buyer pays and then closes the tab before `payment-verify`
runs, only the webhook will confirm the booking.

- `POST /api/payments/webhook`. Mount it **before** `express.json()` with
  `express.raw({ type: "application/json" })`, because the signature is over
  the raw bytes. Check the `X-Razorpay-Signature` header as HMAC_SHA256(raw
  body, `WEBHOOK_SECRET`). No auth cookie, and no rate limiter that could drop
  Razorpay's retries.
- Handle `payment.captured`: look up the payment row by `order_id`, then run the
  same `confirmBookingTx` and the refund-on-failure path as P3. Handle
  `payment.failed`: record the error.
- Always answer `200` quickly once the signature is valid, even for events we
  ignore. Razorpay retries anything else.
- **Testing locally:** expose port 5000 with `ngrok` or `cloudflared`, then add
  the webhook in the Razorpay dashboard (test mode) with the
  `payment.captured` and `payment.failed` events.

---

## 8. Milestone P6: Frontend checkout

| Where | Change |
| :--- | :--- |
| `api/buyerApi.ts` | `createPaymentOrder`, `verifyPayment` and `reportPaymentFailed` mutations. `verifyPayment` invalidates the booking, holds and seats tags. |
| **New** `features/payments/loadRazorpay.ts` | Injects `https://checkout.razorpay.com/v1/checkout.js` once and resolves when `window.Razorpay` exists. Cache the promise. Show an error if it fails to load (an ad blocker, or offline). Add a small `Razorpay` type declaration. |
| `CheckoutPage.handlePay` | `createBooking`, then `createPaymentOrder`, then `new Razorpay({ key, order_id, amount, currency, name: "SeatEase", description, prefill, theme: { color: <accent hex> }, timeout, handler, modal: { ondismiss } })` and `.open()`. In `handler`: `verifyPayment`, then navigate to `/bookings/:id`. Listen to `payment.failed`: report it, then show the message inline with "Try again". |
| Button states | "Pay ₹X", then "Opening payment…", then the modal, then "Confirming payment…". Disable Cancel while confirming. Keep the hold countdown visible. |
| Errors | `PAID_BUT_RELEASED`: a modal saying "Your seats were released before payment finished. ₹X has been refunded (test mode)." with a "Choose seats again" button. Other `409`s: today's expired-hold modal. |
| `TicketPage` / `MyBookingsPage` | Show "Paid via UPI · pay_XXXX" and the payment status. Refunded bookings show a "Refunded" badge. |
| Test-mode banner | A thin "Test mode: no real money is charged" note on checkout, with a link to Razorpay's test card/UPI list. |
| Mock mode | If `PAYMENT_MODE=mock`, the order endpoint returns `{ mode: "mock" }` and the page falls back to today's `/pay` call. |

**Test inputs:** Razorpay's documented test cards; UPI `success@razorpay` and
`failure@razorpay`.

---

## 9. Milestone P7: Booking emails

Wire the templates from `docs/email-plan.md` §6, sent after commit:
- **Confirmed / ticket:** from `confirmBookingTx`'s `paid` outcome. Not on
  `already_confirmed`, or verify and the webhook would send it twice.
- **Refunded:** from the P3 step 5 path.
- **Screening cancelled:** from the organizer cancel endpoint, one mail per
  confirmed booking.

Depends on mail milestone M1.

---

## 10. Milestone P8: Tests and a manual run

Extend the race tests (buyer plan milestone 5) with:
- verify with a bad signature, then nothing changes
- verify twice, and the webhook after verify: confirmed exactly once, one mail
- hold expired before verify: booking cancelled, seats available, refund called
  (mock the SDK in tests)
- paise conversion edge cases: `"0.50"`, `"1234.05"`, `"99999999.99"`

Then do a manual run in test mode: success by card, success by UPI, a failed
UPI, closing the modal, and paying at 9:30 into the hold.

---

## 11. Security checklist

- The key secret and webhook secret stay server-side only and are never logged.
- Never trust the client for amount, booking or order: everything is looked up
  server-side, and the caller's ownership is checked.
- Signatures are compared in constant time.
- The webhook uses the raw body, and the endpoint accepts nothing without a
  valid signature.
- No card or UPI data ever touches our server (Checkout.js handles it).

## 12. Out of scope (later)

- Live mode (needs KYC and a website review by Razorpay)
- Buyer-initiated cancellation and refunds
- Automatic refunds when an organizer cancels
- Partial refunds
- Coupons or convenience fees
- Invoices or GST

## 13. Order and size

| # | Milestone | Size | Depends on |
| :- | :--- | :--- | :--- |
| P1 | Schema, env, SDK | S | Your test keys |
| P2 | Create order | S–M | P1 |
| P3 | Verify + shared confirm + refund path | M | P2 |
| P4 | Failed attempts, booking payment info | S | P3 |
| P5 | Webhook | M | P3, a tunnel |
| P6 | Frontend checkout | M | P2, P3 |
| P7 | Booking emails | S | P3, email M1 |
| P8 | Tests + manual run | M | all |

**Suggested overall order:** email M1–M4, then P1–P4 and P6 (a working demo),
then P7, then P5 and P8.
