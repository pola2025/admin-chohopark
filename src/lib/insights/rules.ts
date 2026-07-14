/**
 * 규칙 기반 인사이트 엔진 — 규칙 7종 구현
 *
 * 각 규칙은 순수 함수: 데이터 → Insight | null (감지 안 되면 null)
 * 페이지는 collectInsights([...])로 모아 InsightBriefing에 전달
 */

import { avg, calcChange, isInverted, stddev } from "@/lib/stats/metrics";
import type { Insight } from "./types";

/* ── ① 급변 감지: |Δ| ≥ threshold vs 이전 기간 ── */

export function detectSpike(opts: {
  label: string; // "방문자"
  metricKey?: string; // 역방향 판단용 ("bounceRate" 등)
  current: number;
  previous: number;
  format?: (v: number) => string;
  threshold?: number; // 기본 0.2 (20%)
}): Insight | null {
  const { label, metricKey, current, previous, threshold = 0.2 } = opts;
  const fmt = opts.format ?? ((v: number) => Math.round(v).toLocaleString("ko-KR"));
  const change = calcChange(current, previous);
  if (change == null || Math.abs(change) < threshold) return null;

  const risingIsGood = !(metricKey && isInverted(metricKey));
  const isGood = change > 0 === risingIsGood;
  const pct = (Math.abs(change) * 100).toFixed(1);
  const dir = change > 0 ? "+" : "-";

  return {
    rule: "spike",
    severity: isGood ? "good" : "warning",
    title: `${label} ${dir}${pct}% (${fmt(previous)} → ${fmt(current)})`,
    weight: Math.abs(change),
  };
}

/* ── ② 기여 분해: 전체 증감의 최대 기여 요인 ── */

export function detectContribution(opts: {
  totalLabel: string; // "방문자 증가"
  totalDelta: number; // 전체 증감량 (양/음)
  items: Array<{ name: string; delta: number }>;
  format?: (v: number) => string;
  minShare?: number; // 기여율 최소 (기본 0.4)
}): Insight | null {
  const { totalLabel, totalDelta, items, minShare = 0.4 } = opts;
  const fmt = opts.format ?? ((v: number) => Math.round(v).toLocaleString("ko-KR"));
  if (totalDelta === 0 || items.length === 0) return null;

  // 전체 증감과 같은 방향의 기여만 후보
  const sameDir = items.filter((i) => i.delta * totalDelta > 0);
  if (sameDir.length === 0) return null;
  const top = sameDir.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a));
  const share = Math.abs(top.delta) / Math.abs(totalDelta);
  if (share < minShare) return null;

  const sign = top.delta > 0 ? "+" : "-";
  return {
    rule: "contribution",
    severity: "info",
    title: `${totalLabel} 기여 1위: ${top.name} ${sign}${fmt(Math.abs(top.delta))}`,
    detail: `전체 증감분(${sign}${fmt(Math.abs(totalDelta))})의 ${Math.min(Math.round(share * 100), 999)}%`,
    weight: share,
  };
}

/* ── ③ 이상치: 일별 값이 기간 평균 ± 2σ 이탈 ── */

export function detectOutliers(opts: {
  label: string; // "방문"
  series: Array<{ date: string; value: number }>;
  format?: (v: number) => string;
  sigma?: number; // 기본 2
  max?: number; // 최대 보고 개수 (기본 2)
}): Insight[] {
  const { label, series, sigma = 2, max = 2 } = opts;
  const fmt = opts.format ?? ((v: number) => Math.round(v).toLocaleString("ko-KR"));
  if (series.length < 7) return [];

  const values = series.map((s) => s.value);
  const m = avg(values);
  const sd = stddev(values);
  if (m == null || sd == null || sd === 0) return [];

  return series
    .filter((s) => Math.abs(s.value - m) > sigma * sd)
    .sort((a, b) => Math.abs(b.value - m) - Math.abs(a.value - m))
    .slice(0, max)
    .map((s) => {
      const [, mo, d] = s.date.split("-");
      const ratio = m > 0 ? (s.value / m).toFixed(1) : "–";
      return {
        rule: "outlier" as const,
        severity: "info" as const,
        title: `${Number(mo)}/${Number(d)} ${label} ${fmt(s.value)} — 기간 평균(${fmt(m)})의 ${ratio}배`,
        weight: Math.abs(s.value - m) / sd,
      };
    });
}

/* ── ④ 연속 추세: N주기 이상 연속 상승/하락 ── */

