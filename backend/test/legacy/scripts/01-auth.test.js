#!/usr/bin/env node
const { runModule } = require('./_moduleRunner');

runModule('Auth', 'auth-cases.json').catch((err) => {
  console.error('[auth.test] FATAL:', err.message);
  process.exit(1);
});

