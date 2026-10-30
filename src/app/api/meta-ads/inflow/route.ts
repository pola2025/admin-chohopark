import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import {
  BusyError,
  cached,
  parseStrictRange,
  withinRate,
} from "@/lib/api-guard";
import { loadMetaInflow } from "@/lib/meta-inflow";

/**
 * Meta 광고 유입 분석 — GET ?start=&end=&campaign=all|<캠페인 ID>
 * 관리자 로그인 필수 · 분당 60회 · 같은 조건은 60초 캐시 · 기간 최대 400일
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  const denied = await requireAdminSession();
  if (denied) return denied;
  if (!withinRate("meta-ads-inflow", 60)) {
    return NextResponse.json(
      { error: "잠시 후 다시 조회해주세요." },
      { status: 429, headers },
    );
  }
  const url = new URL(request.url);
  if (
    [...url.searchParams.keys()].some(
      (k) => !["start", "end", "preset", "campaign"].includes(k),
    )
  ) {
    return NextResponse.json(
      { error: "조회 조건을 확인해주세요." },
      { status: 400, headers },
    );
  }
  const range = parseStrictRange(url);
  const campaignParam = url.searchParams.get("campaign") || "all";
  if (
    !range ||
    (campaignParam !== "all" && !/^\d{5,32}$/.test(campaignParam))
  ) {
    return NextResponse.json(
      { error: "조회 조건을 확인해주세요." },
      { status: 400, headers },
    );
  }
  const campaign = campaignParam === "all" ? null : campaignParam;
  try {
    const data = await cached(
      `meta-inflow:${range.start}:${range.end}:${campaignParam}`,
      60_000,
      () => loadMetaInflow(range.start, range.end, campaign),
    );
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof BusyError) {
      return NextResponse.json(
        { error: "잠시 후 다시 조회해주세요." },
        { status: 429, headers },
      );
    }
    console.error(
      "[admin-chohopark/meta-ads-inflow]",
      error instanceof Error ? error.message.slice(0, 200) : "unknown",
    );
    return NextResponse.json(
      { error: "광고 데이터를 불러오지 못했습니다." },
      { status: 502, headers },
    );
  }
}
