"use client";

/**
 * 표준 도넛 차트 — 세그먼트 간 카드색 갭 + 중앙 합계 + 값 포함 범례
 *
 * 규칙:
 * - 세그먼트 분리는 stroke(카드색)로 — 테두리 장식 금지
 * - 범례에 값·비중 직접 표기 (색만으로 식별 금지)
 * - 슬라이스 7개 초과 금지 — 초과분은 호출부에서 "기타"로 접기
 */

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { seriesColor } from "./colors";
import { formatNumber } from "@/lib/stats/format";
import { cn } from "@/lib/utils";

export interface DonutItem {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  items: DonutItem[];
  centerLabel?: string;
  entityMap?: Record<string, string>;
  valueFormatter?: (v: number) => string;
  /** 범례 아래 붙일 보조 노트 (예: 임계값 경고) */
  footnote?: React.ReactNode;
  className?: string;
}

export function DonutChart({
  items,
  centerLabel = "합계",
  entityMap,
  valueFormatter = formatNumber,
  footnote,
  className,
}: DonutChartProps) {
  const total = items.reduce((a, b) => a + b.value, 0);

  if (items.length === 0 || total === 0) {
    return (
      <p className={cn("py-6 text-center text-sm text-muted-foreground", className)}>
        데이터 없음
      </p>
    );
  }

  return (
    <div className={cn("flex items-center gap-6", className)}>
      <div className="relative h-38 w-38 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="hsl(var(--card))"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {items.map((item, idx) => (
                <Cell
                  key={item.name}
                  fill={item.color ?? seriesColor(item.name, idx, entityMap)}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-xl font-semibold tabular-nums">
            {valueFormatter(total)}
          </div>
          <div className="text-[10px] text-muted-foreground">{centerLabel}</div>
        </div>
      </div>
      <div className="w-full space-y-2.5 text-sm">
        {items.map((item, idx) => (
          <div key={item.name} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{
                background: item.color ?? seriesColor(item.name, idx, entityMap),
              }}
            />
            <span className="truncate">{item.name}</span>
            <span className="ml-auto font-medium tabular-nums">
              {valueFormatter(item.value)}
            </span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
              {((item.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
        {footnote && (
          <div className="border-t pt-2 text-xs text-muted-foreground">
            {footnote}
          </div>
        )}
      </div>
    </div>
  );
}
