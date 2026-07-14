import { NextRequest, NextResponse } from "next/server";
import {
  getDailyAnalyticsFromCache,
  getTopPagesFromCache,
  getDeviceStatsFromCache,
  getRegionStatsFromCache,
  getHourlyTrafficFromCache,
} from "@/lib/d1-analytics-cache";
import { calcChange } from "@/lib/stats/metrics";

// 빈 데이터
const EMPTY_DATA = {
  overview: {
    totalVisitors: 0,
    uniqueVisitors: 0,
    pageViews: 0,
    avgSessionDuration: "0분 0초",
    bounceRate: 0,
    newVisitors: 0,
    returningVisitors: 0,
    changes: {
      visitors: 0,
      pageViews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
    },
  },
  daily: [],
  regions: [],
  pages: [],
  devices: [],
  browsers: [],
  hourlyTraffic: [],
};

export async function GET(request: NextRequest) {
  try {
    // 쿼리 파라미터에서 days 추출 (기본값 7일)
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "7", 10);

    // D1 캐시에서 데이터 조회
    const [dailyData, topPages, deviceStats, regionStats, hourlyTraffic] =
      await Promise.all([
        getDailyAnalyticsFromCache(days * 2), // 비교를 위해 2배 기간
        getTopPagesFromCache(),
        getDeviceStatsFromCache(),
        getRegionStatsFromCache(),
        getHourlyTrafficFromCache(),
      ]);

    if (dailyData.length === 0) {
      return NextResponse.json(EMPTY_DATA);
    }

    // 현재 기간과 이전 기간 분리
    const currentPeriod = dailyData.slice(0, days);
    const previousPeriod = dailyData.slice(days, days * 2);

    // Overview 계산
    const totalVisitors = currentPeriod.reduce((sum, d) => sum + d.visitors, 0);
    const pageViews = currentPeriod.reduce((sum, d) => sum + d.pageviews, 0);
    const newVisitors = currentPeriod.reduce((sum, d) => sum + d.newUsers, 0);
    const bounceRate =
      currentPeriod.length > 0
        ? currentPeriod.reduce((sum, d) => sum + d.bounceRate, 0) /
          currentPeriod.length
        : 0;
    const avgDuration =
      currentPeriod.length > 0
        ? currentPeriod.reduce((sum, d) => sum + d.avgDuration, 0) /
          currentPeriod.length
        : 0;

    // 이전 기간 데이터
    const prevVisitors = previousPeriod.reduce((sum, d) => sum + d.visitors, 0);
    const prevPageViews = previousPeriod.reduce(
      (sum, d) => sum + d.pageviews,
      0,
    );
    const prevBounceRate =
      previousPeriod.length > 0
        ? previousPeriod.reduce((sum, d) => sum + d.bounceRate, 0) /
          previousPeriod.length
        : 0;
    const prevAvgDuration =
      previousPeriod.length > 0
        ? previousPeriod.reduce((sum, d) => sum + d.avgDuration, 0) /
          previousPeriod.length
        : 0;

    // 변화율(퍼센트) — 공용 calcChange(비율|null)를 퍼센트 숫자로 변환 (기존 응답 단위 유지)
    const changePct = (curr: number, prev: number) =>
      (calcChange(curr, prev) ?? 0) * 100;

    // 시간 포맷
    const mins = Math.floor(avgDuration / 60);
    const secs = Math.floor(avgDuration % 60);
    const avgSessionDuration = `${mins}분 ${secs}초`;

    // 일별 데이터 (MM/DD 형식)
    const daily = currentPeriod
      .map((d) => ({
        date: d.date.slice(5).replace("-", "/"),
        visitors: d.visitors,
        pageviews: d.pageviews,
        sessions: d.sessions,
      }))
      .reverse();

    // 페이지별 데이터
    const pages = topPages.map((p) => ({
      path: p.path,
      title: p.title,
      views: p.views,
      uniqueViews: p.uniqueViews,
      avgTime: p.avgTime,
      bounceRate: p.bounceRate,
    }));

    // 기기별 데이터 (한글 → 영문 변환)
    const deviceNameMap: Record<string, string> = {
      데스크톱: "desktop",
      모바일: "mobile",
      태블릿: "tablet",
      Desktop: "desktop",
      Mobile: "mobile",
      Tablet: "tablet",
    };
    const devices = deviceStats.map((d) => ({
      device: deviceNameMap[d.device] || d.device.toLowerCase(),
      visitors: d.visitors,
      percentage: d.percentage,
    }));

    // 지역별 데이터
    const regions = regionStats.map((r) => ({
      region: r.region,
      visitors: r.visitors,
      percentage: r.percentage,
    }));

    // 시간대별 데이터
    const hourly = hourlyTraffic.map((h) => ({
      hour: h.hour,
      visitors: h.visitors,
    }));

    return NextResponse.json({
      overview: {
        totalVisitors,
        uniqueVisitors: totalVisitors,
        pageViews,
        avgSessionDuration,
        bounceRate,
        newVisitors,
        returningVisitors: totalVisitors - newVisitors,
        changes: {
          visitors: changePct(totalVisitors, prevVisitors),
          pageViews: changePct(pageViews, prevPageViews),
          bounceRate: changePct(bounceRate, prevBounceRate),
          avgSessionDuration: changePct(avgDuration, prevAvgDuration),
        },
      },
      daily,
      regions,
      pages,
      devices,
      browsers: [], // 브라우저별 데이터는 아직 미구현
      hourlyTraffic: hourly,
    });
  } catch (error) {
    console.error("Visitors API Error:", error);
    return NextResponse.json(EMPTY_DATA);
  }
}
