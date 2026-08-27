import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = "https://chorigol.net/api/admin/reservations";
const TOKEN = process.env.CONTRACT_ADMIN_API_TOKEN;

/**
 * 예약 목록 — chorigol.net 의 D1 예약 저장소를 대신 읽는다.
 *
 * 약정서에서 확정된 건과 구글 캘린더에 손으로 적은 건이 한 자리에 모여 있다.
 * 고객 정보는 암호화 저장이라 저쪽에서 복호화해 내려준다.
 * 브라우저가 그 토큰을 갖지 않도록 이 경로를 거친다.
 */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: "CONTRACT_ADMIN_API_TOKEN 미설정" },
      { status: 503 },
    );
  }

  const incoming = new URL(request.url).searchParams;
  const params = new URLSearchParams();
  for (const key of [
    "status",
    "paymentStatus",
    "source",
    "from",
    "to",
    "query",
    "needsReview",
    "page",
    "pageSize",
  ]) {
    const value = incoming.get(key);
    if (value) params.set(key, value);
  }

  try {
    const res = await fetch(`${UPSTREAM}?${params}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "조회 실패" }, { status: 502 });
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

/** 구글 캘린더에 손으로 적은 예약을 가져온다. */
export async function POST(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: "CONTRACT_ADMIN_API_TOKEN 미설정" },
      { status: 503 },
    );
  }

  const action = new URL(request.url).searchParams.get("action");
  if (action !== "sync-calendar") {
    return NextResponse.json({ error: "지원하지 않는 요청" }, { status: 400 });
  }

  try {
    const res = await fetch(`${UPSTREAM}/sync-calendar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { error: body?.message ?? "동기화 실패" },
        { status: 502 },
      );
    }
    return NextResponse.json(body);
  } catch {
    return NextResponse.json({ error: "동기화 실패" }, { status: 500 });
  }
}
