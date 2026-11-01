"use client";

/**
 * Meta 광고 유입 분석 — Meta 집계(지출·노출·클릭) 옆에 사이트가 직접 센 도착·견적 화면·실제 문의를 붙인다.
 * 데이터: /api/meta-ads/inflow (관리자 인증 · 60초 캐시). 기간/캠페인을 바꿀 때만 조회한다.
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PeriodFilter } from "@/components/stats";
import {
  SourceBadge,
  type SourceKind,
} from "@/components/dashboard/analytics/overview-sections";
import { useDateRange } from "@/hooks/use-date-range";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
} from "@/lib/stats/format";
import type { MetaInflow, MetaInflowCampaign } from "@/lib/meta-inflow";
import { cn } from "@/lib/utils";

const ADS_MANAGER_URL =
  "https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=639564975420619&business_id=644810374029513";
const usd = (v: number) => formatCurrency(v, "USD");
const div = (a: number, b: number) => (b > 0 ? a / b : null);

const OBJECTIVE: Record<string, string> = {
  OUTCOME_LEADS: "잠재고객",
  OUTCOME_TRAFFIC: "트래픽",
  OUTCOME_SALES: "판매",
  OUTCOME_ENGAGEMENT: "참여",
  OUTCOME_AWARENESS: "인지도",
  OUTCOME_APP_PROMOTION: "앱 홍보",
};

function statusOf(c: MetaInflowCampaign): { label: string; className: string } {
  const v = (c.effectiveStatus || c.status).toUpperCase();
  if (v === "ACTIVE")
    return { label: "진행 중", className: "bg-green-100 text-green-800" };
  if (v === "PAUSED" || v === "CAMPAIGN_PAUSED")
    return { label: "일시 중지", className: "bg-muted text-muted-foreground" };
  if (v === "UNKNOWN")
    return { label: "수집 대상 밖", className: "bg-amber-100 text-amber-800" };
  return {
    label: v === "ARCHIVED" ? "보관됨" : v === "DELETED" ? "삭제됨" : v,
    className: "bg-muted text-muted-foreground",
  };
}

function kstTime(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function Kpi({
  kind,
  title,
  value,
  sub,
  ring,
}: {
  kind: SourceKind;
  title: string;
  value: string;
  sub?: string;
  ring?: string;
}) {
  return (
    <Card className={cn("gap-0 py-0", ring)}>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-1.5">
          <SourceBadge kind={kind} />
          <span className="text-xs text-muted-foreground">{title}</span>
        </div>
        <div className="text-2xl font-bold tabular-nums tracking-tight">
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Bar({
  value,
  max,
  color = "#2563eb",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
      <div
        className="h-full rounded"
        style={{
          width: `${max > 0 ? Math.max(1, (value / max) * 100) : 0}%`,
          background: color,
        }}
      />
    </div>
  );
}

type Grain = "day" | "week" | "month";
type DailyRow = MetaInflow["daily"][number];
type Totals = Omit<DailyRow, "date">;
type PeriodRow = Totals & {
  key: string;
  from: string;
  to: string;
  days: number;
  cumSpend: number;
};

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const dow = (ymd: string) => new Date(ymd + "T00:00:00Z").getUTCDay();
const md = (ymd: string) => ymd.slice(5).replace("-", "/");
const nextDay = (ymd: string) =>
  new Date(Date.parse(ymd + "T00:00:00Z") + 86_400_000)
    .toISOString()
    .slice(0, 10);

/** 날짜별 행을 일·주(월요일 시작)·월 단위로 묶는다. 최신 기간이 위로 온다. */
function groupDaily(daily: DailyRow[], grain: Grain): PeriodRow[] {
  const map = new Map<string, PeriodRow>();
  for (const d of daily) {
    const key =
      grain === "day"
        ? d.date
        : grain === "month"
          ? d.date.slice(0, 7)
          : new Date(
              Date.parse(d.date + "T00:00:00Z") -
                ((dow(d.date) + 6) % 7) * 86_400_000,
            )
              .toISOString()
              .slice(0, 10);
    let row = map.get(key);
    if (!row)
      map.set(
        key,
        (row = {
          key,
          from: d.date,
          to: d.date,
          days: 0,
          spend: 0,
          clicks: 0,
          impressions: 0,
          landingPageViews: 0,
          pixelLeads: 0,
          sessions: 0,
          reached: 0,
          inquiries: 0,
          cumSpend: 0,
        }),
      );
    row.to = d.date;
    row.days += 1;
    row.spend += d.spend;
    row.clicks += d.clicks;
    row.impressions += d.impressions;
    row.landingPageViews += d.landingPageViews;
    row.pixelLeads += d.pixelLeads;
    row.sessions += d.sessions;
    row.reached += d.reached;
    row.inquiries += d.inquiries;
  }
  const rows = [...map.values()];
  let cum = 0;
  for (const r of rows) r.cumSpend = cum += r.spend;
  return rows.reverse();
}

