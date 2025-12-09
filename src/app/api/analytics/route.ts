import { NextResponse } from 'next/server';
import {
  getAnalyticsSummary,
  getDailyAnalytics,
  getTopPages,
  getTrafficSources,
  getRealtimeUsers,
} from '@/lib/analytics';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '30');
  const type = searchParams.get('type') || 'all';

  try {
    if (type === 'realtime') {
      const realtimeUsers = await getRealtimeUsers();
      return NextResponse.json({ realtimeUsers });
    }

    if (type === 'summary') {
      const summary = await getAnalyticsSummary(days);
      return NextResponse.json({ summary });
    }

    if (type === 'daily') {
      const daily = await getDailyAnalytics(days);
      return NextResponse.json({ daily });
    }

    if (type === 'pages') {
      const pages = await getTopPages(days);
      return NextResponse.json({ pages });
    }

    if (type === 'sources') {
      const sources = await getTrafficSources(days);
      return NextResponse.json({ sources });
    }

    // 모든 데이터 조회
    const [summary, daily, pages, sources, realtimeUsers] = await Promise.all([
      getAnalyticsSummary(days),
      getDailyAnalytics(days),
      getTopPages(days),
      getTrafficSources(days),
      getRealtimeUsers(),
    ]);

    return NextResponse.json({
      summary,
      daily,
      pages,
      sources,
      realtimeUsers,
    });
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
