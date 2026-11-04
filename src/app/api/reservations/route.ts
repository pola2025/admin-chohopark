import {
  MAX_PAGE_SIZE,
  MAX_RANGE_PAGE_SIZE,
  proxyReservationAdmin,
} from "@/lib/reservation-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 목록 조회에 넘기는 매개변수. 이 밖의 값은 버린다. */
const LIST_PARAMS = [
  "from",
  "to",
  "status",
  "channel",
  "query",
  "page",
  "pageSize",
  "limit",
  "source",
  "paymentStatus",
  "needsReview",
  "overlapFrom",
] as const;

/**
 * 예약 목록 — 기간과 겹치는 예약과 그 기간의 막은 날짜를 함께 받는다.
 * 고객 정보는 chorigol.net 이 복호화해 내려준다.
 */
export async function GET(request: Request) {
  const incoming = new URL(request.url).searchParams;
  const search = new URLSearchParams();
  for (const key of LIST_PARAMS) {
    const value = incoming.get(key);
    if (value) search.set(key, value.slice(0, 120));
  }
  // 쪽 크기·쪽 번호는 숫자로 바꿔 상한으로 자른다.
  const cap =
    search.has("from") && search.has("to") ? MAX_RANGE_PAGE_SIZE : MAX_PAGE_SIZE;
  for (const key of ["pageSize", "limit"] as const) {
    if (!search.has(key)) continue;
    const n = Math.floor(Number(search.get(key)));
    search.set(
      key,
      String(Number.isFinite(n) ? Math.min(Math.max(n, 1), cap) : 30),
    );
  }
  if (search.has("page")) {
    const n = Math.floor(Number(search.get("page")));
    search.set("page", String(Number.isFinite(n) ? Math.min(Math.max(n, 1), 500) : 1));
  }
  return proxyReservationAdmin(request, {
    method: "GET",
    path: "/reservations",
    search,
  });
}

/** 관리자 예약 등록. 겹침·막은 날짜 409 는 본문 그대로 돌려준다. */
export async function POST(request: Request) {
  return proxyReservationAdmin(request, {
    method: "POST",
    path: "/reservations",
    withBody: true,
  });
}
