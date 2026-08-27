import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMS_URL = process.env.CHOHO_FORMS_URL || "https://api.chorigol.net";
const TOKEN = process.env.CHOHO_FORMS_ADMIN_READ_TOKEN;

/**
 * 고객 목록 — 접수 건이 아니라 사람 단위로 묶은 목록을 받는다.
 *
 * 같은 담당자가 빠른문의를 남기고 며칠 뒤 견적을 받는 흐름이 흔해서,
 * 건 단위 목록만 보면 한 고객이 여러 줄로 흩어진다.
 * 묶는 일은 D1 쪽에서 하고 여기서는 넘겨받기만 한다.
 * 집계라 무거워서 Worker 가 1분 동안 결과를 재사용한다.
 */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: "CHOHO_FORMS_ADMIN_READ_TOKEN 미설정" },
      { status: 503 },
    );
  }

  const incoming = new URL(request.url).searchParams;

  // phone 이 붙으면 그 고객의 접수 이력을 통째로 가져온다.
  const phone = incoming.get("phone");
  if (phone) {
    try {
      const res = await fetch(
        `${FORMS_URL}/admin/customer?phone=${encodeURIComponent(phone)}`,
        { headers: { Authorization: `Bearer ${TOKEN}` }, cache: "no-store" },
      );
      if (!res.ok) {
        return NextResponse.json({ error: "조회 실패" }, { status: 502 });
      }
      const body = await res.json();
      return NextResponse.json({ data: body.items ?? [] });
    } catch {
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }
  }

  const params = new URLSearchParams();
  for (const key of ["limit", "offset", "query", "repeat"]) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  if (!params.has("limit")) params.set("limit", "50");

  try {
    const res = await fetch(`${FORMS_URL}/admin/customers?${params}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "조회 실패" }, { status: 502 });
    }
    const body = await res.json();
    return NextResponse.json({
      data: body.items ?? [],
      total: body.total ?? 0,
      limit: body.limit ?? 50,
      offset: body.offset ?? 0,
      hasMore: Boolean(body.hasMore),
    });
  } catch {
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
