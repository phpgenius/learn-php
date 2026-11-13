# RUNNING.md — Learn PHP

How to run, test and deploy this project. Everything below was verified against
the files in this folder; commands that were actually executed are marked
**✅ verified**.

---

## 1. What this project is made of

Two independent halves that happen to live in one folder.

### A. The static site — no server needed

Plain HTML/CSS/JS. Open it from a file, a static host, or behind the Node
server. It works on its own; everything a visitor can see and click runs in the
browser.

| Path | Files | What it is |
|---|---|---|
| `index.html` | 1 | Homepage: hero, 8-level curriculum, lesson index (96 lessons, searchable), pricing, testimonials, FAQ, newsletter |
| `lessons/` | **96** | One page per lesson, `lesson-01.html` … `lesson-96.html` |
| `projects/` | 4 | Project briefs: auth system, blog CRUD, contact form, REST API |
| `signup.html` | 1 | Sign-up / sign-in form |
| `checkout.html` | 1 | Plan selection + checkout (demo or real Stripe) |
| `dashboard.html` | 1 | Account: plan, renewal date, progress, upgrade/cancel |
| `certificate.html` | 1 | Completion certificate |
| `legal.html` | 1 | Terms, privacy, affiliate disclosure |
| `404.html` | 1 | Not-found page |
| `assets/app.js` | 1 | Shared account/subscription engine — **source of truth for plan data in the browser** |
| `assets/account.css` | 1 | Styles for the account pages |
| `assets/lesson-titles.js` | 1 | Lesson title metadata |
| `assets/og-image.png` | 1 | Social share image (1200×630) |
| `assets/learn-php-code-bundle.zip` | 1 | Downloadable code bundle |
| `robots.txt`, `sitemap.xml` | 2 | 98 URLs: homepage + 96 lessons + legal |

### B. The Node server — needed for real payments only

| Path | What it is |
|---|---|
| `server/server.js` | Express app: Stripe Checkout, webhook, auth, static file serving |
| `server/plans.js` | Server-side prices — **source of truth for what gets charged** |
| `server/store.js` | Subscription/account store (JSON file, no database dependency) |
| `server/scripts/smoke-test.js` | 24-check end-to-end test |
| `server/STRIPE_SETUP.md` | The detailed Stripe walkthrough |
| `server/package.json` | Dependencies: `express`, `stripe`; Node ≥ 20 |

Without the server the site still runs — checkout falls back to a **clearly
labelled demo** that stores the plan in `localStorage` and charges nothing.

### How the two halves connect

Only `checkout.html` talks to the server, via exactly two endpoints:

```
GET  /api/health          → decides demo vs stripe mode
POST /api/checkout/session → creates the Stripe Checkout Session
```

Everything else — sign-up, sign-in, the dashboard, lesson gating — runs from
`assets/app.js` against `localStorage`.

> ### ⚠️ Read this before you take real money
>
> `server/server.js` exposes a full server-side auth API
> (`/api/auth/signup`, `/api/auth/signin`, `/api/me`, `/api/billing/portal`)
> with scrypt password hashing and HttpOnly session cookies. **The front-end
> does not call any of it.** `signup.html` calls `LP.signUp()`, which writes to
> `localStorage`.
>
> The consequence in Stripe mode: `POST /api/checkout/session` requires a
> `lp_session` cookie, the browser never obtains one, so checkout returns
> **401 `AUTH_REQUIRED`**. A visitor cannot complete a real purchase until the
> two are joined.
>
> This is a known gap, not a bug you introduced. Section 5 of this guide is the
> fix, and it is the one thing to do before switching to live keys.
> Until then: the site is fully usable and demonstrable, and **no real money can
> flow** — which is the safe failure direction.

---

## 2. Run it locally

### Prerequisites

- **Node.js ≥ 20** (`server/package.json` declares `engines.node >=20`).
  ✅ Verified on Node **v20.20.2** / npm **11.19.0**.
- Nothing else. No database, no Docker, no PHP.

### The fastest way — static only, demo mode

Enough to read the site, click every page and test the demo purchase flow.

```bash
cd webpages/learn-php_v5
python3 -m http.server 8000
```

Open **http://localhost:8000**

Stop with `Ctrl+C`.

