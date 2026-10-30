import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-session";
import {
  BusyError,
  cached,
  parseStrictRange,
  withinRate,
} from "@/lib/api-guard";
import { loadOverview } from "@/lib/analytics-overview";

/**
 * 방문자 통계 통합 조회 — GET ?start=YYYY-MM-DD&end=YYYY-MM-DD (KST, 최대 400일)
 * 관리자 로그인 필수 · 분당 60회 · 같은 기간은 60초 캐시
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  const denied = await requireAdminSession();
  if (denied) return denied;
  if (!withinRate("analytics-overview", 60)) {
    return NextResponse.json(
      { error: "잠시 후 다시 조회해주세요." },
      { status: 429, headers },
    );
  }
  const url = new URL(request.url);
  if (
    [...url.searchParams.keys()].some(
      (k) => !["start", "end", "preset"].includes(k),
    )
  ) {
    return NextResponse.json(
      { error: "조회 조건을 확인해주세요." },
      { status: 400, headers },
    );
  }
  const range = parseStrictRange(url);
  if (!range)
    return NextResponse.json(
      { error: "조회 기간을 확인해주세요." },
      { status: 400, headers },
    );
  try {
    const data = await cached(
      `overview:${range.start}:${range.end}`,
      60_000,
      () => loadOverview(range.start, range.end, range.days),
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
      "[admin-chohopark/analytics-overview]",
      error instanceof Error ? error.message.slice(0, 200) : "unknown",
    );
    return NextResponse.json(
      { error: "통계를 불러오지 못했습니다." },
      { status: 502, headers },
    );
  }
}
