import test from 'node:test';
import assert from 'node:assert/strict';

import { ACCOUNT_ID, D1_MAX_STATEMENTS } from '../../src/lib/meta-ads-core.mjs';
import { collectSnapshot, collectionWindow, commitStatements, snapshotCounts, synchronize } from './collector-core.mjs';
import config from './config.json' with { type: 'json' };

const campaignId = '120250878150770043';
const newCampaignId = '120251206966710043';
const adId = '120251206966710099';
const token = 'test-token-that-is-long-enough-for-validation';
const now = new Date('2026-10-08T12:00:00Z');
const pinnedConfig = { ...config, campaignIds: [campaignId] };
const rollingConfig = { ...pinnedConfig, availableSince: '2026-10-01' };
const d1Env = { D1_PROXY_URL: 'https://choho-blog-d1-proxy.mkt9834.workers.dev', D1_PROXY_TOKEN: 'test' };

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}
function campaign(id, account = ACCOUNT_ID) {
  return { id, account_id: account, name: 'Campaign ' + id.slice(-4), status: 'ACTIVE', effective_status: 'ACTIVE', objective: 'OUTCOME_LEADS' };
}

// Routes Graph calls by node and by the level/breakdowns query, and records every request for assertions.
function providerFetch({ pages = [], breakdowns = {}, ads = [], campaignAccount = ACCOUNT_ID, accountCampaigns = [campaign(campaignId), campaign(newCampaignId)], calls = [] } = {}) {
  const cursor = new Map(), next = (key, list) => { const index = cursor.get(key) ?? 0; cursor.set(key, index + 1); return list[index] ?? { data: [] }; };
  return async input => {
    const url = new URL(input), params = Object.fromEntries(url.searchParams); calls.push({ path: url.pathname, params });
    if (url.pathname.endsWith('/act_' + ACCOUNT_ID)) return jsonResponse({ id: 'act_' + ACCOUNT_ID, name: 'Choho', currency: 'USD', timezone_name: 'Asia/Seoul', account_status: 1 });
    if (url.pathname.endsWith('/act_' + ACCOUNT_ID + '/campaigns')) return jsonResponse({ data: accountCampaigns });
    if (url.pathname.endsWith('/' + campaignId)) return jsonResponse(campaign(campaignId, campaignAccount));
    if (url.pathname.endsWith('/insights')) {
      if (params.level === 'ad') return jsonResponse(next('ad', ads));
      if (params.breakdowns) return jsonResponse(next(params.breakdowns, breakdowns[params.breakdowns] ?? []));
      return jsonResponse(next('daily', pages));
    }
    throw new Error('unexpected provider URL: ' + url.pathname);
  };
}

function insight(date, overrides = {}) {
  return { account_id: ACCOUNT_ID, campaign_id: campaignId, campaign_name: 'Campaign', date_start: date, date_stop: date, spend: '1.000001', impressions: '10', inline_link_clicks: '2', reach: '8', actions: [{ action_type: 'offsite_conversion.fb_pixel_lead', '7d_click': '1' }], ...overrides };
}
function breakdownRow(date, values, overrides = {}) {
  return { account_id: ACCOUNT_ID, campaign_id: campaignId, date_start: date, date_stop: date, spend: '0.5', impressions: '20', inline_link_clicks: '3', actions: [{ action_type: 'offsite_conversion.fb_pixel_lead', value: '5', '7d_click': '2' }], ...values, ...overrides };
}
function adRow(date, overrides = {}) {
  return { account_id: ACCOUNT_ID, campaign_id: campaignId, ad_id: adId, ad_name: '단체 워크숍 릴스 A', date_start: date, date_stop: date, spend: '2.5', impressions: '900', inline_link_clicks: '12', actions: [{ action_type: 'offsite_conversion.fb_pixel_lead', '7d_click': '1' }], video_thruplay_watched_actions: [{ action_type: 'video_view', value: '120' }], video_p25_watched_actions: [{ action_type: 'video_view', value: '705' }], video_p50_watched_actions: [{ action_type: 'video_view', value: '400' }], video_p75_watched_actions: [{ action_type: 'video_view', '7d_click': '210' }], ...overrides };
}

