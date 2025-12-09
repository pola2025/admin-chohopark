import { supabaseAdmin } from './supabase';
import { getAnalyticsSummary, getDailyAnalytics, getTopPages, getTrafficSources } from './analytics';

// =============================================
// 타입 정의
// =============================================

export interface DailyVisitorRecord {
  id?: number;
  date: string;
  total_users: number;
  new_users: number;
  sessions: number;
  page_views: number;
  avg_session_duration: number;
  bounce_rate: number;
  created_at?: string;
  updated_at?: string;
}

export interface WeeklyVisitorRecord {
  id?: number;
  week_start: string;
  week_end: string;
  year: number;
  week_number: number;
  total_users: number;
  new_users: number;
  sessions: number;
  page_views: number;
  avg_daily_users: number;
  avg_session_duration: number;
  avg_bounce_rate: number;
}

export interface MonthlyVisitorRecord {
  id?: number;
  year: number;
  month: number;
  total_users: number;
  new_users: number;
  sessions: number;
  page_views: number;
  avg_daily_users: number;
  avg_session_duration: number;
  avg_bounce_rate: number;
  weekly_breakdown?: WeeklyBreakdown[];
}

export interface WeeklyBreakdown {
  week_number: number;
  week_start: string;
  week_end: string;
  total_users: number;
  sessions: number;
  page_views: number;
}

export interface CumulativeStats {
  period_type: 'daily' | 'weekly' | 'monthly';
  total_users: number;
  total_sessions: number;
  total_page_views: number;
  avg_daily_users: number;
  comparison?: {
    users_change: number;
    sessions_change: number;
    page_views_change: number;
  };
}

// =============================================
// 일별 데이터 저장/수집
// =============================================

/**
 * GA4에서 특정 날짜의 데이터를 가져와 DB에 저장
 */
export async function collectDailyVisitors(targetDate: Date): Promise<DailyVisitorRecord | null> {
  const dateStr = formatDateToYYYYMMDD(targetDate);
  const dateForDB = formatDateToISO(targetDate);

  try {
    // GA4에서 해당 날짜 데이터 조회 (오늘 기준 며칠 전인지 계산)
    const today = new Date();
    const diffDays = Math.ceil((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      console.log(`미래 날짜는 수집 불가: ${dateStr}`);
      return null;
    }

    // 해당 날짜 데이터 조회
    const dailyData = await getDailyAnalytics(diffDays + 1);
    const dayData = dailyData.find((d) => d.date === dateStr);

    if (!dayData) {
      console.log(`${dateStr} 날짜의 데이터 없음`);
      return null;
    }

    // 해당 기간 요약 데이터에서 평균 세션 시간, 이탈률 가져오기
    const summary = await getAnalyticsSummary(diffDays + 1);

    const record: DailyVisitorRecord = {
      date: dateForDB,
      total_users: dayData.users,
      new_users: Math.round(dayData.users * 0.7), // 대략적 추정 (GA4에서 일별 신규 사용자 데이터 필요)
      sessions: dayData.sessions,
      page_views: dayData.pageViews,
      avg_session_duration: summary?.avgSessionDuration || 0,
      bounce_rate: summary?.bounceRate || 0,
    };

    // DB에 UPSERT
    const { data, error } = await supabaseAdmin
      .from('daily_visitors')
      .upsert(record, { onConflict: 'date' })
      .select()
      .single();

    if (error) {
      console.error('일별 데이터 저장 실패:', error);
      return null;
    }

    console.log(`일별 데이터 저장 완료: ${dateStr}`);
    return data;
  } catch (error) {
    console.error('일별 데이터 수집 오류:', error);
    return null;
  }
}

/**
 * 최근 N일간의 데이터를 일괄 수집
 */
export async function collectRecentDailyVisitors(days: number = 30): Promise<number> {
  let successCount = 0;
  const today = new Date();

  for (let i = 1; i <= days; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() - i);

    const result = await collectDailyVisitors(targetDate);
    if (result) successCount++;

    // API Rate Limit 방지
    await sleep(100);
  }

  console.log(`총 ${successCount}/${days}일 데이터 수집 완료`);
  return successCount;
}

