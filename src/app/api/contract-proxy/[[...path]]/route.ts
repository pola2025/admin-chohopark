import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";

/**
 * 약정서 관리 API 서버 프록시.
 *
 * 브라우저(대시보드)는 same-origin으로 이 프록시를 호출하고, 프록시가 서버에서
 * Bearer 토큰을 붙여 chorigol.net 의 `/api/admin/contracts*` 를 대신 호출한다.
 * 토큰이 브라우저에 노출되지 않으므로 전 고객 개인정보가 무인증으로 새지 않는다.
 *
 * 목록(path 없음)·상세([id])·상태([id]/status)·입금([id]/deposit)·
 * 원본 HTML([id]/original, iframe) 을 하나의 catch-all 로 커버한다.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = "https://chorigol.net/api/admin/contracts";

async function forward(request: Request, path: string[] | undefined) {
  // 대시보드 로그인(admin-token 쿠키) 없이는 접근 불가.
  // 미들웨어가 /api 를 제외하므로 여기서 직접 세션을 검증한다.
  if (!(await getSession())) {
    return NextResponse.json(
      { message: "인증이 필요합니다." },
      { status: 401 },
    );
  }

  const token = process.env.CONTRACT_ADMIN_API_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { message: "약정서 연동이 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  const segments = (path ?? []).map(encodeURIComponent).join("/");
  const suffix = segments ? `/${segments}` : "";
  const search = new URL(request.url).search;
  const target = `${UPSTREAM}${suffix}${search}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let body: string | undefined;
  if (request.method === "POST") {
    body = await request.text();
    const contentType = request.headers.get("content-type");
    if (contentType) headers["Content-Type"] = contentType;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { message: "약정서 서버에 연결하지 못했습니다." },
      { status: 502 },
    );
  }

  const payload = await upstream.arrayBuffer();
  const responseHeaders: Record<string, string> = {
    "Content-Type":
      upstream.headers.get("content-type") ?? "application/octet-stream",
    "Cache-Control": "no-store",
  };
  const csp = upstream.headers.get("content-security-policy");
  if (csp) responseHeaders["Content-Security-Policy"] = csp;

  return new NextResponse(payload, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return forward(request, path);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await context.params;
  return forward(request, path);
}
