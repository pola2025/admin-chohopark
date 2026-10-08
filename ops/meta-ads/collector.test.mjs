import test from 'node:test';
import assert from 'node:assert/strict';

import { ACCOUNT_ID } from '../../src/lib/meta-ads-core.mjs';
import { collectSnapshot, synchronize } from './collector-core.mjs';
import config from './config.json' with { type: 'json' };

const campaignId = config.campaignIds[0];
const token = 'test-token-that-is-long-enough-for-validation';
const rollingConfig = { ...config, availableSince: '2026-10-01' };

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function providerFetch({ pages = [], campaignAccount = ACCOUNT_ID } = {}) {
  let insightPage = 0;
  return async input => {
    const url = new URL(input);
    if (url.pathname.endsWith('/act_' + ACCOUNT_ID)) return jsonResponse({ id: 'act_' + ACCOUNT_ID, name: 'Choho', currency: 'USD', timezone_name: 'Asia/Seoul', account_status: 1 });
    if (url.pathname.endsWith('/' + campaignId)) return jsonResponse({ id: campaignId, account_id: campaignAccount, name: 'Campaign', status: 'ACTIVE', effective_status: 'ACTIVE', objective: 'OUTCOME_LEADS' });
    if (url.pathname.endsWith('/' + campaignId + '/insights')) return jsonResponse(pages[insightPage++] ?? { data: [] });
    throw new Error('unexpected provider URL: ' + url.pathname);
  };
}

function insight(date, overrides = {}) {
  return { account_id: ACCOUNT_ID, campaign_id: campaignId, campaign_name: 'Campaign', date_start: date, date_stop: date, spend: '1.000001', impressions: '10', inline_link_clicks: '2', reach: '8', actions: [{ action_type: 'offsite_conversion.fb_pixel_lead', '7d_click': '1' }], ...overrides };
}

test('provider pagination follows opaque cursors and normalizes every page', async () => {
  const snapshot = await collectSnapshot({ token, config: rollingConfig, now: new Date('2026-10-08T12:00:00Z'), fetchImpl: providerFetch({ pages: [
    { data: [insight('2026-10-07')], paging: { next: 'opaque', cursors: { after: 'page-two' } } },
    { data: [insight('2026-10-08')], paging: {} },
  ] }) });
  assert.equal(snapshot.rows.length, 2);
  assert.equal(snapshot.rows[0].spendMicros, 1_000_001);
  assert.equal(snapshot.graphRequests, 4);
});

test('provider pagination rejects repeated cursors and bounded page overflow', async () => {
  await assert.rejects(collectSnapshot({ token, config: rollingConfig, now: new Date('2026-10-08T12:00:00Z'), fetchImpl: providerFetch({ pages: [
    { data: [], paging: { next: 'x', cursors: { after: 'same' } } },
    { data: [], paging: { next: 'x', cursors: { after: 'same' } } },
  ] }) }), /META_CURSOR_INVALID/);
  const endless = Array.from({ length: 10 }, (_, index) => ({ data: [], paging: { next: 'x', cursors: { after: 'cursor-' + index } } }));
  await assert.rejects(collectSnapshot({ token, config: rollingConfig, now: new Date('2026-10-08T12:00:00Z'), fetchImpl: providerFetch({ pages: endless }) }), /META_PAGE_LIMIT/);
});

test('provider rejects foreign campaign and insight ownership', async () => {
  await assert.rejects(collectSnapshot({ token, config, now: new Date('2026-10-08T12:00:00Z'), fetchImpl: providerFetch({ campaignAccount: '999999999999999' }) }), /CAMPAIGN_IDENTITY_INVALID/);
  await assert.rejects(collectSnapshot({ token, config, now: new Date('2026-10-08T12:00:00Z'), fetchImpl: providerFetch({ pages: [{ data: [insight('2026-10-08', { account_id: '999999999999999' })] }] }) }), /SOURCE_ACCOUNT_MISMATCH/);
});

test('provider failure releases its own lease and never submits commit statements', async () => {
  const batches = [];
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    if (url.hostname === 'choho-blog-d1-proxy.mkt9834.workers.dev') {
      const body = JSON.parse(init.body); batches.push(body.statements);
      return jsonResponse({ ok: true, result: body.statements.map(() => ({ success: true, meta: { changes: 1 } })) });
    }
    return jsonResponse({ error: { code: 500 } }, 500);
  };
  await assert.rejects(synchronize({ env: { D1_PROXY_URL: 'https://choho-blog-d1-proxy.mkt9834.workers.dev', D1_PROXY_TOKEN: 'test' }, token, config, now: new Date('2026-10-08T12:00:00Z'), fetchImpl }), /META_HTTP_500/);
  assert.equal(batches.length, 2);
  assert.match(batches[0][0].sql, /SET lease_owner=/);
  assert.match(batches[1][0].sql, /SET status='ERROR'/);
  assert.equal(batches.some(batch => batch.some(statement => statement.sql.startsWith('DELETE FROM meta_ads_daily'))), false);
});

test('concurrent collection loses the durable lease without calling Meta', async () => {
  let graphCalls = 0;
  const fetchImpl = async input => {
    const url = new URL(input);
    if (url.hostname === 'choho-blog-d1-proxy.mkt9834.workers.dev') return jsonResponse({ ok: true, result: [{ success: true, meta: { changes: 0 } }] });
    graphCalls++; return jsonResponse({});
  };
  const result = await synchronize({ env: { D1_PROXY_URL: 'https://choho-blog-d1-proxy.mkt9834.workers.dev', D1_PROXY_TOKEN: 'test' }, token, config, now: new Date('2026-10-08T12:00:00Z'), fetchImpl });
  assert.deepEqual(result, { status: 'SKIPPED_LEASE', publishedCount: 0 });
  assert.equal(graphCalls, 0);
});