/** 주·월이 조회 기간에 잘려 일부만 들어가면 실제로 더한 날짜를 옆에 적는다 */
function periodLabel(
  r: PeriodRow,
  grain: Grain,
): { main: string; sub?: string } {
  if (grain === "day")
    return { main: `${md(r.from)} (${WEEKDAY[dow(r.from)]})` };
  if (grain === "week")
    return {
      main: `${md(r.from)} ~ ${md(r.to)}`,
      sub: r.days < 7 ? `${r.days}일` : undefined,
    };
  const whole = r.from.endsWith("-01") && nextDay(r.to).slice(0, 7) !== r.key;
  return {
    main: `${r.key.slice(0, 4)}년 ${Number(r.key.slice(5, 7))}월`,
    sub: whole ? undefined : `${md(r.from)} ~ ${md(r.to)}`,
  };
}

function periodCells(r: Totals): string[] {
  return [
    usd(r.spend),
    formatNumber(r.impressions),
    formatNumber(r.clicks),
    r.impressions > 0
      ? formatPercent((r.clicks / r.impressions) * 100, 2)
      : "–",
    r.clicks > 0 ? usd(r.spend / r.clicks) : "–",
    formatNumber(r.landingPageViews),
    formatNumber(r.sessions),
    formatNumber(r.reached),
    formatNumber(r.inquiries),
    r.inquiries > 0 ? usd(r.spend / r.inquiries) : "–",
  ];
}

const PERIOD_HEADS = [
  "지출",
  "노출",
  "링크 클릭",
  "클릭률",
  "클릭당",
  "랜딩 조회",
  "사이트 도착",
  "견적 화면",
  "실제 문의",
  "문의당",
  "누적 지출",
];
const INQUIRY_COL = PERIOD_HEADS.indexOf("실제 문의");

