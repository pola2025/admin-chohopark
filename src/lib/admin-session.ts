import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

/**
 * 관리자 통계 API 공통 인증 — admin-token(JWT HS256, role=admin) 검증.
 * 미들웨어는 /api 를 통과시키므로 라우트마다 이 함수를 먼저 호출한다.
 * 통과하면 null, 실패하면 그대로 반환할 응답을 돌려준다.
 */
export async function requireAdminSession(): Promise<NextResponse | null> {
  const headers = { "Cache-Control": "private, no-store" };
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "fallback-secret" || secret.length < 24) {
    return NextResponse.json(
      { error: "인증 설정 오류" },
      { status: 503, headers },
    );
  }
  const token = (await cookies()).get("admin-token")?.value;
  if (!token)
    return NextResponse.json(
      { error: "관리자 로그인이 필요합니다." },
      { status: 401, headers },
    );
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] },
    );
    if (payload.role !== "admin" || !payload.exp) throw new Error("role");
  } catch {
    return NextResponse.json(
      { error: "관리자 로그인이 필요합니다." },
      { status: 401, headers },
    );
  }
  return null;
}
