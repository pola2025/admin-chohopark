"use client";

/**
 * 방문자 통계 개편 — 유입 경로 표(세션 첫 유입 · Meta 캠페인 펼침) · 인기 페이지(한국어 이름표)
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AnalyticsOverview } from "@/lib/analytics-overview";
import { formatNumber, formatPercent } from "@/lib/stats/format";
import { cn } from "@/lib/utils";

function rate(inquiries: number, sessions: number) {
  return sessions > 0 && inquiries > 0
    ? formatPercent((inquiries / sessions) * 100)
    : "–";
}

export function ChannelTable({
  data,
  loading,
}: {
  data: AnalyticsOverview | null;
  loading: boolean;
}) {
  const [metaOpen, setMetaOpen] = useState(true);
  const total = data?.funnel.sessions || 0;
  const totalInquiries = data?.inquiries.total || 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">유입 경로</CardTitle>
        <CardDescription>
          방문은 세션 첫 유입 기준 · 문의는 접수 때 저장된 첫 유입 주소 기준 ·
          봇 제외
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading || !data ? (
          <Skeleton className="h-72 w-full" />
        ) : data.channels.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            이 기간에는 기록된 방문이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>채널</TableHead>
                  <TableHead className="text-right">방문</TableHead>
                  <TableHead className="min-w-[140px]">비중</TableHead>
                  <TableHead className="text-right">문의</TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    방문 대비 문의
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.channels.map((c) => {
                  const share = total > 0 ? (c.sessions / total) * 100 : 0;
                  const isMeta =
                    c.key === "meta_ad" && data.metaCampaigns.length > 0;
                  return [
                    <TableRow
                      key={c.key}
                      className={cn(
                        isMeta &&
                          "cursor-pointer bg-blue-50/50 hover:bg-blue-50",
                      )}
                      onClick={
                        isMeta ? () => setMetaOpen((v) => !v) : undefined
                      }
                    >
                      <TableCell className="whitespace-nowrap">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                          style={{ background: c.color }}
                        />
                        {isMeta ? (
                          <span className="font-semibold">
                            {c.label}
                            {metaOpen ? (
                              <ChevronDown className="ml-1 inline h-4 w-4" />
                            ) : (
                              <ChevronRight className="ml-1 inline h-4 w-4" />
                            )}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              캠페인 {data.metaCampaigns.length}개
                            </span>
                          </span>
                        ) : (
                          c.label
                        )}
                        {c.paid && !isMeta && (
                          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            광고
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(c.sessions)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                            <div
                              className="h-full rounded"
                              style={{
                                width: `${share}%`,
                                background: c.color,
                              }}
                            />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                            {share.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.inquiries ? (
                          `${c.inquiries}건`
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {rate(c.inquiries, c.sessions)}
                      </TableCell>
                    </TableRow>,
                    ...(isMeta && metaOpen
                      ? data.metaCampaigns.map((m) => (
                          <TableRow
                            key={`meta-${m.key}`}
                            className="bg-blue-50/30 text-[13px]"
                          >
                            <TableCell className="pl-8">
                              {m.campaignId ? (
                                <Link
                                  href={`/dashboard/meta-ads?campaign=${m.campaignId}`}
                                  className="text-blue-700 underline decoration-dotted underline-offset-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {m.name}
                                </Link>
                              ) : (
                                m.name
                              )}
                              <div className="text-xs text-muted-foreground">
                                {m.platforms
                                  .map(
                                    (p) =>
                                      `${p.label} ${formatNumber(p.sessions)}`,
                                  )
                                  .join(" · ") || "사이트 도착 없음"}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(m.sessions)}
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right tabular-nums">
                              {m.inquiries ? (
                                `${m.inquiries}건`
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {rate(m.inquiries, m.sessions)}
                            </TableCell>
                          </TableRow>
                        ))
                      : []),
                  ];
                })}
                <TableRow className="font-semibold">
                  <TableCell>합계</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(total)}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(totalInquiries)}건
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rate(totalInquiries, total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const KIND_STYLE: Record<string, string> = {
  메뉴: "bg-slate-100 text-slate-700",
  안내글: "bg-emerald-50 text-emerald-700",
  소식: "bg-orange-50 text-orange-700",
  "광고 랜딩": "bg-blue-50 text-blue-700",
  기타: "bg-muted text-muted-foreground",
};

export function TopPages({
  data,
  loading,
}: {
  data: AnalyticsOverview | null;
  loading: boolean;
}) {
  const [grouped, setGrouped] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div className="space-y-1.5">
          <CardTitle className="text-base">인기 페이지 TOP 10</CardTitle>
          <CardDescription>자체측정 페이지뷰 기준 · 봇 제외</CardDescription>
        </div>
        <div className="flex rounded-md bg-muted p-0.5 text-xs">
          {[
            { v: false, label: "페이지별" },
            { v: true, label: "주제별로 묶기" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setGrouped(o.v)}
              className={cn(
                "rounded px-3 py-1.5",
                grouped === o.v
                  ? "bg-background font-semibold shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading || !data ? (
          <Skeleton className="h-72 w-full" />
        ) : (grouped ? data.topics : data.pages).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            이 기간에는 기록된 페이지가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>{grouped ? "주제" : "페이지"}</TableHead>
                  <TableHead className="text-right">페이지뷰</TableHead>
                  {!grouped && (
                    <TableHead className="text-right">방문</TableHead>
                  )}
                  <TableHead className="text-right whitespace-nowrap">
                    첫 페이지로 들어온 방문
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped
                  ? data.topics.map((t, i) => (
                      <TableRow key={t.topic}>
                        <TableCell className="text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "mr-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              KIND_STYLE[t.kind],
                            )}
                          >
                            {t.kind}
                          </span>
                          <span className="font-medium">
                            {t.topic.replace(/^소식 · /, "")}
                          </span>
                          {t.pages > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {t.pages}편
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(t.pageviews)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatNumber(t.landings)}
                        </TableCell>
                      </TableRow>
                    ))
                  : data.pages.map((p, i) => (
                      <TableRow key={p.path}>
                        <TableCell className="text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-1.5">
                            <span
                              className={cn(
                                "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                KIND_STYLE[p.kind],
                              )}
                            >
                              {p.kind}
                            </span>
                            <span className="font-medium">{p.label}</span>
                          </div>
                          <div className="mt-0.5 break-all text-xs text-muted-foreground">
                            {p.path}
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(p.pageviews)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(p.sessions)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatNumber(p.landings)}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
