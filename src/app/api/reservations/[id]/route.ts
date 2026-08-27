import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = "https://chorigol.net/api/admin/reservations";
const TOKEN = process.env.CONTRACT_ADMIN_API_TOKEN;

/**
 * 예약 한 건 손보기 — 입금 상태 변경, 취소 표시, 확인 표시 해제.
 * 브라우저가 관리 토큰을 갖지 않도록 이 경로를 거쳐 chorigol.net 으로 넘긴다.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: "CONTRACT_ADMIN_API_TOKEN 미설정" },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const raw = await request.text();

  try {
    const res = await fetch(`${UPSTREAM}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: raw || "{}",
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    return NextResponse.json(body ?? {}, { status: res.status });
  } catch {
    return NextResponse.json({ message: "변경 실패" }, { status: 500 });
  }
}
