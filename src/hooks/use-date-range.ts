"use client";

/**
 * 통계 페이지 표준 기간 필터 훅 — PeriodFilter 컴포넌트와 세트
 *
 * 사용:
 *   const dr = useDateRange("30d");
 *   fetch(`/api/...?${dr.query}`)  // start/end 표준 파라미터
 *   dr.range.days                  // legacy ?days= API용
 */

import { useMemo, useState } from "react";
import {
  type PeriodPreset,
  type ResolvedRange,
  rangeToQuery,
  resolveRange,
} from "@/lib/stats/date-range";

export interface UseDateRange {
  preset: PeriodPreset;
  setPreset: (p: PeriodPreset) => void;
  customStart: string;
  customEnd: string;
  setCustom: (start: string, end: string) => void;
  compare: boolean;
  setCompare: (v: boolean) => void;
  range: ResolvedRange;
  /** "start=...&end=...&preset=..." */
  query: string;
}

export function useDateRange(
  initialPreset: PeriodPreset = "30d",
): UseDateRange {
  const [preset, setPreset] = useState<PeriodPreset>(initialPreset);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [compare, setCompare] = useState(true);

  const range = useMemo(
    () =>
      resolveRange(
        preset,
        preset === "custom" ? { start: customStart, end: customEnd } : undefined,
      ),
    [preset, customStart, customEnd],
  );

  const query = useMemo(() => rangeToQuery(range).toString(), [range]);

  return {
    preset,
    setPreset,
    customStart,
    customEnd,
    setCustom: (start: string, end: string) => {
      setCustomStart(start);
      setCustomEnd(end);
      setPreset("custom");
    },
    compare,
    setCompare,
    range,
    query,
  };
}
