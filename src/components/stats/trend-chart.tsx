"use client";

/**
 * 표준 트렌드 차트 — 현재 기간(accent) + 이전 기간(de-emphasis) 오버레이 + 이상치 마커
 *
 * 규칙:
 * - 단일 y축만 사용 (이중축 금지 — 스케일 다른 두 지표는 차트 분리)
 * - 이전 기간은 항상 회색 (emphasis 패턴), 2개 시리즈 이상이면 범례 필수
 * - 이상치 마커: 8px + 카드색 2px 링 (detectOutliers 결과의 date 전달)
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDateShort, formatNumber } from "@/lib/stats/format";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  current: number;
  previous?: number | null;
}

interface TrendChartProps {
  data: TrendPoint[];
  currentLabel?: string;
  previousLabel?: string;
  /** 이상치 날짜 목록 (YYYY-MM-DD) — 마커 표시 */
  anomalies?: string[];
  valueFormatter?: (v: number) => string;
  className?: string;
}

export function TrendChart({
  data,
  currentLabel = "현재 기간",
  previousLabel = "이전 기간",
  anomalies = [],
  valueFormatter = formatNumber,
  className,
}: TrendChartProps) {
  const hasPrevious = data.some((d) => d.previous != null);

  const config: ChartConfig = {
    current: { label: currentLabel, color: "var(--chart-1)" },
    ...(hasPrevious
      ? { previous: { label: previousLabel, color: "var(--chart-deemphasis)" } }
      : {}),
  };

  const anomalySet = new Set(anomalies);
  const anomalyPoints = data.filter((d) => anomalySet.has(d.date));

  return (
    <div className={className}>
      {hasPrevious && (
        <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{ background: "var(--chart-1)" }}
            />
            {currentLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded"
              style={{ background: "var(--chart-deemphasis)" }}
            />
            {previousLabel}
          </span>
          {anomalyPoints.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: "var(--status-warning)" }}
              />
              이상치
            </span>
          )}
        </div>
      )}
      <ChartContainer config={config} className="h-64 w-full">
        <LineChart
          data={data}
          margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="hsl(var(--border))"
            strokeWidth={1}
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickFormatter={formatDateShort}
            tick={{ fontSize: 11 }}
            minTickGap={32}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label: string) =>
                  formatDateShort(String(label))
                }
                formatter={(value, name, item) => (
                  <span className="flex w-full items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: item?.color }}
                    />
                    {config[name as string]?.label ?? name}
                    <b className="ml-auto pl-3 tabular-nums">
                      {valueFormatter(Number(value))}
                    </b>
                  </span>
                )}
              />
            }
          />
          {hasPrevious && (
            <Line
              dataKey="previous"
              type="monotone"
              stroke="var(--color-previous)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            dataKey="current"
            type="monotone"
            stroke="var(--color-current)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {anomalyPoints.map((p) => (
            <ReferenceDot
              key={p.date}
              x={p.date}
              y={p.current}
              r={5}
              fill="var(--status-warning)"
              stroke="hsl(var(--card))"
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}