test('provider pagination follows opaque cursors and normalizes every page', async () => {
  const snapshot = await collectSnapshot({ token, config: rollingConfig, now, fetchImpl: providerFetch({ pages: [
    { data: [insight('2026-10-07')], paging: { next: 'opaque', cursors: { after: 'page-two' } } },
    { data: [insight('2026-10-08')], paging: {} },
  ] }) });
  assert.equal(snapshot.rows.length, 2);
  assert.equal(snapshot.rows[0].spendMicros, 1_000_001);
  assert.equal(snapshot.graphRequests, 4 + 6 + 1);
  assert.deepEqual(snapshot.breakdowns, []);
  assert.deepEqual(snapshot.ads, []);
});

test('provider pagination rejects repeated cursors and bounded page overflow', async () => {
  await assert.rejects(collectSnapshot({ token, config: rollingConfig, now, fetchImpl: providerFetch({ pages: [
    { data: [], paging: { next: 'x', cursors: { after: 'same' } } },
    { data: [], paging: { next: 'x', cursors: { after: 'same' } } },
  ] }) }), /META_CURSOR_INVALID/);
  const endless = Array.from({ length: 10 }, (_, index) => ({ data: [], paging: { next: 'x', cursors: { after: 'cursor-' + index } } }));
  await assert.rejects(collectSnapshot({ token, config: rollingConfig, now, fetchImpl: providerFetch({ pages: endless }) }), /META_PAGE_LIMIT/);
  await assert.rejects(collectSnapshot({ token, config: rollingConfig, now, fetchImpl: providerFetch({ breakdowns: { region: endless } }) }), /^Error: META_PAGE_LIMIT_REGION$/);
});

test('provider rejects foreign campaign and insight ownership', async () => {
  await assert.rejects(collectSnapshot({ token, config: pinnedConfig, now, fetchImpl: providerFetch({ campaignAccount: '999999999999999' }) }), /CAMPAIGN_IDENTITY_INVALID/);
  await assert.rejects(collectSnapshot({ token, config: pinnedConfig, now, fetchImpl: providerFetch({ pages: [{ data: [insight('2026-10-08', { account_id: '999999999999999' })] }] }) }), /SOURCE_ACCOUNT_MISMATCH/);
  await assert.rejects(collectSnapshot({ token, config: pinnedConfig, now, fetchImpl: providerFetch({ breakdowns: { age: [{ data: [breakdownRow('2026-10-08', { age: '45-54' }, { campaign_id: '120299999999999999' })] }] } }) }), /SOURCE_ACCOUNT_MISMATCH/);
  await assert.rejects(collectSnapshot({ token, config: pinnedConfig, now, fetchImpl: providerFetch({ ads: [{ data: [adRow('2026-09-30')] }] }) }), /SOURCE_DATE_MISMATCH/);
});

test('default config collects every account campaign and filters insights by the listed ids', async () => {
  assert.equal(config.campaignIds, undefined);
  assert.ok(config.maxGraphRequests >= 16 && config.maxBreakdownRows === 5000);
  const calls = [];
  const snapshot = await collectSnapshot({ token, config, now, fetchImpl: providerFetch({ calls, pages: [{ data: [insight('2026-10-08'), insight('2026-10-08', { campaign_id: newCampaignId })] }] }) });
  assert.deepEqual(snapshot.campaigns.map(c => c.id), [campaignId, newCampaignId]);
  assert.equal(snapshot.rows.length, 2);
  assert.ok(calls.some(c => c.path.endsWith('/act_' + ACCOUNT_ID + '/campaigns')));
  const insightCalls = calls.filter(c => c.path.endsWith('/insights'));
  assert.equal(insightCalls.length, 8);
  for (const call of insightCalls) {
    assert.ok(call.path.endsWith('/act_' + ACCOUNT_ID + '/insights'));
    assert.deepEqual(JSON.parse(call.params.filtering), [{ field: 'campaign.id', operator: 'IN', value: [campaignId, newCampaignId] }]);
    assert.deepEqual(JSON.parse(call.params.time_range), { since: '2026-10-08', until: '2026-10-08' });
    assert.equal(call.params.time_increment, '1');
  }
});

