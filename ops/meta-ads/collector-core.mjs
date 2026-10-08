import { randomUUID } from 'node:crypto';
import { ACCOUNT_ID, addDays, boundedJson, count, fail, kstDate, normalizeInsight, proxyCall, validDate, validId } from '../../src/lib/meta-ads-core.mjs';

const CAMPAIGN_FIELDS = 'id,account_id,name,status,effective_status,objective,spend_cap';
const INSIGHT_FIELDS = 'account_id,campaign_id,campaign_name,date_start,date_stop,spend,impressions,inline_link_clicks,reach,actions';
const safeCode = error => /^[A-Z][A-Z0-9_]{1,70}$/.test(error?.code || error?.message || '') ? (error.code || error.message) : 'COLLECTION_FAILED';

export function graphClient(token, config, fetchImpl = fetch) {
  if (!token || token.length < 30) fail('META_TOKEN_MISSING'); let calls = 0;
  return { get calls() { return calls; }, async get(node, params = {}) {
    if (++calls > config.maxGraphRequests) fail('META_REQUEST_BUDGET');
    if (!/^(?:act_)?\d+(?:\/(?:campaigns|insights))?$/.test(node)) fail('META_NODE_INVALID');
    const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${node}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(20000) });
    const data = await boundedJson(response, config.maxResponseBytes);
    if (!response.ok || data.error) fail('META_HTTP_' + (data.error?.code || response.status));
    return data;
  } };
}
async function pages(client, node, params, maxRows, maxPages = 10) {
  const rows = [], seen = new Set(); let after;
  for (let page = 0; page < maxPages; page++) {
    const data = await client.get(node, { ...params, limit: '100', ...(after ? { after } : {}) });
    if (!Array.isArray(data.data)) fail('META_DATA_INVALID'); rows.push(...data.data); if (rows.length > maxRows) fail('META_ROW_LIMIT');
    if (!data.paging?.next) return rows;
    const next = data.paging?.cursors?.after; if (typeof next !== 'string' || !next || next.length > 4000 || seen.has(next)) fail('META_CURSOR_INVALID'); seen.add(next); after = next;
  }
  fail('META_PAGE_LIMIT');
}
export async function collectSnapshot({ token, config, now = new Date(), fetchImpl = fetch }) {
  if (config.accountId !== ACCOUNT_ID || !validDate(config.availableSince) || config.lookbackDays !== 8) fail('CONFIG_INVALID');
  const until = kstDate(now), since = [config.availableSince, addDays(until, -7)].sort().at(-1);
  if (since > until) fail('COLLECTION_NOT_STARTED');
  const client = graphClient(token, config, fetchImpl);
  const account = await client.get('act_' + ACCOUNT_ID, { fields: 'id,name,currency,timezone_name,account_status' });
  if (account.id !== 'act_' + ACCOUNT_ID || account.currency !== 'USD' || account.timezone_name !== 'Asia/Seoul') fail('META_ACCOUNT_MISMATCH');
  let sourceCampaigns;
  if (Array.isArray(config.campaignIds) && config.campaignIds.length) {
    if (config.campaignIds.length > 10 || config.campaignIds.some(id => !validId(id)) || new Set(config.campaignIds).size !== config.campaignIds.length) fail('CONFIG_SCOPE_INVALID');
    sourceCampaigns = []; for (const id of config.campaignIds) sourceCampaigns.push(await client.get(id, { fields: CAMPAIGN_FIELDS }));
  } else sourceCampaigns = await pages(client, 'act_' + ACCOUNT_ID + '/campaigns', { fields: CAMPAIGN_FIELDS }, config.maxCampaigns, 3);
  if (sourceCampaigns.length > config.maxCampaigns) fail('CAMPAIGN_LIMIT');
  const collectedAt = new Date(now).toISOString();
  const campaigns = sourceCampaigns.map(c => {
    if (!validId(c.id) || String(c.account_id) !== ACCOUNT_ID || typeof c.name !== 'string' || c.name.length > 500) fail('CAMPAIGN_IDENTITY_INVALID');
    if ([c.status, c.effective_status, c.objective].some(v => typeof v !== 'string' || v.length > 80)) fail('CAMPAIGN_METADATA_INVALID');
    return { id: c.id, name: c.name, status: c.status, effectiveStatus: c.effective_status, objective: c.objective, spendCapCents: c.spend_cap === undefined ? null : count(c.spend_cap), updatedAt: collectedAt };
  });
  const ids = campaigns.map(c => c.id); if (new Set(ids).size !== ids.length) fail('DUPLICATE_CAMPAIGN');
  const node = ids.length === 1 ? ids[0] + '/insights' : 'act_' + ACCOUNT_ID + '/insights';
  const sourceRows = ids.length ? await pages(client, node, { fields: INSIGHT_FIELDS, level: 'campaign', time_increment: '1', time_range: { since, until }, action_attribution_windows: ['7d_click'], action_report_time: 'impression', ...(ids.length > 1 ? { filtering: [{ field: 'campaign.id', operator: 'IN', value: ids }] } : {}) }, config.maxRows) : [];
  const rows = sourceRows.map(row => normalizeInsight(row, { accountId: ACCOUNT_ID, campaignIds: ids, since, until, collectedAt }));
  if (new Set(rows.map(r => r.date + '/' + r.campaignId)).size !== rows.length) fail('DUPLICATE_INSIGHT');
  return { account: { name: account.name, currency: account.currency, timezone: account.timezone_name }, campaigns, rows, since, until, collectedAt, graphRequests: client.calls };
}

