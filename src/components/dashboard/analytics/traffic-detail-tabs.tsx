"use client";

/**
 * 방문 상세 탭 — 기기별 / 지역별 / 시간대별 (GA4 스냅샷)
 * 인기 페이지는 한국어 이름표가 붙은 TopPages 카드(inflow-sections)로 옮겼다
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BreakdownBars, DEVICE_COLORS, DonutChart } from "@/components/stats";

export interface TrafficDetailData {
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
  regions: Array<{ region: string; visitors: number; percentage: number }>;
  hourlyTraffic: Array<{ hour: string; visitors: number }>;
}

interface TrafficDetailTabsProps {
  data: TrafficDetailData;
  loading: boolean;
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: "모바일",
  desktop: "데스크톱",
  tablet: "태블릿",
};

function EmptyOrLoading({
  loading,
  empty,
  rows = 5,
}: {
  loading: boolean;
  empty: boolean;
  rows?: number;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (empty) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        데이터가 없습니다.
      </div>
    );
  }
  return null;
}

export function TrafficDetailTabs({ data, loading }: TrafficDetailTabsProps) {
  const peakHour = data.hourlyTraffic.reduce<{
    hour: string;
    visitors: number;
  } | null>(
    (max, item) => (!max || item.visitors > max.visitors ? item : max),
    null,
  );

  return (
    <Tabs defaultValue="devices" className="space-y-4">
      <TabsList>
        <TabsTrigger value="devices">기기별</TabsTrigger>
        <TabsTrigger value="location">지역별</TabsTrigger>
        <TabsTrigger value="time">시간대별</TabsTrigger>
      </TabsList>

      {/* 기기별 */}
      <TabsContent value="devices" className="space-y-4">
        <div className="grid min-w-0 gap-4 md:grid-cols-2 [&>*]:min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>기기 유형</CardTitle>
              <CardDescription>방문자가 사용하는 기기 분포</CardDescription>
            </CardHeader>
            <CardContent>
              {loading || data.devices.length === 0 ? (
                <EmptyOrLoading
                  loading={loading}
                  empty={data.devices.length === 0}
                  rows={3}
                />
              ) : (
                <DonutChart
                  items={data.devices.map((d) => ({
                    name: DEVICE_LABELS[d.device] ?? d.device,
                    value: d.visitors,
                  }))}
                  centerLabel="방문자"
                  entityMap={DEVICE_COLORS}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>브라우저</CardTitle>
              <CardDescription>방문자가 사용하는 브라우저</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <EmptyOrLoading loading empty={false} />
              ) : (
                <BreakdownBars
                  items={data.browsers.map((b) => ({
                    name: b.browser,
                    value: b.visitors,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      {/* 지역별 */}
      <TabsContent value="location" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>지역별 방문자</CardTitle>
            <CardDescription>방문자의 접속 지역 분포</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <EmptyOrLoading loading empty={false} />
            ) : (
              <BreakdownBars
                items={data.regions.map((r) => ({
                  name: r.region,
                  value: r.visitors,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* 시간대별 */}
      <TabsContent value="time" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>시간대별 트래픽</CardTitle>
            <CardDescription>하루 중 방문이 집중되는 시간대</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || data.hourlyTraffic.length === 0 ? (
              <EmptyOrLoading
                loading={loading}
                empty={data.hourlyTraffic.length === 0}
                rows={6}
              />
            ) : (
              <>
                <BreakdownBars
                  items={data.hourlyTraffic.map((h) => ({
                    name: h.hour,
                    value: h.visitors,
                  }))}
                />
                {peakHour && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    * 가장 많은 방문이 발생하는 시간대:{" "}
                    <strong>{peakHour.hour}</strong>
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
