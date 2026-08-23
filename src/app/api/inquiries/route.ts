import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMS_URL = process.env.CHOHO_FORMS_URL || "https://api.chorigol.net";
const TOKEN = process.env.CHOHO_FORMS_ADMIN_READ_TOKEN;

/**
 * 접수 목록 — 견적문의·빠른문의를 한 흐름으로 합친 D1 피드를 페이지 단위로 받는다.
 * 목록이 계속 늘어나므로 전체를 한 번에 끌어오지 않는다.
 * 필터 조합마다 결과가 달라 캐시 효용이 적고, 방금 들어온 접수가 늦게 보이면
 * 곤란하므로 목록은 캐시하지 않는다. 무거운 집계(/api/demand)만 캐시한다.
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
  const params = new URLSearchParams();
  for (const key of ["limit", "offset", "kind", "query", "use_date"]) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }
  if (!params.has("limit")) params.set("limit", "50");

  try {
    const res = await fetch(`${FORMS_URL}/admin/feed?${params}`, {
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
