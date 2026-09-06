import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const MAX_BODY_BYTES = 3 * 1024 * 1024;

export async function requireQuoteAdmin(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "허용되지 않은 요청 출처입니다." }, { status: 403 });
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return NextResponse.json({ error: "요청 크기가 너무 큽니다." }, { status: 413 });
  return null;
}

export async function readQuoteBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("payload-too-large");
  return JSON.parse(text);
}

export function upstreamError() { return NextResponse.json({ error: "견적 API에 연결하지 못했습니다." }, { status: 502 }); }
