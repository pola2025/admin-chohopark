/**
 * 방문통계 분석 타입 정의
 */

// =====================
// 기본 데이터 타입
// =====================

// 일별 방문자 데이터
export interface DailyVisitorData {
  date: string // "2025-12-20"
  visitors: number
  pageviews: number
  sessions: number
  newUsers: number
  bounceRate: number
  avgDuration: number // 초 단위
}

// 주별 방문자 데이터
export interface WeeklyVisitorData {
  week_label: string // "W51", "2025-W51"
  week_start: string // "2025-12-16"
  week_end: string // "2025-12-22"
  visitors: number
  pageviews: number
  sessions: number
  newUsers: number
  bounceRate: number
  avgDuration: number
  // 전주 대비 변화율 (%)
  visitors_change?: number
  pageviews_change?: number
  sessions_change?: number
  bounceRate_change?: number
}

// 월별 방문자 데이터
export interface MonthlyVisitorData {
  month: string // "2025-12"
  month_label: string // "2025년 12월"
  visitors: number
  pageviews: number
  sessions: number
  newUsers: number
  bounceRate: number
  avgDuration: number
  // 전월 대비 변화율 (%)
  visitors_change?: number
  pageviews_change?: number
  sessions_change?: number
  bounceRate_change?: number
  // 하위 주별 데이터
  weeks?: WeeklyVisitorData[]
}

// =====================
// 집계 데이터 응답
// =====================

// 누적데이터 요약
export interface VisitorSummary {
  total_visitors: number
  total_pageviews: number
  total_sessions: number
  avg_bounce_rate: number
  avg_session_duration: number
  date_range: {
    start: string
    end: string
  }
}

// 누적데이터 API 응답
export interface AggregatedVisitorData {
  daily: DailyVisitorData[]
  weekly: WeeklyVisitorData[]
  monthly: MonthlyVisitorData[]
  summary: VisitorSummary
}

// =====================
// 트래픽 유입 분석
// =====================

// 채널 데이터
export interface TrafficChannel {
  channel: string // "organic", "direct", "social", "referral", "paid"
  visitors: number
  sessions: number
  percentage: number
  bounceRate: number
  avgDuration: number
  conversions?: number
  cvr?: number // 전환율
}

// 유입 출처 데이터
export interface TrafficSource {
  source: string // "google", "naver", "facebook"
  medium: string // "organic", "cpc", "referral"
  visitors: number
  sessions: number
  bounceRate: number
  avgDuration: number
}

// Referrer 데이터
export interface TopReferrer {
  referrer: string
  visitors: number
  landingPage: string
}

// 트래픽 분석 API 응답
export interface TrafficSourcesData {
  channels: TrafficChannel[]
  sources: TrafficSource[]
  topReferrers: TopReferrer[]
}

// =====================
// 기간 비교 분석
// =====================

// 기간 메트릭
export interface PeriodMetrics {
  visitors: number
  pageviews: number
  sessions: number
  bounceRate: number
  avgDuration: number
  newUsers: number
  returningUsers: number
}

// 기간 비교 응답
export interface PeriodCompareData {
  current: PeriodMetrics & { startDate: string; endDate: string }
  previous: PeriodMetrics & { startDate: string; endDate: string }
  changes: {
    visitors_percent: number
    pageviews_percent: number
    sessions_percent: number
    bounceRate_percent: number
    avgDuration_percent: number
    newUsers_percent: number
  }
}

// =====================
// 캠페인 분석 (UTM)
// =====================

export interface CampaignData {
  campaign: string // utm_campaign
  source: string // utm_source
  medium: string // utm_medium
  term?: string // utm_term
  content?: string // utm_content
  visitors: number
  sessions: number
  conversions: number
  cvr: number // 전환율
  bounceRate: number
  avgDuration: number
  cost?: number // 광고비 (수동 입력)
  cpa?: number // Cost Per Acquisition
  roas?: number // Return On Ad Spend
}

export interface CampaignAnalyticsData {
  campaigns: CampaignData[]
  summary: {
    total_campaigns: number
    total_visitors: number
    total_conversions: number
    avg_cvr: number
  }
}

// =====================
// 전환 분석
// =====================

export interface ConversionGoal {
  goal_name: string // 이벤트명
  goal_label: string // 표시명
  conversions: number
  conversion_value: number // 전환 가치
  cvr: number
}

export interface ConversionByChannel {
  channel: string
  conversions: number
  cvr: number
  value: number
}

export interface FunnelStep {
  step: number
  name: string
  users: number
  rate: number // 전체 대비 비율
  dropoff?: number // 이전 단계 대비 이탈률
}

export interface ConversionAnalyticsData {
  goals: ConversionGoal[]
  by_channel: ConversionByChannel[]
  funnel: {
    acquisition: number
    engagement: number
    interest: number
    conversion: number
  }
}

// =====================
// 세그먼트 분석
// =====================

export interface SegmentData {
  name: string
  visitors: number
  percentage: number
  pages_per_session: number
  avg_duration: number
  bounce_rate: number
  cvr: number
}

export interface SegmentCompareData {
  segment_type: "new_vs_returning" | "device" | "channel" | "region"
  segments: SegmentData[]
  insight?: string
}

// =====================
// 키워드 분석
// =====================

export interface KeywordData {
  keyword: string
  type: "brand" | "non_brand" | "long_tail" | "informational"
  impressions: number
  clicks: number
  ctr: number
  position: number
  conversions: number
  cvr: number
  trend: "up" | "down" | "stable"
}

export interface KeywordAnalyticsData {
  keywords: KeywordData[]
  brand_ratio: {
    brand: number
    non_brand: number
  }
  top_opportunities: Array<{
    keyword: string
    potential: "high" | "medium" | "low"
    competition: "high" | "medium" | "low"
  }>
}

// =====================
// 시간대/요일 분석
// =====================

export interface HourlyTraffic {
  hour: number // 0-23
  visitors: number
  pageviews: number
  conversions?: number
}

export interface DailyOfWeekTraffic {
  dayOfWeek: number // 0(일)-6(토)
  dayLabel: string // "월", "화", ...
  visitors: number
  pageviews: number
  conversions?: number
}

export interface HeatmapCell {
  hour: number
  dayOfWeek: number
  value: number
}

export interface TimePatternData {
  hourly: HourlyTraffic[]
  daily: DailyOfWeekTraffic[]
  heatmap: HeatmapCell[]
  peakHours: number[]
  peakDays: number[]
}

// =====================
// 유틸리티 타입
// =====================

export type ViewMode = "daily" | "weekly" | "monthly"

export type DateRangePreset = "24h" | "7d" | "30d" | "90d" | "custom"

export interface DateRange {
  startDate: string
  endDate: string
}
