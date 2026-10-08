import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { MetaAdsDashboard } from "@/types/meta-ads";
import { ACCOUNT_ID, PAGE_SIZE, metrics, proxyCall, rangeInput, validDate, validId } from "./meta-ads-core.mjs";

export class MetaAdsError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
type Input = { days?: number | string; campaign?: string; cursor?: string | null };
type Row = Record<string, string | number | null>;
type Range = { start: string; end: string; days: number; campaignId: string | null };
type Cursor = { a: string; s: string; e: string; f: string | null; v: number; d: string; c: string };
const cache = new Map<string, { expires: number; data: MetaAdsDashboard }>();
const pending = new Map<string, Promise<MetaAdsDashboard>>();
let rate = { start: Date.now(), count: 0 };
const sums = "SUM(spend_micros) AS spend_micros,SUM(impressions) AS impressions,SUM(link_clicks) AS link_clicks,SUM(landing_page_views) AS landing_page_views,SUM(website_leads) AS website_leads";

async function authenticate(): Promise<string> {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "fallback-secret" || secret.length < 24) throw new MetaAdsError(503, "AUTH_CONFIGURATION");
  const token = (await cookies()).get("admin-token")?.value;
  if (!token) throw new MetaAdsError(401, "UNAUTHORIZED");
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] });
    if (payload.role !== "admin" || !payload.exp) throw new Error("role");
  } catch { throw new MetaAdsError(401, "UNAUTHORIZED"); }
  return secret;
}
function decodeCursor(value: string | null | undefined, range: Range, version: number, secret: string): Cursor | null {
  if (!value) return null;
  if (value.length > 700 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) throw new MetaAdsError(400, "INVALID_CURSOR");
  const [body, signature] = value.split(".");
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new MetaAdsError(400, "INVALID_CURSOR");
  let cursor: Cursor; try { cursor = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { throw new MetaAdsError(400, "INVALID_CURSOR"); }
  if (cursor.a !== ACCOUNT_ID || cursor.s !== range.start || cursor.e !== range.end || cursor.f !== range.campaignId || !validDate(cursor.d) || !validId(cursor.c) || cursor.d < range.start || cursor.d > range.end) throw new MetaAdsError(400, "INVALID_CURSOR");
  if (cursor.v !== version) throw new MetaAdsError(409, "DATA_UPDATED");
  return cursor;
}
function encodeCursor(row: Row, range: Range, version: number, secret: string): string {
  const body = Buffer.from(JSON.stringify({ a: ACCOUNT_ID, s: range.start, e: range.end, f: range.campaignId, v: version, d: row.date, c: row.campaign_id })).toString("base64url");
  return body + "." + createHmac("sha256", secret).update(body).digest("base64url");
}

export async function getMetaAdsDashboard(input: Input = {}): Promise<MetaAdsDashboard> {
  const secret = await authenticate();
  if (Date.now() - rate.start > 60000) rate = { start: Date.now(), count: 0 };
  if (++rate.count > 120) throw new MetaAdsError(429, "READ_RATE_LIMIT");
  let range: Range; try { range = rangeInput(input); } catch { throw new MetaAdsError(400, "INVALID_FILTER"); }
  try {
    const stateResult = await proxyCall(process.env, [{ sql: "SELECT account_name,currency,timezone,status,version,last_success_at,last_attempt_at,available_since FROM meta_ads_sync WHERE account_id=?", params: [ACCOUNT_ID] }]);
    const state = (stateResult[0].results?.[0] || {}) as Row;
    const version = Number(state.version || 0);
    const cursor = decodeCursor(input.cursor, range, version, secret);
    const key = JSON.stringify([ACCOUNT_ID, "admin", range, version, state.status, state.last_attempt_at, input.cursor || ""]);
    const hit = cache.get(key); if (hit && hit.expires > Date.now()) { cache.delete(key); cache.set(key, hit); return hit.data; }
    if (hit) cache.delete(key);
    const inflight = pending.get(key); if (inflight) return inflight;
    if (pending.size >= 4) throw new MetaAdsError(429, "READ_BUSY");
    const task = loadDashboard(range, cursor, state, version, secret).then(data => {
      for (const [k, entry] of cache) if (entry.expires <= Date.now()) cache.delete(k);
      while (cache.size >= 32) cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + 60000, data }); return data;
    }).finally(() => pending.delete(key));
    pending.set(key, task); return await task;
  } catch (error) {
    if (error instanceof MetaAdsError) throw error;
    console.error("[admin-chohopark/meta-ads] stored data unavailable");
    throw new MetaAdsError(502, "DATA_UNAVAILABLE");
  }
}

