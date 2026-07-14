"use client";

/**
 * 자체측정(단순 터치) 섹션 — visit_events 기반, GA4 미포함 1초 미만 이탈 포함
 * /api/analytics/touches 응답을 표준 컴포넌트(StatCard·BreakdownBars)로 렌더
 */

import { Calendar, Eye, TrendingUp, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BreakdownBars, CHANNEL_COLORS, StatCard } from "@/components/stats";
import { formatDateShort, formatNumber, formatPercent } from "@/lib/stats/format";
import { safeDiv } from "@/lib/stats/metrics";

export interface TouchesData {
  range: { days: number; startDate: string };
  overview: {
    totalTouches: number;
    uniqueVisitors: number;
    newVisitors: number;
    returningVisitors: number;
    botTouches: number;
    humanTouches: number;
    dayCount: number;
  };
  daily: Array<{
    date: string;
    touches: number;
    uniqueVisitors: number;
    newVisitors: number;
  }>;
  topPaths: Array<{ path: string; touches: number; uniqueVisitors: number }>;
  sources: Array<{ utmSource: string; touches: number }>;
}

interface TouchesSectionProps {
  data: TouchesData | null;
  loading: boolean;
}

export function TouchesSection({ data, loading }: TouchesSectionProps) {
  const ov = data?.overview;
  const dayAvg =
    ov && ov.dayCount > 0 ? Math.round(ov.humanTouches / ov.dayCount) : 0;
  const newPct =
    ov && ov.uniqueVisitors > 0
      ? (safeDiv(ov.newVisitors, ov.uniqueVisitors) ?? 0) * 100
      : null;
  const returnPct =
    ov && ov.uniqueVisitors > 0
      ? (safeDiv(ov.returningVisitors, ov.uniqueVisitors) ?? 0) * 100
      : null;

  const empty = !loading && (!data || data.overview.totalTouches === 0);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          자체측정 (단순 터치){" "}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            GA4 미포함 — 1초 미만 이탈도 카운트
          </span>
        </h2>
        {data && (
          <span className="text-xs text-muted-foreground">
            {formatDateShort(data.range.startDate)} ~ 오늘 · {data.range.days}일
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <StatCard key={i} title="" value="" loading />
          ))
        ) : empty ? (
          <Card className="md:col-span-2 lg:col-span-4">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              아직 자체측정 데이터가 없습니다. 폴라애드 홈페이지에 트래커 JS가
              배포되면 즉시 수집됩니다.
            </CardContent>
          </Card>
        ) : (
          ov && (
            <>
              <StatCard
                title="총 터치 수"
                value={formatNumber(ov.humanTouches)}
                previousLabel={
                  dayAvg > 0 ? `봇 제외 · 일평균 ${formatNumber(dayAvg)}` : "봇 제외"
                }
                icon={Eye}
              />
              <StatCard
                title="순 방문자 (30일 쿠키)"
                value={formatNumber(ov.uniqueVisitors)}
                previousLabel="visitor_id 기준"
                icon={Users}
              />
              <StatCard
                title="신규"
                value={formatNumber(ov.newVisitors)}
                previousLabel={
                  newPct != null
                    ? `순 방문자의 ${formatPercent(newPct, 0)}`
                    : undefined
                }
                icon={TrendingUp}
              />
              <StatCard
                title="재방문"
                value={formatNumber(ov.returningVisitors)}
                previousLabel={
                  returnPct != null
                    ? `순 방문자의 ${formatPercent(returnPct, 0)}`
                    : undefined
                }
                icon={Calendar}
              />
            </>
          )
        )}
      </div>

      {data && data.topPaths.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">인기 페이지 TOP 10</CardTitle>
              <CardDescription>자체측정 (봇 제외)</CardDescription>
            </CardHeader>
            <CardContent>
              <BreakdownBars
                items={data.topPaths.map((p) => ({
                  name: p.path || "(empty)",
                  value: p.touches,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">유입 소스 TOP 10</CardTitle>
              <CardDescription>UTM source 기준</CardDescription>
            </CardHeader>
            <CardContent>
              <BreakdownBars
                items={data.sources.map((s) => ({
                  name: s.utmSource,
                  value: s.touches,
                }))}
                entityMap={CHANNEL_COLORS}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
