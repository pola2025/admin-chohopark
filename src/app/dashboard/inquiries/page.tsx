"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  assignVisitNumbers,
  parseCreatedAt,
  type HistoryEntry,
} from "@/lib/inquiry-history";
import { DemandHeatmap, type DemandRow } from "@/components/DemandHeatmap";

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
  balance_amount: string | null;
  seminar_room: string | null;
  use_date: string | null;
  quote_number: string | null;
  source: string | null;
  source_channel: string | null;
  landing_url: string | null;
  email_sent: number | null;
  sms_sent: number | null;
  telegram_sent: number | null;
  created_at: string;
  contact_total: number;
}

type KindFilter = "all" | "quote" | "quick";

const KST = "Asia/Seoul";
const PAGE_SIZE = 50;

function kindBadge(kind: string) {
  return kind === "quote"
    ? "bg-[#dce5f1] text-[#132a4f]"
    : "bg-blue-100 text-blue-800";
}

function sourceBadge(src: string | null) {
  const s = src || "";
  if (s.includes("파워링크")) return "bg-[var(--gov-ok)] text-white";
  if (s.includes("스마트플레이스")) return "bg-[#dbe8dd] text-[#164423]";
  if (s.includes("블로그")) return "bg-lime-100 text-lime-800";
  if (s.includes("네이버")) return "bg-[var(--gov-brand-weak)] text-[var(--gov-brand)]";
  if (s.includes("구글")) return "bg-[#efe5d3] text-[#6d3b06]";
  if (s.includes("인스타")) return "bg-[#ece7f0] text-[#3d3546]";
  if (s.includes("페이스북")) return "bg-indigo-100 text-indigo-800";
  return "bg-gray-100 text-gray-600";
}

/** 저장값은 UTC라 한국 시간으로 옮겨서 표시하고 날짜를 나눈다. */
function kstParts(value: string) {
  const date = parseCreatedAt(value);
  if (Number.isNaN(date.getTime())) {
    return { dayKey: value.slice(0, 10), dayLabel: value, time: "", date };
  }
  return {
    dayKey: date.toLocaleDateString("en-CA", { timeZone: KST }),
    dayLabel: date.toLocaleDateString("ko-KR", {
      timeZone: KST,
      month: "long",
      day: "numeric",
      weekday: "short",
    }),
    time: date.toLocaleTimeString("ko-KR", {
      timeZone: KST,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    date,
  };
}

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: KST });
}