export function detectStreak(opts: {
  label: string;
  metricKey?: string;
  series: Array<{ date: string; value: number }>;
  periodLabel?: string; // "일" | "주" (기본 "일")
  minPeriods?: number; // 기본 3 (연속 변화 횟수)
}): Insight | null {
  const { label, metricKey, series, periodLabel = "일", minPeriods = 3 } = opts;
  if (series.length < minPeriods + 1) return null;

  let dir = 0; // 1 상승, -1 하락
  let streak = 0;
  for (let i = series.length - 1; i > 0; i--) {
    const d = Math.sign(series[i].value - series[i - 1].value);
    if (d === 0) break;
    if (dir === 0) dir = d;
    if (d !== dir) break;
    streak++;
  }
  if (streak < minPeriods) return null;

  const risingIsGood = !(metricKey && isInverted(metricKey));
  const isGood = dir > 0 === risingIsGood;
  return {
    rule: "streak",
    severity: isGood ? "good" : "warning",
    title: `${label} ${streak}${periodLabel} 연속 ${dir > 0 ? "상승" : "하락"}`,
    weight: streak,
  };
}

/* ── ⑤ 임계값: 지표별 기준선 초과/미달 ── */

export function detectThreshold(opts: {
  label: string; // "모바일 이탈률"
  value: number;
  threshold: number;
  direction: "above" | "below"; // 어느 쪽이면 경고인가
  format?: (v: number) => string;
  severity?: "warning" | "critical";
  detail?: string; // 권장 조치
}): Insight | null {
  const { label, value, threshold, direction, severity = "warning", detail } = opts;
  const fmt = opts.format ?? ((v: number) => `${v.toFixed(1)}%`);
  const breached =
    direction === "above" ? value > threshold : value < threshold;
  if (!breached) return null;

  return {
    rule: "threshold",
    severity,
    title: `${label} ${fmt(value)} — 기준선(${fmt(threshold)}) ${direction === "above" ? "초과" : "미달"}`,
    detail,
    weight: Math.abs(value - threshold) / Math.max(Math.abs(threshold), 1e-9),
  };
}

/* ── ⑥ 효율 역전: 투입 증가 + 성과 감소 동시 발생 ── */

export function detectEfficiencyInversion(opts: {
  spendLabel?: string; // 기본 "지출"
  resultLabel: string; // "리드"
  spendCurrent: number;
  spendPrevious: number;
  resultCurrent: number;
  resultPrevious: number;
  minSpendIncrease?: number; // 기본 0.1
  formatSpend?: (v: number) => string;
}): Insight | null {
  const {
    spendLabel = "지출",
    resultLabel,
    spendCurrent,
    spendPrevious,
    resultCurrent,
    resultPrevious,
    minSpendIncrease = 0.1,
  } = opts;
  const spendChange = calcChange(spendCurrent, spendPrevious);
  const resultChange = calcChange(resultCurrent, resultPrevious);
  if (spendChange == null || resultChange == null) return null;
  if (spendChange < minSpendIncrease || resultChange >= 0) return null;

  return {
    rule: "efficiency",
    severity: "critical",
    title: `${spendLabel} +${(spendChange * 100).toFixed(1)}% 증가에도 ${resultLabel} ${(resultChange * 100).toFixed(1)}% 감소`,
    detail: "예산 대비 성과 역전 — 소재·타겟 점검 권장",
    weight: spendChange - resultChange,
  };
}

/* ── ⑦ 데이터 신선도: 스냅샷이 오래됨 ── */

export function detectStaleness(opts: {
  sourceLabel: string; // "GA4 스냅샷"
  lastDate: string | null; // 마지막 적재일 YYYY-MM-DD (없으면 null)
  maxAgeDays?: number; // 기본 2
  today?: string; // 테스트 주입용
}): Insight | null {
  const { sourceLabel, lastDate, maxAgeDays = 2 } = opts;
  const today =
    opts.today ?? new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  if (!lastDate) {
    return {
      rule: "freshness",
      severity: "critical",
      title: `${sourceLabel} 데이터 없음 — 동기화 상태 확인 필요`,
      weight: 99,
    };
  }
  const age = Math.round(
    (new Date(today + "T00:00:00Z").getTime() -
      new Date(lastDate + "T00:00:00Z").getTime()) /
      86400000,
  );
  if (age <= maxAgeDays) return null;

  return {
    rule: "freshness",
    severity: "warning",
    title: `${sourceLabel} 마지막 갱신 ${lastDate} (${age}일 전) — 최신 데이터가 아닐 수 있음`,
    detail: "cron 동기화 로그 확인 권장",
    weight: age,
  };
}