function PeriodTable({ daily }: { daily: DailyRow[] }) {
  const [grain, setGrain] = useState<Grain>("day");
  const rows = useMemo(() => groupDaily(daily, grain), [daily, grain]);
  const total = useMemo(
    () =>
      daily.reduce<Totals>(
        (a, d) => ({
          spend: a.spend + d.spend,
          clicks: a.clicks + d.clicks,
          impressions: a.impressions + d.impressions,
          landingPageViews: a.landingPageViews + d.landingPageViews,
          pixelLeads: a.pixelLeads + d.pixelLeads,
          sessions: a.sessions + d.sessions,
          reached: a.reached + d.reached,
          inquiries: a.inquiries + d.inquiries,
        }),
        {
          spend: 0,
          clicks: 0,
          impressions: 0,
          landingPageViews: 0,
          pixelLeads: 0,
          sessions: 0,
          reached: 0,
          inquiries: 0,
        },
      ),
    [daily],
  );
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-base">기간별 성과 내역</CardTitle>
          <CardDescription>
            최신 기간이 맨 위 · 주는 월요일 시작 · 누적 지출은 조회 기간
            첫날부터 더한 금액
          </CardDescription>
        </div>
        <Tabs value={grain} onValueChange={(v) => setGrain(v as Grain)}>
          <TabsList>
            <TabsTrigger value="day">일별</TabsTrigger>
            <TabsTrigger value="week">주별</TabsTrigger>
            <TabsTrigger value="month">월별</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">기간</TableHead>
              {PERIOD_HEADS.map((h) => (
                <TableHead key={h} className="whitespace-nowrap text-right">
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell className="whitespace-nowrap">
                합계
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {daily.length}일
                </span>
              </TableCell>
              {periodCells(total).map((v, i) => (
                <TableCell key={i} className="text-right tabular-nums">
                  {v}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">–</TableCell>
            </TableRow>
            {rows.map((r) => {
              const label = periodLabel(r, grain);
              const idle =
                r.spend === 0 && r.sessions === 0 && r.inquiries === 0;
              return (
                <TableRow
                  key={r.key}
                  className={cn(idle && "text-muted-foreground")}
                >
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {label.main}
                    {label.sub && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {label.sub}
                      </span>
                    )}
                    {idle && <span className="ml-1 text-xs">집행 없음</span>}
                  </TableCell>
                  {periodCells(r).map((v, i) => (
                    <TableCell
                      key={i}
                      className={cn(
                        "text-right tabular-nums",
                        i === INQUIRY_COL &&
                          r.inquiries > 0 &&
                          "font-semibold text-pink-700",
                      )}
                    >
                      {v}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {usd(r.cumSpend)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">
          지출·노출·클릭·랜딩 조회는 Meta 집계, 사이트 도착·견적 화면은 사이트가
          직접 센 방문, 실제 문의는 접수일 기준입니다. 집행 없는 날도 0으로
          남깁니다.
        </p>
      </CardContent>
    </Card>
  );
}

function CampaignCard({
  c,
  highlight,
}: {
  c: MetaInflowCampaign;
  highlight: boolean;
}) {
  const st = statusOf(c);
  const steps = [
    { label: "광고 노출", value: c.impressions },
    {
      label: "링크 클릭",
      value: c.clicks,
      note: c.landingPageViews
        ? `랜딩 조회 ${formatNumber(c.landingPageViews)}`
        : undefined,
    },
    {
      label: "사이트 도착",
      value: c.sessions,
      note:
        c.platforms
          .map((p) => `${p.label} ${formatNumber(p.sessions)}`)
          .join(" · ") || undefined,
    },
    { label: "상품·견적 화면", value: c.reached },
  ];
  return (
    <Card className={cn("gap-0 py-0", highlight && "ring-2 ring-blue-200")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              st.className,
            )}
          >
            {st.label}
          </span>
          <b className="break-all">{c.name}</b>
        </div>
        <p className="text-xs text-muted-foreground">
          {c.firstDate
            ? `${c.firstDate.slice(5).replace("-", "/")} ~ ${c.lastDate?.slice(5).replace("-", "/")} 집행`
            : "이 기간 집행 기록 없음"}
          {c.objective && ` · ${OBJECTIVE[c.objective] || c.objective} 목표`}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground">지출</div>
            <b className="tabular-nums">{usd(c.spend)}</b>
          </div>
          <div className="rounded bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground">클릭당</div>
            <b className="tabular-nums">
              {div(c.spend, c.clicks) == null ? "–" : usd(c.spend / c.clicks)}
            </b>
          </div>
          <div className="rounded bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground">문의당</div>
            <b className="tabular-nums">
              {c.inquiries > 0 ? usd(c.spend / c.inquiries) : "–"}
            </b>
          </div>
        </div>
        <div className="space-y-1.5 text-sm">
          {steps.map((s) => (
            <div key={s.label} className="flex justify-between gap-2">
              <span>
                {s.label}
                {s.note && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    {s.note}
                  </span>
                )}
              </span>
              <b className="tabular-nums">{formatNumber(s.value)}</b>
            </div>
          ))}
          <div className="flex justify-between gap-2 text-pink-700">
            <span>
              문의 접수
              {c.products.length > 0 && (
                <span className="ml-1 text-xs">
                  {c.products.map((p) => `${p.name} ${p.count}`).join(" · ")}
                </span>
              )}
            </span>
            <b className="tabular-nums">{c.inquiries}</b>
          </div>
          {c.pixelLeads > 0 && (
            <div className="text-xs text-muted-foreground">
              Meta 픽셀 집계 문의 {formatNumber(c.pixelLeads)}건 (7일 클릭 기준)
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MetaInflowDashboard({
  initialCampaign,
}: {
  initialCampaign: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const dr = useDateRange("30d");
  const { startDate, endDate } = dr.range;
  const [campaign, setCampaign] = useState(initialCampaign);
  const [data, setData] = useState<MetaInflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [options, setOptions] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    fetch(
      `/api/meta-ads/inflow?start=${startDate}&end=${endDate}&campaign=${campaign}`,
      { signal: ctrl.signal, cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) {
          setData(null);
          setError(
            r.status === 401
              ? "로그인이 만료되었습니다. 다시 로그인해 주세요."
              : r.status === 429
                ? "조회가 너무 잦습니다. 잠시 후 다시 시도해 주세요."
                : "광고 데이터를 불러오지 못했습니다.",
          );
          return;
        }
        const json = (await r.json()) as MetaInflow;
        setData(json);
        setOptions((prev) => {
          const next = new Map(prev);
          for (const c of json.campaigns)
            if (/^\d+$/.test(c.id)) next.set(c.id, c.name);
          return next;
        });
      })
      .catch((e) => {
        if (e?.name !== "AbortError")
          setError("광고 데이터를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [startDate, endDate, campaign]);

  const changeCampaign = (v: string) => {
    setCampaign(v);
    router.replace(v === "all" ? pathname : `${pathname}?campaign=${v}`, {
      scroll: false,
    });
  };

  const s = data?.summary;
  const dailyMax = useMemo(
    () => Math.max(0.01, ...(data?.daily || []).map((d) => d.spend)),
    [data],
  );
  const hourMax = Math.max(1, ...(data?.hours || [0]));
  const hourTop3 = [...(data?.hours || [])].sort((a, b) => b - a)[2] ?? 0;
  const ageMax = Math.max(1, ...(data?.age || []).map((a) => a.clicks));
  const genderTotal = (data?.gender || []).reduce((a, g) => a + g.clicks, 0);
  const videoBase = Math.max(1, s?.p25 || 0);
  const latestActive = data?.campaigns.find(
    (c) => (c.effectiveStatus || c.status).toUpperCase() === "ACTIVE",
  )?.id;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">
        광고 클릭이 실제 방문과 문의로 이어졌는지 캠페인별로 확인합니다.
      </p>

      {/* 수집 상태 */}
      <Card className="gap-0 py-0">
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                data?.sync.stale ? "bg-amber-500" : "bg-emerald-500",
              )}
            />
            최근 수집 {kstTime(data?.sync.lastSuccessAt || null)}
          </span>
          <span className="text-xs text-muted-foreground">
            1시간마다 · 최근 8일을 다시 집계
          </span>
          <span className="text-xs text-muted-foreground">
            수집 대상: 광고 계정 전체 캠페인{" "}
            {data ? `${data.sync.campaignsTracked}개` : ""}
          </span>
          <a
            href={ADS_MANAGER_URL}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-xs text-blue-700 hover:underline"
          >
            광고 관리자 열기 <ExternalLink className="h-3 w-3" />
          </a>
        </CardContent>
      </Card>
      {data && !data.sync.breakdownReady && (
        <Alert>
          <AlertDescription>
            게재면·연령·지역·소재 집계는 수집 확장이 반영된 뒤부터 표시됩니다.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PeriodFilter control={dr} showCompare={false} />
        <select
          value={campaign}
          onChange={(e) => changeCampaign(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
          aria-label="캠페인 선택"
        >
          <option value="all">전체 캠페인</option>
          {[...options].map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
          {campaign !== "all" && !options.has(campaign) && (
            <option value={campaign}>{campaign}</option>
          )}
        </select>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 지표 8칸 */}
      {loading || !s ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              kind="meta"
              title="지출"
              value={usd(s.spend)}
              sub={`하루 평균 ${usd(s.spend / Math.max(1, dr.range.days))}`}
            />
            <Kpi
              kind="meta"
              title="노출"
              value={formatNumber(s.impressions)}
              sub={
                s.impressions > 0
                  ? `1천 회당 ${usd((s.spend / s.impressions) * 1000)}`
                  : undefined
              }
            />
            <Kpi
              kind="meta"
              title="링크 클릭"
              value={formatNumber(s.clicks)}
              sub={
                s.impressions > 0
                  ? `클릭률 ${formatPercent((s.clicks / s.impressions) * 100, 2)} · 클릭당 ${s.clicks > 0 ? usd(s.spend / s.clicks) : "–"}`
                  : undefined
              }
            />
            <Kpi
              kind="meta"
              title="영상 끝까지 시청"
              value={formatNumber(s.p100)}
              sub={`15초 이상 시청 ${formatNumber(s.thruplays)}`}
            />
            <Kpi
              kind="self"
              title="사이트 도착"
              value={`${formatNumber(s.sessions)}명`}
              sub={
                s.clicks > 0
                  ? `클릭 대비 ${formatPercent((s.sessions / s.clicks) * 100, 0)}`
                  : undefined
              }
              ring="ring-1 ring-emerald-200"
            />
            <Kpi
              kind="self"
              title="상품·견적 화면 도달"
              value={`${formatNumber(s.reached)}명`}
              sub={
                s.sessions > 0
                  ? `도착의 ${formatPercent((s.reached / s.sessions) * 100)}`
                  : undefined
              }
              ring="ring-1 ring-emerald-200"
            />
            <Kpi
              kind="lead"
              title="실제 문의"
              value={`${formatNumber(s.inquiries)}건`}
              sub={`Meta 픽셀 집계 ${formatNumber(s.pixelLeads)}건`}
              ring="ring-1 ring-pink-200"
            />
            <Kpi
              kind="lead"
              title="문의당 비용"
              value={s.inquiries > 0 ? usd(s.spend / s.inquiries) : "–"}
              sub="지출 ÷ 실제 문의"
              ring="ring-1 ring-pink-200"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            위 4칸은 Meta 광고 관리자 숫자, 아래 4칸은 사이트가 직접 센 숫자와
            실제 접수입니다. 사이트 도착은 광고 꼬리표가 붙은 첫 방문만 셉니다.
          </p>
        </>
      )}

      {/* 캠페인 */}
      <section className="space-y-3">
        <h3 className="font-semibold">캠페인</h3>
        {loading || !data ? (
          <Skeleton className="h-64 w-full" />
        ) : data.campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              이 기간에는 집행된 캠페인이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                c={c}
                highlight={c.id === latestActive}
              />
            ))}
          </div>
        )}
      </section>

      {/* 소재별 효율 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">광고 소재별 효율</CardTitle>
          <CardDescription>
            지출 많은 순 · 사이트 도착은 주소의 광고 번호(ad_id) 기준, 없으면
            소재가 하나인 캠페인 도착으로 셉니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <Skeleton className="h-24 w-full" />
          ) : data.ads.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              소재 집계가 아직 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>소재</TableHead>
                    <TableHead className="text-right">지출</TableHead>
                    <TableHead className="text-right">노출</TableHead>
                    <TableHead className="text-right">클릭률</TableHead>
                    <TableHead className="text-right">클릭당</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      25% 시청
                    </TableHead>
                    <TableHead className="text-right">끝까지</TableHead>
                    <TableHead className="text-right whitespace-nowrap">
                      사이트 도착
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ads.map((a) => (
                    <TableRow key={a.adId}>
                      <TableCell>
                        <div className="font-medium">{a.name}</div>
                        {a.campaignName !== a.name && (
                          <div className="text-xs text-muted-foreground">
                            {a.campaignName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {usd(a.spend)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(a.impressions)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.impressions > 0
                          ? formatPercent((a.clicks / a.impressions) * 100, 2)
                          : "–"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {a.clicks > 0 ? usd(a.spend / a.clicks) : "–"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(a.p25)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(a.p100)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(a.sessions)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 일별 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            일별 지출·클릭·사이트 도착
          </CardTitle>
          <CardDescription>
            막대 = 지출 · 위 숫자 = 클릭 / 사이트 도착
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <Skeleton className="h-40 w-full" />
          ) : data.daily.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              이 기간에는 집행 기록이 없습니다.
            </p>
          ) : (
            <div className="flex h-44 items-end gap-1.5 overflow-x-auto pb-1">
              {data.daily.map((d) => (
                <div
                  key={d.date}
                  className="flex h-full min-w-[38px] flex-1 flex-col items-center justify-end"
                  title={`${d.date} 지출 ${usd(d.spend)} · 클릭 ${d.clicks} · 도착 ${d.sessions}`}
                >
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {d.clicks}/{d.sessions}
                  </span>
                  <div
                    className="w-3/4 rounded-t-sm bg-blue-400"
                    style={{
                      height: `${(d.spend / dailyMax) * 100}%`,
                      minHeight: d.spend > 0 ? 2 : 0,
                    }}
                  />
                  <span className="mt-1 text-[10px] text-muted-foreground">
                    {d.date.slice(5).replace("-", "/")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 기간별 내역 */}
      {loading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        data.daily.length > 0 && <PeriodTable daily={data.daily} />
      )}

      {/* 게재면 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">게재면별 효율</CardTitle>
          <CardDescription>
            Meta 지표와 사이트 도착·실제 문의를 플랫폼별로 나란히 표시
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              {data.placements.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>게재면</TableHead>
                        <TableHead className="text-right">지출</TableHead>
                        <TableHead className="text-right">노출</TableHead>
                        <TableHead className="text-right">클릭</TableHead>
                        <TableHead className="text-right">클릭률</TableHead>
                        <TableHead className="text-right">클릭당</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.placements.map((p) => (
                        <TableRow key={p.bucket}>
                          <TableCell>{p.label}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {usd(p.spend)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(p.impressions)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(p.clicks)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.impressions > 0
                              ? formatPercent(
                                  (p.clicks / p.impressions) * 100,
                                  2,
                                )
                              : "–"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.clicks > 0 ? usd(p.spend / p.clicks) : "–"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="grid gap-3 md:grid-cols-2">
                {data.platforms.map((p) => (
                  <div
                    key={p.label}
                    className="space-y-1 rounded-md bg-blue-50 p-3 text-sm"
                  >
                    <div className="flex justify-between">
                      <b>{p.label}</b>
                      <span className="tabular-nums">
                        {p.spend > 0 ? usd(p.spend) : "–"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        사이트 도착 {formatNumber(p.sessions)} · 문의{" "}
                        {p.inquiries}
                      </span>
                      <span>
                        문의당{" "}
                        {p.inquiries > 0 && p.spend > 0
                          ? usd(p.spend / p.inquiries)
                          : "–"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 타겟 분해 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">연령대</CardTitle>
            <CardDescription>클릭 · 지출</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(data?.age || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">집계 없음</p>
            ) : (
              data!.age.map((a) => (
                <div key={a.bucket} className="flex items-center gap-2 text-sm">
                  <span className="w-12">{a.bucket}</span>
                  <Bar
                    value={a.clicks}
                    max={ageMax}
                    color={a.clicks >= ageMax * 0.6 ? "#2563eb" : "#93c5fd"}
                  />
                  <span className="w-20 text-right tabular-nums">
                    {a.clicks}{" "}
                    <span className="text-xs text-muted-foreground">
                      {usd(a.spend)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">성별·지역</CardTitle>
            <CardDescription>클릭 · 지출</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {(data?.gender || []).map((g) => (
              <div key={g.bucket} className="space-y-1">
                <div className="flex justify-between">
                  <span>{g.label}</span>
                  <span className="tabular-nums">
                    {formatNumber(g.clicks)}{" "}
                    <span className="text-xs text-muted-foreground">
                      {genderTotal > 0
                        ? formatPercent((g.clicks / genderTotal) * 100, 0)
                        : ""}{" "}
                      · {usd(g.spend)}
                    </span>
                  </span>
                </div>
                <Bar
                  value={g.clicks}
                  max={genderTotal}
                  color={g.bucket === "female" ? "#ec4899" : "#2563eb"}
                />
              </div>
            ))}
            {(data?.region || []).length > 0 && <hr className="my-2" />}
            {(data?.region || []).map((r) => (
              <div key={r.bucket} className="flex justify-between">
                <span>{r.label}</span>
                <span className="tabular-nums">
                  {formatNumber(r.clicks)}{" "}
                  <span className="text-xs text-muted-foreground">
                    {usd(r.spend)}
                  </span>
                </span>
              </div>
            ))}
            {(data?.gender || []).length === 0 &&
              (data?.region || []).length === 0 && (
                <p className="text-muted-foreground">집계 없음</p>
              )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">영상 시청 깔때기</CardTitle>
            <CardDescription>소재 합계</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!s || s.p25 === 0 ? (
              <p className="text-muted-foreground">집계 없음</p>
            ) : (
              [
                { k: "25% 시청", v: s.p25 },
                { k: "50% 시청", v: s.p50 },
                { k: "75% 시청", v: s.p75 },
                { k: "끝까지 시청", v: s.p100 },
                { k: "15초 이상 시청", v: s.thruplays },
              ].map((x) => (
                <div key={x.k} className="space-y-1">
                  <div className="flex justify-between">
                    <span>{x.k}</span>
                    <span className="tabular-nums">{formatNumber(x.v)}</span>
                  </div>
                  <Bar value={x.v} max={videoBase} color="#6366f1" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* 시간대 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">시간대별 광고 클릭</CardTitle>
          <CardDescription>
            한국 시간 · 진한 막대는 상위 3개 시간대
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data || data.hours.every((h) => h === 0) ? (
            <p className="text-sm text-muted-foreground">집계 없음</p>
          ) : (
            <>
              <div className="flex h-28 items-end gap-[3px]">
                {data.hours.map((v, h) => (
                  <div
                    key={h}
                    title={`${h}시 클릭 ${v}`}
                    className="flex-1 rounded-t-sm"
                    style={{
                      height: `${Math.max(2, (v / hourMax) * 100)}%`,
                      background:
                        v >= hourTop3 && v > 0 ? "#2563eb" : "#93c5fd",
                    }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>0시</span>
                <span>6시</span>
                <span>12시</span>
                <span>18시</span>
                <span>23시</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Meta 문의 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meta 광고로 들어온 문의</CardTitle>
          <CardDescription>
            접수 때 저장된 첫 유입 주소의 광고 꼬리표 기준 · 개인정보는 표시하지
            않습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !data ? (
            <Skeleton className="h-24 w-full" />
          ) : data.inquiries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              이 기간에는 Meta 광고 문의가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>접수 시각</TableHead>
                    <TableHead>상품</TableHead>
                    <TableHead className="text-right">인원</TableHead>
                    <TableHead>게재면</TableHead>
                    <TableHead>캠페인</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.inquiries.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {q.createdAt.slice(5)}
                      </TableCell>
                      <TableCell>{q.product}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {q.people ? `${q.people}명` : "–"}
                      </TableCell>
                      <TableCell>{q.platform}</TableCell>
                      <TableCell className="break-all">
                        {q.campaignName}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