export function commitStatements(snapshot, runId) {
  const guard = 'EXISTS(SELECT 1 FROM meta_ads_sync WHERE account_id=? AND lease_owner=?)';
  const campaigns = JSON.stringify(snapshot.campaigns), rows = JSON.stringify(snapshot.rows), scope = JSON.stringify(snapshot.campaigns.map(c => c.id));
  return [
    { sql: `INSERT INTO meta_ads_campaigns(account_id,campaign_id,name,status,effective_status,objective,spend_cap_cents,updated_at) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.name'),json_extract(value,'$.status'),json_extract(value,'$.effectiveStatus'),json_extract(value,'$.objective'),json_extract(value,'$.spendCapCents'),json_extract(value,'$.updatedAt') FROM json_each(?) WHERE ${guard} ON CONFLICT(account_id,campaign_id) DO UPDATE SET name=excluded.name,status=excluded.status,effective_status=excluded.effective_status,objective=excluded.objective,spend_cap_cents=excluded.spend_cap_cents,updated_at=excluded.updated_at`, params: [ACCOUNT_ID, campaigns, ACCOUNT_ID, runId] },
    { sql: `DELETE FROM meta_ads_daily WHERE account_id=? AND date>=? AND date<=? AND campaign_id IN (SELECT value FROM json_each(?)) AND ${guard}`, params: [ACCOUNT_ID, snapshot.since, snapshot.until, scope, ACCOUNT_ID, runId] },
    { sql: `INSERT INTO meta_ads_daily(account_id,campaign_id,date,spend_micros,impressions,link_clicks,landing_page_views,website_leads,daily_reach,source_json,collected_at) SELECT ?,json_extract(value,'$.campaignId'),json_extract(value,'$.date'),json_extract(value,'$.spendMicros'),json_extract(value,'$.impressions'),json_extract(value,'$.linkClicks'),json_extract(value,'$.landingPageViews'),json_extract(value,'$.websiteLeads'),json_extract(value,'$.dailyReach'),json_extract(value,'$.sourceJson'),json_extract(value,'$.collectedAt') FROM json_each(?) WHERE ${guard} ON CONFLICT(account_id,campaign_id,date) DO UPDATE SET spend_micros=excluded.spend_micros,impressions=excluded.impressions,link_clicks=excluded.link_clicks,landing_page_views=excluded.landing_page_views,website_leads=excluded.website_leads,daily_reach=excluded.daily_reach,source_json=excluded.source_json,collected_at=excluded.collected_at`, params: [ACCOUNT_ID, rows, ACCOUNT_ID, runId] },
    { sql: "UPDATE meta_ads_sync SET account_name=?,currency=?,timezone=?,status='OK',version=version+1,last_success_at=?,available_since=CASE WHEN available_since IS NULL OR available_since>? THEN ? ELSE available_since END,window_since=?,window_until=?,last_error_code=NULL,last_run_id=?,lease_owner=NULL,lease_expires_at=NULL,scope_json=? WHERE account_id=? AND lease_owner=?", params: [snapshot.account.name, snapshot.account.currency, snapshot.account.timezone, snapshot.collectedAt, snapshot.since, snapshot.since, snapshot.since, snapshot.until, runId, scope, ACCOUNT_ID, runId] },
  ];
}
export async function synchronize({ env, token, config, now = new Date(), fetchImpl = fetch, dryRun = false }) {
  const runId = randomUUID(), timestamp = new Date(now).toISOString(), db = statements => proxyCall(env, statements, { fetchImpl });
  if (dryRun) { const snapshot = await collectSnapshot({ token, config, now, fetchImpl }); return { status: 'DRY_RUN', snapshot }; }
  const lease = await db([{ sql: "UPDATE meta_ads_sync SET lease_owner=?,lease_expires_at=?,last_attempt_at=?,status='RUNNING' WHERE account_id=? AND (lease_owner IS NULL OR lease_expires_at<?)", params: [runId, new Date(new Date(now).getTime() + 10 * 60000).toISOString(), timestamp, ACCOUNT_ID, timestamp] }]);
  if (lease[0].meta?.changes !== 1) return { status: 'SKIPPED_LEASE', publishedCount: 0 };
  try {
    const snapshot = await collectSnapshot({ token, config, now, fetchImpl });
    let committed;
    try { committed = await db(commitStatements(snapshot, runId)); }
    catch {
      const check = await db([{ sql: 'SELECT last_run_id FROM meta_ads_sync WHERE account_id=?', params: [ACCOUNT_ID] }]);
      if (check[0].results?.[0]?.last_run_id !== runId) fail('COMMIT_UNCONFIRMED');
    }
    if (committed && committed.at(-1)?.meta?.changes !== 1) fail('LEASE_LOST');
    return { status: 'SYNCED', accountId: ACCOUNT_ID, campaigns: snapshot.campaigns.length, rows: snapshot.rows.length, since: snapshot.since, until: snapshot.until, collectedAt: snapshot.collectedAt, graphRequests: snapshot.graphRequests, runId };
  } catch (error) {
    const code = safeCode(error);
    await db([{ sql: "UPDATE meta_ads_sync SET status='ERROR',last_error_code=?,lease_owner=NULL,lease_expires_at=NULL WHERE account_id=? AND lease_owner=?", params: [code, ACCOUNT_ID, runId] }]).catch(() => {});
    fail(code);
  }
}