function fullStamp(value: string) {
  const { date } = kstParts(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("ko-KR", {
        timeZone: KST,
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
}

export default function InquiriesPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Item | null>(null);

  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [useDate, setUseDate] = useState<string | null>(null);

  const [demand, setDemand] = useState<DemandRow[]>([]);
  const [demandLoading, setDemandLoading] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const buildParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (kind !== "all") params.set("kind", kind);
      if (appliedQuery) params.set("query", appliedQuery);
      if (useDate) params.set("use_date", useDate);
      return params;
    },
    [kind, appliedQuery, useDate],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(null);
    try {
      const res = await fetch(`/api/inquiries?${buildParams(0)}`, {
        cache: "no-store",
      });
      const body = await res.json();
      setItems(body.data || []);
      setTotal(body.total || 0);
      setHasMore(Boolean(body.hasMore));
    } catch {
      toast.error("접수 내역을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/inquiries?${buildParams(items.length)}`, {
        cache: "no-store",
      });
      const body = await res.json();
      setItems((prev) => [...prev, ...(body.data || [])]);
      setHasMore(Boolean(body.hasMore));
    } catch {
      toast.error("추가 내역을 불러오지 못했습니다");
    } finally {
      setLoadingMore(false);
    }
  };

  const loadDemand = useCallback(async () => {
    setDemandLoading(true);
    try {
      const res = await fetch("/api/demand", { cache: "no-store" });
      const body = await res.json();
      setDemand(body.data || []);
    } catch {
      // 히트맵 실패가 목록을 막지 않는다.
    } finally {
      setDemandLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadDemand();
  }, [loadDemand]);

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
        setTotal((prev) => Math.max(0, prev - 1));
        setSelected(null);
        void loadDemand();
      } else {
        toast.error("삭제 실패");
      }
    } catch {
      toast.error("오류 발생");
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; rows: Item[] }>();
    for (const item of items) {
      const { dayKey, dayLabel } = kstParts(item.created_at);
      const bucket = map.get(dayKey);
      if (bucket) bucket.rows.push(item);
      else map.set(dayKey, { label: dayLabel, rows: [item] });
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [items]);

  const today = todayKey();
  const useDateLabel = useDate
    ? new Date(`${useDate}T00:00:00Z`).toLocaleDateString("ko-KR", {
        timeZone: "UTC",
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : "";

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mt-1 text-sm text-gray-600">
            조건에 맞는 접수 <b>{total}건</b>
            {items.length < total ? (
              <span className="text-gray-400"> · {items.length}건 표시 중</span>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHeatmap((prev) => !prev)}
          >
            {showHeatmap ? "히트맵 접기" : "히트맵 펼치기"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void load();
              void loadDemand();
            }}
            disabled={loading}
          >
            새로고침
          </Button>
        </div>
      </header>

      {showHeatmap ? (
        <DemandHeatmap
          rows={demand}
          loading={demandLoading}
          selectedDate={useDate}
          onSelectDate={setUseDate}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-sm border border-gray-200 bg-white p-3">
        <form
          className="flex min-w-[220px] flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedQuery(query.trim());
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름 · 연락처 · 업체 · 견적번호 검색"
            className="min-w-0 flex-1 rounded-sm border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[var(--gov-brand)] focus:ring-2 focus:ring-[#dce5f1]"
          />
          <Button type="submit" size="sm">
            검색
          </Button>
        </form>
        <div className="flex overflow-hidden rounded-sm border border-gray-300 text-sm">
          {(
            [
              ["all", "전체"],
              ["quote", "견적문의"],
              ["quick", "빠른문의"],
            ] as Array<[KindFilter, string]>
          ).map(([value, label], index) => (
            <button
              key={value}
              onClick={() => setKind(value)}
              className={`px-3 py-2 ${index ? "border-l border-gray-300" : ""} ${
                kind === value
                  ? "bg-[var(--gov-brand)] font-semibold text-white"
                  : "bg-white hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {useDate ? (
          <button
            onClick={() => setUseDate(null)}
            className="rounded-sm bg-[var(--gov-brand)] px-3 py-2 text-sm font-semibold text-white"
          >
            이용일 {useDateLabel} ✕
          </button>
        ) : null}
        {appliedQuery ? (
          <button
            onClick={() => {
              setQuery("");
              setAppliedQuery("");
            }}
            className="rounded-sm border border-gray-300 px-3 py-2 text-sm"
          >
            검색어 “{appliedQuery}” ✕
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="overflow-hidden rounded-sm border border-gray-200 bg-white">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-500">
              불러오는 중입니다.
            </div>
          ) : groups.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-500">
              조건에 맞는 접수가 없습니다.
            </div>
          ) : (
            <>
              {groups.map(([dayKey, group]) => (
                <div key={dayKey}>
                  <div className="sticky top-0 z-10 flex items-baseline justify-between border-y border-gray-200 bg-gray-50/95 px-4 py-2 backdrop-blur">
                    <h2 className="text-sm font-bold text-gray-900">
                      {group.label}
                      {dayKey === today ? (
                        <span className="ml-1.5 rounded bg-[#dce5f1] px-1.5 py-0.5 text-xs font-semibold text-[#132a4f]">
                          오늘
                        </span>
                      ) : null}
                    </h2>
                    <span className="text-xs text-gray-500">
                      {group.rows.length}건
                    </span>
                  </div>
                  {group.rows.map((item) => {
                    const active =
                      selected?.id === item.id && selected?.kind === item.kind;
                    return (
                      <button
                        key={`${item.kind}-${item.id}`}
                        onClick={() => setSelected(item)}
                        className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left ${
                          active
                            ? "bg-[var(--gov-brand-weak)] shadow-[inset_3px_0_0_#047857]"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <span className="w-11 shrink-0 text-xs tabular-nums text-gray-500">
                          {kstParts(item.created_at).time}
                        </span>
                        <span
                          className={`w-16 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-bold ${kindBadge(item.kind)}`}
                        >
                          {item.kind_label}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                            {item.customer_company || item.customer_name}
                            {item.customer_company ? (
                              <span className="font-normal text-gray-400">
                                · {item.customer_name}
                              </span>
                            ) : null}
                            {item.contact_total > 1 ? (
                              <span className="shrink-0 rounded bg-[#efe5d3] px-1.5 py-0.5 text-[11px] font-bold text-[#6d3b06]">
                                재문의
                              </span>
                            ) : null}
                          </span>
                          <span className="block truncate text-xs text-gray-500">
                            {item.product_name || "상품 미선택"}
                            {item.people_count
                              ? ` · ${item.people_count}명`
                              : ""}
                          </span>
                        </span>
                        <span className="hidden w-40 shrink-0 truncate text-xs text-gray-600 sm:block">
                          {item.use_date || "-"}
                        </span>
                        <span
                          className={`w-24 shrink-0 text-right text-sm ${
                            item.total_amount
                              ? "font-bold text-[var(--gov-brand)]"
                              : "text-gray-400"
                          }`}
                        >
                          {item.total_amount || "—"}
                        </span>
                        <span className="hidden w-24 shrink-0 text-center lg:block">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs ${sourceBadge(item.source_channel)}`}
                          >
                            {item.source_channel || "직접"}
                          </span>
                        </span>
                        <span className="shrink-0 text-gray-300">›</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {hasMore ? (
                <div className="px-4 py-4 text-center">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore
                      ? "불러오는 중..."
                      : `이전 내역 더 보기 (${total - items.length}건 남음)`}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          {selected ? (
            <DetailCard
              item={selected}
              onClose={() => setSelected(null)}
              onDelete={() => handleDelete(selected)}
            />
          ) : (
            <Card className="hidden xl:block">
              <CardContent className="py-16 text-center text-sm text-gray-500">
                왼쪽 목록에서 접수를 선택하면
                <br />
                상세 내용이 여기 표시됩니다.
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailCard({
  item,
  onClose,
  onDelete,
}: {
  item: Item;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (item.contact_total <= 1) {
      setHistory([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/inquiries/history?phone=${encodeURIComponent(item.customer_phone)}`,
          { cache: "no-store" },
        );
        const body = await res.json();
        if (alive) setHistory(assignVisitNumbers(body.data || []));
      } catch {
        if (alive) setHistory([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [item.customer_phone, item.contact_total]);

  const current = history.find(
    (entry) => entry.id === item.id && entry.kind === item.kind,
  );
  const visitTotal = history.length
    ? Math.max(...history.map((entry) => entry.visitNo))
    : 1;

  const sent = [
    ["이메일", item.email_sent],
    ["문자", item.sms_sent],
    ["텔레그램", item.telegram_sent],
  ] as Array<[string, number | null]>;

  return (
    <div className="overflow-hidden rounded-sm border border-gray-200 bg-white">
      <div
        className={`border-b border-gray-200 px-4 py-3 ${item.kind === "quote" ? "bg-[var(--gov-brand-weak)]" : "bg-blue-50"}`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${kindBadge(item.kind)}`}
          >
            {item.kind_label}
          </span>
          {item.quote_number ? (
            <span className="text-xs font-semibold text-gray-700">
              {item.quote_number}
            </span>
          ) : null}
          <button
            onClick={onClose}
            className="ml-auto text-gray-400 hover:text-gray-700"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <h3 className="mt-1.5 flex flex-wrap items-center gap-2 text-lg font-bold text-gray-900">
          {item.customer_company || item.customer_name}
          {visitTotal > 1 && current ? (
            <span className="rounded bg-[#efe5d3] px-2 py-0.5 text-xs font-bold text-[#6d3b06]">
              {current.visitNo}회차 / 총 {visitTotal}회
            </span>
          ) : null}
        </h3>
        <p className="text-xs text-gray-600">
          {fullStamp(item.created_at)} 접수 · 유입{" "}
          <b>{item.source_channel || "직접"}</b>
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        <Section title="예약 희망">
          <Row label="상품" value={item.product_name} />
          <Row label="이용일" value={item.use_date} />
          <Row
            label="인원"
            value={item.people_count ? `${item.people_count}명` : null}
          />
          {item.seminar_room ? (
            <Row label="세미나룸" value={item.seminar_room} />
          ) : null}
        </Section>

        {item.total_amount ? (
          <Section title="견적 금액">
            <div className="rounded-sm bg-gray-50 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-gray-600">총 이용금액</span>
                <span className="text-lg font-bold text-[var(--gov-brand)]">
                  {item.total_amount}
                </span>
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-gray-600">
                <span>계약금 {item.deposit_amount || "-"}</span>
                <span>잔금 {item.balance_amount || "-"}</span>
              </div>
            </div>
          </Section>
        ) : null}

        <Section title="연락처">
          <Row label="담당자" value={item.customer_name} />
          <div className="grid grid-cols-[70px_1fr] text-sm">
            <span className="text-gray-500">연락처</span>
            <a
              href={`tel:${item.customer_phone.replace(/\D/g, "")}`}
              className="font-medium text-[var(--gov-brand)] underline"
            >
              {item.customer_phone}
            </a>
          </div>
          <Row label="이메일" value={item.customer_email} />
          <Row label="업체" value={item.customer_company} />
        </Section>

        {item.customer_memo ? (
          <Section title="고객 메모">
            <p className="rounded-sm bg-[var(--gov-warn-weak)] p-3 text-sm leading-relaxed text-gray-800">
              {item.customer_memo}
            </p>
          </Section>
        ) : null}

        {history.length > 1 ? (
          <Section title={`접수 이력 · ${history.length}건`}>
            <ol className="space-y-2 border-l border-gray-200 pl-3 text-sm">
              {[...history].reverse().map((entry) => {
                const isCurrent =
                  entry.id === item.id && entry.kind === item.kind;
                return (
                  <li
                    key={`${entry.kind}-${entry.id}`}
                    className={isCurrent ? "text-[#132a4f]" : "text-gray-700"}
                  >
                    <span className="text-xs text-gray-500">
                      {fullStamp(entry.created_at)}
                    </span>
                    <br />
                    <span className={isCurrent ? "font-semibold" : ""}>
                      {entry.visitNo}회차 · {entry.kind_label}
                      {entry.product_name ? ` · ${entry.product_name}` : ""}
                      {entry.people_count ? ` ${entry.people_count}명` : ""}
                      {isCurrent ? " (지금 보는 건)" : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Section>
        ) : null}

        <Section title="발송 상태">
          <div className="flex flex-wrap gap-1.5 text-xs">
            {sent.map(([label, value]) => (
              <span
                key={label}
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  value
                    ? "bg-[#dce5f1] text-[#132a4f]"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {value ? "예" : "—"} {label}
              </span>
            ))}
          </div>
          {item.landing_url ? (
            <p className="mt-2 break-all text-xs text-gray-500">
              유입 경로: {item.landing_url}
            </p>
          ) : null}
        </Section>
      </div>

      <div className="flex gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
        <a
          href={`tel:${item.customer_phone.replace(/\D/g, "")}`}
          className="flex-1 rounded-sm bg-[var(--gov-brand)] px-3 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#132a4f]"
        >
          전화 걸기
        </a>
        <Button variant="destructive" onClick={onDelete}>
          삭제
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-xs font-bold text-gray-400">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[70px_1fr] text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={value ? "font-medium" : "text-gray-400"}>
        {value || "미입력"}
      </span>
    </div>
  );
}
