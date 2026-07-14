"use client";

/**
 * 표준 KPI 카드 — 값 + 전기 대비 증감(비교 기간 명시) + 스파크라인
 *
 * 규칙:
 * - 증감 라벨에는 비교 기간을 반드시 명시 (previousLabel: "이전 30일 (1,204)")
 * - 역방향 지표(이탈률·CPC·CPL 등)는 metricKey로 전달 → 감소가 녹색
 * - 스파크라인: de-emphasis 회색 + 마지막 포인트만 accent
 */

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { deltaTone } from "@/lib/stats/metrics";
import { formatDeltaPercent } from "@/lib/stats/format";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  /** 포맷 완료된 표시 값 (예: "1,482", "2분 34초") */
  value: string;
  /** calcChange() 결과 (0.231 = +23.1%). null=신규, undefined=증감 미표시 */
  change?: number | null;
  /** change 대신 직접 표기할 델타 문자열 (예: "▼ 4.5%p") + tone 지정 */
  changeText?: string;
  changeToneOverride?: "good" | "bad" | "neutral";
  /** 역방향 지표 키 ("bounceRate", "cpc", "cpl" 등) */
  metricKey?: string;
  /** 비교 기간 설명 (예: "vs 이전 30일 (1,204)") */
  previousLabel?: string;
  /** 스파크라인 데이터 (선택, 8~14 포인트 권장) */
  spark?: number[];
  icon?: LucideIcon;
  hint?: string;
  loading?: boolean;
  className?: string;
}

const TONE_CLASS = {
  good: "text-delta-good",
  bad: "text-delta-bad",
  neutral: "text-muted-foreground",
} as const;

export function StatCard({
  title,
  value,
  change,
  changeText,
  changeToneOverride,
  metricKey,
  previousLabel,
  spark,
  icon: Icon,
  hint,
  loading,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  const tone =
    changeToneOverride ??
    (change !== undefined ? deltaTone(change ?? null, metricKey) : "neutral");
  const delta =
    changeText ?? (change !== undefined ? formatDeltaPercent(change) : null);

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground" title={hint}>
            {title}
            {hint ? " ⓘ" : ""}
          </span>
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="text-2xl font-semibold sm:text-3xl">{value}</div>
          {spark && spark.length >= 2 && <Sparkline values={spark} />}
        </div>
        {(delta || previousLabel) && (
          <div className="mt-1.5 text-xs">
            {delta && (
              <span className={cn("font-semibold tabular-nums", TONE_CLASS[tone])}>
                {delta}
              </span>
            )}{" "}
            {previousLabel && (
              <span className="text-muted-foreground">{previousLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => 2 + (i * (w - 4)) / (values.length - 1);
  const y = (v: number) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`);
  const last = values.length - 1;

  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline
        points={pts.slice(0, -1).join(" ")}
        fill="none"
        stroke="var(--chart-deemphasis)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <polyline
        points={pts.slice(-2).join(" ")}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle
        cx={x(last)}
        cy={y(values[last])}
        r={3}
        fill="var(--chart-1)"
        stroke="hsl(var(--card))"
        strokeWidth={2}
      />
    </svg>
  );
}
