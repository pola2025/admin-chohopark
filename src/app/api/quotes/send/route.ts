import { NextResponse } from "next/server";
import { readQuoteBody, requireQuoteAdmin, upstreamError } from "@/app/api/quotes/_auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const UPSTREAM = "https://api.chorigol.net/admin/quotes/send";
const UPSTREAM_TIMEOUT_MS = 55_000;

export async function POST(request: Request) {
  const denied = await requireQuoteAdmin(request);
  if (denied) return denied;
  const token = process.env.CHOHO_FORMS_ADMIN_WRITE_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "발송 쓰기 권한이 설정되지 않았습니다." }, { status: 503 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(UPSTREAM, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(await readQuoteBody(request)), cache: "no-store", signal: controller.signal });
    const text = await response.text();
    try { return NextResponse.json(JSON.parse(text), { status: response.status }); } catch { return NextResponse.json({ error: "발송 응답이 올바르지 않습니다." }, { status: 502 }); }
  } catch (error) { if (error instanceof Error && error.message === "payload-too-large") return NextResponse.json({ error: "요청 크기가 너무 큽니다." }, { status: 413 }); return upstreamError(); }
  finally { clearTimeout(timer); }
}
