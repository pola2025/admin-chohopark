import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMS_URL = process.env.CHOHO_FORMS_URL || "https://api.chorigol.net";
const TOKEN = process.env.CHOHO_FORMS_ADMIN_READ_TOKEN;

/**
 * 견적서 PDF 열람.
 *
 * 발송한 견적서는 R2 에 보관되지만 꺼내는 길이 없어서
 * 관리자가 고객에게 무엇을 보냈는지 확인할 방법이 없었다.
 * 버킷은 비공개라 이 경로를 거쳐야만 열린다.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
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

  const { id } = await context.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  try {
    const res = await fetch(`${FORMS_URL}/admin/quotes/${id}/pdf`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "보관된 견적서를 찾지 못했습니다" },
        { status: res.status === 404 ? 404 : 502 },
      );
    }
    return new NextResponse(res.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          res.headers.get("content-disposition") ?? "inline",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
