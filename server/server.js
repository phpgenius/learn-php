/**
 * Learn PHP — checkout + subscription server
 * ---------------------------------------------------------------------------
 * Endpoints
 *   GET  /api/health              liveness + whether Stripe is configured
 *   GET  /api/config              public config (publishable key, mode)
 *   POST /api/auth/signup         create account
 *   POST /api/auth/signin         sign in
 *   POST /api/auth/signout        sign out
 *   GET  /api/me                  current user + effective plan
 *   POST /api/checkout/session    create a Stripe Checkout Session
 *   GET  /api/checkout/status     poll a session after redirect
 *   POST /api/billing/portal      Stripe customer portal (cancel/upgrade)
 *   POST /api/stripe/webhook      subscription lifecycle (THE source of truth)
 *
 * Two modes:
 *   stripe  — STRIPE_SECRET_KEY is set; real Checkout Sessions are created.
 *   demo    — no keys; /api/checkout/session 503s with code DEMO_MODE and the
 *             browser falls back to its localStorage demo flow.
 *
 * Security notes, because they matter more than the happy path:
 *   - The browser never sends a price. It sends {plan, billing}; the server
 *     resolves the amount from plans.js. Otherwise anyone can post amount:1.
 *   - The webhook is the only place a plan is granted. /checkout/session
 *     records an "incomplete" state at most; it never grants access.
 *   - The webhook verifies the Stripe signature against the RAW body, so
 *     express.json() must not consume that route.
 *   - Sessions are HttpOnly, SameSite=Lax cookies; no tokens in localStorage.
 */

import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';

import { PLANS, PAID_PLANS, BILLING, resolvePrice, savings, CURRENCY } from './plans.js';
import * as store from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = process.env.SITE_ROOT || path.join(__dirname, '..');

const PORT = Number(process.env.PORT || 4242);
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

const stripeEnabled = Boolean(SECRET_KEY);
const stripe = stripeEnabled ? new Stripe(SECRET_KEY) : null;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

/* --------------------------------------------------------------- helpers */
const COOKIE = 'lp_session';

function setSessionCookie(res, token, expiresAt) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    expires: new Date(expiresAt),
    path: '/',
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function sessionToken(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Attach req.user when a valid session cookie is present. */
function withUser(req, _res, next) {
  req.user = store.getSessionUser(sessionToken(req));
  next();
}

/** Effective plan: a canceled sub keeps access until the paid period ends. */
function effectivePlan(user) {
  if (!user) return 'free';
  if (user.plan === 'free') return 'free';
  if (user.status === 'active') return user.plan;
  if (user.status === 'canceled' && user.currentPeriodEnd) {
    return new Date(user.currentPeriodEnd).getTime() > Date.now() ? user.plan : 'free';
  }
  // past_due / incomplete grant nothing
  return 'free';
}

function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Sign in first.', code: 'AUTH_REQUIRED' });
  next();
}

/** Small in-memory rate limiter — enough to blunt credential stuffing. */
const buckets = new Map();
function rateLimit({ windowMs = 60000, max = 12, key = 'ip' } = {}) {
  return (req, res, next) => {
    const id = `${key}:${req.ip}:${req.path}`;
    const now = Date.now();
    const b = buckets.get(id) || { n: 0, reset: now + windowMs };
    if (now > b.reset) {
      b.n = 0;
      b.reset = now + windowMs;
    }
    b.n += 1;
    buckets.set(id, b);
    if (b.n > max) {
      res.set('Retry-After', String(Math.ceil((b.reset - now) / 1000)));
      return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    }
    next();
  };
}

/* ---------------------------------------------------------------- config */
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: stripeEnabled ? 'stripe' : 'demo',
    webhookConfigured: Boolean(WEBHOOK_SECRET),
    plans: Object.keys(PLANS),
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    mode: stripeEnabled ? 'stripe' : 'demo',
    publishableKey: PUBLIC_PK(),
    currency: CURRENCY,
    prices: Object.fromEntries(
      Object.values(PLANS).map((p) => [
        p.id,
        p.prices
          ? {
              monthly: p.prices.monthly.amount,
              yearly: p.prices.yearly.amount,
              seats: p.seats,
            }
          : { monthly: 0, yearly: 0, seats: 1 },
      ])
    ),
    savings: { pro: savings('pro'), team: savings('team') },
  });
});

function PUBLIC_PK() {
  return stripeEnabled ? PUBLISHABLE_KEY : '';
}

/* ------------------------------------------------------------------ auth
   The Stripe webhook must see the RAW request body, so it is excluded from
   the JSON parser. `express.raw()` in the route would otherwise be a no-op
   because express.json() had already consumed and re-serialised the body —
   which silently breaks signature verification. */
function jsonExceptWebhook(req, res, next) {
  if (req.path === '/api/stripe/webhook') return next();
  return express.json({ limit: '32kb' })(req, res, next);
}
app.use(jsonExceptWebhook);
app.use(withUser);

