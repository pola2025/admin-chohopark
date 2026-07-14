"use client";

/**
 * 봇 트래픽 분석 카드 — /api/analytics/bot-stats 응답 렌더
 * 카테고리 분포는 표준 BreakdownBars로, 상위 봇은 순위 목록으로 표시
 */

import { Bot, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BreakdownBars } from "@/components/stats";
import { formatNumber, formatPercent } from "@/lib/stats/format";

export interface BotStats {
  total_visits: number;
  bot_visits: number;
  human_visits: number;
  bot_percentage: number;
  categories: Array<{ category: string; count: number; percentage: string }>;
  top_bots: Array<{ name: string; count: number }>;
  tracking_since: string | null;
}

interface BotTrafficCardProps {
  stats: BotStats | null;
}

export function BotTrafficCard({ stats }: BotTrafficCardProps) {
  if (!stats || stats.total_visits === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-5 w-5" />봇 트래픽 분석
          {stats.tracking_since && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              (추적 시작:{" "}
              {new Date(stats.tracking_since).toLocaleDateString("ko-KR")})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <SummaryBox label="전체 방문" value={formatNumber(stats.total_visits)} />
          <SummaryBox
            label="일반 방문자"
            value={formatNumber(stats.human_visits)}
          />
          <SummaryBox label="봇 방문" value={formatNumber(stats.bot_visits)} />
          <SummaryBox
            label="봇 비율"
            value={formatPercent(stats.bot_percentage)}
            icon={<ShieldAlert className="h-3 w-3" />}
          />
        </div>

        {stats.categories.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 text-sm font-medium">봇 카테고리별</h4>
              <BreakdownBars
                items={stats.categories.map((c) => ({
                  name: c.category,
                  value: c.count,
                }))}
              />
            </div>
            {stats.top_bots.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-medium">상위 봇</h4>
                <div className="space-y-1.5">
                  {stats.top_bots.map((bot, i) => (
                    <div
                      key={bot.name}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-4 text-xs text-muted-foreground">
                          {i + 1}.
                        </span>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {bot.name}
                        </code>
                      </span>
                      <span className="text-muted-foreground tabular-nums">
                        {formatNumber(bot.count)}회
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-center">
      <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
