"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Download,
  Eye,
  Handshake,
  Loader2,
  MessageSquare,
  Timer,
  TrendingDown,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  InsightBriefing,
  PeriodFilter,
  StatCard,
  TrendChart,
} from "@/components/stats";
import { VisitorPeriodTable } from "@/components/dashboard/visitor-period-table";
import { VisitorHeatmap } from "@/components/dashboard/visitor-heatmap";
import {
  TouchesSection,
  type TouchesData,
} from "@/components/dashboard/analytics/touches-section";
import {
  BotTrafficCard,
  type BotStats,
} from "@/components/dashboard/analytics/bot-traffic-card";
import { TrafficDetailTabs } from "@/components/dashboard/analytics/traffic-detail-tabs";
import { useDateRange } from "@/hooks/use-date-range";
import {
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
} from "@/lib/stats/format";
import { avg, safeDiv, stddev } from "@/lib/stats/metrics";
import {
  collectInsights,
  detectOutliers,
  detectSpike,
  detectStaleness,
} from "@/lib/insights";
import type { AggregatedVisitorData } from "@/types/analytics";

interface VisitorData {
  overview: {
    totalVisitors: number;
    uniqueVisitors: number;
    pageViews: number;
    avgSessionDuration: string;
    bounceRate: number;
    newVisitors: number;
    returningVisitors: number;
    changes: {
      visitors: number;
      pageViews: number;
      bounceRate: number;
      avgSessionDuration: number;
    };
  };
  daily: Array<{
    date: string;
    visitors: number;
    pageviews: number;
    sessions: number;
  }>;
  regions: Array<{ region: string; visitors: number; percentage: number }>;
  pages: Array<{
    path: string;
    title: string;
    views: number;
    uniqueViews: number;
    avgTime: string;
    bounceRate: number;
  }>;
  devices: Array<{ device: string; visitors: number; percentage: number }>;
  browsers: Array<{ browser: string; visitors: number; percentage: number }>;
  hourlyTraffic: Array<{ hour: string; visitors: number }>;
}

const EMPTY_DATA: VisitorData = {
  overview: {
    totalVisitors: 0,
    uniqueVisitors: 0,
    pageViews: 0,
    avgSessionDuration: "0분 0초",
    bounceRate: 0,
    newVisitors: 0,
    returningVisitors: 0,
    changes: { visitors: 0, pageViews: 0, bounceRate: 0, avgSessionDuration: 0 },
  },
  daily: [],
  regions: [],
  pages: [],
  devices: [],
  browsers: [],
  hourlyTraffic: [],
};

/**
 * visitors API는 증감을 퍼센트(percent)로만 주고 이전 절대값은 주지 않으므로,
 * 현재값 + 증감률로 이전 기간 절대값을 역산한다 (비교 라벨·급변 감지 근거용).
 */
function prevFromChange(current: number, changePct: number): number {
  const r = changePct / 100;
  if (r <= -1) return 0;
  return current / (1 + r);
}

