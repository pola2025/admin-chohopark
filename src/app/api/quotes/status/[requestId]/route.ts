import { NextResponse } from "next/server";
import { requireQuoteAdmin, upstreamError } from "@/app/api/quotes/_auth";

export const runtime = "nodejs";
const UPSTREAM_TIMEOUT_MS = 10_000;

export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const denied = await requireQuoteAdmin(request);
  if (denied) return denied;
  const token = process.env.CHOHO_FORMS_ADMIN_WRITE_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "발송 쓰기 권한이 설정되지 않았습니다." }, { status: 503 });
  const requestId = (await params).requestId;
  if (!/^[0-9a-f-]{20,80}$/i.test(requestId)) return NextResponse.json({ error: "잘못된 요청 ID입니다." }, { status: 400 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`https://api.chorigol.net/admin/quotes/dispatch/${encodeURIComponent(requestId)}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
    const text = await response.text();
    try { return NextResponse.json(JSON.parse(text), { status: response.status }); } catch { return NextResponse.json({ error: "상태 응답이 올바르지 않습니다." }, { status: 502 }); }
  } catch { return upstreamError(); }
  finally { clearTimeout(timer); }
}
