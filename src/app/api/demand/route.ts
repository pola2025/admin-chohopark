import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMS_URL = process.env.CHOHO_FORMS_URL || "https://api.chorigol.net";
const TOKEN = process.env.CHOHO_FORMS_ADMIN_READ_TOKEN;

/**
 * 이용희망일 수요 집계 — D1 `use_date_demand` 에 쌓아 둔 값을 그대로 읽는다.
 * 접수 원문을 매번 훑지 않으므로 건수가 늘어도 가볍다.
 * Worker 가 접수·삭제 때 캐시를 비우므로 여기서도 짧게 캐시한다.
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
  for (const key of ["from", "to"]) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }

  try {
    const res = await fetch(
      `${FORMS_URL}/admin/demand${params.size ? `?${params}` : ""}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        next: { revalidate: 60 },
      },
    );
    if (!res.ok) {
      return NextResponse.json({ error: "수요 조회 실패" }, { status: 502 });
    }
    const body = await res.json();
    return NextResponse.json({ data: body.items ?? [] });
  } catch {
    return NextResponse.json({ error: "수요 조회 실패" }, { status: 500 });
  }
}
