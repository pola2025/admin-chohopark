import { NextResponse } from 'next/server';
import {
  getAnalyticsSummary,
  getDailyAnalytics,
  getTopPages,
  getTrafficSources,
  getRealtimeUsers,
  getTrafficSourceMedium,
  getChannelGroups,
  getLandingPages,
  getDeviceStats,
  getCityStats,
  getBrowserStats,
} from '@/lib/analytics';
import {
  getLatestSummary,
  getLatestPages,
  getLatestSources,
  getLatestDevices,
  isAirtableConfigured,
} from '@/lib/analytics-airtable';

// Airtable 데이터 유효성 확인
function isValidAirtableData(data: unknown[]): boolean {
  return Array.isArray(data) && data.length > 0;
}

// Summary 데이터 변환 (Airtable -> API 응답 형식)
interface SummaryTotals {
  totalUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
}

function transformSummaryFromAirtable(records: Record<string, unknown>[]) {
  if (records.length === 0) return null;

  const totals = records.reduce<SummaryTotals>(
    (acc, r) => ({
      totalUsers: acc.totalUsers + (Number(r.totalUsers) || 0),
      newUsers: acc.newUsers + (Number(r.newUsers) || 0),
      sessions: acc.sessions + (Number(r.sessions) || 0),
      pageViews: acc.pageViews + (Number(r.pageViews) || 0),
      avgSessionDuration: acc.avgSessionDuration + (Number(r.avgSessionDuration) || 0),
      bounceRate: acc.bounceRate + (Number(r.bounceRate) || 0),
    }),
    { totalUsers: 0, newUsers: 0, sessions: 0, pageViews: 0, avgSessionDuration: 0, bounceRate: 0 }
  );

  const count = records.length;
  return {
    totalUsers: totals.totalUsers,
    newUsers: totals.newUsers,
    sessions: totals.sessions,
    pageViews: totals.pageViews,
    avgSessionDuration: count > 0 ? totals.avgSessionDuration / count : 0,
    bounceRate: count > 0 ? totals.bounceRate / count : 0,
  };
}

