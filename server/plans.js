/**
 * Learn PHP — plans, single source of truth for the server.
 *
 * These MUST stay in sync with PLANS in ../assets/app.js. The front-end
 * renders prices from app.js; the server charges from here. If they drift,
 * a customer sees one price and is charged another — so the smoke test
 * (scripts/smoke-test.js) asserts they match.
 *
 * Prices are in the smallest currency unit (cents), which is what Stripe
 * expects. $19.00 -> 1900.
 */

export const CURRENCY = 'usd';

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    seats: 1,
    // Free has no Stripe price — it is the absence of a subscription.
    prices: null,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    seats: 1,
    prices: {
      monthly: { amount: 1900, interval: 'month' },
      yearly: { amount: 18000, interval: 'year' }, // $15/mo billed annually
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    seats: 5,
    prices: {
      monthly: { amount: 4900, interval: 'month' },
      yearly: { amount: 46800, interval: 'year' }, // $39/mo billed annually
    },
  },
};

export const PAID_PLANS = ['pro', 'team'];
export const BILLING = ['monthly', 'yearly'];

/** Resolve a plan + billing period to a Stripe-ready price descriptor. */
export function resolvePrice(planId, billing) {
  const plan = PLANS[planId];
  if (!plan) throw new Error(`Unknown plan: ${planId}`);
  if (!plan.prices) throw new Error(`Plan ${planId} has no price (free tier)`);
  const period = BILLING.includes(billing) ? billing : 'monthly';
  const p = plan.prices[period];
  return {
    planId,
    billing: period,
    amount: p.amount,
    interval: p.interval,
    currency: CURRENCY,
    seats: plan.seats,
    // Human label used in Stripe line items and receipts.
    label: `Learn PHP ${plan.name} — ${period === 'yearly' ? 'annual' : 'monthly'}`,
  };
}

/** Yearly saving vs paying monthly, in cents and percent. */
export function savings(planId) {
  const plan = PLANS[planId];
  if (!plan || !plan.prices) return { amount: 0, pct: 0 };
  const full = plan.prices.monthly.amount * 12;
  const disc = plan.prices.yearly.amount;
  return { amount: full - disc, pct: Math.round(((full - disc) / full) * 100) };
}
