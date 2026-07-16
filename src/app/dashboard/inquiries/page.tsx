"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Item {
  id: number;
  kind: "quick" | "quote";
  kind_label: string;
  product_name: string | null;
  people_count: number | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_company: string | null;
  customer_memo: string | null;
  total_amount: string | null;
  deposit_amount: string | null;
  use_date: string | null;
  quote_number: string | null;
  source: string | null;
  source_channel: string | null;
  created_at: string;
}

function kindBadge(kind: string) {
  return kind === "quote"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-blue-100 text-blue-800";
}

function sourceBadge(src: string | null) {
  const s = src || "";
  if (s.includes("파워링크")) return "bg-green-600 text-white";
  if (s.includes("스마트플레이스")) return "bg-green-100 text-green-800";
  if (s.includes("블로그")) return "bg-lime-100 text-lime-800";
  if (s.includes("네이버")) return "bg-emerald-50 text-emerald-700";
  if (s.includes("구글")) return "bg-amber-100 text-amber-800";
  if (s.includes("인스타")) return "bg-pink-100 text-pink-800";
  if (s.includes("페이스북")) return "bg-indigo-100 text-indigo-800";
  if (s.includes("직접")) return "bg-gray-100 text-gray-600";
  return "bg-gray-100 text-gray-700";
}

function fmtDate(v: string) {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function InquiriesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inquiries", { cache: "no-store" });
      const data = await res.json();
      setItems(data.data || []);
    } catch {
      toast.error("접수 내역을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (item: Item) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/inquiries/${item.id}?kind=${item.kind}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("삭제되었습니다");
        setItems((prev) =>
          prev.filter((i) => !(i.id === item.id && i.kind === item.kind)),
        );
      } else {
        toast.error("삭제 실패");
      }
    } catch {
      toast.error("오류 발생");
    }
  };

  const quoteCount = items.filter((i) => i.kind === "quote").length;
  const quickCount = items.filter((i) => i.kind === "quick").length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">접수 내역</h1>
          <p className="mt-1 text-sm text-gray-500">
            견적문의 {quoteCount}건 · 빠른문의 {quickCount}건
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          새로고침
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-500">로딩 중...</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-gray-500">
            접수된 문의가 없습니다
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Card
              key={`${item.kind}-${item.id}`}
              className="transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${kindBadge(item.kind)}`}
                  >
                    {item.kind_label}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sourceBadge(item.source_channel)}`}
                  >
                    {item.source_channel || "직접"}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {fmtDate(item.created_at)}
                  </span>
                </div>
                <CardTitle className="pt-1 text-base">
                  {item.customer_company || item.customer_name || "고객"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">상품</span>
                  <span className="font-medium">
                    {item.product_name || "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="shrink-0 text-gray-500">이용일</span>
                  <span className="text-right font-medium">
                    {item.use_date || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">인원</span>
                  <span className="font-medium">
                    {item.people_count ? `${item.people_count}명` : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">담당자</span>
                  <span className="font-medium">{item.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">연락처</span>
                  <span className="font-medium">{item.customer_phone}</span>
                </div>
                {item.kind === "quote" && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">견적금액</span>
                    <span className="font-bold text-emerald-700">
                      {item.total_amount || "-"}
                    </span>
                  </div>
                )}
                <div className="flex gap-2 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setSelected(item)}
                  >
                    상세
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(item)}
                  >
                    삭제
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selected?.kind_label} 상세
              {selected?.quote_number ? ` · ${selected.quote_number}` : ""}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Detail
                  label="유입출처"
                  value={selected.source_channel || "직접"}
                />
                <Detail label="상품" value={selected.product_name} />
                <Detail
                  label="인원"
                  value={
                    selected.people_count ? `${selected.people_count}명` : null
                  }
                />
                <Detail label="이용일" value={selected.use_date} />
                <Detail label="업체" value={selected.customer_company} />
                <Detail label="담당자" value={selected.customer_name} />
                <Detail label="연락처" value={selected.customer_phone} />
                <Detail label="이메일" value={selected.customer_email} />
                <Detail label="견적금액" value={selected.total_amount} />
                <Detail label="계약금" value={selected.deposit_amount} />
              </div>
              {selected.customer_memo && (
                <div>
                  <span className="text-sm text-gray-500">메모</span>
                  <p className="mt-1 rounded bg-gray-50 p-3 text-sm">
                    {selected.customer_memo}
                  </p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button variant="outline" onClick={() => setSelected(null)}>
                  닫기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-gray-500">{label}:</span>
      <span className="ml-2 font-medium">{value || "-"}</span>
    </div>
  );
}
