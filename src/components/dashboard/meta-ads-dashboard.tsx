"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatCard, TrendChart } from "@/components/stats";
import { formatCurrency, formatNumber } from "@/lib/stats/format";
import type { MetaAdsDashboard, MetaAdsMetrics } from "@/types/meta-ads";

const DEFAULT_CAMPAIGN_ID = "120250878150770043";
const ADS_MANAGER_URL =
  "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=639564975420619&business_id=644810374029513";

type MetaAdsDashboardViewProps = {
  initialData: MetaAdsDashboard;
  days: number;
  campaign: string;
};

function formatKstDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatMetric(
  hasData: boolean,
  value: number,
  kind: "number" | "usd" = "number",
): string {
  if (!hasData) return "—";
  return kind === "usd" ? formatCurrency(value, "USD") : formatNumber(value);
}

function campaignStatus(status: string, effectiveStatus: string): string {
  const value = (effectiveStatus || status).toUpperCase();
  if (value === "ACTIVE") return "진행 중";
  if (value === "PAUSED") return "일시 중지";
  if (value === "ARCHIVED") return "보관됨";
  if (value === "DELETED") return "삭제됨";
  return value || "—";
}

function mergeRows(
  current: MetaAdsDashboard["rows"],
  incoming: MetaAdsDashboard["rows"],
): MetaAdsDashboard["rows"] {
  const seen = new Set<string>();
  return [...current, ...incoming].filter((row) => {
    const key = `${row.date}:${row.campaignId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function syncTone(sync: MetaAdsDashboard["sync"]): {
  label: string;
  className: string;
} {
  const status = sync.status.toLowerCase();
  if (status.includes("error") || status.includes("fail")) {
    return { label: "수집 오류", className: "bg-[var(--gov-danger-weak)] text-[var(--gov-danger)]" };
  }
  if (status.includes("hold") || status.includes("pause")) {
    return { label: "수집 보류", className: "bg-[var(--gov-warn-weak)] text-[var(--gov-warn)]" };
  }
  if (sync.stale) {
    return { label: "갱신 지연", className: "bg-[var(--gov-warn-weak)] text-[var(--gov-warn)]" };
  }
  if (!sync.lastSuccessAt || !sync.hasData) {
    return { label: "수집 대기", className: "bg-[var(--gov-brand-weak)] text-[var(--gov-brand)]" };
  }
  return { label: "최근 수집 완료", className: "bg-[var(--gov-ok-weak)] text-[var(--gov-ok)]" };
}

export function MetaAdsDashboardView({
  initialData,
  days,
  campaign,
}: MetaAdsDashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    requestRef.current?.abort();
    setData(initialData);
    setRequestError(null);
    setIsRefreshing(false);
    setIsLoadingMore(false);
  }, [initialData]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
    },
    [],
  );

  const campaignOptions = useMemo(() => {
    const byId = new Map<string, string>([
      [DEFAULT_CAMPAIGN_ID, "이번 프로모션"],
      ...data.campaigns.map((item): [string, string] => [item.id, item.name]),
    ]);
    if (campaign !== "all" && !byId.has(campaign)) {
      byId.set(
        campaign,
        campaign === DEFAULT_CAMPAIGN_ID ? "이번 프로모션" : `캠페인 ${campaign}`,
      );
    }
    return [...byId.entries()];
  }, [campaign, data.campaigns]);

  const hasData = data.sync.hasData;
  const tone = syncTone(data.sync);
  const visibleCampaigns = data.range.campaignId
    ? data.campaigns.filter((item) => item.id === data.range.campaignId)
    : data.campaigns;

  const changeFilter = (key: "days" | "campaign", value: string) => {
    requestRef.current?.abort();
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    next.delete("cursor");
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  };

  const requestDashboard = async (cursor?: string) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const params = new URLSearchParams({ days: String(days), campaign });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`/api/meta-ads?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("저장된 광고 데이터를 불러오지 못했습니다.");
    return (await response.json()) as MetaAdsDashboard;
  };

  const refresh = async () => {
    setIsRefreshing(true);
    setRequestError(null);
    try {
      setData(await requestDashboard());
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setRequestError(
          error instanceof Error ? error.message : "데이터를 불러오지 못했습니다.",
        );
      }
    } finally {
      if (!requestRef.current?.signal.aborted) setIsRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!data.nextCursor) return;
    setIsLoadingMore(true);
    setRequestError(null);
    try {
      const next = await requestDashboard(data.nextCursor);
      setData((current) => ({
        ...current,
        rows: mergeRows(current.rows, next.rows.slice(0, 31)),
        nextCursor:
          next.nextCursor && next.nextCursor !== current.nextCursor
            ? next.nextCursor
            : null,
      }));
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setRequestError(
          error instanceof Error ? error.message : "다음 데이터를 불러오지 못했습니다.",
        );
      }
    } finally {
      if (!requestRef.current?.signal.aborted) setIsLoadingMore(false);
    }
  };

  const summary: MetaAdsMetrics = data.summary;

  return (
    <div className="min-w-0 space-y-5">
      <section className="flex flex-col gap-4 border border-[var(--gov-line)] bg-white p-4 sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-[18px] font-bold">Meta 광고 현황</h2>
          <p className="mt-1 text-[13px] leading-6 text-[var(--gov-ink-sub)]">
            저장된 Meta 광고 성과를 읽기 전용으로 확인합니다. 광고 수정이나 집행은 이 화면에서 할 수 없습니다.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[var(--gov-ink-sub)]">
            <span className={`inline-flex px-2 py-1 font-medium ${tone.className}`}>{tone.label}</span>
            <span>마지막 정상 수집 {formatKstDateTime(data.sync.lastSuccessAt)} KST</span>
          </div>
        </div>
        <a
          href={ADS_MANAGER_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 shrink-0 items-center justify-center border border-[var(--gov-line-strong)] bg-white px-3 text-[13px] font-medium text-[var(--gov-brand)] hover:bg-[var(--gov-brand-weak)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gov-brand)]"
        >
          Meta 광고 관리자 열기
        </a>
      </section>

      <section className="grid gap-3 border border-[var(--gov-line)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-[160px_minmax(220px,1fr)_auto] lg:items-end">
        <label className="grid gap-1.5 text-[12px] font-semibold text-[var(--gov-ink-sub)]">
          기간
          <select
            value={String(days)}
            onChange={(event) => changeFilter("days", event.target.value)}
            disabled={isNavigating}
            className="h-9 w-full border border-[var(--gov-line-strong)] bg-white px-3 text-[13px] font-normal text-[var(--gov-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gov-brand)]"
          >
            <option value="7">최근 7일</option>
            <option value="30">최근 30일</option>
            <option value="90">최근 90일</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-[12px] font-semibold text-[var(--gov-ink-sub)]">
          캠페인
          <select
            value={campaign}
            onChange={(event) => changeFilter("campaign", event.target.value)}
            disabled={isNavigating}
            className="h-9 w-full min-w-0 border border-[var(--gov-line-strong)] bg-white px-3 text-[13px] font-normal text-[var(--gov-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gov-brand)]"
          >
            <option value="all">전체 캠페인</option>
            {campaignOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          disabled={isNavigating || isRefreshing || isLoadingMore}
          className="h-9 sm:col-span-2 lg:col-span-1"
        >
          <Icon name="refresh" size={16} />
          {isRefreshing ? "불러오는 중" : "저장된 데이터 새로고침"}
        </Button>
      </section>

      {(requestError || data.sync.stale || tone.label === "수집 오류" || tone.label === "수집 보류") && (
        <Alert className={requestError || tone.label === "수집 오류" ? "border-[var(--gov-danger)] bg-[var(--gov-danger-weak)]" : "border-[var(--gov-warn)] bg-[var(--gov-warn-weak)]"}>
          <Icon name="alert" size={16} />
          <AlertTitle>{requestError ? "조회 오류" : tone.label}</AlertTitle>
          <AlertDescription>
            {requestError ?? "마지막 정상 수집 시점의 저장된 데이터를 표시하고 있습니다."}
          </AlertDescription>
        </Alert>
      )}

      {!hasData && (
        <Alert>
          <AlertTitle>표시할 실제 광고 데이터가 없습니다</AlertTitle>
          <AlertDescription>
            저장된 데이터가 확인되면 이 화면에 지표와 표가 표시됩니다. 값이 없는 항목은 0이 아닌 —로 표시합니다.
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="meta-kpi-heading">
        <h2 id="meta-kpi-heading" className="sr-only">주요 광고 지표</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard title="사용액" value={formatMetric(hasData, summary.spendUsd, "usd")} previousLabel={`조회 기간 ${data.range.start} ~ ${data.range.end}`} />
          <StatCard title="노출" value={formatMetric(hasData, summary.impressions)} previousLabel="Meta 보고 수치" />
          <StatCard title="링크 클릭" value={formatMetric(hasData, summary.linkClicks)} previousLabel={hasData && summary.linkCtr != null ? `링크 클릭률 ${summary.linkCtr.toFixed(2)}%` : "링크 클릭 기준"} />
          <StatCard title="랜딩 페이지 조회" value={formatMetric(hasData, summary.landingPageViews)} previousLabel="Meta 보고 수치" />
          <StatCard title="Meta 웹사이트 문의 전환" value={formatMetric(hasData, summary.websiteLeads)} previousLabel="실제 문의 접수 건수와 같다고 단정할 수 없음" hint="Meta의 귀속 기준으로 집계된 웹사이트 문의 전환입니다." />
          <StatCard title="전환당 비용" value={hasData && summary.costPerLeadUsd != null ? formatCurrency(summary.costPerLeadUsd, "USD") : "—"} previousLabel="Meta 웹사이트 문의 전환 기준" metricKey="cpl" />
        </div>
      </section>

      <Alert className="border-[var(--gov-line-strong)] bg-[var(--gov-brand-weak)]">
        <AlertDescription>
          오늘 수치는 아직 확정되지 않을 수 있습니다. 전환은 Meta의 7일 클릭 귀속 기준이며, 초호쉼터 관리자에 실제 접수된 문의 건수와 동일한 값으로 보지 않습니다.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="px-4 sm:px-5">
          <CardTitle className="text-[14px]">사용액 일별 추이</CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-5">
          {hasData && data.daily.length === 1 ? (
            <div className="flex h-64 items-center justify-center text-center">
              <div>
                <span
                  className="inline-block h-3 w-3 rounded-full bg-[var(--chart-1)] ring-4 ring-[var(--gov-brand-weak)]"
                  aria-hidden="true"
                />
                <p className="mt-3 text-[18px] font-semibold tabular-nums">
                  {formatCurrency(data.daily[0].spendUsd, "USD")}
                </p>
                <p className="mt-1 text-[12px] text-[var(--gov-ink-sub)]">
                  {data.daily[0].date} · 단일 일자 사용액
                </p>
              </div>
            </div>
          ) : hasData && data.daily.length > 1 ? (
            <TrendChart
              data={[...data.daily]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((item) => ({ date: item.date, current: item.spendUsd }))}
              currentLabel="사용액"
              valueFormatter={(value) => formatCurrency(value, "USD")}
            />
          ) : (
            <p className="py-12 text-center text-[13px] text-[var(--gov-ink-sub)]">—</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 sm:px-5">
          <CardTitle className="text-[14px]">캠페인 요약</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="max-w-full overflow-x-auto" tabIndex={0} aria-label="캠페인 요약 표, 가로로 스크롤할 수 있습니다">
            <table className="w-full min-w-[920px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-y border-[var(--gov-line-strong)] bg-gray-50 text-left">
                  <th className="px-5 py-2.5 font-semibold">캠페인</th>
                  <th className="px-3 py-2.5 font-semibold">상태</th>
                  <th className="px-3 py-2.5 text-right font-semibold">사용액</th>
                  <th className="px-3 py-2.5 text-right font-semibold">노출</th>
                  <th className="px-3 py-2.5 text-right font-semibold">링크 클릭</th>
                  <th className="px-3 py-2.5 text-right font-semibold">랜딩 조회</th>
                  <th className="px-3 py-2.5 text-right font-semibold">문의 전환</th>
                  <th className="px-5 py-2.5 text-right font-semibold">전환당 비용</th>
                </tr>
              </thead>
              <tbody>
                {hasData && visibleCampaigns.length > 0 ? visibleCampaigns.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--gov-line)]">
                    <td className="max-w-[260px] px-5 py-3 font-medium">{item.name}</td>
                    <td className="px-3 py-3">{campaignStatus(item.status, item.effectiveStatus)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(item.metrics.spendUsd, "USD")}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(item.metrics.impressions)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(item.metrics.linkClicks)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(item.metrics.landingPageViews)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(item.metrics.websiteLeads)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{item.metrics.costPerLeadUsd == null ? "—" : formatCurrency(item.metrics.costPerLeadUsd, "USD")}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-[var(--gov-ink-sub)]">—</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 sm:px-5">
          <CardTitle className="text-[14px]">일별 상세</CardTitle>
          <p className="text-[12px] leading-5 text-[var(--gov-ink-sub)]">일별 도달은 사람 기준 중복 제거 지표이므로 여러 날짜를 더해 전체 도달로 사용하지 않습니다.</p>
        </CardHeader>
        <CardContent className="px-0">
          <div className="max-w-full overflow-x-auto" tabIndex={0} aria-label="일별 상세 표, 가로로 스크롤할 수 있습니다">
            <table className="w-full min-w-[1060px] border-collapse text-[12.5px]">
              <thead>
                <tr className="border-y border-[var(--gov-line-strong)] bg-gray-50 text-left">
                  <th className="px-5 py-2.5 font-semibold">날짜</th>
                  <th className="px-3 py-2.5 font-semibold">캠페인</th>
                  <th className="px-3 py-2.5 text-right font-semibold">사용액</th>
                  <th className="px-3 py-2.5 text-right font-semibold">일별 도달</th>
                  <th className="px-3 py-2.5 text-right font-semibold">노출</th>
                  <th className="px-3 py-2.5 text-right font-semibold">링크 클릭</th>
                  <th className="px-3 py-2.5 text-right font-semibold">랜딩 조회</th>
                  <th className="px-5 py-2.5 text-right font-semibold">문의 전환</th>
                </tr>
              </thead>
              <tbody>
                {hasData && data.rows.length > 0 ? data.rows.map((item) => (
                  <tr key={`${item.date}:${item.campaignId}`} className="border-b border-[var(--gov-line)]">
                    <td className="whitespace-nowrap px-5 py-3">{item.date}</td>
                    <td className="max-w-[260px] px-3 py-3 font-medium">{item.campaignName}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(item.spendUsd, "USD")}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(item.dailyReach)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(item.impressions)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(item.linkClicks)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatNumber(item.landingPageViews)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatNumber(item.websiteLeads)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-[var(--gov-ink-sub)]">—</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {data.nextCursor && (
            <div className="border-t border-[var(--gov-line)] p-4 text-center">
              <Button type="button" variant="outline" onClick={loadMore} disabled={isLoadingMore || isRefreshing}>
                {isLoadingMore ? "불러오는 중" : "일별 데이터 더보기"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