/**
 * 인기 페이지 데이터 저장
 */
export async function collectDailyPageViews(targetDate: Date): Promise<number> {
  const dateForDB = formatDateToISO(targetDate);
  const today = new Date();
  const diffDays = Math.ceil((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

  try {
    const pages = await getTopPages(diffDays + 1, 20);

    if (pages.length === 0) return 0;

    const records = pages.map((page) => ({
      date: dateForDB,
      page_path: page.path,
      page_title: page.title,
      views: page.views,
    }));

    const { error } = await supabaseAdmin
      .from('daily_page_views')
      .upsert(records, { onConflict: 'date,page_path' });

    if (error) {
      console.error('페이지뷰 저장 실패:', error);
      return 0;
    }

    return records.length;
  } catch (error) {
    console.error('페이지뷰 수집 오류:', error);
    return 0;
  }
}

/**
 * 트래픽 소스 데이터 저장
 */
export async function collectDailyTrafficSources(targetDate: Date): Promise<number> {
  const dateForDB = formatDateToISO(targetDate);
  const today = new Date();
  const diffDays = Math.ceil((today.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

  try {
    const sources = await getTrafficSources(diffDays + 1);

    if (sources.length === 0) return 0;

    const records = sources.map((source) => ({
      date: dateForDB,
      source: source.source || '(direct)',
      users: source.users,
      sessions: source.sessions,
    }));

    const { error } = await supabaseAdmin
      .from('daily_traffic_sources')
      .upsert(records, { onConflict: 'date,source' });

    if (error) {
      console.error('트래픽 소스 저장 실패:', error);
      return 0;
    }

    return records.length;
  } catch (error) {
    console.error('트래픽 소스 수집 오류:', error);
    return 0;
  }
}

// =============================================
// 주간/월간 집계
// =============================================

/**
 * 주간 데이터 집계 (특정 주의 월요일 날짜 기준)
 */
export async function aggregateWeeklyVisitors(weekStart: Date): Promise<WeeklyVisitorRecord | null> {
  const weekStartStr = formatDateToISO(weekStart);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr = formatDateToISO(weekEnd);

  const year = weekStart.getFullYear();
  const weekNumber = getWeekNumber(weekStart);

  try {
    // 해당 주의 일별 데이터 조회
    const { data: dailyData, error: queryError } = await supabaseAdmin
      .from('daily_visitors')
      .select('*')
      .gte('date', weekStartStr)
      .lte('date', weekEndStr);

    if (queryError) {
      console.error('주간 집계 조회 실패:', queryError);
      return null;
    }

    if (!dailyData || dailyData.length === 0) {
      console.log(`${weekStartStr} ~ ${weekEndStr} 기간 데이터 없음`);
      return null;
    }

    // 집계
    const totalUsers = dailyData.reduce((sum, d) => sum + (d.total_users || 0), 0);
    const newUsers = dailyData.reduce((sum, d) => sum + (d.new_users || 0), 0);
    const sessions = dailyData.reduce((sum, d) => sum + (d.sessions || 0), 0);
    const pageViews = dailyData.reduce((sum, d) => sum + (d.page_views || 0), 0);
    const avgDailyUsers = dailyData.length > 0 ? totalUsers / dailyData.length : 0;
    const avgSessionDuration =
      dailyData.length > 0
        ? dailyData.reduce((sum, d) => sum + (d.avg_session_duration || 0), 0) / dailyData.length
        : 0;
    const avgBounceRate =
      dailyData.length > 0
        ? dailyData.reduce((sum, d) => sum + (d.bounce_rate || 0), 0) / dailyData.length
        : 0;

    const record: WeeklyVisitorRecord = {
      week_start: weekStartStr,
      week_end: weekEndStr,
      year,
      week_number: weekNumber,
      total_users: totalUsers,
      new_users: newUsers,
      sessions,
      page_views: pageViews,
      avg_daily_users: avgDailyUsers,
      avg_session_duration: avgSessionDuration,
      avg_bounce_rate: avgBounceRate,
    };

    // UPSERT
    const { data, error } = await supabaseAdmin
      .from('weekly_visitors')
      .upsert(record, { onConflict: 'year,week_number' })
      .select()
      .single();

    if (error) {
      console.error('주간 집계 저장 실패:', error);
      return null;
    }

    console.log(`주간 집계 완료: ${year}년 ${weekNumber}주차`);
    return data;
  } catch (error) {
    console.error('주간 집계 오류:', error);
    return null;
  }
}

/**
 * 월간 데이터 집계
 */
export async function aggregateMonthlyVisitors(
  year: number,
  month: number
): Promise<MonthlyVisitorRecord | null> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // 해당 월의 마지막 날

  const monthStartStr = formatDateToISO(monthStart);
  const monthEndStr = formatDateToISO(monthEnd);

  try {
    // 해당 월의 일별 데이터 조회
    const { data: dailyData, error: dailyError } = await supabaseAdmin
      .from('daily_visitors')
      .select('*')
      .gte('date', monthStartStr)
      .lte('date', monthEndStr);

    if (dailyError) {
      console.error('월간 집계 조회 실패:', dailyError);
      return null;
    }

    // 해당 월의 주간 데이터 조회 (breakdown용)
    const { data: weeklyData } = await supabaseAdmin
      .from('weekly_visitors')
      .select('*')
      .gte('week_start', monthStartStr)
      .lte('week_end', monthEndStr)
      .order('week_start', { ascending: true });

    if (!dailyData || dailyData.length === 0) {
      console.log(`${year}년 ${month}월 데이터 없음`);
      return null;
    }

    // 집계
    const totalUsers = dailyData.reduce((sum, d) => sum + (d.total_users || 0), 0);
    const newUsers = dailyData.reduce((sum, d) => sum + (d.new_users || 0), 0);
    const sessions = dailyData.reduce((sum, d) => sum + (d.sessions || 0), 0);
    const pageViews = dailyData.reduce((sum, d) => sum + (d.page_views || 0), 0);
    const avgDailyUsers = dailyData.length > 0 ? totalUsers / dailyData.length : 0;
    const avgSessionDuration =
      dailyData.length > 0
        ? dailyData.reduce((sum, d) => sum + (d.avg_session_duration || 0), 0) / dailyData.length
        : 0;
    const avgBounceRate =
      dailyData.length > 0
        ? dailyData.reduce((sum, d) => sum + (d.bounce_rate || 0), 0) / dailyData.length
        : 0;

    // 주차별 breakdown
    const weeklyBreakdown: WeeklyBreakdown[] = (weeklyData || []).map((w) => ({
      week_number: w.week_number,
      week_start: w.week_start,
      week_end: w.week_end,
      total_users: w.total_users,
      sessions: w.sessions,
      page_views: w.page_views,
    }));

    const record = {
      year,
      month,
      total_users: totalUsers,
      new_users: newUsers,
      sessions,
      page_views: pageViews,
      avg_daily_users: avgDailyUsers,
      avg_session_duration: avgSessionDuration,
      avg_bounce_rate: avgBounceRate,
      weekly_breakdown: weeklyBreakdown,
    };

    // UPSERT
    const { data, error } = await supabaseAdmin
      .from('monthly_visitors')
      .upsert(record, { onConflict: 'year,month' })
      .select()
      .single();

    if (error) {
      console.error('월간 집계 저장 실패:', error);
      return null;
    }

    console.log(`월간 집계 완료: ${year}년 ${month}월`);
    return data;
  } catch (error) {
    console.error('월간 집계 오류:', error);
    return null;
  }
}

// =============================================
// 조회 함수
// =============================================

/**
 * 일별 방문자 데이터 조회
 */
export async function getDailyVisitors(days: number = 30): Promise<DailyVisitorRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('daily_visitors')
    .select('*')
    .order('date', { ascending: false })
    .limit(days);

  if (error) {
    console.error('일별 데이터 조회 실패:', error);
    return [];
  }

  return data || [];
}

/**
 * 주간 방문자 데이터 조회
 */
export async function getWeeklyVisitors(weeks: number = 12): Promise<WeeklyVisitorRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('weekly_visitors')
    .select('*')
    .order('week_start', { ascending: false })
    .limit(weeks);

  if (error) {
    console.error('주간 데이터 조회 실패:', error);
    return [];
  }

  return data || [];
}

/**
 * 월간 방문자 데이터 조회
 */
export async function getMonthlyVisitors(months: number = 12): Promise<MonthlyVisitorRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('monthly_visitors')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(months);

  if (error) {
    console.error('월간 데이터 조회 실패:', error);
    return [];
  }

  return data || [];
}

