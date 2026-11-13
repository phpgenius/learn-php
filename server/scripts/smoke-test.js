/**
 * End-to-end smoke test for the Learn PHP checkout server.
 *
 * Runs against a live server instance and exercises the paths that actually
 * matter for money:
 *   1. health / config
 *   2. signup -> session cookie -> /api/me
 *   3. signin with a wrong password is rejected
 *   4. checkout in demo mode returns code DEMO_MODE (browser falls back)
 *   5. an unknown plan is rejected (price can never come from the client)
 *   6. a webhook with a bad signature is rejected (400)
 *   7. a correctly-signed customer.subscription.updated webhook
 *      actually upgrades the stored plan
 *   8. replaying that same event is a no-op (idempotency)
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_fake STRIPE_WEBHOOK_SECRET=whsec_test \
 *   PORT=4399 node scripts/smoke-test.js
 *
 * Test 7 uses customer.subscription.updated because that handler makes no
 * Stripe API call, so it works with a fake secret key while still proving
 * the raw-body + signature + store path.
 */

import crypto from 'node:crypto';

const BASE = process.env.TEST_BASE || `http://localhost:${process.env.PORT || 4399}`;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function sign(payload, secret) {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

let cookie = '';

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(cookie ? { cookie } : {}) },
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
}

async function main() {
  const email = `smoke+${Date.now()}@example.com`;

  console.log(`\nLearn PHP smoke test → ${BASE}\n`);

  console.log('health & config');
  const health = await req('/api/health');
  check('health 200', health.status === 200, `got ${health.status}`);
  check('health mode reported', ['demo', 'stripe'].includes(health.json?.mode));
  const cfg = await req('/api/config');
  check('config exposes 3 plans', cfg.json && Object.keys(cfg.json.prices || {}).length === 3);
  check(
    'pro yearly price is 18000 cents ($180)',
    cfg.json?.prices?.pro?.yearly === 18000,
    String(cfg.json?.prices?.pro?.yearly)
  );
  check(
    'team yearly price is 46800 cents ($468)',
    cfg.json?.prices?.team?.yearly === 46800,
    String(cfg.json?.prices?.team?.yearly)
  );

  console.log('\nauth');
  const su = await req('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, name: 'Smoke Tester', password: 'hunter2hunter2' }),
  });
  check('signup 201', su.status === 201, `got ${su.status} ${su.text.slice(0, 120)}`);
  check('signup sets a session cookie', Boolean(cookie), cookie || '(none)');
  check('new account is free', su.json?.plan === 'free');

  const me = await req('/api/me');
  check('me returns the signed-in user', me.json?.signedIn === true);
  check('me hides the password hash', !JSON.stringify(me.json || {}).includes('passwordHash'));

  const dupe = await req('/api/auth/signup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, name: 'Again', password: 'hunter2hunter2' }),
  });
  check('duplicate email rejected 409', dupe.status === 409, `got ${dupe.status}`);

  const badPw = await req('/api/auth/signin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'wrongwrongwrong' }),
  });
  check('wrong password rejected 401', badPw.status === 401, `got ${badPw.status}`);

  console.log('\ncheckout guards');
  const demo = await req('/api/checkout/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'pro', billing: 'yearly' }),
  });
  if (health.json?.mode === 'demo') {
    check(
      'checkout without keys -> 503 DEMO_MODE',
      demo.status === 503 && demo.json?.code === 'DEMO_MODE',
      `got ${demo.status} ${demo.text.slice(0, 100)}`
    );
  } else {
    // Stripe mode. With a real key this returns a session URL; with the fake
    // key this smoke test uses, the Stripe call fails and we must get a clean
    // 502 that grants nothing — never a false success.
    console.log(`  info checkout in stripe mode -> ${demo.status}`);
    check(
      'checkout in stripe mode either returns a url or fails cleanly',
      (demo.status === 200 && Boolean(demo.json?.url)) ||
        (demo.status === 502 && !demo.json?.url),
      `got ${demo.status} ${demo.text.slice(0, 120)}`
    );
  }

  const badPlan = await req('/api/checkout/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'enterprise-free', billing: 'monthly' }),
  });
  check('unknown plan rejected 400', badPlan.status === 400, `got ${badPlan.status}`);

  const badBilling = await req('/api/checkout/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'pro', billing: 'weekly' }),
  });
  check('unknown billing rejected 400', badBilling.status === 400, `got ${badBilling.status}`);

  const anon = await fetch(BASE + '/api/checkout/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'pro', billing: 'monthly' }),
  });
  check('checkout without a session -> 401', anon.status === 401, `got ${anon.status}`);

  console.log('\nwebhook');
  const unsigned = await req('/api/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'evt_forged', type: 'customer.subscription.updated' }),
  });
  check(
    'forged webhook rejected (400 or 503)',
    unsigned.status === 400 || unsigned.status === 503,
    `got ${unsigned.status}`
  );

  if (health.json?.webhookConfigured) {
    const userId = me.json?.user?.id;
    const eventId = `evt_smoke_${Date.now()}`;
    const periodEnd = Math.floor(Date.now() / 1000) + 365 * 86400;

    const payload = JSON.stringify({
      id: eventId,
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_smoke',
          object: 'subscription',
          customer: 'cus_smoke',
          status: 'active',
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          metadata: { userId, planId: 'pro' },
          items: {
            data: [
              {
                price: { unit_amount: 18000, recurring: { interval: 'year' }, currency: 'usd' },
              },
            ],
          },
        },
      },
    });

    const hookRes = (sig) =>
      fetch(BASE + '/api/stripe/webhook', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'stripe-signature': sig },
        body: payload,
      });

    const bad = await hookRes('t=1,v1=deadbeef');
    check('wrong signature rejected 400', bad.status === 400, `got ${bad.status}`);

    const good = await hookRes(sign(payload, WEBHOOK_SECRET));
    check('signed webhook accepted 200', good.status === 200, `got ${good.status}`);

    const after = await req('/api/me');
    check('webhook upgraded plan to pro', after.json?.plan === 'pro', `plan=${after.json?.plan}`);
    check('webhook set yearly billing', after.json?.user?.billing === 'yearly');
    check('webhook granted hasPro', after.json?.hasPro === true);
    check(
      'webhook set a period end',
      Boolean(after.json?.user?.currentPeriodEnd),
      String(after.json?.user?.currentPeriodEnd)
    );

    const replay = await hookRes(sign(payload, WEBHOOK_SECRET));
    const replayJson = await replay.json().catch(() => ({}));
    check(
      'replayed event is a no-op',
      replay.status === 200 && replayJson.duplicate === true,
      `status=${replay.status} body=${JSON.stringify(replayJson)}`
    );
  } else {
    console.log('  skip signed-webhook checks (STRIPE_WEBHOOK_SECRET not set on server)');
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log('failed: ' + failures.join(', '));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\nSMOKE TEST CRASHED:', e.message);
  process.exit(1);
});
