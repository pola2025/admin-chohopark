/**
 * 통계 표시 포맷 단일 모듈 (SSoT)
 *
 * 규칙:
 * - 페이지/컴포넌트에서 포맷 함수 로컬 재정의 금지 — 반드시 여기서 import
 * - 통화는 명시적으로: KRW="1,234만원" 체계, USD="$1.23" (페이지 내 혼용 금지)
 * - 증감 표시는 비교 기간을 항상 라벨에 명시 ("vs 이전 30일")
 */

export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return Math.round(n).toLocaleString("ko-KR");
}

/** 큰 수 축약: 12,345 → "1.2만", 1,234,567 → "123.5만" */
export function formatCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  const abs = Math.abs(n);
  if (abs >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (abs >= 10_000) return `${(n / 10_000).toFixed(1)}만`;
  return formatNumber(n);
}

/** 초 → "2분 34초" (1시간 이상은 "1시간 12분") */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "–";
  const s = Math.round(seconds);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 ${s % 60}초`;
  const h = Math.floor(m / 60);
  return `${h}시간 ${m % 60}분`;
}

export type CurrencyCode = "KRW" | "USD";

/** KRW: 12,340,000 → "1,234만원" / USD: 1.234 → "$1.23" */
export function formatCurrency(
  amount: number | null | undefined,
  currency: CurrencyCode = "KRW",
): string {
  if (amount == null || !Number.isFinite(amount)) return "–";
  if (currency === "USD") {
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const abs = Math.abs(amount);
  if (abs >= 10_000) return `${formatNumber(amount / 10_000)}만원`;
  return `${formatNumber(amount)}원`;
}

export function formatPercent(
  v: number | null | undefined,
  digits = 1,
): string {
  if (v == null || !Number.isFinite(v)) return "–";
  return `${v.toFixed(digits)}%`;
}

/**
 * 증감률 표시: +23.1% / -4.3% (±999% 클램프, prev=0이면 "신규")
 * ratio는 calcChange() 결과 (0.231 = +23.1%)
 */
export function formatDeltaPercent(ratio: number | null | undefined): string {
  if (ratio == null || !Number.isFinite(ratio)) return "신규";
  const pct = ratio * 100;
  const clamped = Math.min(Math.abs(pct), 999);
  return `${pct >= 0 ? "▲" : "▼"} ${clamped.toFixed(1)}%${Math.abs(pct) > 999 ? "+" : ""}`;
}

/** %p 차이 표시 (이탈률 등 비율 지표의 delta): -4.5%p */
export function formatDeltaPoint(diff: number | null | undefined): string {
  if (diff == null || !Number.isFinite(diff)) return "–";
  return `${diff >= 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)}%p`;
}

/** "2026-06-28" → "6/28" */
export function formatDateShort(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** "2026-06-02" ~ "2026-07-01" → "2026.06.02 – 07.01" */
export function formatDateRange(start: string, end: string): string {
  const s = start.replaceAll("-", ".");
  const e = end.replaceAll("-", ".");
  return s.slice(0, 4) === e.slice(0, 4) ? `${s} – ${e.slice(5)}` : `${s} – ${e}`;
}
