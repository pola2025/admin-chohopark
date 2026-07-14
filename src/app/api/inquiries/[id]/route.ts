import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMS_URL = process.env.CHOHO_FORMS_URL || "https://api.chorigol.net";
const TOKEN = process.env.CHOHO_FORMS_ADMIN_READ_TOKEN;

// kind=quote → quotes, 그 외 → inquiries 테이블에서 삭제 (choho-forms Worker 경유).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!TOKEN) {
    return NextResponse.json(
      { error: "CHOHO_FORMS_ADMIN_READ_TOKEN 미설정" },
      { status: 503 },
    );
  }
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "잘못된 ID" }, { status: 400 });
  }
  const kind = new URL(request.url).searchParams.get("kind");
  const table = kind === "quote" ? "quotes" : "inquiries";
  try {
    const res = await fetch(`${FORMS_URL}/admin/${table}/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "삭제 오류" }, { status: 500 });
  }
}
