"use client";

import { useState, useMemo, type CSSProperties } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Grid3x3,
  Users,
  Eye,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { DailyVisitorData } from "@/types/analytics";

interface VisitorHeatmapProps {
  daily: DailyVisitorData[];
  loading?: boolean;
}

type MetricType = "visitors" | "pageviews";
type ViewType = "calendar" | "minimap";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 순차 히트 램프 (var(--heat-0..6)) — 라이트/다크 모드에서 자동 반전
// 어두운 배경 단계는 밝은 끝(heat-0), 밝은 배경 단계는 어두운 끝(heat-6) 글자색으로 대비 확보
function getColor(value: number, max: number): CSSProperties {
  if (value <= 0 || max <= 0) {
    return {
      backgroundColor: "var(--heat-0)",
      color: "hsl(var(--muted-foreground))",
    };
  }
  const ratio = value / max;
  if (ratio > 0.75)
    return { backgroundColor: "var(--heat-6)", color: "var(--heat-0)" };
  if (ratio > 0.5)
    return { backgroundColor: "var(--heat-5)", color: "var(--heat-0)" };
  if (ratio > 0.25)
    return { backgroundColor: "var(--heat-3)", color: "var(--heat-6)" };
  return { backgroundColor: "var(--heat-1)", color: "var(--heat-6)" };
}

function getMinimapColor(value: number, max: number): CSSProperties {
  if (value <= 0 || max <= 0) return { backgroundColor: "var(--heat-0)" };
  const ratio = value / max;
  if (ratio > 0.75) return { backgroundColor: "var(--heat-6)" };
  if (ratio > 0.5) return { backgroundColor: "var(--heat-5)" };
  if (ratio > 0.25) return { backgroundColor: "var(--heat-3)" };
  return { backgroundColor: "var(--heat-1)" };
}