> Use a real HTTP server, not `file://`. Opening `index.html` directly breaks
> root-relative paths like `/assets/app.js` and the `fetch('/api/health')` call.

### The full way — with the Node server

```bash
cd webpages/learn-php_v5/server
npm install          # ✅ verified: adds 71 packages in ~1s
npm start            # = node server.js
```

Open **http://localhost:4242**

Expected output:

```
Learn PHP server on http://localhost:4242
  mode: demo (no keys — browser fallback)
  webhook secret: NOT set
  Set STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY to enable real payments.
```

That `demo` line is correct with no keys configured — the server is serving the
site and the browser is handling purchases locally.

Stop with `Ctrl+C`. If it was started in the background, `kill %1` or
`pkill -f "node server.js"`.

**Other commands**

```bash
npm run dev        # restart on file change (node --watch)
PORT=5000 npm start  # different port
```

### Where the data lives

`server/data/learnphp.json` — accounts, sessions, events. Created on first
signup. Delete it to reset all server-side state.

To keep it elsewhere: `DATA_DIR=/var/lib/learnphp npm start`.

---

## 3. Configure it

Config is plain environment variables read from `process.env`. There is no
`.env` loader in the code, so a `.env` file only works if you pass it to Node
explicitly (see below).

### Environment variables

| Variable | Required | Default | What it does | If missing |
|---|---|---|---|---|
| `STRIPE_SECRET_KEY` | For real payments | — | Server API key, `sk_test_…` / `sk_live_…` | **Demo mode.** `/api/checkout/session` returns `503 DEMO_MODE`; browser runs the labelled demo |
| `STRIPE_PUBLISHABLE_KEY` | Recommended | — | `pk_test_…` / `pk_live_…`, served via `/api/config` | `/api/config` returns an empty key; hosted Checkout still works without it |
| `STRIPE_WEBHOOK_SECRET` | For activation | — | `whsec_…` that signs webhooks | `/api/stripe/webhook` returns **503** and **no purchase ever activates** |
| `SITE_URL` | Production | `http://localhost:$PORT` | Absolute origin for Stripe `success_url` / `cancel_url` | Redirects after payment land on localhost and break |
| `PORT` | No | `4242` | HTTP port | — |
| `COOKIE_SECURE` | Production | unset | `true` → `Secure` session cookie | Cookie is not `Secure`; fix behind HTTPS |
| `DATA_DIR` | No | `server/data` | Where `learnphp.json` lives | Uses `server/data` |
| `SITE_ROOT` | No | folder above `server/` | Static site directory | Correct by default |
| `TEST_BASE` | No | `http://localhost:$PORT` | Target for the smoke test | — |

### How to set them

**Option 1 — inline (simplest for a first run):**

```bash
cd webpages/learn-php_v5/server
STRIPE_SECRET_KEY=sk_test_xxx \
STRIPE_PUBLISHABLE_KEY=pk_test_xxx \
STRIPE_WEBHOOK_SECRET=whsec_xxx \
SITE_URL=http://localhost:4242 \
npm start
```

**Option 2 — a `.env` file** (Node 20 has a built-in loader):

```bash
cd webpages/learn-php_v5/server
cat > .env <<'EOF'
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
SITE_URL=http://localhost:4242
PORT=4242
COOKIE_SECURE=false
EOF

node --env-file=.env server.js     # ✅ --env-file verified working on Node 20
```

`npm start` will **not** read `.env` by itself — it runs plain `node server.js`.
Either use `node --env-file=.env server.js`, or add
`"start": "node --env-file=.env server.js"` to `package.json`'s `scripts`.

**Option 3 — your host's dashboard.** Every PaaS below has an env-var UI.
Never commit `.env`.

### Never commit these

```gitignore
server/.env
server/data/
server/node_modules/
```

A leaked `sk_live_` key is direct access to your payouts.

### Confirming what mode you are in

```bash
curl -s http://localhost:4242/api/health
# {"ok":true,"mode":"demo","webhookConfigured":false,"plans":["free","pro","team"]}
```

`"mode":"stripe"` means the secret key is visible to the process.
`"webhookConfigured":false` with a real key means **payments will be taken and
plans will never activate** — set `STRIPE_WEBHOOK_SECRET` before going live.

---

## 4. Test it

### Automated smoke test

Start the server first, then in a second terminal:

```bash
cd webpages/learn-php_v5/server

# demo mode
PORT=4242 node scripts/smoke-test.js
```

✅ Verified: **17 passed, 0 failed.**

```bash
# full run with the webhook path enabled
STRIPE_SECRET_KEY=sk_test_fake STRIPE_WEBHOOK_SECRET=whsec_test PORT=4400 npm start &
PORT=4400 STRIPE_WEBHOOK_SECRET=whsec_test node scripts/smoke-test.js
```

✅ Verified: **24 passed, 0 failed.**

What the 24 checks cover: health/config, the three prices, signup → session
cookie → `/api/me`, duplicate email (409), wrong password (401), demo-mode
checkout (503 `DEMO_MODE`), unknown plan (400), unknown billing (400),
unauthenticated checkout (401), forged webhook, wrong signature (400), a
correctly signed webhook that **actually upgrades the plan**, and idempotency on
replay.

> The `STRIPE_SECRET_KEY=sk_test_fake` above is a deliberately fake key — the
> test proves the signature and store path without calling Stripe. A real
> `sk_test_…` also works.

### Static-site checks (no server)

```bash
cd webpages/learn-php_v5
python3 tools/check_links.py      # ✅ verified: 107 files, 2411 refs, 0 broken
```

### Manual click-through

Serve the site (`npm start` or `python3 -m http.server`), then:

**Demo mode (no keys) — everything except real payment works:**

1. **Homepage** — level cards show 14/12/14/8/12/14/14/8 = **96**. The lesson
   index lists 96 rows; typing `mysql` in the search box filters live.
2. **Sign up** — `/signup.html`, create an account. Password must be ≥ 8
   characters. Header now shows your plan.
3. **Pro gate** — open any Pro lesson (e.g. `/lessons/lesson-50.html`) while on
   Free: content is locked with an upgrade CTA.
4. **Plan selection** — `/checkout.html`, pick Pro, toggle monthly ⇄ yearly.
   Price and the yearly saving must update.
5. **Checkout** — complete it. The page must state plainly that **no card was
   charged**. You land on a success panel.
6. **Dashboard** — `/dashboard.html` shows plan = Pro, a renewal date, and
   progress. Use **cancel** → plan drops back to Free.
7. **Unlock check** — re-open `/lessons/lesson-50.html`: with Pro it is fully
   readable; after cancelling it is locked again.
8. **Persistence** — reload the page. The plan survives (it is in
   `localStorage`).
9. **404** — `/nope` returns `404.html` with a 404 status ✅ verified.

**Stripe mode (test keys) — also verify the real path:**

10. `/checkout.html` hides the demo banner and the button reads *"Continue to
    secure checkout"*.
11. Clicking it redirects to Stripe's hosted page.
12. Pay with `4242 4242 4242 4242`, any future expiry, any CVC.
13. Return to `/checkout.html?status=success&session_id=cs_…`.
14. `stripe listen` shows `checkout.session.completed → 200`.

**Expect step 11–14 to fail with `401 AUTH_REQUIRED` until you do Section 5.**
That is the known gap described at the top, not a regression.

---

## 5. Before real payments: connect the front-end to the server

Two edits, ~20 lines. Do this before live keys.

**(a) Make sign-up use the server.** In `signup.html` the submit handler calls
`LP.signUp({...})`. POST to the server instead, then refresh the session:

```js
var res = await fetch('/api/auth/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'same-origin',          // <- this is what sets the cookie
  body: JSON.stringify({ name: name, email: email, password: pass })
});
if (!res.ok) { /* show (await res.json()).error */ }
else { location.href = 'dashboard.html'; }
```

Use `/api/auth/signin` for the sign-in form. Both set the `lp_session` cookie
that `/api/checkout/session` requires.

**(b) Make the lock read the server.** Replace `LP.plan()` on the lesson pages
and dashboard with:

```js
const me = await fetch('/api/me', { credentials: 'same-origin' }).then(r => r.json());
// me.plan -> 'free' | 'pro' | 'team';  me.hasPro -> boolean
```

Keep `LP` as the fallback when `/api/me` is unreachable so the static host still
works.

Then re-run Section 4 steps 10–14.

---

## 6. Deploy it

### What to upload

**Static-only (no payments):** everything **except** `server/`, `tools/` and
`RUNNING.md`. That is:

