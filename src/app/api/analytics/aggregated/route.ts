import { NextRequest, NextResponse } from "next/server"
import { getDailyAnalyticsFromCache } from "@/lib/d1-analytics-cache"
import { calcChange } from "@/lib/stats/metrics"
import type { DailyVisitorData, WeeklyVisitorData, MonthlyVisitorData } from "@/types/analytics"

// 주 시작일 계산 (월요일 기준)
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

// 주 번호 계산
function getWeekNumber(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `W${weekNum.toString().padStart(2, "0")}`
}

// 변화율 계산 — 공용 calcChange(비율|null)를 퍼센트 숫자로 변환 (기존 응답 단위 유지)
function calculateChange(current: number, previous: number): number {
  return (calcChange(current, previous) ?? 0) * 100
}

// 일별 -> 주별 집계
function aggregateToWeekly(daily: DailyVisitorData[]): WeeklyVisitorData[] {
  const weeklyMap = new Map<string, DailyVisitorData[]>()

  for (const day of daily) {
    const date = new Date(day.date)
    const weekStart = getWeekStart(date)
    const weekKey = weekStart.toISOString().split("T")[0]

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, [])
    }
    weeklyMap.get(weekKey)!.push(day)
  }

  const weeks: WeeklyVisitorData[] = Array.from(weeklyMap.entries())
    .map(([weekStartStr, days]) => {
      const weekStart = new Date(weekStartStr)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      return {
        week_label: getWeekNumber(weekStart),
        week_start: weekStartStr,
        week_end: weekEnd.toISOString().split("T")[0],
        visitors: days.reduce((sum, d) => sum + d.visitors, 0),
        pageviews: days.reduce((sum, d) => sum + d.pageviews, 0),
        sessions: days.reduce((sum, d) => sum + d.sessions, 0),
        newUsers: days.reduce((sum, d) => sum + d.newUsers, 0),
        bounceRate: days.length > 0 ? days.reduce((sum, d) => sum + d.bounceRate, 0) / days.length : 0,
        avgDuration: days.length > 0 ? days.reduce((sum, d) => sum + d.avgDuration, 0) / days.length : 0,
      }
    })
    .sort((a, b) => b.week_start.localeCompare(a.week_start))

  // 전주 대비 변화율 계산
  for (let i = 0; i < weeks.length - 1; i++) {
    weeks[i].visitors_change = calculateChange(weeks[i].visitors, weeks[i + 1].visitors)
    weeks[i].pageviews_change = calculateChange(weeks[i].pageviews, weeks[i + 1].pageviews)
    weeks[i].sessions_change = calculateChange(weeks[i].sessions, weeks[i + 1].sessions)
    weeks[i].bounceRate_change = calculateChange(weeks[i].bounceRate, weeks[i + 1].bounceRate)
  }

  return weeks
}

// 일별 -> 월별 집계
function aggregateToMonthly(daily: DailyVisitorData[], weekly: WeeklyVisitorData[]): MonthlyVisitorData[] {
  const monthlyMap = new Map<string, DailyVisitorData[]>()

  for (const day of daily) {
    const month = day.date.substring(0, 7)
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, [])
    }
    monthlyMap.get(month)!.push(day)
  }

  const months: MonthlyVisitorData[] = Array.from(monthlyMap.entries())
    .map(([month, days]) => {
      const [year, m] = month.split("-")
      const monthLabel = `${year}년 ${parseInt(m)}월`

      const monthWeeks = weekly.filter(
        (w) => w.week_start.startsWith(month) || w.week_end.startsWith(month)
      )

      return {
        month,
        month_label: monthLabel,
        visitors: days.reduce((sum, d) => sum + d.visitors, 0),
        pageviews: days.reduce((sum, d) => sum + d.pageviews, 0),
        sessions: days.reduce((sum, d) => sum + d.sessions, 0),
        newUsers: days.reduce((sum, d) => sum + d.newUsers, 0),
        bounceRate: days.length > 0 ? days.reduce((sum, d) => sum + d.bounceRate, 0) / days.length : 0,
        avgDuration: days.length > 0 ? days.reduce((sum, d) => sum + d.avgDuration, 0) / days.length : 0,
        weeks: monthWeeks,
      }
    })
    .sort((a, b) => b.month.localeCompare(a.month))

  // 전월 대비 변화율 계산
  for (let i = 0; i < months.length - 1; i++) {
    months[i].visitors_change = calculateChange(months[i].visitors, months[i + 1].visitors)
    months[i].pageviews_change = calculateChange(months[i].pageviews, months[i + 1].pageviews)
    months[i].sessions_change = calculateChange(months[i].sessions, months[i + 1].sessions)
    months[i].bounceRate_change = calculateChange(months[i].bounceRate, months[i + 1].bounceRate)
  }

  return months
}

// 요약 계산
function calculateSummary(daily: DailyVisitorData[]) {
  return {
    total_visitors: daily.reduce((sum, d) => sum + d.visitors, 0),
    total_pageviews: daily.reduce((sum, d) => sum + d.pageviews, 0),
    total_sessions: daily.reduce((sum, d) => sum + d.sessions, 0),
    avg_bounce_rate: daily.length > 0 ? daily.reduce((sum, d) => sum + d.bounceRate, 0) / daily.length : 0,
    avg_session_duration: daily.length > 0 ? daily.reduce((sum, d) => sum + d.avgDuration, 0) / daily.length : 0,
    date_range: {
      start: daily.length > 0 ? daily[daily.length - 1].date : "",
      end: daily.length > 0 ? daily[0].date : "",
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "90")

    // D1 캐시에서 데이터 조회
    const cachedDaily = await getDailyAnalyticsFromCache(days)

    if (cachedDaily.length === 0) {
      return NextResponse.json({
        daily: [],
        weekly: [],
        monthly: [],
        summary: {
          total_visitors: 0,
          total_pageviews: 0,
          total_sessions: 0,
          avg_bounce_rate: 0,
          avg_session_duration: 0,
          date_range: { start: "", end: "" },
        },
      })
    }

    const weekly = aggregateToWeekly(cachedDaily)
    const monthly = aggregateToMonthly(cachedDaily, weekly)
    const summary = calculateSummary(cachedDaily)

    return NextResponse.json({
      daily: cachedDaily,
      weekly,
      monthly,
      summary,
    })
  } catch (error) {
    console.error("Aggregated Analytics API Error:", error)
    return NextResponse.json({
      daily: [],
      weekly: [],
      monthly: [],
      summary: {
        total_visitors: 0,
        total_pageviews: 0,
        total_sessions: 0,
        avg_bounce_rate: 0,
        avg_session_duration: 0,
        date_range: { start: "", end: "" },
      },
    })
  }
}
