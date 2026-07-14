import { NextRequest, NextResponse } from "next/server";
import { d1All, d1First } from "@/lib/d1-client";

/**
 * 자체측정(단순 터치) 조회 API — visit_events 테이블 read-only.
 *
 * GA4가 누락하는 1초 미만 이탈 방문자도 포함된 전체 페이지뷰 집계.
 * 트래커가 폴라애드 홈페이지에서 sendBeacon으로 즉시 발송.
 *
 * 쿼리: ?days=7 (기본 7)
 * 응답:
 *   overview: { totalTouches, uniqueVisitors, newVisitors, returningVisitors,
 *               quickBounces, botTouches, humanTouches, dayCount }
 *   daily: [{ date, touches, uniqueVisitors, newVisitors, quickBounces }]
 *   topPaths: [{ path, touches, uniqueVisitors }]
 *   sources: [{ utm_source, touches }]
 */

interface OverviewRow {
  total_touches: number;
  unique_visitors: number;
  new_visitors: number;
  returning_visitors: number;
  bot_touches: number;
  human_touches: number;
  day_count: number;
}

interface DailyRow {
  date: string;
  touches: number;
  unique_visitors: number;
  new_visitors: number;
}

interface PathRow {
  path: string;
  touches: number;
  unique_visitors: number;
}

interface SourceRow {
  utm_source: string;
  touches: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Math.max(
    1,
    Math.min(365, parseInt(searchParams.get("days") || "7", 10)),
  );

  const startDate = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);

  try {
    const [overview, daily, topPaths, sources] = await Promise.all([
      d1First<OverviewRow>(
        `SELECT
           COUNT(*) AS total_touches,
           COUNT(DISTINCT visitor_id) AS unique_visitors,
           COUNT(DISTINCT CASE WHEN is_new_visitor = 1 THEN visitor_id END) AS new_visitors,
           COUNT(DISTINCT CASE WHEN is_new_visitor = 0 THEN visitor_id END) AS returning_visitors,
           SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS bot_touches,
           SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human_touches,
           COUNT(DISTINCT substr(created_at, 1, 10)) AS day_count
         FROM visit_events
         WHERE event_type = 'page_view'
           AND substr(created_at, 1, 10) >= ?`,
        [startDate],
      ),
      d1All<DailyRow>(
        `SELECT
           substr(created_at, 1, 10) AS date,
           COUNT(*) AS touches,
           COUNT(DISTINCT visitor_id) AS unique_visitors,
           COUNT(DISTINCT CASE WHEN is_new_visitor = 1 THEN visitor_id END) AS new_visitors
         FROM visit_events
         WHERE event_type = 'page_view'
           AND is_bot = 0
           AND substr(created_at, 1, 10) >= ?
         GROUP BY date
         ORDER BY date ASC`,
        [startDate],
      ),
      d1All<PathRow>(
        `SELECT
           path,
           COUNT(*) AS touches,
           COUNT(DISTINCT visitor_id) AS unique_visitors
         FROM visit_events
         WHERE event_type = 'page_view'
           AND is_bot = 0
           AND substr(created_at, 1, 10) >= ?
           AND path != ''
         GROUP BY path
         ORDER BY touches DESC
         LIMIT 10`,
        [startDate],
      ),
      d1All<SourceRow>(
        `SELECT
           COALESCE(NULLIF(utm_source, ''), '(direct)') AS utm_source,
           COUNT(*) AS touches
         FROM visit_events
         WHERE event_type = 'page_view'
           AND is_bot = 0
           AND substr(created_at, 1, 10) >= ?
         GROUP BY utm_source
         ORDER BY touches DESC
         LIMIT 10`,
        [startDate],
      ),
    ]);

    return NextResponse.json({
      range: { days, startDate },
      overview: {
        totalTouches: Number(overview?.total_touches ?? 0),
        uniqueVisitors: Number(overview?.unique_visitors ?? 0),
        newVisitors: Number(overview?.new_visitors ?? 0),
        returningVisitors: Number(overview?.returning_visitors ?? 0),
        botTouches: Number(overview?.bot_touches ?? 0),
        humanTouches: Number(overview?.human_touches ?? 0),
        dayCount: Number(overview?.day_count ?? 0),
      },
      daily: daily.map((d) => ({
        date: d.date,
        touches: Number(d.touches ?? 0),
        uniqueVisitors: Number(d.unique_visitors ?? 0),
        newVisitors: Number(d.new_visitors ?? 0),
      })),
      topPaths: topPaths.map((p) => ({
        path: p.path,
        touches: Number(p.touches ?? 0),
        uniqueVisitors: Number(p.unique_visitors ?? 0),
      })),
      sources: sources.map((s) => ({
        utmSource: s.utm_source,
        touches: Number(s.touches ?? 0),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { error: "touches failed: " + msg.slice(0, 100) },
      { status: 500 },
    );
  }
}