test('each breakdown dimension stores a normalized bucket with 7d_click leads, hour without actions', async () => {
  const calls = [], day = '2026-10-08';
  const snapshot = await collectSnapshot({ token, config: rollingConfig, now, fetchImpl: providerFetch({ calls, breakdowns: {
    'publisher_platform,platform_position': [{ data: [breakdownRow(day, { publisher_platform: 'instagram', platform_position: 'instagram_reels' })], paging: { next: 'x', cursors: { after: 'p2' } } }, { data: [breakdownRow(day, { publisher_platform: 'facebook', platform_position: 'feed' })] }],
    age: [{ data: [breakdownRow(day, { age: '45-54' })] }],
    gender: [{ data: [breakdownRow(day, { gender: 'female' }), breakdownRow(day, { gender: 'unknown' })] }],
    region: [{ data: [breakdownRow(day, { region: 'Seoul' })] }],
    device_platform: [{ data: [breakdownRow(day, { device_platform: 'mobile_app' })] }],
    hourly_stats_aggregated_by_advertiser_time_zone: [{ data: [breakdownRow(day, { hourly_stats_aggregated_by_advertiser_time_zone: '22:00:00 - 22:59:59' }, { actions: undefined }), breakdownRow(day, { hourly_stats_aggregated_by_advertiser_time_zone: '00:00:00 - 00:59:59' }, { actions: undefined })] }],
  } }) });
  const buckets = snapshot.breakdowns.map(r => r.dimension + '=' + r.bucket);
  assert.deepEqual(buckets, ['placement=instagram:instagram_reels', 'placement=facebook:feed', 'age=45-54', 'gender=female', 'gender=unknown', 'region=Seoul', 'device=mobile_app', 'hour=22', 'hour=00']);
  assert.deepEqual(snapshot.breakdowns[0], { campaignId, date: day, spendMicros: 500_000, impressions: 20, linkClicks: 3, dimension: 'placement', bucket: 'instagram:instagram_reels', websiteLeads: 2, collectedAt: now.toISOString() });
  assert.ok(snapshot.breakdowns.filter(r => r.dimension === 'hour').every(r => r.websiteLeads === 0));
  assert.deepEqual(snapshotCounts(snapshot).breakdownRowsByDimension, { placement: 2, age: 1, gender: 2, region: 1, device: 1, hour: 2 });
  const breakdownCalls = calls.filter(c => c.params.breakdowns);
  assert.deepEqual([...new Set(breakdownCalls.map(c => c.params.breakdowns))], ['publisher_platform,platform_position', 'age', 'gender', 'region', 'device_platform', 'hourly_stats_aggregated_by_advertiser_time_zone']);
  for (const call of breakdownCalls) {
    assert.equal(call.params.limit, '500'); assert.equal(call.params.level, 'campaign'); assert.equal(call.params.time_increment, '1');
    const hour = call.params.breakdowns.startsWith('hourly');
    assert.equal(call.params.fields.split(',').includes('actions'), !hour);
    assert.equal(call.params.action_attribution_windows, hour ? undefined : '["7d_click"]');
  }
  assert.equal(breakdownCalls.filter(c => c.params.after === 'p2').length, 1);
});

test('breakdown and ad rows reject duplicates and invalid buckets', async () => {
  const day = '2026-10-08';
  await assert.rejects(collectSnapshot({ token, config: rollingConfig, now, fetchImpl: providerFetch({ breakdowns: { region: [{ data: [breakdownRow(day, { region: 'Seoul' }), breakdownRow(day, { region: 'Seoul' })] }] } }) }), /DUPLICATE_BREAKDOWN/);
  await assert.rejects(collectSnapshot({ token, config: rollingConfig, now, fetchImpl: providerFetch({ breakdowns: { gender: [{ data: [breakdownRow(day, { gender: 'other' })] }] } }) }), /BREAKDOWN_BUCKET_INVALID/);
  await assert.rejects(collectSnapshot({ token, config: rollingConfig, now, fetchImpl: providerFetch({ breakdowns: { 'publisher_platform,platform_position': [{ data: [breakdownRow(day, { platform_position: 'instagram_reels' })] }] } }) }), /BREAKDOWN_BUCKET_INVALID/);
  await assert.rejects(collectSnapshot({ token, config: rollingConfig, now, fetchImpl: providerFetch({ ads: [{ data: [adRow(day), adRow(day)] }] }) }), /DUPLICATE_AD_INSIGHT/);
});