function publicSession(user) {
  if (!user) return { signedIn: false, plan: 'free' };
  return {
    signedIn: true,
    user: store.publicUser(user),
    plan: effectivePlan(user),
    hasPro: ['pro', 'team'].includes(effectivePlan(user)),
  };
}

app.post('/api/auth/signup', rateLimit({ max: 8 }), (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !String(email).includes('@')) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'Enter your name.' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  try {
    const user = store.createUser({ email, name, password });
    const { token, expiresAt } = store.createSession(user.id);
    setSessionCookie(res, token, expiresAt);
    store.logEvent('signup', { email: user.email });
    res.status(201).json(publicSession(user));
  } catch (e) {
    if (e.code === 'EMAIL_TAKEN') return res.status(409).json({ error: e.message });
    console.error('[signup]', e);
    res.status(500).json({ error: 'Could not create the account.' });
  }
});

app.post('/api/auth/signin', rateLimit({ max: 10 }), (req, res) => {
  const { email, password } = req.body || {};
  const user = store.findUserByEmail(email);
  // Same message either way — do not confirm which emails exist.
  if (!user || !store.verifyPassword(String(password || ''), user.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const { token, expiresAt } = store.createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json(publicSession(user));
});

app.post('/api/auth/signout', (req, res) => {
  const t = sessionToken(req);
  if (t) store.destroySession(t);
  clearSessionCookie(res);
  res.json({ signedIn: false, plan: 'free' });
});

app.get('/api/me', (req, res) => {
  res.json(publicSession(req.user));
});

/* -------------------------------------------------------------- checkout */
app.post('/api/checkout/session', requireUser, rateLimit({ max: 20 }), async (req, res) => {
  const { plan, billing } = req.body || {};

  if (!PAID_PLANS.includes(plan)) {
    return res.status(400).json({ error: 'Choose Pro or Team.' });
  }
  if (!BILLING.includes(billing)) {
    return res.status(400).json({ error: 'Choose monthly or yearly billing.' });
  }

  let price;
  try {
    price = resolvePrice(plan, billing); // amount comes from the server, never the client
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (!stripeEnabled) {
    // No keys: tell the browser to use its clearly-labelled demo flow.
    return res.status(503).json({
      error: 'Payments are not configured on this server.',
      code: 'DEMO_MODE',
    });
  }

  try {
    // Reuse the Stripe customer if we already have one, else create it.
    let customerId = req.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: req.user.id },
      });
      customerId = customer.id;
      store.updateUser(req.user.id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      // client_reference_id survives the redirect and the webhook.
      client_reference_id: req.user.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CURRENCY,
            unit_amount: price.amount,
            recurring: { interval: price.interval },
            product_data: {
              name: price.label,
              metadata: { planId: plan, seats: String(price.seats) },
            },
          },
        },
      ],
      subscription_data: {
        metadata: { userId: req.user.id, planId: plan, billing },
      },
      metadata: { userId: req.user.id, planId: plan, billing },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      success_url: `${SITE_URL}/checkout.html?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/checkout.html?status=canceled`,
    });

    store.logEvent('checkout_start', { plan, billing, amount: price.amount, userId: req.user.id });
    res.json({ url: session.url, id: session.id });
  } catch (e) {
    console.error('[checkout]', e.message);
    res.status(502).json({ error: 'Could not start checkout. Try again.' });
  }
});

app.get('/api/checkout/status', requireUser, async (req, res) => {
  const { session_id: sessionId } = req.query;
  if (!stripeEnabled) return res.json({ mode: 'demo' });
  if (!sessionId) return res.status(400).json({ error: 'session_id required' });

  try {
    const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
      expand: ['subscription'],
    });
    // Only ever report on this user's own sessions.
    if (session.client_reference_id && session.client_reference_id !== req.user.id) {
      return res.status(403).json({ error: 'That session belongs to another account.' });
    }
    res.json({
      mode: 'stripe',
      status: session.status,
      paymentStatus: session.payment_status,
      plan: session.metadata?.planId || null,
      billing: session.metadata?.billing || null,
    });
  } catch (e) {
    res.status(502).json({ error: 'Could not read the session.' });
  }
});

app.post('/api/billing/portal', requireUser, async (req, res) => {
  if (!stripeEnabled) return res.status(503).json({ code: 'DEMO_MODE' });
  if (!req.user.stripeCustomerId) {
    return res.status(400).json({ error: 'No Stripe customer on this account yet.' });
  }
  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: req.user.stripeCustomerId,
      return_url: `${SITE_URL}/dashboard.html`,
    });
    res.json({ url: portal.url });
  } catch (e) {
    console.error('[portal]', e.message);
    res.status(502).json({ error: 'Could not open the billing portal.' });
  }
});