async function loadDashboard(range: Range, cursor: Cursor | null, state: Row, version: number, secret: string): Promise<MetaAdsDashboard> {
  const base = [ACCOUNT_ID, range.start, range.end];
  const selected = range.campaignId ? " AND campaign_id=?" : "";
  const params = range.campaignId ? [...base, range.campaignId] : base;
  const rowWhere = range.campaignId ? " AND d.campaign_id=?" : "";
  const after = cursor ? " AND (d.date<? OR (d.date=? AND d.campaign_id>?))" : "";
  const rowParams = cursor ? [...params, cursor.d, cursor.d, cursor.c] : params;
  const result = await proxyCall(process.env, [
    { sql: `SELECT c.*,COALESCE(d.spend_micros,0) AS spend_micros,COALESCE(d.impressions,0) AS impressions,COALESCE(d.link_clicks,0) AS link_clicks,COALESCE(d.landing_page_views,0) AS landing_page_views,COALESCE(d.website_leads,0) AS website_leads FROM meta_ads_campaigns c LEFT JOIN (SELECT campaign_id,${sums} FROM meta_ads_daily WHERE account_id=? AND date>=? AND date<=? GROUP BY campaign_id) d ON d.campaign_id=c.campaign_id WHERE c.account_id=? ORDER BY c.campaign_id LIMIT 101`, params: [...base, ACCOUNT_ID] },
    { sql: `SELECT date,COUNT(*) AS campaigns,${sums} FROM meta_ads_daily WHERE account_id=? AND date>=? AND date<=?${selected} GROUP BY date ORDER BY date LIMIT 91`, params },
    { sql: `SELECT d.*,c.name AS campaign_name FROM meta_ads_daily d JOIN meta_ads_campaigns c ON c.account_id=d.account_id AND c.campaign_id=d.campaign_id WHERE d.account_id=? AND d.date>=? AND d.date<=?${rowWhere}${after} ORDER BY d.date DESC,d.campaign_id ASC LIMIT 32`, params: rowParams },
    { sql: `SELECT COUNT(*) AS row_count,${sums} FROM meta_ads_daily WHERE account_id=? AND date>=? AND date<=?${selected}`, params },
    { sql: "SELECT version FROM meta_ads_sync WHERE account_id=?", params: [ACCOUNT_ID] },
  ]);
  if (Number(result[4].results?.[0]?.version || 0) !== version) throw new MetaAdsError(409, "DATA_UPDATED");
  const campaigns = result[0].results as Row[];
  if (campaigns.length > 100 || result[1].results.length > 90) throw new MetaAdsError(502, "DATA_LIMIT");
  if (range.campaignId && !campaigns.some(c => c.campaign_id === range.campaignId)) throw new MetaAdsError(400, "CAMPAIGN_NOT_TRACKED");
  const summary = result[3].results[0] as Row;
  const allRows = result[2].results as Row[], rows = allRows.slice(0, PAGE_SIZE);
  const lastSuccessAt = typeof state.last_success_at === "string" ? state.last_success_at : null;
  const data: MetaAdsDashboard = {
    account: { id: ACCOUNT_ID, name: String(state.account_name || "chohopark"), currency: "USD", timezone: "Asia/Seoul" },
    range, summary: metrics(summary),
    campaigns: campaigns.map(c => ({ id: String(c.campaign_id), name: String(c.name), status: String(c.status), effectiveStatus: String(c.effective_status), objective: String(c.objective), spendCapUsd: c.spend_cap_cents === null ? null : Number(c.spend_cap_cents) / 100, updatedAt: String(c.updated_at), metrics: metrics(c) })),
    daily: result[1].results.map((r: Row) => ({ date: String(r.date), campaigns: Number(r.campaigns), ...metrics(r) })),
    rows: rows.map(r => ({ date: String(r.date), campaignId: String(r.campaign_id), campaignName: String(r.campaign_name), dailyReach: Number(r.daily_reach), collectedAt: String(r.collected_at), ...metrics(r) })),
    nextCursor: allRows.length > PAGE_SIZE ? encodeCursor(rows[rows.length - 1], range, version, secret) : null,
    sync: { lastSuccessAt, lastAttemptAt: state.last_attempt_at ? String(state.last_attempt_at) : null, status: String(state.status || "NOT_COLLECTED"), version, stale: !lastSuccessAt || Date.now() - Date.parse(lastSuccessAt) > 2 * 3600000, intervalMinutes: 60, availableSince: state.available_since ? String(state.available_since) : null, attribution: "7일 클릭 · 노출일 기준", hasData: Number(summary.row_count || 0) > 0 },
  };
  if (Buffer.byteLength(JSON.stringify(data)) > 262144) throw new MetaAdsError(502, "DATA_LIMIT");
  return data;
}
