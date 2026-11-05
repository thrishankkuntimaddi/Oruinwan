#!/usr/bin/env node
'use strict';

/**
 * Make the four Pro plans in Razorpay (monthly/yearly × USD/INR, prices from
 * src/features/billing/prices.js) and print the lines to paste into server/.env.
 *
 *   RAZORPAY_KEY_ID=rzp_test_... RAZORPAY_KEY_SECRET=... node scripts/billing/create-razorpay-plans.js
 *   ... --only=INR       just the rupee plans (USD needs International Payments switched on)
 *
 * Run once with test keys and once with live keys: plans belong to one mode. Running it again
 * makes new plans (Razorpay has no "update plan"); old ones stay and can be ignored.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const razorpay = require('../../src/features/billing/razorpay');
const { PRO_UNIT_AMOUNT } = require('../../src/features/billing/prices');

async function main() {
    const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
    const c = razorpay.config();
    if (!c.keyId || !c.keySecret) {
        console.error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (in server/.env or the environment) first.');
        process.exit(1);
    }
    const rz = razorpay.client();
    const lines = [];
    for (const [key, amount] of Object.entries(PRO_UNIT_AMOUNT)) {
        const [cycle, currency] = key.split(':');
        if (only && currency !== only.toUpperCase()) continue;
        const plan = await rz.createPlan({
            period: cycle,
            amount,
            currency,
            name: `Oruinwan Pro (${cycle}, per member)`,
            description: `Oruinwan Pro, one workspace member, billed ${cycle}`,
        });
        lines.push(`RAZORPAY_PLAN_PRO_${cycle.toUpperCase()}_${currency}=${plan.id}`);
        console.error(`made ${plan.id}: ${currency} ${amount / 100} ${cycle}`);
    }
    console.log(`\n# Paste into server/.env (${c.keyId.startsWith('rzp_live') ? 'LIVE' : 'TEST'} mode)\n${lines.join('\n')}`);
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
