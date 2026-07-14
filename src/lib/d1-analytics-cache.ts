/**
 * 분석 캐시 저장소.
 * 백엔드는 Cloudflare D1이며 Worker proxy를 경유한다.
 */

import { d1All, d1First, d1Run, d1Batch, nowIso } from "@/lib/d1-client";
import type { DailyVisitorData } from "@/types/analytics";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// =====================
// 캐시 메타데이터
// =====================

interface CacheMetadata {
  cache_key: string;
  last_updated: string;
  status: "success" | "error" | "pending";
  record_count: number;
  error_message?: string;
}

export async function getCacheMetadata(
  cacheKey: string,
): Promise<CacheMetadata | null> {
  try {
    const row = await d1First<CacheMetadata>(
      "SELECT cache_key, last_updated, status, record_count, error_message FROM cache_metadata WHERE cache_key = ?",
      [cacheKey],
    );
    return row;
  } catch (error) {
    console.error("Failed to get cache metadata:", error);
    return null;
  }
}

export async function updateCacheMetadata(
  metadata: CacheMetadata,
): Promise<void> {
  try {
    await d1Run(
      `INSERT INTO cache_metadata (cache_key, last_updated, status, record_count, error_message)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         last_updated = excluded.last_updated,
         status = excluded.status,
         record_count = excluded.record_count,
         error_message = excluded.error_message`,
      [
        metadata.cache_key,
        metadata.last_updated,
        metadata.status,
        metadata.record_count,
        metadata.error_message ?? "",
      ],
    );
  } catch (error) {
    console.error("Failed to update cache metadata:", error);
  }
}

// =====================
// 일별 통계 (daily_analytics)
// =====================

export async function saveDailyAnalytics(
  data: DailyVisitorData[],
): Promise<number> {
  if (data.length === 0) return 0;
  try {
    const queries = data.map((item) => ({
      sql: `INSERT INTO daily_analytics (date, visitors, pageviews, sessions, new_users, bounce_rate, avg_duration, collected_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
              visitors = excluded.visitors,
              pageviews = excluded.pageviews,
              sessions = excluded.sessions,
              new_users = excluded.new_users,
              bounce_rate = excluded.bounce_rate,
              avg_duration = excluded.avg_duration,
              collected_at = excluded.collected_at`,
      params: [
        item.date,
        item.visitors,
        item.pageviews,
        item.sessions,
        item.newUsers,
        item.bounceRate,
        item.avgDuration,
        nowIso(),
      ],
    }));
    await d1Batch(queries);
    return data.length;
  } catch (error) {
    console.error("Failed to save daily analytics:", error);
    return 0;
  }
}

export async function getDailyAnalyticsFromCache(
  days: number = 90,
): Promise<DailyVisitorData[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = formatDate(startDate);
    const rows = await d1All<{
      date: string;
      visitors: number;
      pageviews: number;
      sessions: number;
      new_users: number;
      bounce_rate: number;
      avg_duration: number;
    }>(
      `SELECT date, visitors, pageviews, sessions, new_users, bounce_rate, avg_duration
       FROM daily_analytics
       WHERE date > ?
       ORDER BY date DESC`,
      [startDateStr],
    );
    return rows.map((r) => ({
      date: r.date,
      visitors: r.visitors,
      pageviews: r.pageviews,
      sessions: r.sessions,
      newUsers: r.new_users,
      bounceRate: r.bounce_rate,
      avgDuration: r.avg_duration,
    }));
  } catch (error) {
    console.error("Failed to get daily analytics from cache:", error);
    return [];
  }
}

// =====================
// 트래픽 소스
// =====================

interface TrafficSourceCache {
  date: string;
  channel: string;
  visitors: number;
  sessions: number;
  percentage: number;
  bounceRate: number;
  avgDuration: number;
}

