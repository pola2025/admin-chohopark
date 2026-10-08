export const ACCOUNT_ID = '639564975420619';
export const DEFAULT_CAMPAIGN = '120250878150770043';
export const MAX_CAMPAIGNS = 100;
export const PAGE_SIZE = 31;
export const fail = (code) => { const error = new Error(code); error.code = code; throw error; };
export const kstDate = (now = new Date()) => new Date(new Date(now).getTime() + 9 * 3600000).toISOString().slice(0, 10);
export function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value; }
export function addDays(date, amount) { if (!validDate(date)) fail('INVALID_DATE'); return new Date(Date.parse(date + 'T00:00:00Z') + amount * 86400000).toISOString().slice(0, 10); }
export function validId(id) { return typeof id === 'string' && /^\d{5,32}$/.test(id); }
export function count(value, fractional = false) {
  if (value === undefined || value === null) return 0;
  if (!['string', 'number'].includes(typeof value) || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(String(value))) fail('INVALID_METRIC');
  const n = Number(value); if (!Number.isFinite(n) || n < 0 || n > 1000000000000 || (!fractional && !Number.isSafeInteger(n))) fail('INVALID_METRIC'); return n;
}
export function usdMicros(value) {
  const text = String(value ?? '0'); if (!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,6})?$/.test(text)) fail('INVALID_SPEND');
  const [whole, fraction = ''] = text.split('.'); const result = Number(whole) * 1000000 + Number(fraction.padEnd(6, '0')); if (!Number.isSafeInteger(result)) fail('INVALID_SPEND'); return result;
}
export function actionValue(actions, name) {
  if (actions === undefined) return 0; if (!Array.isArray(actions) || actions.length > 150) fail('INVALID_ACTIONS');
  const match = actions.filter(x => x?.action_type === name); if (match.length > 1) fail('DUPLICATE_ACTION_TYPE'); return count(match[0]?.['7d_click'] ?? 0, true);
}
export function normalizeInsight(row, { accountId = ACCOUNT_ID, campaignIds, since, until, collectedAt }) {
  if (String(row.account_id) !== accountId || !campaignIds.includes(String(row.campaign_id))) fail('SOURCE_ACCOUNT_MISMATCH');
  if (!validDate(row.date_start) || row.date_start !== row.date_stop || row.date_start < since || row.date_start > until) fail('SOURCE_DATE_MISMATCH');
  const safeSource = { account_id: accountId, campaign_id: String(row.campaign_id), date_start: row.date_start, date_stop: row.date_stop, spend: row.spend ?? '0', impressions: row.impressions ?? '0', inline_link_clicks: row.inline_link_clicks ?? '0', reach: row.reach ?? '0', actions: (row.actions || []).filter(x => ['landing_page_view', 'offsite_conversion.fb_pixel_lead'].includes(x.action_type)), action_attribution_windows: ['7d_click'], action_report_time: 'impression' };
  return { campaignId: String(row.campaign_id), date: row.date_start, spendMicros: usdMicros(row.spend), impressions: count(row.impressions), linkClicks: count(row.inline_link_clicks), landingPageViews: count(actionValue(row.actions, 'landing_page_view')), websiteLeads: actionValue(row.actions, 'offsite_conversion.fb_pixel_lead'), dailyReach: count(row.reach), sourceJson: JSON.stringify(safeSource), collectedAt };
}
export function metrics(row = {}) {
  const spendUsd = Number(row.spend_micros || 0) / 1000000;
  const impressions = Number(row.impressions || 0), linkClicks = Number(row.link_clicks || 0), landingPageViews = Number(row.landing_page_views || 0), websiteLeads = Number(row.website_leads || 0);
  return { spendUsd, impressions, linkClicks, landingPageViews, websiteLeads, linkCtr: impressions > 0 ? linkClicks / impressions * 100 : null, costPerLinkClickUsd: linkClicks > 0 ? spendUsd / linkClicks : null, costPerLeadUsd: websiteLeads > 0 ? spendUsd / websiteLeads : null };
}
export function rangeInput(input = {}, now = new Date()) {
  const days = String(input.days ?? '30'); if (!['7', '30', '90'].includes(days)) fail('INVALID_RANGE');
  const campaign = input.campaign ?? DEFAULT_CAMPAIGN; if (campaign !== 'all' && !validId(campaign)) fail('INVALID_CAMPAIGN');
  const end = kstDate(now); return { start: addDays(end, -(Number(days) - 1)), end, days: Number(days), campaignId: campaign === 'all' ? null : campaign };
}
export async function boundedJson(response, maxBytes = 2097152) {
  if (Number(response.headers.get('content-length') || 0) > maxBytes) fail('RESPONSE_TOO_LARGE');
  if (!response.body) fail('RESPONSE_EMPTY'); const reader = response.body.getReader(); let total = 0; const parts = [];
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maxBytes) fail('RESPONSE_TOO_LARGE'); parts.push(value); } }
  catch (error) { await reader.cancel().catch(() => {}); throw error; } finally { reader.releaseLock(); }
  const merged = new Uint8Array(total); let offset = 0; for (const part of parts) { merged.set(part, offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder().decode(merged)); } catch { fail('RESPONSE_JSON_INVALID'); }
}
export async function proxyCall(env, statements, { fetchImpl = fetch } = {}) {
  const endpoint = env.D1_PROXY_URL, token = env.D1_PROXY_TOKEN;
  if (!endpoint || !token) fail('D1_CONFIG_MISSING');
  const parsed = new URL(endpoint); if (parsed.protocol !== 'https:' || parsed.hostname !== 'choho-blog-d1-proxy.mkt9834.workers.dev' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) fail('D1_ENDPOINT_MISMATCH');
  if (!Array.isArray(statements) || !statements.length || statements.length > 20) fail('D1_STATEMENT_LIMIT');
  const body = JSON.stringify({ statements }); if (new TextEncoder().encode(body).byteLength > 2097152) fail('D1_BODY_LIMIT');
  const response = await fetchImpl(new URL('/batch', parsed), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
  const json = await boundedJson(response); if (!response.ok || !json.ok || !Array.isArray(json.result) || json.result.length !== statements.length || json.result.some(x => x.success === false)) fail('D1_REQUEST_FAILED'); return json.result;
}