```
index.html  404.html  signup.html  checkout.html  dashboard.html
certificate.html  legal.html  robots.txt  sitemap.xml
assets/  lessons/  projects/
```

**With payments:** the same, **plus** `server/` (excluding
`server/node_modules/` and `server/data/`). The server also serves the static
files, so on a Node host you upload the whole folder and do not need a separate
static host.

### Which host for which part

| Host | Static part | Server part | Notes |
|---|---|---|---|
| **Netlify / Vercel / Cloudflare Pages** | ✅ ideal | ⚠️ needs a `functions/` port of `server.js` | Vercel/Netlify want a handler export, not `app.listen()` |
| **Render / Railway / Fly.io / Heroku** | ✅ | ✅ works as-is | `npm start` is already correct; add env vars in the dashboard |
| **A VPS (Hetzner, DO, Lightsail)** | ✅ | ✅ | Run under `pm2` or a systemd unit behind nginx |
| **GitHub Pages / S3+CloudFront** | ✅ only | ❌ | No Node. Checkout stays in demo mode |
| **Shared cPanel hosting** | ✅ only | ❌ (usually no Node) | Static + demo only |

`server.js` listens on `process.env.PORT`, so Render/Railway/Heroku work with no
code change.

### Deploy to Render / Railway (the least-friction full deployment)

1. Push the folder to GitHub.
2. New **Web Service** → root directory `server`.
3. Build: `npm install` · Start: `npm start`.
4. Environment variables: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `SITE_URL=https://your-domain.com`,
   `COOKIE_SECURE=true`.
5. Deploy, then open the URL. `/api/health` must report `"mode":"stripe"`.
6. **Add a persistent disk** mounted at `/var/lib/learnphp` and set
   `DATA_DIR=/var/lib/learnphp`. **Without this, `learnphp.json` is wiped on
   every deploy and every customer silently reverts to Free.**

### Deploy the static-only version

Netlify drag-and-drop, Cloudflare Pages, or Vercel: publish directory = this
folder, no build command. Then expect demo checkout only.

### DNS and domain

1. Buy a domain (Namecheap, Cloudflare, Porkbun).
2. Point it at the host:
   - **Netlify/Vercel/Cloudflare:** add the domain in the dashboard, then create
     the `CNAME` / `A` records they show you.
   - **VPS:** `A` record → your server IP. `www` → `CNAME` → the apex.
3. Wait for DNS (minutes to a few hours).
4. **HTTPS is not optional** — Stripe requires it. Most hosts issue a free
   Let's Encrypt certificate automatically; on a VPS use `certbot --nginx`.
5. Set `SITE_URL=https://your-domain.com` and redeploy. Stripe redirects break
   if this still says localhost.

### Post-deploy, in this order

1. Visit `/api/health` → `"mode":"stripe"`, `"webhookConfigured":true`.
2. Register the webhook: Stripe Dashboard → Developers → Webhooks → Add
   endpoint → `https://your-domain.com/api/stripe/webhook`, events
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.
3. **Update the SEO URLs.** `robots.txt`, `sitemap.xml` and every page's
   `canonical` / `og:url` currently contain the staging address
   `static.teamily.ai/.../learn-php_v5/`. Regenerate:

   ```bash
   cd webpages/learn-php_v5
   python3 tools/apply_seo.py   --base https://your-domain.com/
   python3 tools/make_sitemap.py --base https://your-domain.com/
   # then edit the Sitemap: line in robots.txt
   ```

   Skip this and Google indexes the staging host instead of your domain.
4. `robots.txt` is only honoured at the **domain root**
   (`https://your-domain.com/robots.txt`). This repo's copy is already at the
   root, so it is correct once deployed that way.
5. Do one real-mode purchase with a real card, then refund it.
6. Submit the sitemap in Google Search Console.

---

## 7. Common problems