export async function saveTrafficSources(
  data: TrafficSourceCache[],
): Promise<number> {
  if (data.length === 0) return 0;
  try {
    const today = formatDate(new Date());
    const queries: { sql: string; params: (string | number)[] }[] = [
      // 오늘 데이터 삭제
      { sql: "DELETE FROM traffic_sources WHERE date = ?", params: [today] },
    ];
    for (const item of data) {
      queries.push({
        sql: `INSERT INTO traffic_sources (date, channel, visitors, sessions, percentage, bounce_rate, avg_duration)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          item.date,
          item.channel,
          item.visitors,
          item.sessions,
          item.percentage,
          item.bounceRate,
          item.avgDuration,
        ],
      });
    }
    await d1Batch(queries);
    return data.length;
  } catch (error) {
    console.error("Failed to save traffic sources:", error);
    return 0;
  }
}

export async function getTrafficSourcesFromCache(): Promise<
  TrafficSourceCache[]
> {
  try {
    // 가장 최신 날짜 찾기
    const latest = await d1First<{ date: string }>(
      "SELECT date FROM traffic_sources ORDER BY date DESC LIMIT 1",
    );
    if (!latest?.date) return [];
    const rows = await d1All<{
      date: string;
      channel: string;
      visitors: number;
      sessions: number;
      percentage: number;
      bounce_rate: number;
      avg_duration: number;
    }>(
      "SELECT date, channel, visitors, sessions, percentage, bounce_rate, avg_duration FROM traffic_sources WHERE date = ?",
      [latest.date],
    );
    return rows.map((r) => ({
      date: r.date,
      channel: r.channel,
      visitors: r.visitors,
      sessions: r.sessions,
      percentage: r.percentage,
      bounceRate: r.bounce_rate,
      avgDuration: r.avg_duration,
    }));
  } catch (error) {
    console.error("Failed to get traffic sources from cache:", error);
    return [];
  }
}

// =====================
// 캐시 유효성 검사
// =====================

export async function isCacheValid(
  cacheKey: string,
  maxAgeHours: number = 24,
): Promise<boolean> {
  const metadata = await getCacheMetadata(cacheKey);
  if (!metadata || metadata.status !== "success") return false;
  const lastUpdated = new Date(metadata.last_updated);
  const ageHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
  return ageHours < maxAgeHours;
}

export const CACHE_KEYS = {
  DAILY_ANALYTICS: "daily_analytics",
  TRAFFIC_SOURCES: "traffic_sources",
  TOP_PAGES: "top_pages",
  DEVICES: "devices",
  COUNTRIES: "countries",
  HOURLY_TRAFFIC: "hourly_traffic",
  GOOGLE_ADS_DAILY: "google_ads_daily",
} as const;

// =====================
// Top pages
// =====================

interface TopPageCache {
  date: string;
  path: string;
  title: string;
  views: number;
  uniqueViews: number;
  avgTime: string;
  bounceRate: number;
}

export async function saveTopPages(data: TopPageCache[]): Promise<number> {
  if (data.length === 0) return 0;
  try {
    const today = formatDate(new Date());
    const queries: { sql: string; params: (string | number)[] }[] = [
      { sql: "DELETE FROM top_pages WHERE date = ?", params: [today] },
    ];
    // GA4는 pagePath+pageTitle 조합으로 행을 반환 → 같은 path가 title만 달라 중복될 수 있음.
    // top_pages PK는 (date, path)이므로 path 기준 중복 제거 (views 내림차순이라 첫 항목 유지)
    const seenPaths = new Set<string>();
    for (const item of data) {
      if (seenPaths.has(item.path)) continue;
      seenPaths.add(item.path);
      queries.push({
        sql: `INSERT INTO top_pages (date, path, title, views, unique_views, avg_time, bounce_rate)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          item.date,
          item.path,
          item.title,
          item.views,
          item.uniqueViews,
          item.avgTime,
          item.bounceRate,
        ],
      });
    }
    await d1Batch(queries);
    return data.length;
  } catch (error) {
    console.error("Failed to save top pages:", error);
    return 0;
  }
}

export async function getTopPagesFromCache(): Promise<TopPageCache[]> {
  try {
    const latest = await d1First<{ date: string }>(
      "SELECT date FROM top_pages ORDER BY date DESC LIMIT 1",
    );
    if (!latest?.date) return [];
    const rows = await d1All<{
      date: string;
      path: string;
      title: string;
      views: number;
      unique_views: number;
      avg_time: string;
      bounce_rate: number;
    }>(
      "SELECT date, path, title, views, unique_views, avg_time, bounce_rate FROM top_pages WHERE date = ? ORDER BY views DESC LIMIT 20",
      [latest.date],
    );
    return rows.map((r) => ({
      date: r.date,
      path: r.path,
      title: r.title,
      views: r.views,
      uniqueViews: r.unique_views,
      avgTime: r.avg_time || "0:00",
      bounceRate: r.bounce_rate,
    }));
  } catch (error) {
    console.error("Failed to get top pages from cache:", error);
    return [];
  }
}

