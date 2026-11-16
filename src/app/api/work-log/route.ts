import { proxyReservationAdmin } from "@/lib/reservation-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 폴라애드 작업 기록 — chorigol.net /api/admin/work-log 를 관리자 세션 확인 뒤 대신 부른다. */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const search = new URLSearchParams();
  for (const key of ["category", "before"]) {
    const value = sp.get(key);
    if (value) search.set(key, value.slice(0, 40));
  }
  return proxyReservationAdmin(request, {
    method: "GET",
    path: "/work-log",
    search,
  });
}
