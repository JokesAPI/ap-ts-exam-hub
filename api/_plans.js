// ── Server-side plan catalogue — THE single source of truth for pricing ──────
//
// The browser sends only a plan *id*. Amount and duration are resolved HERE, in
// both /api/create-order and /api/verify-payment, so the client can never choose
// what it pays or what it gets.
//
// ⚠️  TEST BUILD — TEMPORARY PRICING ⚠️
// monthly is Rs.9 (900 paise) so a real end-to-end payment can be exercised
// cheaply. The YEARLY plan is intentionally REMOVED for the duration of the test
// so nobody can obtain 12 months at the test price. Restore before production:
//
//   PRODUCTION:  monthly = 19900 paise (Rs.199, 1 month)
//                yearly  = 99900 paise (Rs.999, 12 months)
//
export const PLANS = {
  monthly: {
    months:       1,
    amountPaise:  900,   // TEST: was 19900 (Rs.199)
    amountRupees: 9,     // TEST: was 199   — recorded in payments.amount
  },
  // yearly: DISABLED during the Rs.9 payment test. Re-enable with:
  //   yearly: { months: 12, amountPaise: 99900, amountRupees: 999 },
};

export const CURRENCY = 'INR';

/** Resolve a plan id from an untrusted client. Returns null for anything unknown
 *  or currently disabled (e.g. 'yearly' during the test). */
export function resolvePlan(planId) {
  if (typeof planId !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(PLANS, planId) ? PLANS[planId] : null;
}