// Daily 데이터 변환
function transformDailyFromAirtable(records: Record<string, unknown>[]) {
  return records
    .map((r) => ({
      date: String(r.date || '').replace(/-/g, ''),
      users: Number(r.totalUsers) || 0,
      sessions: Number(r.sessions) || 0,
      pageViews: Number(r.pageViews) || 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Pages 데이터 변환
function transformPagesFromAirtable(records: Record<string, unknown>[], limit: number = 10) {
  const pageMap = new Map<string, { path: string; title: string; views: number }>();

  for (const r of records) {
    const path = String(r.path || '');
    const existing = pageMap.get(path);
    if (existing) {
      existing.views += Number(r.views) || 0;
    } else {
      pageMap.set(path, {
        path,
        title: String(r.title || ''),
        views: Number(r.views) || 0,
      });
    }
  }

  return Array.from(pageMap.values())
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

// Sources 데이터 변환
function transformSourcesFromAirtable(records: Record<string, unknown>[]) {
  const sourceMap = new Map<string, { source: string; users: number; sessions: number }>();

  for (const r of records) {
    const source = String(r.source || 'direct');
    const existing = sourceMap.get(source);
    if (existing) {
      existing.users += Number(r.users) || 0;
      existing.sessions += Number(r.sessions) || 0;
    } else {
      sourceMap.set(source, {
        source,
        users: Number(r.users) || 0,
        sessions: Number(r.sessions) || 0,
      });
    }
  }

  return Array.from(sourceMap.values()).sort((a, b) => b.users - a.users);
}

// Devices 데이터 변환
function transformDevicesFromAirtable(records: Record<string, unknown>[]) {
  const deviceMap = new Map<string, { device: string; users: number; sessions: number; pageViews: number }>();

  for (const r of records) {
    const device = String(r.device || 'unknown');
    const existing = deviceMap.get(device);
    if (existing) {
      existing.users += Number(r.users) || 0;
      existing.sessions += Number(r.sessions) || 0;
      existing.pageViews += Number(r.pageViews) || 0;
    } else {
      deviceMap.set(device, {
        device,
        users: Number(r.users) || 0,
        sessions: Number(r.sessions) || 0,
        pageViews: Number(r.pageViews) || 0,
      });
    }
  }

  return Array.from(deviceMap.values()).sort((a, b) => b.users - a.users);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');
  const type = searchParams.get('type') || 'all';
  const source = searchParams.get('source') || 'auto'; // 'auto' | 'airtable' | 'ga'

  const useAirtable = source !== 'ga' && isAirtableConfigured();

  try {
    // 실시간 데이터는 항상 GA에서 조회
    if (type === 'realtime') {
      const realtimeUsers = await getRealtimeUsers();
      return NextResponse.json({ realtimeUsers, source: 'ga' });
    }

    // Summary 조회
    if (type === 'summary') {
      if (useAirtable) {
        try {
          const airtableData = await getLatestSummary(days);
          if (isValidAirtableData(airtableData)) {
            const summary = transformSummaryFromAirtable(airtableData);
            return NextResponse.json({ summary, source: 'airtable' });
          }
        } catch (e) {
          console.log('Airtable summary fetch failed, falling back to GA:', e);
        }
      }
      const summary = await getAnalyticsSummary(days);
      return NextResponse.json({ summary, source: 'ga' });
    }

    // Daily 조회
    if (type === 'daily') {
      if (useAirtable) {
        try {
          const airtableData = await getLatestSummary(days);
          if (isValidAirtableData(airtableData)) {
            const daily = transformDailyFromAirtable(airtableData);
            return NextResponse.json({ daily, source: 'airtable' });
          }
        } catch (e) {
          console.log('Airtable daily fetch failed, falling back to GA:', e);
        }
      }
      const daily = await getDailyAnalytics(days);
      return NextResponse.json({ daily, source: 'ga' });
    }

    // Pages 조회
    if (type === 'pages') {
      if (useAirtable) {
        try {
          const airtableData = await getLatestPages(days);
          if (isValidAirtableData(airtableData)) {
            const pages = transformPagesFromAirtable(airtableData, 10);
            return NextResponse.json({ pages, source: 'airtable' });
          }
        } catch (e) {
          console.log('Airtable pages fetch failed, falling back to GA:', e);
        }
      }
      const pages = await getTopPages(days);
      return NextResponse.json({ pages, source: 'ga' });
    }

    // Sources 조회
    if (type === 'sources') {
      if (useAirtable) {
        try {
          const airtableData = await getLatestSources(days);
          if (isValidAirtableData(airtableData)) {
            const sources = transformSourcesFromAirtable(airtableData);
            return NextResponse.json({ sources, source: 'airtable' });
          }
        } catch (e) {
          console.log('Airtable sources fetch failed, falling back to GA:', e);
        }
      }
      const sources = await getTrafficSources(days);
      return NextResponse.json({ sources, source: 'ga' });
    }

    // GA only 엔드포인트들
    if (type === 'source-medium') {
      const sourceMedium = await getTrafficSourceMedium(days);
      return NextResponse.json({ sourceMedium, source: 'ga' });
    }

    if (type === 'channels') {
      const channels = await getChannelGroups(days);
      return NextResponse.json({ channels, source: 'ga' });
    }

    if (type === 'landing') {
      const landingPages = await getLandingPages(days);
      return NextResponse.json({ landingPages, source: 'ga' });
    }

    // Devices 조회
    if (type === 'devices') {
      if (useAirtable) {
        try {
          const airtableData = await getLatestDevices(days);
          if (isValidAirtableData(airtableData)) {
            const devices = transformDevicesFromAirtable(airtableData);
            return NextResponse.json({ devices, source: 'airtable' });
          }
        } catch (e) {
          console.log('Airtable devices fetch failed, falling back to GA:', e);
        }
      }
      const devices = await getDeviceStats(days);
      return NextResponse.json({ devices, source: 'ga' });
    }

    if (type === 'cities') {
      const cities = await getCityStats(days);
      return NextResponse.json({ cities, source: 'ga' });
    }

    if (type === 'browsers') {
      const browsers = await getBrowserStats(days);
      return NextResponse.json({ browsers, source: 'ga' });
    }

    // Traffic 데이터 조회
    if (type === 'traffic') {
      let devicesFromAirtable = null;

      if (useAirtable) {
        try {
          const airtableDevices = await getLatestDevices(days);
          if (isValidAirtableData(airtableDevices)) {
            devicesFromAirtable = transformDevicesFromAirtable(airtableDevices);
          }
        } catch (e) {
          console.log('Airtable devices fetch failed:', e);
        }
      }

      const [sourceMedium, channels, landingPages, cities, browsers] = await Promise.all([
        getTrafficSourceMedium(days),
        getChannelGroups(days),
        getLandingPages(days),
        getCityStats(days),
        getBrowserStats(days),
      ]);

      const devices = devicesFromAirtable || (await getDeviceStats(days));

      return NextResponse.json({
        sourceMedium,
        channels,
        landingPages,
        devices,
        cities,
        browsers,
        source: devicesFromAirtable ? 'mixed' : 'ga',
      });
    }

    // 모든 데이터 조회 (기본) - Airtable 우선
    let airtableSummary = null;
    let airtableDaily = null;
    let airtablePages = null;
    let airtableSources = null;
    let airtableDevices = null;

    if (useAirtable) {
      try {
        const [summaryRecords, pagesRecords, sourcesRecords, devicesRecords] = await Promise.all([
          getLatestSummary(days),
          getLatestPages(days),
          getLatestSources(days),
          getLatestDevices(days),
        ]);

        if (isValidAirtableData(summaryRecords)) {
          airtableSummary = transformSummaryFromAirtable(summaryRecords);
          airtableDaily = transformDailyFromAirtable(summaryRecords);
        }
        if (isValidAirtableData(pagesRecords)) {
          airtablePages = transformPagesFromAirtable(pagesRecords, 10);
        }
        if (isValidAirtableData(sourcesRecords)) {
          airtableSources = transformSourcesFromAirtable(sourcesRecords);
        }
        if (isValidAirtableData(devicesRecords)) {
          airtableDevices = transformDevicesFromAirtable(devicesRecords);
        }
      } catch (e) {
        console.log('Airtable fetch failed, falling back to GA:', e);
      }
    }

    // Airtable에 없는 데이터는 GA에서 조회
    const [
      gaSummary,
      gaDaily,
      gaPages,
      gaSources,
      realtimeUsers,
      sourceMedium,
      channels,
      landingPages,
      gaDevices,
      cities,
      browsers,
    ] = await Promise.all([
      airtableSummary ? Promise.resolve(null) : getAnalyticsSummary(days),
      airtableDaily ? Promise.resolve(null) : getDailyAnalytics(days),
      airtablePages ? Promise.resolve(null) : getTopPages(days),
      airtableSources ? Promise.resolve(null) : getTrafficSources(days),
      getRealtimeUsers(),
      getTrafficSourceMedium(days),
      getChannelGroups(days),
      getLandingPages(days),
      airtableDevices ? Promise.resolve(null) : getDeviceStats(days),
      getCityStats(days),
      getBrowserStats(days),
    ]);

    const dataSource =
      airtableSummary || airtablePages || airtableSources || airtableDevices ? 'mixed' : 'ga';

    return NextResponse.json({
      summary: airtableSummary || gaSummary,
      daily: airtableDaily || gaDaily,
      pages: airtablePages || gaPages,
      sources: airtableSources || gaSources,
      realtimeUsers,
      sourceMedium,
      channels,
      landingPages,
      devices: airtableDevices || gaDevices,
      cities,
      browsers,
      source: dataSource,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
  }
}
