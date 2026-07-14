"use client";

/**
 * 표준 히트맵 — sequential 단일 색상 램프 (무지개 금지)
 *
 * 규칙:
 * - 강도는 --heat-0 ~ --heat-6 7단계 (라이트: 어두움=많음 / 다크: 밝음=많음, 토큰이 처리)
 * - 셀 호버 시 값 툴팁 (title)
 * - 범례(적음→많음) 항상 표시
 */

import { cn } from "@/lib/utils";

const RAMP = [
  "var(--heat-0)",
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
  "var(--heat-5)",
  "var(--heat-6)",
];

interface HeatmapProps {
  /** 행 라벨 (예: ["월","화",...]) */
  rows: string[];
  /** 열 라벨 (예: ["0","1",...,"23"]) */
  cols: string[];
  /** values[rowIdx][colIdx] */
  values: number[][];
  /** 열 라벨 표시 간격 (기본 3 — 0,3,6,...) */
  colLabelEvery?: number;
  /** 툴팁 단위 라벨 (예: "명") */
  unit?: string;
  className?: string;
}

export function Heatmap({
  rows,
  cols,
  values,
  colLabelEvery = 3,
  unit = "",
  className,
}: HeatmapProps) {
  const flat = values.flat().filter((v) => Number.isFinite(v));
  const max = Math.max(...flat, 1);

  const level = (v: number) => {
    if (v <= 0) return 0;
    return Math.min(6, 1 + Math.floor((v / max) * 5.999));
  };

  return (
    <div className={className}>
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `28px repeat(${cols.length}, 1fr)` }}
      >
        <div />
        {cols.map((c, i) => (
          <div
            key={c}
            className="text-center text-[9px] text-muted-foreground tabular-nums"
          >
            {i % colLabelEvery === 0 ? c : ""}
          </div>
        ))}
        {rows.map((row, ri) => (
          <RowCells
            key={row}
            row={row}
            cols={cols}
            values={values[ri] ?? []}
            level={level}
            unit={unit}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        적음
        {RAMP.map((c) => (
          <span key={c} className="h-3 w-3 rounded-sm" style={{ background: c }} />
        ))}
        많음
      </div>
    </div>
  );
}

function RowCells({
  row,
  cols,
  values,
  level,
  unit,
}: {
  row: string;
  cols: string[];
  values: number[];
  level: (v: number) => number;
  unit: string;
}) {
  return (
    <>
      <div className="flex items-center text-[10px] text-muted-foreground">
        {row}
      </div>
      {cols.map((col, ci) => {
        const v = values[ci] ?? 0;
        return (
          <div
            key={col}
            className={cn(
              "aspect-square w-full rounded-[2px]",
              "hover:outline hover:outline-2 hover:outline-offset-1 hover:outline-foreground",
            )}
            style={{ background: RAMP[level(v)] }}
            title={`${row} ${col}시 · ${v.toLocaleString("ko-KR")}${unit}`}
          />
        );
      })}
    </>
  );
}
