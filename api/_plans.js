// ── Server-side plan catalogue — THE single source of truth for pricing ──────
//
// The browser sends only a plan *id*. Amount and duration are resolved HERE, in
// both /api/create-order and /api/verify-payment, so the client can never choose
// what it pays or what it gets.
//
// PRODUCTION PRICING (restored after the Rs.9 payment test).
export const PLANS = {
  monthly: {
    months:       1,
    amountPaise:  19900,   // Rs.199
    amountRupees: 199,
  },
  yearly: {
    months:       12,
    amountPaise:  99900,   // Rs.999
    amountRupees: 999,
  },
};

export const CURRENCY = 'INR';

/** Resolve a plan id from an untrusted client. Returns null for anything unknown. */
export function resolvePlan(planId) {
  if (typeof planId !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
}