/**
 * 누적 통계 조회
 */
export async function getCumulativeStats(): Promise<CumulativeStats> {
  // 전체 누적 합계
  const { data: allTime } = await supabaseAdmin
    .from('daily_visitors')
    .select('total_users, sessions, page_views');

  const totalUsers = allTime?.reduce((sum, d) => sum + (d.total_users || 0), 0) || 0;
  const totalSessions = allTime?.reduce((sum, d) => sum + (d.sessions || 0), 0) || 0;
  const totalPageViews = allTime?.reduce((sum, d) => sum + (d.page_views || 0), 0) || 0;
  const dayCount = allTime?.length || 1;

  // 지난 30일 vs 그 이전 30일 비교
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(today.getDate() - 60);

  const { data: recent30 } = await supabaseAdmin
    .from('daily_visitors')
    .select('total_users, sessions, page_views')
    .gte('date', formatDateToISO(thirtyDaysAgo));

  const { data: prev30 } = await supabaseAdmin
    .from('daily_visitors')
    .select('total_users, sessions, page_views')
    .gte('date', formatDateToISO(sixtyDaysAgo))
    .lt('date', formatDateToISO(thirtyDaysAgo));

  const recent30Users = recent30?.reduce((sum, d) => sum + (d.total_users || 0), 0) || 0;
  const prev30Users = prev30?.reduce((sum, d) => sum + (d.total_users || 0), 0) || 0;

  const recent30Sessions = recent30?.reduce((sum, d) => sum + (d.sessions || 0), 0) || 0;
  const prev30Sessions = prev30?.reduce((sum, d) => sum + (d.sessions || 0), 0) || 0;

  const recent30PageViews = recent30?.reduce((sum, d) => sum + (d.page_views || 0), 0) || 0;
  const prev30PageViews = prev30?.reduce((sum, d) => sum + (d.page_views || 0), 0) || 0;

  return {
    period_type: 'daily',
    total_users: totalUsers,
    total_sessions: totalSessions,
    total_page_views: totalPageViews,
    avg_daily_users: Math.round(totalUsers / dayCount),
    comparison: {
      users_change: prev30Users > 0 ? ((recent30Users - prev30Users) / prev30Users) * 100 : 0,
      sessions_change:
        prev30Sessions > 0 ? ((recent30Sessions - prev30Sessions) / prev30Sessions) * 100 : 0,
      page_views_change:
        prev30PageViews > 0 ? ((recent30PageViews - prev30PageViews) / prev30PageViews) * 100 : 0,
    },
  };
}

// =============================================
// 유틸리티 함수
// =============================================

function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 최근 N주 집계 실행
 */
export async function aggregateRecentWeeks(weeks: number = 4): Promise<number> {
  let successCount = 0;
  const today = new Date();
  const currentMonday = getMonday(today);

  for (let i = 1; i <= weeks; i++) {
    const weekStart = new Date(currentMonday);
    weekStart.setDate(currentMonday.getDate() - 7 * i);

    const result = await aggregateWeeklyVisitors(weekStart);
    if (result) successCount++;
  }

  return successCount;
}

/**
 * 최근 N개월 집계 실행
 */
export async function aggregateRecentMonths(months: number = 3): Promise<number> {
  let successCount = 0;
  const today = new Date();

  for (let i = 1; i <= months; i++) {
    const targetDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth() + 1;

    const result = await aggregateMonthlyVisitors(year, month);
    if (result) successCount++;
  }

  return successCount;
}
