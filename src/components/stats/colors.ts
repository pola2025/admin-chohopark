/**
 * 시리즈 색상 규칙 (SSoT)
 *
 * - 색은 엔티티를 따라간다 (순위 아님): 같은 채널은 어느 화면에서든 같은 색
 * - 카테고리 색은 고정 순서로 배정, 순환 생성 금지 (7개 이상이면 "기타"로 접기)
 * - hex 하드코딩 금지 — 반드시 CSS 토큰(var(--chart-N)) 사용
 */

/** 카테고리 슬롯 고정 순서 (globals.css 검증 팔레트) */
export const CHART_SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

/** 이전 기간/컨텍스트 시리즈 전용 */
export const DEEMPHASIS = "var(--chart-deemphasis)";

/** 엔티티 고정 색 매핑 — 전 페이지 공통 (유입 채널) */
export const CHANNEL_COLORS: Record<string, string> = {
  "자연검색": "var(--chart-2)",
  "구글광고": "var(--chart-1)",
  "직접유입": "var(--chart-3)",
  "메타광고": "var(--chart-4)",
  "소셜": "var(--chart-5)",
  "추천": "var(--chart-6)",
  // GA4 channel group 영문 키
  "Organic Search": "var(--chart-2)",
  "Paid Search": "var(--chart-1)",
  "Direct": "var(--chart-3)",
  "Paid Social": "var(--chart-4)",
  "Organic Social": "var(--chart-5)",
  "Referral": "var(--chart-6)",
};

/** 엔티티 고정 색 매핑 — 기기 */
export const DEVICE_COLORS: Record<string, string> = {
  "모바일": "var(--chart-1)",
  "데스크톱": "var(--chart-2)",
  "태블릿": "var(--chart-3)",
  mobile: "var(--chart-1)",
  desktop: "var(--chart-2)",
  tablet: "var(--chart-3)",
};

/**
 * 색 결정: 엔티티 맵 우선 → 없으면 목록 내 인덱스로 고정 슬롯 배정
 * (인덱스 배정은 목록 순서가 안정적일 때만 — 정렬 변경으로 색이 바뀌면 안 됨)
 */
export function seriesColor(
  name: string,
  index: number,
  entityMap?: Record<string, string>,
): string {
  return entityMap?.[name] ?? CHART_SERIES[index % CHART_SERIES.length];
}
