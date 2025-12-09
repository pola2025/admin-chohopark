import { NextResponse } from 'next/server';
import {
  getDailyVisitors,
  getWeeklyVisitors,
  getMonthlyVisitors,
  getCumulativeStats,
  collectRecentDailyVisitors,
  aggregateRecentWeeks,
  aggregateRecentMonths,
} from '@/lib/visitor-stats';

/**
 * GET /api/analytics/stats
 *
 * Query params:
 * - type: 'daily' | 'weekly' | 'monthly' | 'cumulative' | 'all'
 * - limit: number (기본값: 30)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all';
  const limit = parseInt(searchParams.get('limit') || '30');

  try {
    if (type === 'daily') {
      const daily = await getDailyVisitors(limit);
      return NextResponse.json({ daily });
    }

    if (type === 'weekly') {
      const weekly = await getWeeklyVisitors(Math.min(limit, 52));
      return NextResponse.json({ weekly });
    }

    if (type === 'monthly') {
      const monthly = await getMonthlyVisitors(Math.min(limit, 24));
      return NextResponse.json({ monthly });
    }

    if (type === 'cumulative') {
      const cumulative = await getCumulativeStats();
      return NextResponse.json({ cumulative });
    }

    // 모든 데이터 조회
    const [daily, weekly, monthly, cumulative] = await Promise.all([
      getDailyVisitors(limit),
      getWeeklyVisitors(12),
      getMonthlyVisitors(12),
      getCumulativeStats(),
    ]);

    return NextResponse.json({
      daily,
      weekly,
      monthly,
      cumulative,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/stats
 *
 * 데이터 수집 및 집계 실행 (Cron Job 또는 수동)
 *
 * Body:
 * - action: 'collect' | 'aggregate-weekly' | 'aggregate-monthly' | 'full-sync'
 * - days: number (collect 시 수집할 일수)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, days = 30 } = body;

    // 인증 확인 (선택적)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let result: { success: boolean; message: string; count?: number };

    switch (action) {
      case 'collect':
        const collectCount = await collectRecentDailyVisitors(days);
        result = {
          success: true,
          message: `일별 데이터 수집 완료`,
          count: collectCount,
        };
        break;

      case 'aggregate-weekly':
        const weeklyCount = await aggregateRecentWeeks(4);
        result = {
          success: true,
          message: `주간 집계 완료`,
          count: weeklyCount,
        };
        break;

      case 'aggregate-monthly':
        const monthlyCount = await aggregateRecentMonths(3);
        result = {
          success: true,
          message: `월간 집계 완료`,
          count: monthlyCount,
        };
        break;

      case 'full-sync':
        // 전체 동기화: 수집 → 주간 집계 → 월간 집계
        const dailyCollected = await collectRecentDailyVisitors(days);
        const weeksAggregated = await aggregateRecentWeeks(Math.ceil(days / 7) + 1);
        const monthsAggregated = await aggregateRecentMonths(Math.ceil(days / 30) + 1);

        result = {
          success: true,
          message: `전체 동기화 완료: ${dailyCollected}일 수집, ${weeksAggregated}주 집계, ${monthsAggregated}개월 집계`,
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: collect, aggregate-weekly, aggregate-monthly, full-sync' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Stats sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync stats data', details: String(error) },
      { status: 500 }
    );
  }
}