test('ad-level rows carry name, leads, and video metrics from value with 7d_click fallback', async () => {
  const calls = [];
  const snapshot = await collectSnapshot({ token, config: rollingConfig, now, fetchImpl: providerFetch({ calls, ads: [{ data: [adRow('2026-10-07'), adRow('2026-10-08', { video_thruplay_watched_actions: undefined, video_p25_watched_actions: undefined, video_p50_watched_actions: undefined, video_p75_watched_actions: undefined })] }] }) });
  assert.deepEqual(snapshot.ads[0], { adId, campaignId, date: '2026-10-07', spendMicros: 2_500_000, impressions: 900, linkClicks: 12, adName: '단체 워크숍 릴스 A', websiteLeads: 1, thruplays: 120, videoP25: 705, videoP50: 400, videoP75: 210, videoP100: 0, collectedAt: now.toISOString() });
  assert.deepEqual([snapshot.ads[1].thruplays, snapshot.ads[1].videoP25, snapshot.ads[1].videoP100], [0, 0, 0]);
  const adCall = calls.find(c => c.params.level === 'ad');
  assert.equal(adCall.params.fields, 'account_id,campaign_id,ad_id,ad_name,date_start,date_stop,spend,impressions,inline_link_clicks,actions,video_thruplay_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions');
  assert.equal(adCall.params.action_report_time, 'impression');
});

test('commit batch stays within D1 limits and keeps the lease-owner sync update last', () => {
  const snapshot = { account: { name: 'Choho', currency: 'USD', timezone: 'Asia/Seoul' }, campaigns: [{ id: campaignId }], rows: [], since: '2026-10-01', until: '2026-10-08', collectedAt: now.toISOString(),
    breakdowns: [{ campaignId, date: '2026-10-08', dimension: 'hour', bucket: '22', spendMicros: 1, impressions: 1, linkClicks: 0, websiteLeads: 0 }],
    ads: [{ adId, campaignId, date: '2026-10-08', adName: 'A', spendMicros: 1, impressions: 1, linkClicks: 0, websiteLeads: 0, thruplays: 0, videoP25: 0, videoP50: 0, videoP75: 0, videoP100: 0 }] };
  const statements = commitStatements(snapshot, 'run-1');
  assert.ok(statements.length <= D1_MAX_STATEMENTS);
  assert.equal(statements.length, 8);
  assert.match(statements.at(-1).sql, /^UPDATE meta_ads_sync SET .* WHERE account_id=\? AND lease_owner=\?$/);
  assert.deepEqual(statements.at(-1).params.slice(-2), [ACCOUNT_ID, 'run-1']);
  for (const statement of statements.slice(0, -1)) assert.match(statement.sql, /EXISTS\(SELECT 1 FROM meta_ads_sync WHERE account_id=\? AND lease_owner=\?\)/);
  assert.ok(statements.some(s => s.sql.startsWith('DELETE FROM meta_ads_breakdown_daily')) && statements.some(s => s.sql.startsWith('INSERT INTO meta_ads_ad_daily')));
  const huge = { ...snapshot, ads: Array.from({ length: 5000 }, (_, index) => ({ ...snapshot.ads[0], date: '2026-10-0' + (1 + index % 8), adId: String(120251206966710099n + BigInt(index)), adName: '광'.repeat(500) })) };
  assert.throws(() => commitStatements(huge, 'run-1'), /COMMIT_BODY_LIMIT/);
  assert.throws(() => commitStatements({ ...snapshot, ads: undefined }, 'run-1'), /SNAPSHOT_INVALID/);
});

