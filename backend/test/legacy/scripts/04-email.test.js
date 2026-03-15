#!/usr/bin/env node
const { runModule } = require('./_moduleRunner');

runModule('Email', 'email-cases.json').catch((err) => {
  console.error('[email.test] FATAL:', err.message);
  process.exit(1);
});

