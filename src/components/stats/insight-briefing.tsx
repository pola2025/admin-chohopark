"use client";

/**
 * 인사이트 브리핑 — 규칙 엔진(src/lib/insights) 결과 렌더
 *
 * 규칙:
 * - 하드코딩 문구 렌더 금지 — Insight[]는 반드시 규칙 엔진 산출물
 * - severity는 색만으로 전달 금지: 아이콘 + 텍스트 라벨 항상 동반
 * - 근거 수치는 title/detail 안에 포함되어 있음 (rules.ts가 생성)
 */

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type Insight,
  type InsightSeverity,
  RULE_LABELS,
} from "@/lib/insights";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Info,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";

const SEVERITY_META: Record<
  InsightSeverity,
  { label: string; icon: typeof Info; border: string; text: string }
> = {
  critical: {
    label: "위험",
    icon: AlertCircle,
    border: "var(--status-critical)",
    text: "text-status-critical",
  },
  warning: {
    label: "주의",
    icon: TriangleAlert,
    border: "var(--status-warning)",
    text: "text-[#8a5c00] dark:text-status-warning",
  },
  good: {
    label: "긍정",
    icon: TrendingUp,
    border: "var(--status-good)",
    text: "text-delta-good",
  },
  info: {
    label: "정보",
    icon: Info,
    border: "var(--heat-4)",
    text: "text-[color:var(--heat-6)] dark:text-[color:var(--heat-5)]",
  },
};

interface InsightBriefingProps {
  insights: Insight[];
  loading?: boolean;
  /** 최대 노출 개수 (기본 6) */
  maxVisible?: number;
  className?: string;
}

export function InsightBriefing({
  insights,
  loading,
  maxVisible = 6,
  className,
}: InsightBriefingProps) {
  return (
    <Card className={className}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            📋 인사이트 브리핑
            {!loading && (
              <span className="text-xs font-normal text-muted-foreground">
                규칙 기반 자동 분석 · {insights.length}건 감지
              </span>
            )}
          </h2>
        </div>
        {loading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            감지된 특이사항 없음 — 주요 지표가 안정 범위입니다.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {insights.slice(0, maxVisible).map((insight, i) => (
              <InsightCard key={`${insight.rule}-${i}`} insight={insight} />
            ))}
          </div>
        )}
        {!loading && insights.length > maxVisible && (
          <p className="mt-2 text-xs text-muted-foreground">
            외 {insights.length - maxVisible}건
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const meta = SEVERITY_META[insight.severity];
  const Icon = meta.icon;

  return (
    <div
      className="rounded-lg border p-3.5"
      style={{ borderLeft: `4px solid ${meta.border}` }}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-xs">
        <Icon className={cn("h-3.5 w-3.5", meta.text)} />
        <span className={cn("font-semibold", meta.text)}>{meta.label}</span>
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
          {RULE_LABELS[insight.rule]}
        </span>
      </div>
      <p className="text-sm leading-relaxed">{insight.title}</p>
      {insight.detail && (
        <p className="mt-1 text-xs text-muted-foreground">{insight.detail}</p>
      )}
    </div>
  );
}