test('backfill starts at availableSince and rejects windows over 62 days before touching Meta or D1', async () => {
  assert.deepEqual(collectionWindow({ ...config, availableSince: '2026-09-01' }, now), { since: '2026-10-01', until: '2026-10-08' });
  assert.deepEqual(collectionWindow({ ...config, availableSince: '2026-09-01' }, now, true), { since: '2026-09-01', until: '2026-10-08' });
  assert.deepEqual(collectionWindow({ ...config, availableSince: '2026-08-08' }, now, true), { since: '2026-08-08', until: '2026-10-08' });
  assert.throws(() => collectionWindow({ ...config, availableSince: '2026-08-07' }, now, true), /BACKFILL_WINDOW_LIMIT/);
  assert.throws(() => collectionWindow({ ...config, maxBreakdownRows: undefined }, now), /CONFIG_INVALID/);
  let calls = 0;
  await assert.rejects(synchronize({ env: d1Env, token, config: { ...config, availableSince: '2026-08-07' }, now, backfill: true, fetchImpl: async () => { calls++; return jsonResponse({}); } }), /BACKFILL_WINDOW_LIMIT/);
  assert.equal(calls, 0);
  const graph = [];
  const snapshot = await collectSnapshot({ token, config: { ...pinnedConfig, availableSince: '2026-09-01' }, now, backfill: true, fetchImpl: providerFetch({ calls: graph }) });
  assert.equal(snapshot.since, '2026-09-01');
  assert.ok(graph.filter(c => c.path.endsWith('/insights')).every(c => JSON.parse(c.params.time_range).since === '2026-09-01'));
});

test('synchronize commits breakdown and ad rows in the same lease-guarded batch', async () => {
  const batches = [], provider = providerFetch({ pages: [{ data: [insight('2026-10-08')] }], breakdowns: { age: [{ data: [breakdownRow('2026-10-08', { age: '45-54' })] }] }, ads: [{ data: [adRow('2026-10-08')] }] });
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    if (url.hostname === 'choho-blog-d1-proxy.mkt9834.workers.dev') { const body = JSON.parse(init.body); batches.push(body.statements); return jsonResponse({ ok: true, result: body.statements.map(() => ({ success: true, meta: { changes: 1 } })) }); }
    return provider(input);
  };
  const result = await synchronize({ env: d1Env, token, config: rollingConfig, now, fetchImpl });
  assert.equal(result.status, 'SYNCED');
  assert.deepEqual([result.rows, result.breakdownRows, result.adRows, result.breakdownRowsByDimension.age], [1, 1, 1, 1]);
  assert.equal(batches.length, 2);
  assert.equal(batches[1].length, 8);
  assert.match(batches[1].at(-1).sql, /^UPDATE meta_ads_sync/);
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
  await assert.rejects(synchronize({ env: d1Env, token, config, now, fetchImpl }), /META_HTTP_500/);
  assert.equal(batches.length, 2);
  assert.match(batches[0][0].sql, /SET lease_owner=/);
  assert.match(batches[1][0].sql, /SET status='ERROR'/);
  assert.equal(batches.some(batch => batch.some(statement => statement.sql.startsWith('DELETE FROM meta_ads_'))), false);
});

test('breakdown provider failure is reported with its dimension and never commits', async () => {
  const batches = [], provider = providerFetch();
  const fetchImpl = async (input, init) => {
    const url = new URL(input);
    if (url.hostname === 'choho-blog-d1-proxy.mkt9834.workers.dev') { const body = JSON.parse(init.body); batches.push(body.statements); return jsonResponse({ ok: true, result: body.statements.map(() => ({ success: true, meta: { changes: 1 } })) }); }
    if (url.searchParams.get('breakdowns') === 'region') return jsonResponse({ error: { code: 100 } }, 400);
    return provider(input);
  };
  await assert.rejects(synchronize({ env: d1Env, token, config: rollingConfig, now, fetchImpl }), /META_HTTP_100_REGION/);
  assert.equal(batches.length, 2);
  assert.deepEqual(batches[1][0].params.slice(0, 1), ['META_HTTP_100_REGION']);
});

test('concurrent collection loses the durable lease without calling Meta', async () => {
  let graphCalls = 0;
  const fetchImpl = async input => {
    const url = new URL(input);
    if (url.hostname === 'choho-blog-d1-proxy.mkt9834.workers.dev') return jsonResponse({ ok: true, result: [{ success: true, meta: { changes: 0 } }] });
    graphCalls++; return jsonResponse({});
  };
  const result = await synchronize({ env: d1Env, token, config, now, fetchImpl });
  assert.deepEqual(result, { status: 'SKIPPED_LEASE', publishedCount: 0 });
  assert.equal(graphCalls, 0);
});
