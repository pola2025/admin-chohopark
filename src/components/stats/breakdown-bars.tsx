"use client";

/**
 * 표준 분해(breakdown) 가로 막대 — 엔티티 고정 색 + 직접 라벨(값·비중·증감)
 *
 * 규칙:
 * - 막대 두께 ≤ 24px (기본 16px), 데이터 끝만 둥글게
 * - 값·비중 라벨 항상 표시 (대비 3:1 미만 색상의 relief rule)
 * - 기본은 단일색(크기 비교) — 카테고리 색은 entityMap/color를 명시한 경우만
 *   (시리즈가 주제일 때만 categorical, 그 외 무지개식 배색 금지)
 * - 색은 entityMap 우선 — 정렬이 바뀌어도 같은 엔티티는 같은 색
 */

import { seriesColor } from "./colors";
import { formatNumber } from "@/lib/stats/format";
import { formatDeltaPercent } from "@/lib/stats/format";
import { deltaTone } from "@/lib/stats/metrics";
import { cn } from "@/lib/utils";

export interface BreakdownItem {
  name: string;
  value: number;
  /** calcChange() 결과 — 전기 대비 (선택) */
  change?: number | null;
  color?: string;
}

interface BreakdownBarsProps {
  items: BreakdownItem[];
  /** 비중(%) 계산 기준 합계 — 생략 시 items 합 */
  total?: number;
  /** 엔티티 고정 색 매핑 (CHANNEL_COLORS 등) */
  entityMap?: Record<string, string>;
  valueFormatter?: (v: number) => string;
  /** 역방향 지표면 metricKey 전달 */
  metricKey?: string;
  className?: string;
}

const TONE_CLASS = {
  good: "text-delta-good",
  bad: "text-delta-bad",
  neutral: "text-muted-foreground",
} as const;

export function BreakdownBars({
  items,
  total,
  entityMap,
  valueFormatter = formatNumber,
  metricKey,
  className,
}: BreakdownBarsProps) {
  if (items.length === 0) {
    return (
      <p className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
        데이터 없음
      </p>
    );
  }

  const sum = total ?? items.reduce((a, b) => a + b.value, 0);
  const max = Math.max(...items.map((i) => i.value), 1);
  const hasChange = items.some((i) => i.change !== undefined);

  return (
    <div className={cn("space-y-3", className)}>
      {items.map((item, idx) => {
        const share = sum > 0 ? (item.value / sum) * 100 : 0;
        const tone = deltaTone(item.change ?? null, metricKey);
        return (
          <div
            key={item.name}
            className="flex items-center gap-3 text-sm"
            title={`${item.name} ${valueFormatter(item.value)} (${share.toFixed(1)}%)`}
          >
            <span className="w-20 shrink-0 truncate text-muted-foreground">
              {item.name}
            </span>
            <div className="h-4 flex-1">
              <div
                className="h-4 rounded-r"
                style={{
                  width: `${(item.value / max) * 100}%`,
                  background:
                    item.color ??
                    (entityMap
                      ? seriesColor(item.name, idx, entityMap)
                      : "var(--chart-1)"),
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-medium tabular-nums">
              {valueFormatter(item.value)}
            </span>
            <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
              {share.toFixed(1)}%
            </span>
            {hasChange && (
              <span
                className={cn(
                  "w-16 shrink-0 text-right text-xs tabular-nums",
                  TONE_CLASS[tone],
                )}
              >
                {item.change !== undefined ? formatDeltaPercent(item.change) : ""}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
