/**
 * 규칙 기반 인사이트 엔진 — 타입 정의
 *
 * 원칙: 모든 인사이트는 화면에 보이는 실제 수치에서 유도된다.
 * 하드코딩 문구 금지. 근거(evidence)가 없는 인사이트는 만들 수 없다.
 */

export type InsightSeverity = "good" | "warning" | "critical" | "info";

export type InsightRule =
  | "spike" // ① 급변 감지
  | "contribution" // ② 기여 분해
  | "outlier" // ③ 이상치
  | "streak" // ④ 연속 추세
  | "threshold" // ⑤ 임계값
  | "efficiency" // ⑥ 효율 역전
  | "freshness"; // ⑦ 데이터 신선도

export const RULE_LABELS: Record<InsightRule, string> = {
  spike: "급변 감지",
  contribution: "기여 분해",
  outlier: "이상치",
  streak: "연속 추세",
  threshold: "임계값",
  efficiency: "효율 역전",
  freshness: "데이터 신선도",
};

export interface Insight {
  rule: InsightRule;
  severity: InsightSeverity;
  /** 핵심 문장 — 수치 포함 (예: "방문자 +23.1% (1,204 → 1,482)") */
  title: string;
  /** 보조 설명 — 기여 요인, 권장 조치 등 */
  detail?: string;
  /** 정렬용 가중치 (심각도 내 2차 정렬, 클수록 위) */
  weight?: number;
}

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  good: 2,
  info: 3,
};

/** 심각도순 정렬 + null 제거 */
export function collectInsights(
  candidates: Array<Insight | null | undefined>,
): Insight[] {
  return candidates
    .filter((i): i is Insight => i != null)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (b.weight ?? 0) - (a.weight ?? 0),
    );
}
