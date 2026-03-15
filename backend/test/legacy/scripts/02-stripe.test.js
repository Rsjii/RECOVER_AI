#!/usr/bin/env node
const { runModule } = require('./_moduleRunner');

runModule('Stripe', 'stripe-cases.json').catch((err) => {
  console.error('[stripe.test] FATAL:', err.message);
  process.exit(1);
});