// =====================
// 캘린더 뷰 (월별 달력 + 실제 수치)
// =====================
function CalendarView({
  daily,
  dataMap,
  metric,
  maxValue,
}: {
  daily: DailyVisitorData[];
  dataMap: Map<string, DailyVisitorData>;
  metric: MetricType;
  maxValue: number;
}) {
  // 가장 최근 날짜 기준으로 현재 월 결정
  const sortedDates = useMemo(
    () => [...daily].sort((a, b) => b.date.localeCompare(a.date)),
    [daily],
  );
  const latestDate =
    sortedDates.length > 0
      ? sortedDates[0].date
      : new Date().toISOString().split("T")[0];
  const [currentYear, currentMonth] = latestDate.split("-").map(Number);

  const [viewYear, setViewYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(currentMonth);

  // 이전/다음 월
  const goToPrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goToNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // 해당 월의 캘린더 그리드 생성
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const lastDay = new Date(viewYear, viewMonth, 0);
    const startDayOfWeek = firstDay.getDay(); // 0=일, 6=토
    const daysInMonth = lastDay.getDate();

    const grid: Array<{
      day: number | null;
      date: string | null;
      data: DailyVisitorData | null;
    }> = [];

    // 빈 셀 (이전 월)
    for (let i = 0; i < startDayOfWeek; i++) {
      grid.push({ day: null, date: null, data: null });
    }

    // 해당 월 날짜
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      grid.push({
        day: d,
        date: dateStr,
        data: dataMap.get(dateStr) || null,
      });
    }

    return grid;
  }, [viewYear, viewMonth, dataMap]);

  // 해당 월 합계
  const monthSummary = useMemo(() => {
    const monthPrefix = `${viewYear}-${String(viewMonth).padStart(2, "0")}`;
    const monthData = daily.filter((d) => d.date.startsWith(monthPrefix));
    return {
      visitors: monthData.reduce((sum, d) => sum + d.visitors, 0),
      pageviews: monthData.reduce((sum, d) => sum + d.pageviews, 0),
      days: monthData.length,
    };
  }, [daily, viewYear, viewMonth]);

  const isToday = (dateStr: string) =>
    dateStr === new Date().toISOString().split("T")[0];

  return (
    <div>
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="sm" onClick={goToPrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <span className="font-semibold text-lg">
            {viewYear}년 {viewMonth}월
          </span>
          <div className="text-xs text-muted-foreground mt-0.5">
            {metric === "visitors" ? "방문자" : "페이지뷰"} 합계:{" "}
            <strong>
              {metric === "visitors"
                ? monthSummary.visitors.toLocaleString()
                : monthSummary.pageviews.toLocaleString()}
            </strong>
            {monthSummary.days > 0 && (
              <span className="ml-2">
                일평균:{" "}
                {Math.round(
                  (metric === "visitors"
                    ? monthSummary.visitors
                    : monthSummary.pageviews) / monthSummary.days,
                ).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={goToNextMonth}
          disabled={
            viewYear > currentYear ||
            (viewYear === currentYear && viewMonth >= currentMonth)
          }
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`text-center text-xs font-medium py-1 ${
              i === 0
                ? "text-red-400"
                : i === 6
                  ? "text-blue-400"
                  : "text-muted-foreground"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 캘린더 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarGrid.map((cell, idx) => {
          if (cell.day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const value = cell.data
            ? metric === "visitors"
              ? cell.data.visitors
              : cell.data.pageviews
            : 0;
          const cellStyle = getColor(value, maxValue);
          const dayOfWeek = idx % 7;
          const today = cell.date ? isToday(cell.date) : false;

          return (
            <div
              key={cell.date}
              style={cellStyle}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-transform hover:scale-105 cursor-default ${
                today ? "ring-2 ring-orange-400 ring-offset-1" : ""
              }`}
              title={
                cell.date
                  ? `${cell.date}: 방문자 ${cell.data?.visitors.toLocaleString() || 0} / 페이지뷰 ${cell.data?.pageviews.toLocaleString() || 0}`
                  : ""
              }
            >
              <span
                className={`text-[10px] leading-none ${
                  dayOfWeek === 0
                    ? "text-red-400"
                    : dayOfWeek === 6
                      ? "text-blue-400"
                      : ""
                } ${value > 0 ? "opacity-70" : "opacity-50"}`}
              >
                {cell.day}
              </span>
              {value > 0 && (
                <span className="text-xs font-bold leading-tight mt-0.5">
                  {value >= 1000
                    ? `${(value / 1000).toFixed(1)}k`
                    : value.toLocaleString()}
                </span>
              )}
              {cell.data && (
                <span className="text-[9px] leading-none opacity-60 mt-0.5 hidden md:block">
                  {metric === "visitors"
                    ? `PV ${cell.data.pageviews}`
                    : `UV ${cell.data.visitors}`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
        <span>적음</span>
        <div className="flex gap-0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const v = ratio === 0 ? 0 : Math.ceil(maxValue * ratio);
            return (
              <div
                key={ratio}
                className="w-[14px] h-[14px] rounded-[2px]"
                style={getColor(v, maxValue)}
              />
            );
          })}
        </div>
        <span>많음</span>
      </div>
    </div>
  );
}

// =====================
// 미니맵 뷰 (GitHub 스타일)
// =====================
function MinimapView({
  daily,
  dataMap,
  metric,
}: {
  daily: DailyVisitorData[];
  dataMap: Map<string, DailyVisitorData>;
  metric: MetricType;
}) {
  const { weeks, maxValue, monthLabels } = useMemo(() => {
    if (daily.length === 0) return { weeks: [], maxValue: 0, monthLabels: [] };

    const sortedDates = [...daily].sort((a, b) => b.date.localeCompare(a.date));
    const endDate = new Date(sortedDates[0].date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 83);

    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const weeksArr: Array<
      Array<{ date: string; value: number; dayOfWeek: number }>
    > = [];
    let currentWeek: Array<{
      date: string;
      value: number;
      dayOfWeek: number;
    }> = [];
    let mv = 0;
    const mLabels: Array<{ weekIndex: number; label: string }> = [];
    let lastMonth = "";
    const current = new Date(startDate);
    let weekIdx = 0;

    while (current <= endDate) {
      const dateStr = current.toISOString().split("T")[0];
      const data = dataMap.get(dateStr);
      const value = data
        ? metric === "visitors"
          ? data.visitors
          : data.pageviews
        : 0;
      if (value > mv) mv = value;

      const monthKey = dateStr.substring(0, 7);
      if (monthKey !== lastMonth) {
        const [, m] = monthKey.split("-");
        mLabels.push({ weekIndex: weekIdx, label: `${parseInt(m)}월` });
        lastMonth = monthKey;
      }

      currentWeek.push({ date: dateStr, value, dayOfWeek: current.getDay() });
      if (current.getDay() === 6) {
        weeksArr.push(currentWeek);
        currentWeek = [];
        weekIdx++;
      }
      current.setDate(current.getDate() + 1);
    }
    if (currentWeek.length > 0) weeksArr.push(currentWeek);

    return { weeks: weeksArr, maxValue: mv, monthLabels: mLabels };
  }, [daily, dataMap, metric]);

  return (
    <div className="overflow-x-auto">
      {/* 월 레이블 */}
      <div className="flex mb-1 ml-8">
        {monthLabels.map((ml, i) => (
          <div
            key={i}
            className="text-xs text-muted-foreground"
            style={{
              position: "relative",
              left: `${ml.weekIndex * 18}px`,
              marginRight:
                i < monthLabels.length - 1
                  ? `${((monthLabels[i + 1]?.weekIndex || 0) - ml.weekIndex) * 18 - 30}px`
                  : 0,
            }}
          >
            {ml.label}
          </div>
        ))}
      </div>

      <div className="flex gap-0.5">
        {/* 요일 레이블 */}
        <div className="flex flex-col gap-0.5 mr-1">
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="h-[16px] text-[10px] text-muted-foreground flex items-center justify-end pr-1"
              style={{ width: "24px" }}
            >
              {i % 2 === 1 ? label : ""}
            </div>
          ))}
        </div>

        {/* 히트맵 그리드 */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {Array.from({ length: 7 }, (_, di) => {
              const cell = week.find((c) => c.dayOfWeek === di);
              if (!cell) return <div key={di} className="w-[16px] h-[16px]" />;
              const cellStyle = getMinimapColor(cell.value, maxValue);
              const dateFormatted = cell.date.slice(5).replace("-", "/");
              return (
                <div
                  key={di}
                  style={cellStyle}
                  className="w-[16px] h-[16px] rounded-[3px] cursor-default transition-transform hover:scale-125"
                  title={`${dateFormatted}: ${metric === "visitors" ? "방문자" : "페이지뷰"} ${cell.value.toLocaleString()}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
        <span>적음</span>
        <div className="flex gap-0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const v = ratio === 0 ? 0 : Math.ceil(maxValue * ratio);
            return (
              <div
                key={ratio}
                className="w-[14px] h-[14px] rounded-[2px]"
                style={getMinimapColor(v, maxValue)}
              />
            );
          })}
        </div>
        <span>많음</span>
        <span className="ml-2 text-muted-foreground">
          최대: {maxValue.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

// =====================
// 메인 컴포넌트
// =====================
export function VisitorHeatmap({ daily, loading }: VisitorHeatmapProps) {
  const [metric, setMetric] = useState<MetricType>("visitors");
  const [view, setView] = useState<ViewType>("calendar");

  const dataMap = useMemo(() => {
    const map = new Map<string, DailyVisitorData>();
    daily.forEach((d) => map.set(d.date, d));
    return map;
  }, [daily]);

  const maxValue = useMemo(() => {
    if (daily.length === 0) return 0;
    return Math.max(
      ...daily.map((d) => (metric === "visitors" ? d.visitors : d.pageviews)),
    );
  }, [daily, metric]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3x3 className="h-5 w-5" />
            방문 히트맵
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (daily.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3x3 className="h-5 w-5" />
            방문 히트맵
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            데이터가 없습니다.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Grid3x3 className="h-5 w-5" />
            방문 히트맵
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* 뷰 토글 */}
            <div className="flex rounded-md border p-0.5">
              <Button
                variant={view === "calendar" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("calendar")}
                className="h-7 px-2"
              >
                <CalendarDays className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">캘린더</span>
              </Button>
              <Button
                variant={view === "minimap" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("minimap")}
                className="h-7 px-2"
              >
                <Grid3x3 className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">미니맵</span>
              </Button>
            </div>
            {/* 메트릭 토글 */}
            <div className="flex rounded-md border p-0.5">
              <Button
                variant={metric === "visitors" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMetric("visitors")}
                className="h-7 px-2"
              >
                <Users className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">방문자</span>
              </Button>
              <Button
                variant={metric === "pageviews" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMetric("pageviews")}
                className="h-7 px-2"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">페이지뷰</span>
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {view === "calendar" ? (
          <CalendarView
            daily={daily}
            dataMap={dataMap}
            metric={metric}
            maxValue={maxValue}
          />
        ) : (
          <MinimapView daily={daily} dataMap={dataMap} metric={metric} />
        )}
      </CardContent>
    </Card>
  );
}