// =====================
// Devices
// =====================

interface DeviceCache {
  date: string;
  device: string;
  visitors: number;
  percentage: number;
}

export async function saveDeviceStats(data: DeviceCache[]): Promise<number> {
  if (data.length === 0) return 0;
  try {
    const today = formatDate(new Date());
    const queries: { sql: string; params: (string | number)[] }[] = [
      { sql: "DELETE FROM devices WHERE date = ?", params: [today] },
    ];
    for (const item of data) {
      queries.push({
        sql: "INSERT INTO devices (date, device, visitors, percentage) VALUES (?, ?, ?, ?)",
        params: [item.date, item.device, item.visitors, item.percentage],
      });
    }
    await d1Batch(queries);
    return data.length;
  } catch (error) {
    console.error("Failed to save device stats:", error);
    return 0;
  }
}

export async function getDeviceStatsFromCache(): Promise<DeviceCache[]> {
  try {
    const latest = await d1First<{ date: string }>(
      "SELECT date FROM devices ORDER BY date DESC LIMIT 1",
    );
    if (!latest?.date) return [];
    return await d1All<DeviceCache>(
      "SELECT date, device, visitors, percentage FROM devices WHERE date = ?",
      [latest.date],
    );
  } catch (error) {
    console.error("Failed to get device stats from cache:", error);
    return [];
  }
}

// =====================
// Region (countries)
// =====================

interface RegionCache {
  date: string;
  region: string;
  visitors: number;
  percentage: number;
}

export async function saveRegionStats(data: RegionCache[]): Promise<number> {
  if (data.length === 0) return 0;
  try {
    const today = formatDate(new Date());
    const queries: { sql: string; params: (string | number)[] }[] = [
      { sql: "DELETE FROM countries WHERE date = ?", params: [today] },
    ];
    for (const item of data) {
      queries.push({
        sql: "INSERT INTO countries (date, country, visitors, percentage) VALUES (?, ?, ?, ?)",
        params: [item.date, item.region, item.visitors, item.percentage],
      });
    }
    await d1Batch(queries);
    return data.length;
  } catch (error) {
    console.error("Failed to save region stats:", error);
    return 0;
  }
}

export async function getRegionStatsFromCache(): Promise<RegionCache[]> {
  try {
    const latest = await d1First<{ date: string }>(
      "SELECT date FROM countries ORDER BY date DESC LIMIT 1",
    );
    if (!latest?.date) return [];
    const rows = await d1All<{
      date: string;
      country: string;
      visitors: number;
      percentage: number;
    }>(
      "SELECT date, country, visitors, percentage FROM countries WHERE date = ? ORDER BY visitors DESC LIMIT 20",
      [latest.date],
    );
    return rows.map((r) => ({
      date: r.date,
      region: r.country,
      visitors: r.visitors,
      percentage: r.percentage,
    }));
  } catch (error) {
    console.error("Failed to get region stats from cache:", error);
    return [];
  }
}

// =====================
// Hourly traffic
// =====================

interface HourlyTrafficCache {
  date: string;
  hour: string;
  visitors: number;
}

export async function saveHourlyTraffic(
  data: HourlyTrafficCache[],
): Promise<number> {
  if (data.length === 0) return 0;
  try {
    const today = formatDate(new Date());
    const queries: { sql: string; params: (string | number)[] }[] = [
      { sql: "DELETE FROM hourly_traffic WHERE date = ?", params: [today] },
    ];
    for (const item of data) {
      queries.push({
        sql: "INSERT INTO hourly_traffic (date, hour, visitors) VALUES (?, ?, ?)",
        params: [item.date, item.hour, item.visitors],
      });
    }
    await d1Batch(queries);
    return data.length;
  } catch (error) {
    console.error("Failed to save hourly traffic:", error);
    return 0;
  }
}

export async function getHourlyTrafficFromCache(): Promise<
  HourlyTrafficCache[]
