import { NextRequest, NextResponse } from "next/server";
import { getMetaAdsDashboard, MetaAdsError } from "@/lib/meta-ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
  try {
    if (request.url.length > 1800) return NextResponse.json({ error: "요청 주소가 너무 깁니다." }, { status: 414, headers });
    const params = request.nextUrl.searchParams;
    if ([...params.keys()].some(k => !["days", "campaign", "cursor"].includes(k) || params.getAll(k).length !== 1)) return NextResponse.json({ error: "조회 조건을 확인해주세요." }, { status: 400, headers });
    const data = await getMetaAdsDashboard({ days: params.get("days") ?? "30", campaign: params.get("campaign") ?? undefined, cursor: params.get("cursor") });
    return NextResponse.json(data, { headers });
  } catch (error) {
    const status = error instanceof MetaAdsError ? error.status : 502;
    const message = status === 401 ? "관리자 로그인이 필요합니다." : status === 409 ? "집계가 갱신되었습니다. 새로고침해주세요." : status === 429 ? "잠시 후 다시 조회해주세요." : status === 400 ? "조회 조건을 확인해주세요." : "광고 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
    return NextResponse.json({ error: message }, { status, headers });
  }
}
