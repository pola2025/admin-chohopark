import { NextResponse } from "next/server";
import { proxyReservationAdmin, SAFE_ID } from "@/lib/reservation-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; paymentId: string }> };

/** 입금 기록 무효 처리. 저쪽은 지우지 않고 voided_at 만 남긴다. */
export async function DELETE(request: Request, context: Context) {
  const { id, paymentId } = await context.params;
  if (!SAFE_ID.test(id) || !SAFE_ID.test(paymentId)) {
    return NextResponse.json({ error: "잘못된 번호" }, { status: 400 });
  }
  return proxyReservationAdmin(request, {
    method: "DELETE",
    path: `/reservations/${id}/payments/${paymentId}`,
  });
}
