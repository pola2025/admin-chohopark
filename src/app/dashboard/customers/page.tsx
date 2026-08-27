"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

/** 사람 단위로 묶인 고객 한 명 */
interface Customer {
  phone_key: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_company: string | null;
  product_name: string | null;
  use_date: string | null;
  people_count: number | null;
  total_amount: string | null;
  source_channel: string | null;
  contact_total: number;
  quote_count: number;
  quick_count: number;
  pdf_count: number;
  first_at: string;
  last_at: string;
  last_kind: string;
  last_id: number;
}

/** 한 고객이 남긴 접수 한 건 */
interface HistoryItem {
  kind: "quote" | "quick";
  id: number;
  customer_name: string;
  product_name: string | null;
  use_date: string | null;
  people_count: number | null;
  total_amount: string | null;
  pdf_r2_key: string | null;
  source_channel: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;
const KST = "Asia/Seoul";

/** 저장값은 UTC라 한국 시간으로 옮겨 표시한다. */
function kstDateTime(value: string): string {
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function kstDate(value: string): string {
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** 한 고객이 남긴 접수 이력. 표의 해당 행 바로 아래에서 펼친다. */
function HistoryPanel({
  loading,
  items,
}: {
  loading: boolean;
  items: HistoryItem[];
}) {
  if (loading) {
    return (
      <p className="px-5 py-4 text-[13px] text-[var(--gov-ink-sub)]">
        불러오는 중입니다.
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="px-5 py-4 text-[13px] text-[var(--gov-ink-sub)]">
        이력이 없습니다.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5 px-5 py-4">
      {items.map((h) => (
        <li
          key={`${h.kind}-${h.id}`}
          className="flex flex-wrap items-center gap-2 border border-[var(--gov-line)] bg-white px-3 py-2 text-[12.5px]"
        >
          <span
            className={`px-1.5 py-0.5 text-[11.5px] ${
              h.kind === "quote"
                ? "bg-[var(--gov-brand-weak)] text-[var(--gov-brand)]"
                : "bg-[#f1f2f5] text-[var(--gov-ink-sub)]"
            }`}
          >
            {h.kind === "quote" ? "견적문의" : "빠른문의"}
          </span>
          <span className="text-[var(--gov-ink-sub)]">
            {kstDateTime(h.created_at)}
          </span>
          <span>{h.product_name || "-"}</span>
          {h.people_count ? <span>{h.people_count}명</span> : null}
          {h.use_date ? (
            <span className="text-[var(--gov-ink-sub)]">희망 {h.use_date}</span>
          ) : null}
          {h.total_amount ? <span>{h.total_amount}</span> : null}
          {h.source_channel ? (
            <span className="text-[var(--gov-ink-sub)]">
              유입 {h.source_channel}
            </span>
          ) : null}
          {h.pdf_r2_key ? (
            <a
              href={`/api/customers/quote-pdf/${h.id}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto flex items-center gap-1 text-[var(--gov-brand)] underline"
            >
              <Icon name="download" size={14} />
              보낸 견적서
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [repeatOnly, setRepeatOnly] = useState(false);

  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (query) params.set("query", query);
    if (repeatOnly) params.set("repeat", "1");
    try {
      const res = await fetch(`/api/customers?${params}`);
      const body = await res.json();
      setItems(body.data ?? []);
      setTotal(body.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [offset, query, repeatOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const openHistory = async (phone: string) => {
    if (openPhone === phone) {
      setOpenPhone(null);
      return;
    }
    setOpenPhone(phone);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/customers?phone=${encodeURIComponent(phone)}`,
      );
      const body = await res.json();
      setHistory(body.data ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-[var(--gov-ink-sub)]">
        견적문의와 빠른문의를 연락처 기준으로 묶어 사람 단위로 봅니다. 같은
        담당자가 여러 번 남긴 접수가 한 줄로 모입니다.
      </p>

      <section className="border border-[var(--gov-line)] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--gov-line)] px-5 py-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setOffset(0);
              setQuery(queryInput.trim());
            }}
          >
            <div className="relative">
              <Icon
                name="search"
                size={16}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--gov-ink-sub)]"
              />
              <input
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                placeholder="이름 · 연락처 · 업체"
                className="h-9 w-56 border border-[var(--gov-line-strong)] pl-8 pr-3 text-[13px] outline-none focus:border-[var(--gov-brand)]"
              />
            </div>
            <button
              type="submit"
              className="h-9 bg-[var(--gov-brand)] px-4 text-[13px] font-medium text-white"
            >
              검색
            </button>
          </form>

          <label className="ml-1 flex items-center gap-1.5 text-[13px]">
            <input
              type="checkbox"
              checked={repeatOnly}
              onChange={(e) => {
                setOffset(0);
                setRepeatOnly(e.target.checked);
              }}
            />
            2회 이상 접수한 고객만
          </label>

          <span className="ml-auto text-[13px] text-[var(--gov-ink-sub)]">
            {loading ? "불러오는 중" : `${total.toLocaleString()}명`}
          </span>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-[13px] text-[var(--gov-ink-sub)]">
            불러오는 중입니다.
          </p>
        ) : items.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-[var(--gov-ink-sub)]">
            조건에 맞는 고객이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="border-t-2 border-[var(--gov-brand)] bg-[#fafbfc] text-left">
                  <th className="px-5 py-2.5 font-semibold">고객</th>
                  <th className="w-[130px] px-3 py-2.5 font-semibold">
                    연락처
                  </th>
                  <th className="w-[150px] px-3 py-2.5 font-semibold">
                    최근 문의 내용
                  </th>
                  <th className="w-[110px] px-3 py-2.5 font-semibold">
                    희망 이용일
                  </th>
                  <th className="w-[124px] whitespace-nowrap px-3 py-2.5 font-semibold">
                    접수
                  </th>
                  <th className="w-[110px] px-3 py-2.5 font-semibold">
                    최근 접수
                  </th>
                  <th className="w-[112px] whitespace-nowrap px-5 py-2.5 font-semibold">
                    접수 이력
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <Fragment key={c.phone_key}>
                    <tr className="border-b border-[var(--gov-line)] align-top hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium">
                          {c.customer_company?.trim() || c.customer_name}
                        </div>
                        <div className="text-[12px] text-[var(--gov-ink-sub)]">
                          {c.customer_company?.trim() ? c.customer_name : ""}
                          {c.customer_email ? ` · ${c.customer_email}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <a
                          href={`tel:${c.customer_phone}`}
                          className="text-[var(--gov-brand)]"
                        >
                          {c.customer_phone}
                        </a>
                      </td>
                      <td className="px-3 py-3">
                        {c.product_name || "-"}
                        {c.people_count ? (
                          <span className="text-[var(--gov-ink-sub)]">
                            {" "}
                            {c.people_count}명
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-[var(--gov-ink-sub)]">
                        {c.use_date || "-"}
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium">{c.contact_total}회</span>
                        <div className="whitespace-nowrap text-[11.5px] text-[var(--gov-ink-sub)]">
                          견적 {c.quote_count} · 문의 {c.quick_count}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[var(--gov-ink-sub)]">
                        {kstDate(c.last_at)}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => void openHistory(c.phone_key)}
                          className="text-[var(--gov-brand)] underline"
                        >
                          {openPhone === c.phone_key ? "접기" : "펼쳐 보기"}
                        </button>
                      </td>
                    </tr>
                    {openPhone === c.phone_key ? (
                      <tr className="border-b border-[var(--gov-line)]">
                        <td colSpan={7} className="bg-[#fafbfc] p-0">
                          <HistoryPanel
                            loading={historyLoading}
                            items={history}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3 border-t border-[var(--gov-line)] px-5 py-3">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="h-8 border border-[var(--gov-line-strong)] px-3 text-[13px] disabled:opacity-40"
            >
              이전
            </button>
            <span className="text-[13px]">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="h-8 border border-[var(--gov-line-strong)] px-3 text-[13px] disabled:opacity-40"
            >
              다음
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
