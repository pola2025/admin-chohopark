"use client";

/**
 * 표준 기간 필터 — 모든 통계 페이지 공통 (useDateRange 훅과 세트)
 * 프리셋 버튼 + 사용자 지정 날짜 + "이전 기간과 비교" 토글
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UseDateRange } from "@/hooks/use-date-range";
import { formatDateRange } from "@/lib/stats/format";
import { PERIOD_PRESETS } from "@/lib/stats/date-range";
import { cn } from "@/lib/utils";

interface PeriodFilterProps {
  control: UseDateRange;
  /** 비교 토글 노출 여부 (기본 true) */
  showCompare?: boolean;
  className?: string;
}

export function PeriodFilter({
  control,
  showCompare = true,
  className,
}: PeriodFilterProps) {
  const { preset, setPreset, range, compare, setCompare } = control;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border bg-card p-1">
          {PERIOD_PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={preset === p.key ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => setPreset(p.key)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        {showCompare && (
          <Button
            variant={compare ? "secondary" : "outline"}
            size="sm"
            className="h-9 text-xs"
            onClick={() => setCompare(!compare)}
          >
            {compare ? "✓ " : ""}이전 기간과 비교
          </Button>
        )}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={control.customStart}
            onChange={(e) => control.setCustom(e.target.value, control.customEnd)}
            className="h-8 w-38 text-xs"
          />
          <span className="text-xs text-muted-foreground">~</span>
          <Input
            type="date"
            value={control.customEnd}
            onChange={(e) => control.setCustom(control.customStart, e.target.value)}
            className="h-8 w-38 text-xs"
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {formatDateRange(range.startDate, range.endDate)} ({range.days}일)
        {compare && (
          <span>
            {" · 비교: "}
            {formatDateRange(range.prevStartDate, range.prevEndDate)}
          </span>
        )}
      </p>
    </div>
  );
}
