"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeriodFilter, TrendChart } from "@/components/stats";
import { VisitorPeriodTable } from "@/components/dashboard/visitor-period-table";
import { VisitorHeatmap } from "@/components/dashboard/visitor-heatmap";
import {
  BotTrafficCard,
  type BotStats,
} from "@/components/dashboard/analytics/bot-traffic-card";
import {
  TrafficDetailTabs,
  type TrafficDetailData,
} from "@/components/dashboard/analytics/traffic-detail-tabs";
import {
  InquiryOps,
  InquiryPatterns,
  OverviewKpis,
} from "@/components/dashboard/analytics/overview-sections";
import {
  ChannelTable,
  TopPages,
} from "@/components/dashboard/analytics/inflow-sections";
import { useDateRange } from "@/hooks/use-date-range";
import { daysBetween, kstToday } from "@/lib/stats/date-range";
import { formatNumber } from "@/lib/stats/format";
import type { AnalyticsOverview } from "@/lib/analytics-overview";
import type { AggregatedVisitorData } from "@/types/analytics";

const EMPTY_DETAIL: TrafficDetailData = {
  pages: [],
  devices: [],
  browsers: [],
  regions: [],
  hourlyTraffic: [],
};

/** 응답이 정상일 때만 JSON, 아니면 null (401·429 등은 화면에 안내) */
async function getJson<T>(
  url: string,
  signal: AbortSignal,
): Promise<{ data: T | null; status: number }> {
  const r = await fetch(url, { signal, cache: "no-store" });
  return { data: r.ok ? ((await r.json()) as T) : null, status: r.status };
}

export default function AnalyticsPage() {
  const dr = useDateRange("30d");
  const { startDate, endDate } = dr.range;
  // GA4 스냅샷·봇·누적 표는 「오늘부터 거꾸로 N일」 API 라서 시작일까지 덮는 일수로 부른다
  const legacyDays = Math.min(365, daysBetween(startDate, kstToday()));

  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<TrafficDetailData>(EMPTY_DETAIL);
  const [detailLoading, setDetailLoading] = useState(true);
  const [aggregated, setAggregated] = useState<AggregatedVisitorData | null>(
    null,
  );
  const [aggregatedLoading, setAggregatedLoading] = useState(true);
  const [botStats, setBotStats] = useState<BotStats | null>(null);

  // 통합 조회 (기간이 바뀔 때만 호출 — 폴링 없음)
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    getJson<AnalyticsOverview>(
      `/api/analytics/overview?start=${startDate}&end=${endDate}`,
      ctrl.signal,
    )
      .then(({ data, status }) => {
        setOverview(data);
        if (!data)
          setError(
            status === 401
              ? "로그인이 만료되었습니다. 다시 로그인해 주세요."
              : status === 429
                ? "조회가 너무 잦습니다. 잠시 후 다시 시도해 주세요."
                : "통계를 불러오지 못했습니다.",
          );
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setError("통계를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [startDate, endDate]);

  // 기존 유지 구역 (GA4 스냅샷 · 누적 · 봇)
  useEffect(() => {
    const ctrl = new AbortController();
    setDetailLoading(true);
    setAggregatedLoading(true);
    Promise.allSettled([
      getJson<TrafficDetailData>(
        `/api/analytics/visitors?days=${legacyDays}`,
        ctrl.signal,
      ).then(({ data }) => data && setDetail({ ...EMPTY_DETAIL, ...data })),
      getJson<AggregatedVisitorData>(
        `/api/analytics/aggregated?days=${Math.max(90, legacyDays)}`,
        ctrl.signal,
      ).then(({ data }) => data && setAggregated(data)),
      getJson<BotStats>(
        `/api/analytics/bot-stats?days=${legacyDays}`,
        ctrl.signal,
      ).then(({ data }) => data && setBotStats(data)),
    ]).finally(() => {
      if (ctrl.signal.aborted) return;
      setDetailLoading(false);
      setAggregatedLoading(false);
    });
    return () => ctrl.abort();
  }, [legacyDays]);

  const trend = useMemo(
    () =>
      (overview?.daily || []).map((d) => ({
        date: d.date,
        current: d.sessions,
        previous: d.ga4Visitors,
      })),
    [overview],
  );

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        방문이 어디서 들어와 문의로 이어졌는지 확인합니다. 숫자 옆 표시는 데이터
        출처입니다.
      </p>

      <PeriodFilter control={dr} showCompare={false} />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <OverviewKpis data={overview} loading={loading} />

      <InquiryOps data={overview} loading={loading} />

      <ChannelTable data={overview} loading={loading} />

      <TopPages data={overview} loading={loading} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">일별 방문 추이</CardTitle>
          <CardDescription>
            자체측정 방문(세션)과 GA4 방문자
            {overview?.self.since
              ? ` · 자체측정은 ${overview.self.since}부터`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 animate-pulse rounded bg-muted" />
          ) : trend.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              데이터가 없습니다.
            </div>
          ) : (
            <TrendChart
              data={trend}
              currentLabel="자체측정 방문"
              previousLabel="GA4 방문자"
              valueFormatter={formatNumber}
            />
          )}
        </CardContent>
      </Card>

      <InquiryPatterns data={overview} loading={loading} />

      <VisitorHeatmap
        daily={aggregated?.daily || []}
        loading={aggregatedLoading}
      />

      <TrafficDetailTabs data={detail} loading={detailLoading} />

      <BotTrafficCard stats={botStats} />

      <VisitorPeriodTable
        daily={aggregated?.daily || []}
        weekly={aggregated?.weekly || []}
        monthly={aggregated?.monthly || []}
        summary={aggregated?.summary}
        loading={aggregatedLoading}
      />
    </div>
  );
}
