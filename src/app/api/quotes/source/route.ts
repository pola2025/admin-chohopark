import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
const FORMS_URL = process.env.CHOHO_FORMS_URL || "https://api.chorigol.net";
const UPSTREAM_TIMEOUT_MS = 10_000;

export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = process.env.CHOHO_FORMS_ADMIN_READ_TOKEN?.trim();
  if (!token) return NextResponse.json({ error: "조회 권한이 설정되지 않았습니다." }, { status: 503 });
  const params = new URL(request.url).searchParams;
  const id = params.get("id") || "";
  const resource = params.get("kind") === "quote" ? "quotes" : "inquiries";
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "잘못된 문의 ID입니다." }, { status: 400 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`${FORMS_URL}/admin/${resource}/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ error: body?.error || "문의 원본을 불러오지 못했습니다." }, { status: response.status });
    return NextResponse.json({ inquiry: body?.inquiry ?? body?.item ?? body });
  } catch { return NextResponse.json({ error: "문의 원본을 불러오지 못했습니다." }, { status: 502 }); }
  finally { clearTimeout(timer); }
}
