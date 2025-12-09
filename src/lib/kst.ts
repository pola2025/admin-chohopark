/**
 * KST (한국 표준시) 유틸리티 함수
 * 모든 시간 처리는 이 유틸리티를 통해 KST 기준으로 일관성 있게 처리
 */

const KST_OFFSET = 9 * 60 * 60 * 1000 // 9시간 (밀리초)

/**
 * 현재 KST 시간을 반환
 */
export function getKSTNow(): Date {
  const now = new Date()
  return new Date(now.getTime() + KST_OFFSET)
}

/**
 * UTC Date를 KST Date로 변환
 */
export function toKST(date: Date): Date {
  return new Date(date.getTime() + KST_OFFSET)
}

/**
 * KST 기준 오늘 날짜 문자열 (YYYY-MM-DD)
 */
export function getKSTTodayString(): string {
  const kst = getKSTNow()
  return kst.toISOString().split('T')[0]
}

/**
 * KST 기준 현재 시간 문자열 (YYYY-MM-DD HH:mm:ss)
 */
export function getKSTDateTimeString(): string {
  const kst = getKSTNow()
  return kst.toISOString().replace('T', ' ').slice(0, 19)
}

/**
 * KST 기준 ISO 문자열 반환 (DB 저장용)
 * Supabase는 UTC로 저장하므로 KST 시간을 UTC로 변환하여 저장
 */
export function toKSTISOString(date: Date): string {
  return date.toISOString()
}

/**
 * 날짜 문자열(YYYY-MM-DD)과 시간(HH:mm)을 KST 기준 Date로 변환
 * Vercel 서버(UTC)에서 실행되므로 KST 시간을 UTC로 변환
 */
export function createKSTDate(dateStr: string, time: string): Date {
  // KST 시간대 문자열 생성
  const kstDateTimeStr = `${dateStr}T${time}:00+09:00`
  return new Date(kstDateTimeStr)
}

/**
 * KST 기준 특정 일수 후 날짜 문자열 반환
 */
export function getKSTDateAfterDays(days: number): string {
  const kst = getKSTNow()
  kst.setDate(kst.getDate() + days)
  return kst.toISOString().split('T')[0]
}

/**
 * KST 기준 오늘의 시작 시간 (00:00:00) - DB 쿼리용
 */
export function getKSTTodayStart(): Date {
  const todayStr = getKSTTodayString()
  return createKSTDate(todayStr, '00:00')
}

/**
 * KST 기준 오늘의 종료 시간 (23:59:59) - DB 쿼리용
 */
export function getKSTTodayEnd(): Date {
  const todayStr = getKSTTodayString()
  return createKSTDate(todayStr, '23:59')
}

/**
 * KST 기준 월의 마지막 날짜 반환
 */
export function getKSTEndOfMonth(): string {
  const kst = getKSTNow()
  const year = kst.getFullYear()
  const month = kst.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

/**
 * 날짜 포맷팅 (한국어)
 */
export function formatKSTDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const kst = toKST(d)
  return kst.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

/**
 * 날짜+시간 포맷팅 (한국어)
 */
export function formatKSTDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const kst = toKST(d)
  return kst.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * SMS 스케줄링을 위한 KST 시간 계산
 * use_date: 이용일 (YYYY-MM-DD)
 * scheduleType: d_minus_1, d_day_morning, before_meal, before_close
 * productType: overnight, daytrip, training
 */
export function calculateSmsScheduleTime(
  useDate: string,
  scheduleType: string,
  productType: string
): Date {
  const scheduleConfig: Record<string, Record<string, { dayOffset: number; time: string }>> = {
    overnight: {
      d_minus_1: { dayOffset: -1, time: '10:00' },
      d_day_morning: { dayOffset: 0, time: '08:00' },
      before_meal: { dayOffset: 0, time: '17:30' },
      before_close: { dayOffset: 1, time: '10:00' },
    },
    daytrip: {
      d_minus_1: { dayOffset: -1, time: '10:00' },
      d_day_morning: { dayOffset: 0, time: '08:00' },
      before_meal: { dayOffset: 0, time: '11:30' },
      before_close: { dayOffset: 0, time: '16:00' },
    },
    training: {
      d_minus_1: { dayOffset: -1, time: '10:00' },
      d_day_morning: { dayOffset: 0, time: '08:00' },
      before_meal: { dayOffset: 0, time: '17:30' },
      before_close: { dayOffset: 2, time: '10:00' },
    },
  }

  const config = scheduleConfig[productType]?.[scheduleType]
  if (!config) {
    throw new Error(`Invalid schedule config: ${productType}/${scheduleType}`)
  }

  // use_date에서 offset 적용
  const baseDate = new Date(useDate)
  baseDate.setDate(baseDate.getDate() + config.dayOffset)
  const targetDateStr = baseDate.toISOString().split('T')[0]

  // KST 시간으로 생성 (UTC로 변환됨)
  return createKSTDate(targetDateStr, config.time)
}