export default function AnalyticsPage() {
  const dr = useDateRange("7d");
  const days = dr.range.days;

  const [visitorData, setVisitorData] = useState<VisitorData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [aggregatedData, setAggregatedData] =
    useState<AggregatedVisitorData | null>(null);
  const [aggregatedLoading, setAggregatedLoading] = useState(true);
  const [inquiryStats, setInquiryStats] = useState<{
    total: number;
    contractCount: number;
    totalRevenue: number;
  } | null>(null);
  const [botStats, setBotStats] = useState<BotStats | null>(null);
  const [touchesData, setTouchesData] = useState<TouchesData | null>(null);
  const [touchesLoading, setTouchesLoading] = useState(true);

  // 방문 통계 (GA4 스냅샷)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/analytics/visitors?days=${days}`);
        const data = r.ok ? await r.json() : null;
        if (alive && data) setVisitorData(data);
      } catch (e) {
        console.error("Failed to fetch visitor data:", e);
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [days]);

  // 누적(일/주/월) 데이터 — 차트·스파크라인·신선도의 원천 (YYYY-MM-DD)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      setAggregatedLoading(true);
      try {
        const r = await fetch(`/api/analytics/aggregated?days=${days}`);
        const data = r.ok ? await r.json() : null;
        if (alive && data) setAggregatedData(data);
      } catch (e) {
        console.error("Failed to fetch aggregated data:", e);
      } finally {
        if (alive) setAggregatedLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [days]);

  // 문의/계약/매출 (전체 조회 후 기간 필터)
  useEffect(() => {
    let alive = true;
    interface InquiryItem {
      createdAt: string;
      status?: string;
      contractAmount?: number;
    }
    const run = async () => {
      const cutoff = new Date(Date.now() - days * 86400000);
      try {
        const r = await fetch("/api/inquiries");
        const data = r.ok ? await r.json() : null;
        if (!alive || !data?.inquiries) return;
        const filtered = (data.inquiries as InquiryItem[]).filter(
          (i) => new Date(i.createdAt) >= cutoff,
        );
        const contracts = filtered.filter((i) => i.status === "계약완료");
        setInquiryStats({
          total: filtered.length,
          contractCount: contracts.length,
          totalRevenue: contracts.reduce(
            (sum, i) => sum + (i.contractAmount || 0),
            0,
          ),
        });
      } catch {
        /* noop */
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [days]);

  // 봇 통계
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const r = await fetch(`/api/analytics/bot-stats?days=${days}`);
        const data = r.ok ? await r.json() : null;
        if (alive && data) setBotStats(data);
      } catch (e) {
        console.error("Failed to fetch bot stats:", e);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [days]);

  // 자체측정 (단순 터치)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      setTouchesLoading(true);
      try {
        const r = await fetch(`/api/analytics/touches?days=${days}`);
        const data = r.ok ? await r.json() : null;
        if (alive && data && !data.error) setTouchesData(data);
      } catch (e) {
        console.error("Failed to fetch touches data:", e);
      } finally {
        if (alive) setTouchesLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [days]);

  const ov = visitorData.overview;

  // 누적 daily는 최신순(DESC) — 차트/스파크라인용으로 오름차순 정렬
  const dailyAsc = useMemo(
    () =>
      aggregatedData?.daily
        ? [...aggregatedData.daily].sort((a, b) =>
            a.date.localeCompare(b.date),
          )
        : [],
    [aggregatedData],
  );

  const durationSecs = aggregatedData?.summary?.avg_session_duration ?? 0;
  const durationValue =
    durationSecs > 0 ? formatDuration(durationSecs) : ov.avgSessionDuration;

  // 이상치 날짜 (평균 ± 2σ) — TrendChart 마커용
  const anomalyDates = useMemo(() => {
    const vals = dailyAsc.map((d) => d.visitors);
    const m = avg(vals);
    const sd = stddev(vals);
    if (m == null || sd == null || sd === 0 || vals.length < 7) return [];
    return dailyAsc
      .filter((d) => Math.abs(d.visitors - m) > 2 * sd)
      .map((d) => d.date);
  }, [dailyAsc]);

  // 규칙 기반 인사이트
  const insights = useMemo(() => {
    if (loading || aggregatedLoading) return [];
    return collectInsights([
      detectSpike({
        label: "방문자",
        current: ov.totalVisitors,
        previous: prevFromChange(ov.totalVisitors, ov.changes.visitors),
        format: formatNumber,
      }),
      detectSpike({
        label: "페이지뷰",
        current: ov.pageViews,
        previous: prevFromChange(ov.pageViews, ov.changes.pageViews),
        format: formatNumber,
      }),
      detectSpike({
        label: "평균 체류시간",
        current: durationSecs,
        previous: prevFromChange(durationSecs, ov.changes.avgSessionDuration),
        format: formatDuration,
      }),
      detectSpike({
        label: "이탈률",
        metricKey: "bounceRate",
        current: ov.bounceRate,
        previous: prevFromChange(ov.bounceRate, ov.changes.bounceRate),
        format: (v) => formatPercent(v),
      }),
      ...detectOutliers({
        label: "방문",
        series: dailyAsc.map((d) => ({ date: d.date, value: d.visitors })),
      }),
      detectStaleness({
        sourceLabel: "GA4 스냅샷",
        lastDate: aggregatedData?.daily?.[0]?.date ?? null,
      }),
    ]);
  }, [loading, aggregatedLoading, ov, durationSecs, dailyAsc, aggregatedData]);

  const totalTyped = ov.newVisitors + ov.returningVisitors;
  const newPct = (safeDiv(ov.newVisitors, totalTyped) ?? 0) * 100;
  const returnPct = (safeDiv(ov.returningVisitors, totalTyped) ?? 0) * 100;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">방문 통계</h1>
          <p className="text-muted-foreground">
            사이트 트래픽과 방문자 행동을 분석합니다.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-9">
          <Download className="mr-2 h-4 w-4" />
          내보내기
        </Button>
      </div>

      {/* 기간 필터 */}
      <PeriodFilter control={dr} showCompare={false} />

      {/* 데이터 없음 알림 */}
      {!loading && ov.totalVisitors === 0 && (
        <Alert>
          <Loader2 className="h-4 w-4" />
          <AlertDescription>
            데이터 수집 준비 중입니다. GA4 API가 연결되면 실제 데이터가
            표시됩니다.
          </AlertDescription>
        </Alert>
      )}

      {/* 인사이트 브리핑 */}
      <InsightBriefing insights={insights} loading={loading || aggregatedLoading} />

      {/* 주요 지표 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="총 방문자"
          value={formatNumber(ov.totalVisitors)}
          change={ov.changes.visitors / 100}
          previousLabel={`vs 이전 ${days}일 (${formatNumber(prevFromChange(ov.totalVisitors, ov.changes.visitors))})`}
          spark={dailyAsc.map((d) => d.visitors).slice(-14)}
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="페이지뷰"
          value={formatNumber(ov.pageViews)}
          change={ov.changes.pageViews / 100}
          previousLabel={`vs 이전 ${days}일 (${formatNumber(prevFromChange(ov.pageViews, ov.changes.pageViews))})`}
          spark={dailyAsc.map((d) => d.pageviews).slice(-14)}
          icon={Eye}
          loading={loading}
        />
        <StatCard
          title="평균 체류시간"
          value={durationValue}
          change={ov.changes.avgSessionDuration / 100}
          previousLabel={`vs 이전 ${days}일 (${formatDuration(prevFromChange(durationSecs, ov.changes.avgSessionDuration))})`}
          spark={dailyAsc.map((d) => d.avgDuration).slice(-14)}
          icon={Timer}
          loading={loading}
        />
        <StatCard
          title="이탈률"
          value={formatPercent(ov.bounceRate)}
          change={ov.changes.bounceRate / 100}
          metricKey="bounceRate"
          previousLabel={`vs 이전 ${days}일 (${formatPercent(prevFromChange(ov.bounceRate, ov.changes.bounceRate))})`}
          spark={dailyAsc.map((d) => d.bounceRate).slice(-14)}
          icon={TrendingDown}
          loading={loading}
        />
      </div>

      {/* 일별 방문자 추이 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">일별 방문자 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {aggregatedLoading ? (
            <div className="h-64 animate-pulse rounded bg-muted" />
          ) : dailyAsc.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              데이터가 없습니다.
            </div>
          ) : (
            <TrendChart
              data={dailyAsc.map((d) => ({ date: d.date, current: d.visitors }))}
              currentLabel="방문자"
              anomalies={anomalyDates}
              valueFormatter={formatNumber}
            />
          )}
        </CardContent>
      </Card>

      {/* 자체측정 (단순 터치) */}
      <TouchesSection data={touchesData} loading={touchesLoading} />

      {/* 전환 퍼널: 문의 → 계약 → 매출 */}
      {inquiryStats && (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="문의 접수"
            value={`${formatNumber(inquiryStats.total)}건`}
            previousLabel={
              ov.totalVisitors > 0
                ? `방문 대비 전환율 ${formatPercent((safeDiv(inquiryStats.total, ov.totalVisitors) ?? 0) * 100)}`
                : "전체 문의 접수"
            }
            icon={MessageSquare}
          />
          <StatCard
            title="계약"
            value={`${formatNumber(inquiryStats.contractCount)}건`}
            previousLabel={
              inquiryStats.total > 0
                ? `계약률 ${formatPercent((safeDiv(inquiryStats.contractCount, inquiryStats.total) ?? 0) * 100)}`
                : "계약 완료"
            }
            icon={Handshake}
          />
          <StatCard
            title="매출"
            value={formatCurrency(inquiryStats.totalRevenue, "KRW")}
            previousLabel={
              inquiryStats.contractCount > 0 && inquiryStats.totalRevenue > 0
                ? `건당 ${formatCurrency(inquiryStats.totalRevenue / inquiryStats.contractCount, "KRW")}`
                : "계약 매출 합계"
            }
            icon={Banknote}
          />
        </div>
      )}

      {/* 방문자 유형 */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="신규 방문자"
          value={formatNumber(ov.newVisitors)}
          previousLabel={`전체의 ${formatPercent(newPct)}`}
          loading={loading}
        />
        <StatCard
          title="재방문자"
          value={formatNumber(ov.returningVisitors)}
          previousLabel={`전체의 ${formatPercent(returnPct)}`}
          loading={loading}
        />
        <StatCard
          title="고유 방문자"
          value={formatNumber(ov.uniqueVisitors)}
          previousLabel="중복 제외"
          loading={loading}
        />
      </div>

      {/* 봇 트래픽 */}
      <BotTrafficCard stats={botStats} />

      {/* 날짜별 히트맵 */}
      <VisitorHeatmap
        daily={aggregatedData?.daily || []}
        loading={aggregatedLoading}
      />

      {/* 상세 탭 (페이지/기기/지역/시간대) */}
      <TrafficDetailTabs data={visitorData} loading={loading} />

      {/* 누적 데이터 (일/주/월) */}
      <VisitorPeriodTable
        daily={aggregatedData?.daily || []}
        weekly={aggregatedData?.weekly || []}
        monthly={aggregatedData?.monthly || []}
        summary={aggregatedData?.summary}
        loading={aggregatedLoading}
      />
    </div>
  );
}
