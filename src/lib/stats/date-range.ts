/**
 * 기간 모델 단일 표준 (SSoT) — KST 기준
 *
 * 규칙:
 * - 모든 통계 화면의 기간 값 체계는 이 프리셋 키로 통일
 * - 비교 기간(prev)은 항상 "직전 동일 길이" — 라벨에 명시
 * - 서버 라우트는 parseRangeParams()로 파싱 (legacy ?days= 도 수용)
 */

export type PeriodPreset =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "cur-month"
  | "prev-month"
  | "custom";

export const PERIOD_PRESETS: Array<{ key: PeriodPreset; label: string }> = [
  { key: "today", label: "오늘" },
  { key: "7d", label: "7일" },
  { key: "30d", label: "30일" },
  { key: "90d", label: "90일" },
  { key: "custom", label: "사용자 지정" },
];

export interface ResolvedRange {
  preset: PeriodPreset;
  startDate: string; // YYYY-MM-DD (KST)
  endDate: string;
  prevStartDate: string; // 직전 동일 길이 기간
  prevEndDate: string;
  days: number;
}

/* ── KST 날짜 유틸 ── */

function kstNow(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000);
}

export function kstToday(): string {
  return kstNow().toISOString().slice(0, 10);
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(start: string, end: string): number {
  const a = new Date(start + "T00:00:00Z").getTime();
  const b = new Date(end + "T00:00:00Z").getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmd(s: string): boolean {
  return YMD.test(s);
}

/* ── 프리셋 해석 ── */

export function resolveRange(
  preset: PeriodPreset,
  custom?: { start?: string; end?: string },
): ResolvedRange {
  const today = kstToday();

  let startDate: string;
  let endDate: string;

  switch (preset) {
    case "today":
      startDate = today;
      endDate = today;
      break;
    case "7d":
    case "30d":
    case "90d": {
      const n = Number(preset.replace("d", ""));
      endDate = today;
      startDate = addDays(today, -(n - 1));
      break;
    }
    case "cur-month":
      startDate = today.slice(0, 8) + "01";
      endDate = today;
      break;
    case "prev-month": {
      const firstOfThis = today.slice(0, 8) + "01";
      endDate = addDays(firstOfThis, -1);
      startDate = endDate.slice(0, 8) + "01";
      break;
    }
    case "custom": {
      endDate = custom?.end && isValidYmd(custom.end) ? custom.end : today;
      startDate =
        custom?.start && isValidYmd(custom.start)
          ? custom.start
          : addDays(endDate, -29);
      if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
      break;
    }
  }

  const days = daysBetween(startDate, endDate);
  const prevEndDate = addDays(startDate, -1);
  const prevStartDate = addDays(prevEndDate, -(days - 1));

  return { preset, startDate, endDate, prevStartDate, prevEndDate, days };
}

/* ── API 쿼리 직렬화/파싱 ── */

/** 표준 쿼리 파라미터 생성: ?start=&end= (+preset) */
export function rangeToQuery(range: ResolvedRange): URLSearchParams {
  const p = new URLSearchParams();
  p.set("start", range.startDate);
  p.set("end", range.endDate);
  p.set("preset", range.preset);
  return p;
}

/**
 * 서버 라우트용 파서 — 우선순위:
 * 1) ?start=&end= (표준)  2) ?days=N (legacy)  3) 기본 30일
 */
export function parseRangeParams(url: URL): ResolvedRange {
  const start = url.searchParams.get("start") || "";
  const end = url.searchParams.get("end") || "";
  if (isValidYmd(start) && isValidYmd(end)) {
    return resolveRange("custom", { start, end });
  }
  const days = Number(url.searchParams.get("days"));
  if (Number.isFinite(days) && days > 0) {
    const clamped = Math.min(Math.max(Math.round(days), 1), 365);
    const endDate = kstToday();
    return resolveRange("custom", {
      start: addDays(endDate, -(clamped - 1)),
      end: endDate,
    });
  }
  return resolveRange("30d");
}
