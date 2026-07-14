/**
 * 지표 사전 (Metric Dictionary) — 파생 지표 계산의 단일 정의 (SSoT)
 *
 * 규칙:
 * - 파생 지표(CPC/CTR/CPL/CVR/증감률)를 라우트·페이지에서 인라인 재계산 금지
 * - CPC는 링크클릭 기준 단일 정의. UI 라벨에 "CPC(링크)" 명시
 * - 역방향 지표(낮을수록 좋음)는 INVERTED_METRICS로 관리 — delta 색상 판단에 사용
 */

/** 0 나누기 안전 나눗셈 — 분모 0이면 null */
export function safeDiv(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

/** CTR = 클릭 ÷ 노출 (%) */
export function ctr(clicks: number, impressions: number): number | null {
  const r = safeDiv(clicks, impressions);
  return r == null ? null : r * 100;
}

/** CPC(링크) = 지출 ÷ 링크클릭 — 전 화면 단일 정의 */
export function cpcLink(spend: number, linkClicks: number): number | null {
  return safeDiv(spend, linkClicks);
}

/** CPL = 지출 ÷ 리드 */
export function cpl(spend: number, leads: number): number | null {
  return safeDiv(spend, leads);
}

/** CPM = 지출 ÷ 노출 × 1000 */
export function cpm(spend: number, impressions: number): number | null {
  const r = safeDiv(spend, impressions);
  return r == null ? null : r * 1000;
}

/** CVR = 전환 ÷ 방문(또는 클릭) (%) */
export function cvr(conversions: number, visits: number): number | null {
  const r = safeDiv(conversions, visits);
  return r == null ? null : r * 100;
}

/**
 * 증감률 = (현재 − 이전) ÷ 이전.
 * 이전=0이면 null ("신규" 표시용) — Infinity 반환 금지
 */
export function calcChange(current: number, previous: number): number | null {
  return safeDiv(current - previous, Math.abs(previous));
}

/** 역방향 지표 명단 — 감소가 좋음(녹색) */
export const INVERTED_METRICS = new Set([
  "bounceRate",
  "cpc",
  "cpl",
  "cpm",
  "cpa",
  "costPerLead",
  "lostImpressionShare",
]);

export function isInverted(metricKey: string): boolean {
  return INVERTED_METRICS.has(metricKey);
}

/**
 * delta 방향성 판단: 값 변화 + 지표 방향 → 좋음/나쁨/중립
 * (색상은 UI에서: good=녹색, bad=빨강, neutral=회색)
 */
export function deltaTone(
  change: number | null,
  metricKey?: string,
): "good" | "bad" | "neutral" {
  if (change == null || change === 0) return "neutral";
  const risingIsGood = !(metricKey && isInverted(metricKey));
  return change > 0 === risingIsGood ? "good" : "bad";
}

/** 합계 */
export function sum(values: number[]): number {
  return values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

/** 평균 (빈 배열 null) */
export function avg(values: number[]): number | null {
  return values.length ? sum(values) / values.length : null;
}

/** 표준편차 (모집단) */
export function stddev(values: number[]): number | null {
  const m = avg(values);
  if (m == null || values.length < 2) return null;
  return Math.sqrt(sum(values.map((v) => (v - m) ** 2)) / values.length);
}

/**
 * 가중 평균 비율 — 이탈률·CTR 등 비율 지표를 기간 합산할 때
 * 단순 평균 금지: Σ(비율×가중치) ÷ Σ가중치
 */
export function weightedRate(
  items: Array<{ rate: number; weight: number }>,
): number | null {
  const w = sum(items.map((i) => i.weight));
  return safeDiv(sum(items.map((i) => i.rate * i.weight)), w);
}
