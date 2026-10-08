import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

import * as core from '../../src/lib/meta-ads-core.mjs';

const nativeRequire = createRequire(import.meta.url);
const secret = 'test-secret-long-enough-for-hs256';
const campaignId = core.DEFAULT_CAMPAIGN;

async function compileCommonJs(url) {
  const source = await readFile(url, 'utf8');
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: url.pathname,
  }).outputText;
}

async function loadServerModule({ token = 'token', payload = { role: 'admin', exp: 4_102_444_800 }, proxyCall }) {
  process.env.JWT_SECRET = secret;
  const code = await compileCommonJs(new URL('../../src/lib/meta-ads.ts', import.meta.url));
  const cjsModule = { exports: {} };
  const mockedCore = { ...core, rangeInput: input => core.rangeInput(input, new Date('2026-10-08T12:00:00Z')), proxyCall };
  const localRequire = id => {
    if (id === 'next/headers') return { cookies: async () => ({ get: () => token ? { value: token } : undefined }) };
    if (id === 'jose') return { jwtVerify: async () => ({ payload }) };
    if (id === './meta-ads-core.mjs') return mockedCore;
    if (id === '@/types/meta-ads') return {};
    return nativeRequire(id);
  };
  vm.runInNewContext(`(function(exports,require,module){${code}\n})`, {
    process, console, TextEncoder, Buffer, setTimeout, clearTimeout,
  })(cjsModule.exports, localRequire, cjsModule);
  return cjsModule.exports;
}

function state(version = 1) {
  return { account_name: 'Choho', currency: 'USD', timezone: 'Asia/Seoul', status: 'OK', version, last_success_at: '2026-10-08T11:00:00.000Z', last_attempt_at: '2026-10-08T11:00:00.000Z', available_since: '2026-10-08' };
}

function dashboardResults(version = 1, spendMicros = 1_000_000) {
  const metric = { spend_micros: spendMicros, impressions: 10, link_clicks: 2, landing_page_views: 1, website_leads: 1 };
  return [
    { results: [{ campaign_id: campaignId, name: 'Campaign', status: 'ACTIVE', effective_status: 'ACTIVE', objective: 'OUTCOME_LEADS', spend_cap_cents: null, updated_at: '2026-10-08T11:00:00.000Z', ...metric }] },
    { results: [{ date: '2026-10-08', campaigns: 1, ...metric }] },
    { results: [{ date: '2026-10-08', campaign_id: campaignId, campaign_name: 'Campaign', daily_reach: 8, collected_at: '2026-10-08T11:00:00.000Z', ...metric }] },
    { results: [{ row_count: 1, ...metric }] },
    { results: [{ version }] },
  ];
}

test('server helper rejects missing authentication and non-admin roles before D1', async () => {
  let calls = 0;
  const missing = await loadServerModule({ token: null, proxyCall: async () => { calls++; } });
  await assert.rejects(missing.getMetaAdsDashboard(), error => error.status === 401 && error.code === 'UNAUTHORIZED');
  const employee = await loadServerModule({ payload: { role: 'employee', exp: 4_102_444_800 }, proxyCall: async () => { calls++; } });
  await assert.rejects(employee.getMetaAdsDashboard(), error => error.status === 401 && error.code === 'UNAUTHORIZED');
  assert.equal(calls, 0);
});

test('server helper rejects malformed cursors and invalid filters', async () => {
  let calls = 0;
  const server = await loadServerModule({ proxyCall: async (_env, statements) => {
    calls++;
    assert.equal(statements.length, 1);
    return [{ results: [state()] }];
  } });
  await assert.rejects(server.getMetaAdsDashboard({ cursor: 'bad.signature' }), error => error.status === 400 && error.code === 'INVALID_CURSOR');
  await assert.rejects(server.getMetaAdsDashboard({ days: '91' }), error => error.status === 400 && error.code === 'INVALID_FILTER');
  assert.equal(calls, 1);
});

test('60-second cache reuses dashboard payload while still checking sync version', async () => {
  let calls = 0;
  const server = await loadServerModule({ proxyCall: async (_env, statements) => {
    calls++;
    return statements.length === 1 ? [{ results: [state(1)] }] : dashboardResults(1);
  } });
  const first = await server.getMetaAdsDashboard({ days: '30' });
  const second = await server.getMetaAdsDashboard({ days: '30' });
  assert.equal(first.summary.spendUsd, 1);
  assert.deepEqual(second, first);
  assert.equal(calls, 3);
});

test('changed sync version bypasses the old cache entry', async () => {
  let calls = 0;
  let version = 0;
  const server = await loadServerModule({ proxyCall: async (_env, statements) => {
    calls++;
    if (statements.length === 1) { version++; return [{ results: [state(version)] }]; }
    return dashboardResults(version, version * 1_000_000);
  } });
  const first = await server.getMetaAdsDashboard({ days: '30' });
  const second = await server.getMetaAdsDashboard({ days: '30' });
  assert.equal(first.sync.version, 1);
  assert.equal(second.sync.version, 2);
  assert.equal(second.summary.spendUsd, 2);
  assert.equal(calls, 4);
});

test('same-key concurrent reads singleflight the five-statement dashboard query', async () => {
  let stateCalls = 0;
  let loadCalls = 0;
  const server = await loadServerModule({ proxyCall: async (_env, statements) => {
    if (statements.length === 1) { stateCalls++; return [{ results: [state(1)] }]; }
    loadCalls++;
    await new Promise(resolve => setTimeout(resolve, 20));
    return dashboardResults(1);
  } });
  const [a, b] = await Promise.all([server.getMetaAdsDashboard({ days: '7' }), server.getMetaAdsDashboard({ days: '7' })]);
  assert.deepEqual(a, b);
  assert.equal(stateCalls, 2);
  assert.equal(loadCalls, 1);
});

async function loadRoute(getMetaAdsDashboard) {
  const code = await compileCommonJs(new URL('../../src/app/api/meta-ads/route.ts', import.meta.url));
  const cjsModule = { exports: {} };
  class MetaAdsError extends Error { constructor(status, code) { super(code); this.status = status; this.code = code; } }
  const localRequire = id => {
    if (id === 'next/server') return { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers }) } };
    if (id === '@/lib/meta-ads') return { getMetaAdsDashboard, MetaAdsError };
    return nativeRequire(id);
  };
  vm.runInNewContext(`(function(exports,require,module){${code}\n})`, { URL, console })(cjsModule.exports, localRequire, cjsModule);
  return cjsModule.exports;
}

test('API route rejects unknown account parameters, duplicate filters, and oversized URLs', async () => {
  let calls = 0;
  const route = await loadRoute(async () => { calls++; return {}; });
  const request = value => { const nextUrl = new URL(value); return { url: nextUrl.href, nextUrl }; };
  assert.equal((await route.GET(request('https://admin.test/api/meta-ads?account=999'))).status, 400);
  assert.equal((await route.GET(request('https://admin.test/api/meta-ads?days=7&days=30'))).status, 400);
  assert.equal((await route.GET(request('https://admin.test/api/meta-ads?cursor=' + 'a'.repeat(1800)))) .status, 414);
  assert.equal(calls, 0);
});
