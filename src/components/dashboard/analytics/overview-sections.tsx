"use client";

/**
 * 방문자 통계 개편 — 지표 카드 6개 · 문의 접수 판단 · 문의 시간대/요일 패턴
 * 데이터: /api/analytics/overview (자체측정 · GA4 · 접수 통합)
 */

import { Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsOverview } from "@/lib/analytics-overview";
import {
  formatDuration,
  formatNumber,
  formatPercent,
} from "@/lib/stats/format";
import { cn } from "@/lib/utils";

export type SourceKind = "self" | "ga4" | "meta" | "lead";

const SOURCE_STYLE: Record<SourceKind, { label: string; className: string }> = {
  self: { label: "자체측정", className: "bg-emerald-50 text-emerald-700" },
  ga4: { label: "GA4", className: "bg-orange-50 text-orange-700" },
  meta: { label: "Meta", className: "bg-blue-50 text-blue-700" },
  lead: { label: "접수", className: "bg-pink-50 text-pink-700" },
};

export function SourceBadge({ kind }: { kind: SourceKind }) {
  const s = SOURCE_STYLE[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4",
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}

/** 직전 같은 기간 대비 증감 문구 (역방향 지표는 inverse) */
function Delta({
  cur,
  prev,
  inverse = false,
  unit = "%",
}: {
  cur: number | null;
  prev: number | null;
  inverse?: boolean;
  unit?: "%" | "%p";
}) {
  if (cur == null || prev == null) return null;
  let diff: number;
  if (unit === "%p") diff = cur - prev;
  else {
    if (prev <= 0)
      return (
        <span className="text-xs text-muted-foreground">
          직전 기간 기록 없음
        </span>
      );
    diff = ((cur - prev) / prev) * 100;
  }
  if (!Number.isFinite(diff)) return null;
  const good = inverse ? diff < 0 : diff > 0;
  const flat = Math.abs(diff) < 0.05;
  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        flat
          ? "text-muted-foreground"
          : good
            ? "text-emerald-600"
            : "text-red-600",
      )}
    >
      {flat
        ? "변화 없음"
        : `${diff > 0 ? "▲" : "▼"} ${Math.abs(diff).toFixed(1)}${unit}`}
      <span className="ml-1 text-muted-foreground">직전 기간 대비</span>
    </span>
  );
}

function Kpi({
  kind,
  title,
  value,
  sub,
  help,
  delta,
  children,
  highlight,
}: {
  kind: SourceKind;
  title: string;
  value: string;
  sub?: string;
  help: string;
  delta?: React.ReactNode;
  children?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={cn("gap-0 py-0", highlight && "ring-1 ring-pink-200")}>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-1.5">
          <SourceBadge kind={kind} />
          <span className="text-xs text-muted-foreground">{title}</span>
          <span
            title={help}
            className="ml-auto cursor-help text-muted-foreground"
          >
            <Info className="h-3.5 w-3.5" aria-label={`${title} 정의`} />
          </span>
        </div>
        <div className="text-2xl font-bold tabular-nums tracking-tight">
          {value}
        </div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        {children}
        {delta && <div>{delta}</div>}
      </CardContent>
    </Card>
  );
}

export function OverviewKpis({
  data,
  loading,
}: {
  data: AnalyticsOverview | null;
  loading: boolean;
}) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }
  const { self, ga4, inquiries } = data;
  const noGa = ga4.days === 0;
  const returningPct =
    self.visitors > 0 ? (self.returning / self.visitors) * 100 : 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <Kpi
        kind="self"
        title="방문"
        value={formatNumber(self.sessions)}
        sub="세션 기준"
        help="사이트 트래커가 센 방문 수입니다. 30분 안에 이어서 본 페이지는 1회로 셉니다. 봇은 뺍니다."
        delta={<Delta cur={self.sessions} prev={self.prev.sessions} />}
      />
      <Kpi
        kind="self"
        title="순방문자"
        value={formatNumber(self.visitors)}
        sub={`재방문 ${formatNumber(self.returning)}명`}
        help="30일 쿠키로 구분한 사람 수입니다. 재방문은 이 기간에 두 번째 이상 들어온 사람입니다."
        delta={<Delta cur={self.visitors} prev={self.prev.visitors} />}
      >
        <div className="h-1.5 overflow-hidden rounded bg-muted">
          <div
            className="h-full rounded bg-emerald-500"
            style={{ width: `${Math.min(100, returningPct)}%` }}
          />
        </div>
      </Kpi>
      <Kpi
        kind="ga4"
        title="페이지뷰"
        value={noGa ? "–" : formatNumber(ga4.pageviews)}
        sub={`자체측정 ${formatNumber(self.pageviews)}`}
        help="GA4 페이지뷰입니다. GA4 는 하루 늦게 들어오므로 오늘 값은 비어 있습니다."
        delta={
          noGa ? undefined : (
            <Delta cur={ga4.pageviews} prev={ga4.prev.pageviews} />
          )
        }
      />
      <Kpi
        kind="ga4"
        title="평균 체류"
        value={noGa ? "–" : formatDuration(ga4.avgDurationSec)}
        sub="세션당"
        help="GA4 평균 세션 시간을 세션 수로 가중 평균한 값입니다."
        delta={
          noGa ? undefined : (
            <Delta cur={ga4.avgDurationSec} prev={ga4.prev.avgDurationSec} />
          )
        }
      />
      <Kpi
        kind="ga4"
        title="이탈률"
        value={noGa ? "–" : formatPercent(ga4.bounceRate)}
        sub="한 페이지만 보고 나감"
        help="GA4 이탈률을 세션 수로 가중 평균한 값입니다. 낮을수록 좋습니다."
        delta={
          noGa ? undefined : (
            <Delta
              cur={ga4.bounceRate}
              prev={ga4.prev.bounceRate}
              inverse
              unit="%p"
            />
          )
        }
      />
      <Kpi
        kind="lead"
        title="문의"
        value={`${formatNumber(inquiries.total)}건`}
        sub={
          self.sessions > 0
            ? `방문 대비 ${formatPercent((inquiries.total / self.sessions) * 100)}`
            : undefined
        }
        help="홈페이지 견적·상담 폼으로 접수된 문의 수입니다(D1 inquiries)."
        delta={<Delta cur={inquiries.total} prev={inquiries.prevTotal} />}
        highlight
      />
    </div>
  );
}

