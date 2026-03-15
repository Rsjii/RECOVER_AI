#!/usr/bin/env node
const { runModule } = require('./_moduleRunner');

runModule('AI', 'ai-cases.json').catch((err) => {
  console.error('[ai.test] FATAL:', err.message);
  process.exit(1);
});

