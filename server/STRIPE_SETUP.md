# Stripe setup — Learn PHP

This turns the checkout from the labelled **demo** into a real paid subscription
flow. Until you set the keys below, the site stays in demo mode: the browser
simulates the purchase in `localStorage` and says so on screen.

Nothing in this file requires you to change the site's HTML. The server serves
the same static pages, and `assets/app.js` switches modes automatically by
asking `GET /api/health`.

---

## 0. What you are building

```
Browser                Your server              Stripe
-------                -----------              ------
POST /api/checkout/session  ──►  create Session  ──►  hosted Checkout page
        ◄── { url } ──────────────┘                      │
      redirect to Stripe ────────────────────────────────►  card entered on Stripe
        ◄── redirect to /checkout.html?status=success&session_id=cs_… ─┘
POST /api/stripe/webhook  ◄──────────── signed event ────  (the ONLY thing that grants a plan)
```

The single rule: **a plan is granted only by a verified webhook**, never by the
browser and never by the success redirect. The redirect is cosmetic — anyone can
type that URL.

---

## 1. Environment variables

Create `server/.env` (or set these in your host's dashboard). The server reads
plain `process.env`, so `.env` is only convenient with a loader — either
`export` them or run with `node --env-file=.env server.js`.

| Variable | Required | What it is | Where to get it |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | **yes** (to leave demo mode) | Server-side API key. `sk_test_…` or `sk_live_…` | Stripe Dashboard → Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` | recommended | `pk_test_…` / `pk_live_…`. Served to the browser by `/api/config` for a future Stripe.js card form | Same page |
| `STRIPE_WEBHOOK_SECRET` | **yes** (to activate plans) | `whsec_…`, signs every webhook. Without it `/api/stripe/webhook` returns 503 and **no purchase will ever activate** | `stripe listen` output, or Dashboard → Webhooks → your endpoint → Signing secret |
| `SITE_URL` | **yes** | Absolute origin used for `success_url` / `cancel_url`. Must match what you registered | e.g. `https://learnphp.com` |
| `PORT` | no (default `4242`) | HTTP port | your host |
| `COOKIE_SECURE` | on production | Set `true` when served over HTTPS so the session cookie is `Secure` | — |
| `DATA_DIR` | no | Where `learnphp.json` lives | default `server/data` |
| `SITE_ROOT` | no | Directory of the static site | default the repo folder above `server/` |

### Example `server/.env`

```bash
STRIPE_SECRET_KEY=sk_test_51AbC...
STRIPE_PUBLISHABLE_KEY=pk_test_51AbC...
STRIPE_WEBHOOK_SECRET=whsec_1a2b3c...
SITE_URL=http://localhost:4242
PORT=4242
COOKIE_SECURE=false
```

> **Never commit `.env`.** Add `server/.env` and `server/data/` to `.gitignore`.
> A leaked `sk_live_` key is a direct route to your bank account.

---

## 2. Create the products and prices

The server builds prices inline from `server/plans.js` (`price_data`), so you do
**not** strictly have to pre-create Stripe Prices. Doing it anyway gives you
nicer receipts, a clean revenue view, and lets you change a price without a
deploy.

| Plan | Billing | Amount | Stripe recurring |
|---|---|---|---|
| Pro | monthly | **$19.00** → `1900` | `interval: month` |
| Pro | yearly | **$180.00** → `18000` | `interval: year` |
| Team | monthly | **$49.00** → `4900` | `interval: month` |
| Team | yearly | **$468.00** → `46800` | `interval: year` |

In the Dashboard → **Product catalog**:

1. **Add product** → name `Learn PHP Pro` → add two recurring prices, $19/month
   and $180/year.
2. **Add product** → name `Learn PHP Team` → $49/month and $468/year, and set
   the description to mention the 5 seats.
3. Copy each price ID (`price_…`) if you want to switch the server from
   `price_data` to fixed `price` IDs — see step 6.

Yearly saves 21% on Pro ($48/yr) and 20% on Team ($120/yr). Those numbers are
computed in `plans.js` and shown on the pricing table, so a price change means
editing **both** `server/plans.js` and `PLANS` in `../assets/app.js`. The smoke
test asserts the two agree.

---

## 3. Register the webhook endpoint

**Production:** Dashboard → **Developers → Webhooks → Add endpoint**

- **Endpoint URL:** `https://YOUR_DOMAIN/api/stripe/webhook`
- **Events to send** (these four, nothing else needed):
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.paid`
- Copy the **Signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

**Local:** install the Stripe CLI, then:

```bash
stripe login
stripe listen --forward-to localhost:4242/api/stripe/webhook
# → Ready! Your webhook signing secret is whsec_xxxxxxxx
```

Use that `whsec_` locally. It is a **different secret** from the production one —
do not mix them up, or every local webhook will 400.

Test a single event without a browser:

```bash
stripe trigger checkout.session.completed
```

---

## 4. Run it

```bash
cd server
npm install        # express + stripe
npm start          # node server.js
```

Expected console output:

```
Learn PHP server on http://localhost:4242
  mode: stripe (real Checkout)
  webhook secret: set
```

If it says `mode: demo (no keys — browser fallback)`, `STRIPE_SECRET_KEY` is not
visible to the process. That is the intended fallback, not a failure.

---

## 5. Verify the whole loop

```bash
# unit-ish + integration checks against a live server
PORT=4242 STRIPE_WEBHOOK_SECRET=whsec_... node scripts/smoke-test.js
```

24 checks cover: health/config, the three prices, signup/session, duplicate
email, wrong password, unknown plan, unknown billing, unauthenticated checkout,
forged webhook, wrong signature, a correctly signed webhook that **does** upgrade
the plan, and idempotency on replay.

Then the real thing with test keys:

1. Sign up on `/signup.html`.
2. Click a Pro plan → you land on Stripe Checkout.
3. Pay with `4242 4242 4242 4242`, any future expiry, any CVC.
4. You return to `/checkout.html?status=success&session_id=…`.
5. Watch the terminal running `stripe listen` — you should see
   `checkout.session.completed` → `200`.
6. Open `/dashboard.html`: plan = Pro, renewal date populated, Pro lessons
   unlocked.

**If step 6 still shows Free, the webhook did not land.** Check, in order:
`STRIPE_WEBHOOK_SECRET` matches the listener, the endpoint URL is exactly
`/api/stripe/webhook`, and the server log for `signature verification failed`.

---

## 6. Optional: switch from inline `price_data` to fixed Price IDs

Inline prices are simpler but create a new Price object on every checkout in
some Stripe configurations. To pin them:

1. Add the four IDs to `.env`:

```bash
STRIPE_PRICE_PRO_MONTHLY=price_1AbC...
STRIPE_PRICE_PRO_YEARLY=price_1DeF...
STRIPE_PRICE_TEAM_MONTHLY=price_1GhI...
STRIPE_PRICE_TEAM_YEARLY=price_1JkL...
```

2. In `server/server.js`, inside `/api/checkout/session`, replace the
   `line_items: [{ quantity: 1, price_data: {…} }]` block with:

```js
const PRICE_IDS = {
  'pro:monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
  'pro:yearly':  process.env.STRIPE_PRICE_PRO_YEARLY,
  'team:monthly': process.env.STRIPE_PRICE_TEAM_MONTHLY,
  'team:yearly':  process.env.STRIPE_PRICE_TEAM_YEARLY,
};
const priceId = PRICE_IDS[`${plan}:${billing}`];
// ...
line_items: [{ price: priceId, quantity: 1 }],
```

Keep `resolvePrice()` in place — it still validates the plan and billing values
before anything is sent to Stripe.

---

## 7. Go live checklist

- [ ] Swap `sk_test_` → `sk_live_` (and `pk_test_` → `pk_live_`).
- [ ] Register the **production** webhook URL and set the live `whsec_`.
- [ ] Set `SITE_URL` to the HTTPS domain.
- [ ] Set `COOKIE_SECURE=true`.
- [ ] Enable **Customer portal** in Dashboard → Settings → Billing, so
      `/api/billing/portal` works for cancel/upgrade.
- [ ] Turn on **Stripe Tax** if you sell to multiple jurisdictions; add
      `automatic_tax: { enabled: true }` to the Session.
- [ ] Set the refund policy (the site says 30 days) and honour it.
- [ ] Confirm your Terms/Privacy pages exist — checkout requires both.
- [ ] Replace the JSON file store with a real database (`server/store.js` is
      the only module to change) before you have concurrent traffic.
- [ ] Run one live-mode purchase yourself with a real card, then refund it.

---

## 8. Security notes worth keeping

- **Prices come from the server.** The browser sends `{plan, billing}` only.
  Anything that accepts an `amount` from a client is a free-subscription bug.
- **The webhook is the only grant path.** `checkout/session` creates a Session;
  it grants nothing. A user who never pays never gets Pro.
- **Raw body, verified signature.** `express.json()` is skipped for
  `/api/stripe/webhook` so `stripe.webhooks.constructEvent` sees the exact bytes
  Stripe signed. (This was an actual bug in the first draft — JSON parsing first
  makes every signature check fail silently.)
- **Webhooks are idempotent.** Event ids are recorded; a Stripe retry is a no-op
  rather than a double upgrade.
- **Passwords are scrypt with a per-user salt**, compared with
  `crypto.timingSafeEqual`. The browser demo's `djb2` hash is *not* used
  server-side.
- **Sessions are opaque tokens in HttpOnly, SameSite=Lax cookies** — no JWT, no
  token in `localStorage`, revocable by deleting a row.
- **Rate limits** on signup/signin/checkout blunt credential stuffing.

---

## 9. Demo mode — the fallback

When `STRIPE_SECRET_KEY` is absent:

- `GET /api/health` → `mode: "demo"`.
- `POST /api/checkout/session` → `503 { "code": "DEMO_MODE" }`.
- `assets/app.js` sees that code and runs the local demo purchase: it writes the
  plan to `localStorage` and the page tells the user plainly that no card was
  charged.

This is deliberate, so the site is never broken by a missing key — it degrades
to a clearly-labelled demo instead of a dead checkout button.