const TAG_STYLE: Record<string, SourceKind | "plain"> = {
  Meta: "meta",
  전환: "lead",
  유입: "self",
  패턴: "plain",
  주의: "ga4",
};

export function InquiryOps({
  data,
  loading,
}: {
  data: AnalyticsOverview | null;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">문의 접수 판단</CardTitle>
        <CardDescription>
          이번 달 접수 흐름과 방문에서 문의까지 이어진 단계
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading || !data ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                {
                  label: "이번 달 문의",
                  value: `${formatNumber(data.ops.current)}건`,
                  sub: `${data.ops.month.slice(5)}월 ${data.ops.elapsedDays}일까지`,
                },
                {
                  label: "월말 예상",
                  value: `${formatNumber(data.ops.forecast)}건`,
                  sub: `하루 평균 ${(data.ops.current / Math.max(1, data.ops.elapsedDays)).toFixed(1)}건`,
                },
                {
                  label: "지난달 대비",
                  value:
                    data.ops.prevMonth > 0
                      ? formatPercent(
                          (data.ops.current / data.ops.prevMonth) * 100,
                          0,
                        )
                      : "–",
                  sub: `지난달 ${formatNumber(data.ops.prevMonth)}건`,
                },
                {
                  label: "광고로 들어온 문의",
                  value: `${formatNumber(data.ops.paid)}건`,
                  sub: `파워링크 ${data.ops.paidNaver} · Meta ${data.ops.paidMeta}`,
                },
              ].map((b) => (
                <div key={b.label} className="rounded-md bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">{b.label}</div>
                  <div className="text-xl font-bold tabular-nums">
                    {b.value}
                  </div>
                  <div className="text-xs text-muted-foreground">{b.sub}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">
                  방문에서 문의까지 (선택 기간)
                </h4>
                {[
                  {
                    label: "사이트 방문",
                    value: data.funnel.sessions,
                    base: data.funnel.sessions,
                    color: "#6366f1",
                  },
                  {
                    label: "상품·요금 또는 견적 화면 도달",
                    value: data.funnel.reachedOffer,
                    base: data.funnel.sessions,
                    color: "#818cf8",
                  },
                  {
                    label: "문의 접수",
                    value: data.funnel.inquiries,
                    base: data.funnel.sessions,
                    color: "#ec4899",
                  },
                ].map((s, i) => (
                  <div key={s.label} className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <span>{s.label}</span>
                      <span className="font-semibold tabular-nums">
                        {formatNumber(s.value)}
                        {i > 0 && s.base > 0 && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            {formatPercent((s.value / s.base) * 100)}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${s.base > 0 ? Math.max(1, (s.value / s.base) * 100) : 0}%`,
                          background: s.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {data.funnel.quoteOpenSessions > 0
                    ? `견적 창이 열린 방문 ${formatNumber(data.funnel.quoteOpenSessions)}회가 가운데 단계에 포함됩니다.`
                    : "견적 창 열림 기록은 2026-10-31부터 쌓여 가운데 단계에 더해집니다."}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">확인할 것</h4>
                {data.insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    특이 사항이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {data.insights.map((it, i) => {
                      const kind = TAG_STYLE[it.tag];
                      return (
                        <li key={i} className="flex gap-2 text-sm">
                          {kind && kind !== "plain" ? (
                            <SourceBadge kind={kind} />
                          ) : (
                            <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-muted px-2 text-[11px] font-semibold text-muted-foreground">
                              {it.tag}
                            </span>
                          )}
                          <span className="leading-5">{it.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEK_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

export function InquiryPatterns({
  data,
  loading,
}: {
  data: AnalyticsOverview | null;
  loading: boolean;
}) {
  const p = data?.patterns;
  const hourMax = p ? Math.max(1, ...p.hours) : 1;
  const weekMax = p ? Math.max(1, ...p.weekdays) : 1;
  const sub = p
    ? `${p.from.slice(5).replace("-", "/")} ~ ${p.to.slice(5).replace("-", "/")} · ${formatNumber(p.total)}건`
    : "";
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">시간대별 문의</CardTitle>
          <CardDescription>최근 90일 · {sub}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !p ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <div className="flex h-28 items-end gap-[3px]">
                {p.hours.map((v, h) => (
                  <div
                    key={h}
                    title={`${h}시 ${v}건`}
                    className="flex-1 rounded-t-sm"
                    style={{
                      height: `${Math.max(2, (v / hourMax) * 100)}%`,
                      background: v >= hourMax * 0.6 ? "#db2777" : "#f9a8d4",
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">요일별 문의</CardTitle>
          <CardDescription>최근 90일 · {sub}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !p ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="space-y-1.5">
              {WEEK_ORDER.map((w) => (
                <div key={w} className="flex items-center gap-2 text-sm">
                  <span className="w-5">{WEEK_LABEL[w]}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(p.weekdays[w] / weekMax) * 100}%`,
                        background:
                          p.weekdays[w] >= weekMax * 0.8
                            ? "#db2777"
                            : "#f9a8d4",
                      }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums">
                    {p.weekdays[w]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
