'use strict';

/**
 * Pro prices per member, in the currency's smallest unit (cents, paise). These are what
 * scripts/billing/create-razorpay-plans.js puts on the Razorpay plans and what the apps show;
 * the amount charged is always the Razorpay plan's. Keep in step with docs/BUSINESS_MODEL.md §2,
 * client/src/pages/pricing/plans.js and mobile/src/features/plan/planText.js.
 *
 *   USD  $6 a month, or $5 a month billed yearly ($60)
 *   INR  ₹499 a month, or ₹399 a month billed yearly (₹4,788)
 */
const PRO_UNIT_AMOUNT = {
    'monthly:USD': 600,
    'yearly:USD': 6000,
    'monthly:INR': 49900,
    'yearly:INR': 478800,
};

const unitAmount = (cycle, currency) => PRO_UNIT_AMOUNT[`${cycle}:${currency}`] ?? null;

module.exports = { PRO_UNIT_AMOUNT, unitAmount };
