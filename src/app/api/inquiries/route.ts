import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMS_URL = process.env.CHOHO_FORMS_URL || "https://api.chorigol.net";
const TOKEN = process.env.CHOHO_FORMS_ADMIN_READ_TOKEN;

async function fetchList(path: string) {
  const res = await fetch(`${FORMS_URL}${path}?limit=200`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const body = await res.json();
  return Array.isArray(body.items) ? body.items : [];
}

// 견적문의(quotes) + 빠른문의(inquiries)를 D1(choho-forms Worker)에서 병합 조회.
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: "CHOHO_FORMS_ADMIN_READ_TOKEN 미설정" },
      { status: 503 },
    );
  }
  try {
    const [inquiries, quotes] = await Promise.all([
      fetchList("/admin/inquiries"),
      fetchList("/admin/quotes"),
    ]);
    const data = [
      ...inquiries.map((r: Record<string, unknown>) => ({
        ...r,
        kind: "quick",
        kind_label: "빠른문의",
      })),
      ...quotes.map((r: Record<string, unknown>) => ({
        ...r,
        people_count: r.people,
        kind: "quote",
        kind_label: "견적문의",
      })),
    ].sort((a, b) =>
      String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
    );
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
