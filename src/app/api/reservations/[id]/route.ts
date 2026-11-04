import { NextResponse } from "next/server";
import { proxyReservationAdmin, SAFE_ID } from "@/lib/reservation-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** 예약 한 건과 변경 기록. */
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  if (!SAFE_ID.test(id)) {
    return NextResponse.json({ error: "잘못된 예약 번호" }, { status: 400 });
  }
  return proxyReservationAdmin(request, {
    method: "GET",
    path: `/reservations/${id}`,
  });
}

/**
 * 예약 한 건 손보기 — 내용 수정(update), 취소(cancel), 가계약 연장(extendHold),
 * 확인 표시 해제(clearReview). 겹침·막은 날짜 409 는 본문 그대로 돌려준다.
 */
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  if (!SAFE_ID.test(id)) {
    return NextResponse.json({ error: "잘못된 예약 번호" }, { status: 400 });
  }
  return proxyReservationAdmin(request, {
    method: "PATCH",
    path: `/reservations/${id}`,
    withBody: true,
  });
}
