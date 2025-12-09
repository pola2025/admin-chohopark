import { NextResponse } from 'next/server';
import {
  collectRecentDailyVisitors,
  aggregateRecentWeeks,
  aggregateRecentMonths,
} from '@/lib/visitor-stats';

/**
 * GET /api/cron/sync-analytics
 *
 * Vercel Cron Job 또는 GitHub Actions에서 호출
 * 매일 새벽 3시에 자동 실행
 */
export async function GET(request: Request) {
  // Cron 인증 확인
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results: {
    daily: number;
    weekly: number;
    monthly: number;
    errors: string[];
  } = {
    daily: 0,
    weekly: 0,
    monthly: 0,
    errors: [],
  };

  try {
    // 1. 일별 데이터 수집 (최근 7일)
    console.log('[Cron] 일별 데이터 수집 시작...');
    results.daily = await collectRecentDailyVisitors(7);
    console.log(`[Cron] 일별 데이터 ${results.daily}일 수집 완료`);
  } catch (error) {
    const errMsg = `일별 수집 실패: ${error}`;
    console.error('[Cron]', errMsg);
    results.errors.push(errMsg);
  }

  try {
    // 2. 주간 집계 (최근 2주)
    console.log('[Cron] 주간 집계 시작...');
    results.weekly = await aggregateRecentWeeks(2);
    console.log(`[Cron] 주간 집계 ${results.weekly}주 완료`);
  } catch (error) {
    const errMsg = `주간 집계 실패: ${error}`;
    console.error('[Cron]', errMsg);
    results.errors.push(errMsg);
  }

  try {
    // 3. 월간 집계 (이번 달)
    console.log('[Cron] 월간 집계 시작...');
    results.monthly = await aggregateRecentMonths(1);
    console.log(`[Cron] 월간 집계 ${results.monthly}개월 완료`);
  } catch (error) {
    const errMsg = `월간 집계 실패: ${error}`;
    console.error('[Cron]', errMsg);
    results.errors.push(errMsg);
  }

  const duration = Date.now() - startTime;
  console.log(`[Cron] 전체 동기화 완료: ${duration}ms`);

  return NextResponse.json({
    success: results.errors.length === 0,
    message: `동기화 완료: 일별 ${results.daily}일, 주간 ${results.weekly}주, 월간 ${results.monthly}개월`,
    duration: `${duration}ms`,
    results,
  });
}
