const { request, extractCookie } = require('./_client');
const { loadContext, saveContext, readCases } = require('./_context');
const { buildPayloads } = require('./_payloads');

function replaceTokens(input, refs) {
  if (typeof input === 'string') {
    return input.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => refs[key] || '');
  }

  if (Array.isArray(input)) {
    return input.map((value) => replaceTokens(value, refs));
  }

  if (input && typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = replaceTokens(v, refs);
    }
    return out;
  }

  return input;
}

function printResult(ok, name, expected, actual) {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }

  console.log(`  FAIL ${name}`);
  console.log(`    expected: ${expected}`);
  console.log(`    actual:   ${actual}`);
}

async function runModule(moduleName, caseFile, options = {}) {
  const { td, port, dataFile } = loadContext();
  const payloads = buildPayloads(td);
  const refs = payloads.refs || {};
  const cases = readCases(caseFile);

  let cookie = td.cookie || '';

  if (options.loginFirst !== false) {
    const login = await request({
      port,
      method: 'POST',
      path: '/api/auth/login',
      body: payloads.loginBody,
    });
    const freshCookie = extractCookie(login.headers);
    if (login.status === 200 && freshCookie) {
      cookie = freshCookie;
      td.cookie = freshCookie;
      saveContext(td, dataFile);
    }
  }

  console.log(`\n[${moduleName}]`);

  let pass = 0;
  let fail = 0;

  for (const testCase of cases) {
    const path = replaceTokens(testCase.path, refs);

    let body = undefined;
    if (testCase.bodyRef) {
      body = replaceTokens(payloads[testCase.bodyRef], refs);
    } else if (Object.prototype.hasOwnProperty.call(testCase, 'body')) {
      body = replaceTokens(testCase.body, refs);
    }

    const response = await request({
      port,
      method: testCase.method,
      path,
      body,
      cookie: testCase.auth ? cookie : undefined,
      headers: testCase.headers || {},
    });

    const ok = response.status === testCase.expectedStatus;
    printResult(ok, testCase.name, testCase.expectedStatus, response.status);
    if (ok) pass += 1;
    else fail += 1;
  }

  console.log(`\n${moduleName} summary: ${pass} passed, ${fail} failed`);

  if (fail > 0) {
    process.exitCode = 1;
  }
}

module.exports = { runModule };

