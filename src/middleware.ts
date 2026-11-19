import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import {
  CRAWLER_RE,
  classify,
  mintCanary,
  renderBait,
  resolveClientIp,
  sendReport,
  shouldReport,
  type SiteInfo,
} from "@/lib/guard";

// 이 미들웨어는 두 가지를 한다.
// 1) 스캐너 대응(2026-11-19, chorigol.net 미들웨어와 같은 장치. 설명은 src/lib/guard.ts 맨 위).
//    미끼 경로(/.env · /.git/config · wp-* · .php 등)에 가짜 설정 파일(200) 또는 404 를 주고 접속 IP 를
//    api.chorigol.net/guard-report 로 서명해 신고한다 → choho-forms Worker 가 Vercel 방화벽 차단 목록에 올린다.
//    검색엔진 · 링크 미리보기 로봇은 신고 없이 404. GUARD_SECRET 이 없으면 미끼 경로는 404 만 준다.
// 2) 대시보드 로그인 확인(예전 그대로).

// 신고 · 함정 주소의 바탕은 api.chorigol.net 고정이다. GUARD_REPORT_URL · GUARD_TRAP_BASE 는 로컬 검증 전용이다.
const API_BASE = "https://api.chorigol.net";
const SITE: SiteInfo = {
  key: "chorigol-admin",
  domain: "chorigol.net",
  db: "choho",
  api: API_BASE,
};

const NO_INDEX = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "X-Content-Type-Options": "nosniff",
};
const notFound = () =>
  new NextResponse("Not Found\n", {
    status: 404,
    headers: { ...NO_INDEX, "Content-Type": "text/plain; charset=utf-8" },
  });

// Vercel 은 x-real-ip · x-forwarded-for 를 방문자 주소로 덮어쓴다(방문자가 지어 보낸 값은 남지 않는다).
function clientIp(req: NextRequest) {
  const peer =
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    "";
  return resolveClientIp(peer, req.headers.get("cf-connecting-ip"));
}

const trapBase = () =>
  (process.env.GUARD_TRAP_BASE || API_BASE).replace(/\/+$/, "");
const reportUrl = () =>
  process.env.GUARD_REPORT_URL || `${API_BASE}/guard-report`;

/** 미끼 경로면 응답을, 아니면 null(아래 로그인 확인으로 계속)을 돌려준다. */
async function guard(req: NextRequest, event: NextFetchEvent) {
  const path = req.nextUrl.pathname;
  const kind = classify(path);
  if (!kind) return null;
  const secret = process.env.GUARD_SECRET || "";
  const ua = req.headers.get("user-agent") || "";
  if (!secret || CRAWLER_RE.test(ua)) return notFound();

  const ip = clientIp(req);
  if (shouldReport(ip, "trap"))
    event.waitUntil(
      sendReport(reportUrl(), secret, {
        reason: "trap",
        site: SITE.key,
        ip,
        path,
        ua,
        kind,
      }),
    );
  if (kind === "none") return notFound();
  const [a, b, t] = await Promise.all([
    mintCanary(secret, ip),
    mintCanary(secret, ip),
    mintCanary(secret, ip, Date.now(), "trap"),
  ]);
  return new NextResponse(
    req.method === "HEAD"
      ? null
      : renderBait(kind, SITE, a, b, { trapBase: `${trapBase()}/trap/${t}` }),
    {
      status: 200,
      headers: { ...NO_INDEX, "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const guarded = await guard(request, event);
  if (guarded) return guarded;

  const token = request.cookies.get("admin-token")?.value;
  const { pathname } = request.nextUrl;

  // 로그인 페이지는 인증 체크 제외
  if (pathname === "/login") {
    // 이미 로그인된 경우 대시보드로 리다이렉트
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // API 라우트는 제외 (각 API에서 처리)
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // 보호된 라우트 (dashboard 하위)
  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 루트 경로 처리
  if (pathname === "/") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard/:path*",
    // 미끼 경로(chorigol.net 미들웨어와 같은 목록). 페이지 · 정적 파일 · /api 요청은 여기에 걸리지 않는다.
    "/((?:.*/)?\\.(?!well-known(?:/|$)).*)",
    "/(.*\\.(?:php\\d?|sql|bak|old|swp|pem|key|ini|ya?ml)(?:[./].*)?)",
    "/((?:wp-admin|wp-includes|wp-content|wp-json|wp-login|cgi-bin|phpmyadmin|pma|myadmin|actuator|vendor|_profiler|telescope|solr|owa|HNAP1|boaform)(?:/.*)?)",
    "/((?:.*/)?(?:config|credentials|secrets?|settings|appsettings|env|serviceaccount)\\.json)",
  ],
};