> {
  try {
    const latest = await d1First<{ date: string }>(
      "SELECT date FROM hourly_traffic ORDER BY date DESC LIMIT 1",
    );
    if (!latest?.date) return [];
    return await d1All<HourlyTrafficCache>(
      "SELECT date, hour, visitors FROM hourly_traffic WHERE date = ?",
      [latest.date],
    );
  } catch (error) {
    console.error("Failed to get hourly traffic from cache:", error);
    return [];
  }
}

// =====================
// Bot visits (write-heavy 로그)
// =====================

export interface BotVisitRecord {
  timestamp: string;
  date: string;
  botName: string;
  category: string;
  path: string;
  ip: string;
}

export async function saveBotVisit(visit: BotVisitRecord): Promise<void> {
  try {
    await d1Run(
      "INSERT INTO bot_visits (timestamp, date, bot_name, category, path, ip) VALUES (?, ?, ?, ?, ?, ?)",
      [
        visit.timestamp,
        visit.date,
        visit.botName,
        visit.category,
        visit.path,
        visit.ip,
      ],
    );
  } catch (error) {
    console.error("Failed to save bot visit:", error);
  }
}

export async function saveBotVisitsBatch(
  visits: BotVisitRecord[],
): Promise<number> {
  if (visits.length === 0) return 0;
  try {
    const queries = visits.map((v) => ({
      sql: "INSERT INTO bot_visits (timestamp, date, bot_name, category, path, ip) VALUES (?, ?, ?, ?, ?, ?)",
      params: [v.timestamp, v.date, v.botName, v.category, v.path, v.ip],
    }));
    await d1Batch(queries);
    return visits.length;
  } catch (error) {
    console.error("Failed to save bot visits batch:", error);
    return 0;
  }
}

export async function getBotVisitsFromCache(
  days: number = 7,
): Promise<BotVisitRecord[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = formatDate(startDate);
    const rows = await d1All<{
      timestamp: string;
      date: string;
      bot_name: string;
      category: string;
      path: string;
      ip: string;
    }>(
      "SELECT timestamp, date, bot_name, category, path, ip FROM bot_visits WHERE date > ? ORDER BY timestamp DESC",
      [startDateStr],
    );
    return rows.map((r) => ({
      timestamp: r.timestamp,
      date: r.date,
      botName: r.bot_name,
      category: r.category,
      path: r.path,
      ip: r.ip || "",
    }));
  } catch (error) {
    console.error("Failed to get bot visits from cache:", error);
    return [];
  }
}

// =====================
// Bot daily stats
// =====================

export interface BotDailyStats {
  date: string;
  total_visits: number;
  bot_visits: number;
  human_visits: number;
  bot_percentage: number;
  categories: string;
  top_bots: string;
}

export async function saveBotDailyStats(stats: BotDailyStats): Promise<void> {
  try {
    await d1Run(
      `INSERT INTO bot_daily_stats (date, total_visits, bot_visits, human_visits, bot_percentage, categories, top_bots)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         total_visits = excluded.total_visits,
         bot_visits = excluded.bot_visits,
         human_visits = excluded.human_visits,
         bot_percentage = excluded.bot_percentage,
         categories = excluded.categories,
         top_bots = excluded.top_bots`,
      [
        stats.date,
        stats.total_visits,
        stats.bot_visits,
        stats.human_visits,
        stats.bot_percentage,
        stats.categories,
        stats.top_bots,
      ],
    );
  } catch (error) {
    console.error("Failed to save bot daily stats:", error);
  }
}

export async function getBotDailyStatsFromCache(
  days: number = 30,
): Promise<BotDailyStats[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = formatDate(startDate);
    return await d1All<BotDailyStats>(
      `SELECT date, total_visits, bot_visits, human_visits, bot_percentage, categories, top_bots
       FROM bot_daily_stats
       WHERE date > ?
       ORDER BY date DESC`,
      [startDateStr],
    );
  } catch (error) {
    console.error("Failed to get bot daily stats from cache:", error);
    return [];
  }
}

// =====================
// Google Ads daily
// =====================

export interface GoogleAdsDailyCache {
  date: string;
  visitors: number;
  sessions: number;
  pageviews: number;
  conversions: number;
  bounceRate: number;
  avgDuration: number;
  cvr: number;
  total_visitors: number;
  total_sessions: number;
  total_conversions: number;
  visitor_contribution: number;
  session_contribution: number;
  conversion_contribution: number;
  ads_cost: number | null;
  ads_clicks: number | null;
  ads_impressions: number | null;
  cpc: number | null;
  cpa: number | null;
  campaigns_json: string;
}

