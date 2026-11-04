import { NextResponse } from "next/server";
import { proxyReservationAdmin, SAFE_ID } from "@/lib/reservation-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** 입금 기록 한 줄 추가 `{ kind, amount, method, paidAt, memo? }`. */
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  if (!SAFE_ID.test(id)) {
    return NextResponse.json({ error: "잘못된 예약 번호" }, { status: 400 });
  }
  return proxyReservationAdmin(request, {
    method: "POST",
    path: `/reservations/${id}/payments`,
    withBody: true,
  });
}
