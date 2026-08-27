"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";

interface Reservation {
  id: string;
  contractNumber: string;
  status: string;
  productName: string;
  useDate: string;
  endDate: string | null;
  people: number;
  totalAmount: number;
  balanceAmount: number;
  calendarEventId: string | null;
  confirmedAt: string | null;
}

interface ReservationCustomer {
  phoneKey: string;
  company: string;
  customerName: string;
  phone: string;
  email: string;
  contactTitle: string;
  reservationCount: number;
  totalAmount: number;
  balanceAmount: number;
  nextUseDate: string | null;
  lastUseDate: string;
  reservations: Reservation[];
}

const PAGE_SIZE = 20;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 약정서에는 하이픈 없이 저장된 번호가 섞여 있어 보기 좋게 끊는다. */
function formatPhone(value: string): string {
  const d = value.replace(/[^0-9]/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return value;
}

function money(value: number): string {
  return value.toLocaleString("ko-KR");
}

/** `2026-09-15` 를 `2026-09-15 (화)` 로 바꾼다. */
function dateWithWeekday(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const weekday = WEEKDAYS[new Date(`${value}T00:00:00Z`).getUTCDay()] ?? "";
  return `${value} (${weekday})`;
}

function statusBadge(status: string) {
  if (status === "confirmed") {
    return {
      label: "확정",
      className:
        "bg-[var(--gov-ok-weak)] text-[var(--gov-ok)] border-[var(--gov-ok)]/30",
    };
  }
  return {
    label: "서명 대기",
    className:
      "bg-[var(--gov-warn-weak)] text-[var(--gov-warn)] border-[var(--gov-warn)]/30",
  };
}

export default function ReservationCustomersPage() {
  const [items, setItems] = useState<ReservationCustomer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    if (query) params.set("query", query);
    try {
      const res = await fetch(`/api/contract-proxy/customers?${params}`);
      if (!res.ok) {
        setItems([]);
        setMessage("고객 목록을 불러오지 못했습니다.");
        return;
      }
      const body = await res.json();
      setItems(body.items ?? []);
      setTotal(body.total ?? 0);
      setTotalPages(body.totalPages ?? 1);
    } catch {
      setItems([]);
      setMessage("고객 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-[var(--gov-ink-sub)]">
        약정서에 입금 확인이 끝나 예약이 확정된 고객입니다. 같은 업체가 여러 번
        왔으면 한 줄로 묶이고, 다가오는 예약이 있는 고객이 앞에 옵니다.
      </p>

      {message ? (
        <p
          role="alert"
          className="border border-[#e2c4c4] bg-[var(--gov-danger-weak)] p-4 text-[13px] text-[var(--gov-danger)]"
        >
          {message}
        </p>
      ) : null}

      <section className="border border-[var(--gov-line)] bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--gov-line)] px-5 py-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
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
                placeholder="업체 · 담당자 · 연락처 · 약정번호"
                className="h-9 w-64 border border-[var(--gov-line-strong)] pl-8 pr-3 text-[13px] outline-none focus:border-[var(--gov-brand)]"
              />
            </div>
            <button
              type="submit"
              className="h-9 bg-[var(--gov-brand)] px-4 text-[13px] font-medium text-white"
            >
              검색
            </button>
          </form>
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
            확정된 예약 고객이 아직 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-[13px]">
              <thead>
                <tr className="border-t-2 border-[var(--gov-brand)] bg-[#fafbfc] text-left">
                  <th className="px-5 py-2.5 font-semibold">고객</th>
                  <th className="w-[130px] px-3 py-2.5 font-semibold">
                    연락처
                  </th>
                  <th className="w-[130px] px-3 py-2.5 font-semibold">
                    다가오는 이용일
                  </th>
                  <th className="w-[80px] px-3 py-2.5 text-right font-semibold">
                    예약
                  </th>
                  <th className="w-[130px] px-3 py-2.5 text-right font-semibold">
                    누적 이용료
                  </th>
                  <th className="w-[130px] px-3 py-2.5 text-right font-semibold">
                    남은 잔금
                  </th>
                  <th className="w-[112px] whitespace-nowrap px-5 py-2.5 font-semibold">
                    예약 내역
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr
                    key={c.phoneKey}
                    className="border-b border-[var(--gov-line)] align-top hover:bg-gray-50"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium">
                        {c.company?.trim() || c.customerName}
                      </div>
                      <div className="text-[12px] text-[var(--gov-ink-sub)]">
                        {c.customerName}
                        {c.contactTitle ? ` ${c.contactTitle}` : ""}
                        {c.email ? ` · ${c.email}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <a
                        href={`tel:${c.phone}`}
                        className="text-[var(--gov-brand)]"
                      >
                        {formatPhone(c.phone)}
                      </a>
                    </td>
                    <td className="px-3 py-3">
                      {c.nextUseDate ? (
                        dateWithWeekday(c.nextUseDate)
                      ) : (
                        <span className="text-[var(--gov-ink-sub)]">
                          지난 이용 {c.lastUseDate}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {c.reservationCount}건
                    </td>
                    <td className="px-3 py-3 text-right">
                      {money(c.totalAmount)}원
                    </td>
                    <td
                      className={`px-3 py-3 text-right ${
                        c.balanceAmount > 0
                          ? "font-medium text-[var(--gov-warn)]"
                          : "text-[var(--gov-ink-sub)]"
                      }`}
                    >
                      {money(c.balanceAmount)}원
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenKey(openKey === c.phoneKey ? null : c.phoneKey)
                        }
                        className="text-[var(--gov-brand)] underline"
                      >
                        {openKey === c.phoneKey ? "접기" : "펼쳐 보기"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {openKey
          ? (() => {
              const target = items.find((c) => c.phoneKey === openKey);
              if (!target) return null;
              return (
                <div className="border-t border-[var(--gov-line)] bg-[#fafbfc] px-5 py-4">
                  <h3 className="mb-2 text-[13px] font-bold">
                    예약 내역 · {target.company?.trim() || target.customerName}
                  </h3>
                  <ul className="space-y-1.5">
                    {target.reservations.map((r) => {
                      const badge = statusBadge(r.status);
                      return (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center gap-2 border border-[var(--gov-line)] bg-white px-3 py-2 text-[12.5px]"
                        >
                          <span
                            className={`border px-1.5 py-0.5 text-[11.5px] ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          <span className="font-medium">
                            {dateWithWeekday(r.useDate)}
                          </span>
                          {r.endDate ? (
                            <span className="text-[var(--gov-ink-sub)]">
                              ~ {r.endDate}
                            </span>
                          ) : null}
                          <span>{r.productName}</span>
                          <span>{r.people}명</span>
                          <span className="text-[var(--gov-ink-sub)]">
                            총 {money(r.totalAmount)}원 · 잔금{" "}
                            {money(r.balanceAmount)}원
                          </span>
                          {r.calendarEventId ? (
                            <span className="flex items-center gap-1 text-[var(--gov-ok)]">
                              <Icon name="calendar" size={13} />
                              일정 등록됨
                            </span>
                          ) : null}
                          <a
                            href={`/dashboard/contracts/${r.id}`}
                            className="ml-auto text-[var(--gov-brand)] underline"
                          >
                            {r.contractNumber}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })()
          : null}

        {totalPages > 1 ? (
          <div className="flex items-center justify-center gap-3 border-t border-[var(--gov-line)] px-5 py-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
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
              onClick={() => setPage(page + 1)}
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
