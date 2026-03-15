#!/usr/bin/env node
const { runModule } = require('./_moduleRunner');

runModule('Platform', 'platform-cases.json', { loginFirst: false }).catch((err) => {
  console.error('[platform.test] FATAL:', err.message);
  process.exit(1);
});