/* --------------------------------------------------------------- webhook
   Mounted with express.raw BEFORE any JSON parser so the signature check
   sees the exact bytes Stripe signed. */
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    if (!stripeEnabled || !WEBHOOK_SECRET) {
      return res.status(503).json({ error: 'Webhook not configured.' });
    }

    const signature = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, WEBHOOK_SECRET);
    } catch (e) {
      // A bad signature is either a misconfiguration or an attacker.
      console.error('[webhook] signature verification failed:', e.message);
      return res.status(400).send(`Webhook Error: ${e.message}`);
    }

    // Idempotency: Stripe retries. A retry must not re-apply the change.
    if (!store.markEventProcessed(event.id)) {
      return res.json({ received: true, duplicate: true });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          await onCheckoutCompleted(event.data.object);
          break;
        }
        case 'customer.subscription.updated': {
          await onSubscriptionUpdated(event.data.object);
          break;
        }
        case 'customer.subscription.deleted': {
          await onSubscriptionDeleted(event.data.object);
          break;
        }
        case 'invoice.payment_failed': {
          await onPaymentFailed(event.data.object);
          break;
        }
        case 'invoice.paid': {
          await onInvoicePaid(event.data.object);
          break;
        }
        default:
          // Unhandled types are fine — acknowledge so Stripe stops retrying.
          break;
      }
      res.json({ received: true });
    } catch (e) {
      console.error(`[webhook] handler failed for ${event.type}:`, e);
      // 500 makes Stripe retry — correct, because we did not apply the change.
      res.status(500).json({ error: 'Handler failed' });
    }
  }
);

async function onCheckoutCompleted(session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId) return console.warn('[webhook] session with no userId, ignoring');

  const sub = session.subscription
    ? await stripe.subscriptions.retrieve(session.subscription)
    : null;

  const planId = session.metadata?.planId || sub?.metadata?.planId || 'pro';
  const billing = session.metadata?.billing || sub?.metadata?.billing || 'monthly';

  store.updateUser(userId, {
    plan: PLANS[planId] ? planId : 'pro',
    billing: billing === 'yearly' ? 'yearly' : 'monthly',
    status: 'active',
    seats: PLANS[planId]?.seats ?? 1,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription || null,
    currentPeriodEnd: sub ? new Date(sub.current_period_end * 1000).toISOString() : null,
    cancelAtPeriodEnd: sub ? Boolean(sub.cancel_at_period_end) : false,
  });
  store.logEvent('subscription_started', { plan: planId, billing, userId });
}

async function onSubscriptionUpdated(sub) {
  const userId = await userIdForSubscription(sub);
  if (!userId) return;

  // Map the Stripe price back to our plan by amount + interval.
  const item = sub.items?.data?.[0];
  const amount = item?.price?.unit_amount;
  const interval = item?.price?.recurring?.interval;
  const planId = matchPlan(amount, interval);

  store.updateUser(userId, {
    plan: planId || 'pro',
    billing: interval === 'year' ? 'yearly' : 'monthly',
    status: sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status,
    currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  });
}

async function onSubscriptionDeleted(sub) {
  const userId = await userIdForSubscription(sub);
  if (!userId) return;
  store.updateUser(userId, {
    plan: 'free',
    billing: 'monthly',
    status: 'active', // back on free, nothing to pay
    seats: 1,
    stripeSubscriptionId: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  });
  store.logEvent('subscription_ended', { userId });
}

async function onPaymentFailed(invoice) {
  const userId = await userIdForCustomer(invoice.customer);
  if (!userId) return;
  store.updateUser(userId, { status: 'past_due' });
  store.logEvent('payment_failed', { userId, amount: invoice.amount_due });
}

async function onInvoicePaid(invoice) {
  const userId = await userIdForCustomer(invoice.customer);
  if (!userId) return;
  // Renewal: refresh the period end and clear any past_due flag.
  if (invoice.subscription) {
    const sub = await stripe.subscriptions.retrieve(invoice.subscription);
    store.updateUser(userId, {
      status: 'active',
      currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
    });
  }
}

async function userIdForSubscription(sub) {
  if (sub.metadata?.userId && store.getUser(sub.metadata.userId)) return sub.metadata.userId;
  return userIdForCustomer(sub.customer);
}

async function userIdForCustomer(customerId) {
  const u = store.findUserByStripeCustomer(customerId);
  return u ? u.id : null;
}

function matchPlan(amount, interval) {
  for (const [id, plan] of Object.entries(PLANS)) {
    if (!plan.prices) continue;
    const p = interval === 'year' ? plan.prices.yearly : plan.prices.monthly;
    if (p && p.amount === amount) return id;
  }
  return null;
}

/* --------------------------------------------------------- static site */
app.use(
  express.static(SITE_ROOT, {
    extensions: ['html'],
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  })
);
app.use((_req, res) => res.status(404).sendFile(path.join(SITE_ROOT, '404.html')));

/* ---------------------------------------------------------------- listen */
app.listen(PORT, () => {
  console.log(`Learn PHP server on ${SITE_URL}`);
  console.log(`  mode: ${stripeEnabled ? 'stripe (real Checkout)' : 'demo (no keys — browser fallback)'}`);
  console.log(`  webhook secret: ${WEBHOOK_SECRET ? 'set' : 'NOT set'}`);
  if (!stripeEnabled) {
    console.log('  Set STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY to enable real payments.');
  }
});

export default app;
