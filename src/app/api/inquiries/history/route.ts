import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMS_URL = process.env.CHOHO_FORMS_URL || "https://api.chorigol.net";
const TOKEN = process.env.CHOHO_FORMS_ADMIN_READ_TOKEN;

/** 한 연락처의 접수 이력 — 상세 카드에서 회차를 셀 때만 부른다. */
export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: "CHOHO_FORMS_ADMIN_READ_TOKEN 미설정" },
      { status: 503 },
    );
  }

  const phone = new URL(request.url).searchParams.get("phone") ?? "";
  if (phone.replace(/\D/g, "").length < 9) {
    return NextResponse.json({ error: "연락처가 필요합니다" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${FORMS_URL}/admin/history?phone=${encodeURIComponent(phone)}`,
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
        next: { revalidate: 20 },
      },
    );
    if (!res.ok) {
      return NextResponse.json({ error: "이력 조회 실패" }, { status: 502 });
    }
    const body = await res.json();
    return NextResponse.json({ data: body.items ?? [] });
  } catch {
    return NextResponse.json({ error: "이력 조회 실패" }, { status: 500 });
  }
}
