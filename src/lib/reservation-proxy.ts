import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * 예약 관리 프록시 — chorigol.net 관리 API 를 대신 부른다.
 *
 * 브라우저는 관리 토큰(CONTRACT_ADMIN_API_TOKEN)을 모른다. 여기서 관리자 세션을
 * 먼저 확인하고, 토큰은 서버에서만 붙인다.
 * 저쪽이 돌려준 4xx 본문(409 conflict·blocked 포함)은 그대로 넘긴다.
 * 저쪽 인증 실패(401·403)와 5xx 는 브라우저 세션 문제로 보이지 않게 502 로 바꾼다.
 * 저쪽 호출은 15초에 끊고(504) 다시 보내지 않는다. 429 는 Retry-After 와 함께 그대로 넘긴다.
 */

const UPSTREAM_BASE = "https://chorigol.net/api/admin";
const MAX_BODY_BYTES = 32_000;
const UPSTREAM_TIMEOUT_MS = 15_000;
/** 목록 한 쪽 상한. 브라우저가 더 크게 보내도 여기서 자른다. */
export const MAX_PAGE_SIZE = 100;
/** 기간(from·to)을 준 달력 조회 한 쪽 상한. chorigol.net 도 기간 조회는 200 까지 받는다. */
export const MAX_RANGE_PAGE_SIZE = 200;

/** 경로에 넣는 예약·입금 기록 id. 슬래시·점이 들어가면 다른 경로로 새어 나간다. */
export const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type ProxyOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** chorigol.net 쪽 경로. `/api/admin` 뒤에 붙는다. 예: `/reservations` */
  path: string;
  search?: URLSearchParams;
  /** true 면 요청 본문(JSON)을 검사해 그대로 넘긴다. */
  withBody?: boolean;
  /** 요청 본문 대신 이 값을 JSON 으로 보낸다. 받은 본문은 읽지 않는다. */
  fixedBody?: unknown;
};

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function proxyReservationAdmin(
  request: Request,
  { method, path, search, withBody, fixedBody }: ProxyOptions,
) {
  if (!(await getSession())) return fail(401, "Unauthorized");
  const token = process.env.CONTRACT_ADMIN_API_TOKEN;
  if (!token) return fail(503, "CONTRACT_ADMIN_API_TOKEN 미설정");

  let body: string | undefined;
  if (fixedBody !== undefined) {
    body = JSON.stringify(fixedBody);
  } else if (withBody) {
    const type = request.headers.get("content-type") ?? "";
    if (!type.toLowerCase().includes("application/json")) {
      return fail(415, "JSON 으로 보내 주세요");
    }
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, "내용이 너무 깁니다");
    try {
      JSON.parse(raw || "{}");
    } catch {
      return fail(400, "잘못된 요청입니다");
    }
    body = raw || "{}";
  }

  const query = search && [...search.keys()].length ? `?${search}` : "";
  let res: Response;
  try {
    res = await fetch(`${UPSTREAM_BASE}${path}${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (e) {
    if ((e as Error)?.name === "TimeoutError") {
      return fail(504, "예약 서버 응답이 늦습니다");
    }
    return fail(502, "예약 서버에 연결하지 못했습니다");
  }

  if (res.status === 401 || res.status === 403) {
    return fail(502, "예약 서버 인증에 실패했습니다");
  }
  if (res.status >= 500) return fail(502, "예약 서버 오류입니다");

  const text = await res.text();
  const retryAfter = res.headers.get("retry-after");
  const headers =
    res.status === 429 && retryAfter ? { "Retry-After": retryAfter } : undefined;
  if (!text) return NextResponse.json({}, { status: res.status, headers });
  try {
    return NextResponse.json(JSON.parse(text), {
      status: res.status,
      headers,
    });
  } catch {
    return fail(502, "예약 서버 응답을 읽지 못했습니다");
  }
}
