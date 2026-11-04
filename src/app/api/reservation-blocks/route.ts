import { NextResponse } from "next/server";
import { DATE_RE, proxyReservationAdmin } from "@/lib/reservation-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 막은 날짜(휴무·내부 행사) 조회 `?from&to`. */
export async function GET(request: Request) {
  const incoming = new URL(request.url).searchParams;
  const search = new URLSearchParams();
  for (const key of ["from", "to"]) {
    const value = incoming.get(key);
    if (value && DATE_RE.test(value)) search.set(key, value);
  }
  return proxyReservationAdmin(request, {
    method: "GET",
    path: "/reservation-blocks",
    search,
  });
}

/** 날짜 막기 `{ date, reason }`. */
export async function POST(request: Request) {
  return proxyReservationAdmin(request, {
    method: "POST",
    path: "/reservation-blocks",
    withBody: true,
  });
}

/** 막은 날짜 풀기 `?date=YYYY-MM-DD`. */
export async function DELETE(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "날짜 형식이 아닙니다" },
      { status: 400 },
    );
  }
  return proxyReservationAdmin(request, {
    method: "DELETE",
    path: "/reservation-blocks",
    search: new URLSearchParams({ date }),
  });
}