export async function saveGoogleAdsDaily(
  data: GoogleAdsDailyCache,
): Promise<number> {
  try {
    await d1Run(
      `INSERT INTO google_ads_daily (
         date, visitors, sessions, pageviews, conversions, bounce_rate, avg_duration, cvr,
         total_visitors, total_sessions, total_conversions,
         visitor_contribution, session_contribution, conversion_contribution,
         ads_cost, ads_clicks, ads_impressions, cpc, cpa, campaigns_json, collected_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         visitors = excluded.visitors,
         sessions = excluded.sessions,
         pageviews = excluded.pageviews,
         conversions = excluded.conversions,
         bounce_rate = excluded.bounce_rate,
         avg_duration = excluded.avg_duration,
         cvr = excluded.cvr,
         total_visitors = excluded.total_visitors,
         total_sessions = excluded.total_sessions,
         total_conversions = excluded.total_conversions,
         visitor_contribution = excluded.visitor_contribution,
         session_contribution = excluded.session_contribution,
         conversion_contribution = excluded.conversion_contribution,
         ads_cost = excluded.ads_cost,
         ads_clicks = excluded.ads_clicks,
         ads_impressions = excluded.ads_impressions,
         cpc = excluded.cpc,
         cpa = excluded.cpa,
         campaigns_json = excluded.campaigns_json,
         collected_at = excluded.collected_at`,
      [
        data.date,
        data.visitors,
        data.sessions,
        data.pageviews,
        data.conversions,
        data.bounceRate,
        data.avgDuration,
        data.cvr,
        data.total_visitors,
        data.total_sessions,
        data.total_conversions,
        data.visitor_contribution,
        data.session_contribution,
        data.conversion_contribution,
        data.ads_cost,
        data.ads_clicks,
        data.ads_impressions,
        data.cpc,
        data.cpa,
        data.campaigns_json,
        nowIso(),
      ],
    );
    return 1;
  } catch (error) {
    console.error("Failed to save Google Ads daily:", error);
    return 0;
  }
}

export async function getGoogleAdsDailyFromCache(
  days: number = 90,
): Promise<GoogleAdsDailyCache[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = formatDate(startDate);
    const rows = await d1All<{
      date: string;
      visitors: number;
      sessions: number;
      pageviews: number;
      conversions: number;
      bounce_rate: number;
      avg_duration: number;
      cvr: number;
      total_visitors: number;
      total_sessions: number;
      total_conversions: number;
      visitor_contribution: number;
      session_contribution: number;
      conversion_contribution: number;
      ads_cost: number | null;
      ads_clicks: number | null;
      ads_impressions: number | null;
      cpc: number | null;
      cpa: number | null;
      campaigns_json: string;
    }>(
      `SELECT date, visitors, sessions, pageviews, conversions, bounce_rate, avg_duration, cvr,
              total_visitors, total_sessions, total_conversions,
              visitor_contribution, session_contribution, conversion_contribution,
              ads_cost, ads_clicks, ads_impressions, cpc, cpa, campaigns_json
       FROM google_ads_daily
       WHERE date > ?
       ORDER BY date DESC`,
      [startDateStr],
    );
    return rows.map((r) => ({
      date: r.date,
      visitors: r.visitors,
      sessions: r.sessions,
      pageviews: r.pageviews,
      conversions: r.conversions,
      bounceRate: r.bounce_rate,
      avgDuration: r.avg_duration,
      cvr: r.cvr,
      total_visitors: r.total_visitors,
      total_sessions: r.total_sessions,
      total_conversions: r.total_conversions,
      visitor_contribution: r.visitor_contribution,
      session_contribution: r.session_contribution,
      conversion_contribution: r.conversion_contribution,
      ads_cost: r.ads_cost,
      ads_clicks: r.ads_clicks,
      ads_impressions: r.ads_impressions,
      cpc: r.cpc,
      cpa: r.cpa,
      campaigns_json: r.campaigns_json || "[]",
    }));
  } catch (error) {
    console.error("Failed to get Google Ads daily from cache:", error);
    return [];
  }
}