| Symptom | Cause | Fix |
|---|---|---|
| `mode: demo (no keys…)` after setting keys | Env vars not visible to the process; or `.env` exists but you ran `npm start` | Use inline vars or `node --env-file=.env server.js` (§3 Option 2) |
| Checkout redirects to Stripe, pays, **still Free** | Webhook never landed | Check `STRIPE_WEBHOOK_SECRET` matches *this* environment; endpoint must be exactly `/api/stripe/webhook`; look for `signature verification failed` in logs |
| Webhook returns **503** | `STRIPE_WEBHOOK_SECRET` unset | Set it. A purchase will never activate without it |
| Webhook returns **400** `No signatures found` | Body was JSON-parsed before the signature check | Already handled — `express.json()` skips that route. If you refactor middleware, keep the raw body |
| Checkout returns **401 `AUTH_REQUIRED`** | Known gap: front-end auth is `localStorage`, server auth needs a cookie | Do Section 5 |
| Checkout returns **502** | Stripe rejected the call — usually a bad/expired key | Verify the key, check server logs |
| Everyone reverts to Free after a deploy | No persistent disk; `learnphp.json` was wiped | Mount a disk and set `DATA_DIR` (§6) |
| Payment redirects to `localhost` in production | `SITE_URL` not set | Set `SITE_URL` to the https domain and redeploy |
| Signed in, but `/api/me` says signed out | Cookie is `Secure` on plain HTTP, or `credentials` missing | `COOKIE_SECURE=true` only behind HTTPS; add `credentials: 'same-origin'` to fetches |
| Session lost on refresh on a static host | Plans live in `localStorage` — private mode / different browser | Expected. Use the server path for cross-device state |
| Styles or JS missing when opening `index.html` directly | `file://` breaks root-relative paths | Serve over HTTP (§2) |
| `npm install` fails on old Node | Needs Node ≥ 20 | `nvm install 20 && nvm use 20` |
| Port 4242 already in use | Another instance running | `PORT=4400 npm start` |
| `stripe listen` works locally, production does not | Different secrets — CLI issues its own `whsec_` | Use the Dashboard signing secret in production |
| Lesson links 404 on a static host | Files not uploaded, or case changed | Re-upload `lessons/`; verify with `python3 tools/check_links.py` |

---

## 8. Still needs your own accounts and keys

The project runs without any of these. Each one is required only for the thing
it unlocks.

| What | Needed for | Where |
|---|---|---|
| **Stripe account** → `sk_…`, `pk_…`, `whsec_…` | Real payments | dashboard.stripe.com |
| **Domain** | Going live on a real address | any registrar |
| **Hosting account** | Serving the site | Render / Railway / Vercel / Netlify / VPS |
| **Plausible account** (or another analytics tool) | Traffic + conversion data | `data-domain="learnphp.example"` in every page's `<head>` — replace with your domain |
| **Carbon Ads zone + serve IDs** | The 300×250 ad slot | `index.html` — `YOUR_CARBON_ZONE_ID`, `YOUR_CARBON_SERVE_ID` |
| **EthicalAds publisher ID** | The 970×90 ad slot | `index.html` — `YOUR_ETHICALADS_PUBLISHER_ID`, `YOUR_ETHICALADS_AD_TYPE` |
| **DigitalOcean affiliate refcode** | Affiliate revenue | `index.html` — `TODO: insert your DigitalOcean refcode` |
| **Amazon Associates tag** | Affiliate revenue | `index.html` — `TODO: insert your Amazon Associates tag` |
| **Udemy affiliate ID** | Affiliate revenue | `index.html` — `TODO: insert your Udemy affiliate ID` |
| **Email provider** (Mailchimp, Buttondown, ConvertKit) | The newsletter form actually collecting addresses | Currently front-end only — validates and confirms, sends nothing |
| **Real testimonials, rating, subscriber count** | Credibility | Currently illustrative; the footer says so |

Find every placeholder in one go:

```bash
cd webpages/learn-php_v5
grep -rniE "TODO|YOUR_[A-Z_]+|learnphp\.example" --include=*.html --include=*.js .
```

### Also worth fixing before you scale

- `server/store.js` is a JSON file with no locking. Fine for a handful of
  signups; swap it for Postgres/SQLite before real concurrent traffic. It is the
  only module to change.
- Password reset is not implemented (no email sending).
- Team seats are recorded (`seats: 5`) but there is no invite flow yet.

---

*Verified in this environment: Node v20.20.2 · `npm install` clean · demo-mode
smoke test 17/17 · Stripe-mode smoke test 24/24 · 107 pages / 2411 internal
references with 0 broken links · static serving and 404 confirmed. Not verified:
a real Stripe test-key purchase end to end (no live keys), and any deployment to
an actual host — those need your accounts.*
