"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";

interface Reservation {
  id: string;
  source: "contract" | "calendar" | "manual";
  contractId: string | null;
  contractNumber: string | null;
  calendarEventId: string | null;
  productType: string;
  productName: string;
  useDate: string;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  peopleCount: number;
  adultCount: number;
  childCount: number;
  company: string;
  customerName: string;
  phone: string;
  email: string;
  contactTitle: string;
  totalAmount: number;
  depositAmount: number;
  balanceAmount: number;
  paymentStatus: "pending" | "partial" | "completed";
  status: "active" | "cancelled";
  needsReview: boolean;
  reviewReason: string | null;
  notes: string;
  createdAt: string;
}

const PAGE_SIZE = 50;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const SOURCE_LABEL: Record<string, string> = {
  contract: "약정서",
  calendar: "캘린더",
  manual: "직접 입력",
};

const PAYMENT_LABEL: Record<string, string> = {
  pending: "미확인",
  partial: "예약금 확인",
  completed: "완납",
};

const PAYMENT_STYLE: Record<string, string> = {
  pending:
    "bg-[var(--gov-warn-weak)] text-[var(--gov-warn)] border-[var(--gov-warn)]/30",
  partial:
    "bg-[var(--gov-brand-weak)] text-[var(--gov-brand)] border-[var(--gov-brand)]/30",
  completed:
    "bg-[var(--gov-ok-weak)] text-[var(--gov-ok)] border-[var(--gov-ok)]/30",
};

function money(value: number): string {
  return value.toLocaleString("ko-KR");
}

/** `2026-09-15` 를 `09-15 (화)` 로 바꾼다. */
function shortDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const weekday = WEEKDAYS[new Date(`${value}T00:00:00Z`).getUTCDay()] ?? "";
  return `${m[2]}-${m[3]} (${weekday})`;
}

/** 약정서에는 하이픈 없이 저장된 번호가 섞여 있어 보기 좋게 끊는다. */
function formatPhone(value: string): string {
  const d = value.replace(/[^0-9]/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return value;
}

/** 예약 한 건의 자세한 내용. 표의 해당 행 바로 아래에서 펼친다. */
function DetailPanel({
  item,
  onPatch,
  busy,
}: {
  item: Reservation;
  onPatch: (id: string, body: Record<string, unknown>) => Promise<void>;
  busy: boolean;
}) {
  return (
    <div className="space-y-3 px-5 py-4">
      {item.needsReview && item.reviewReason ? (
        <div className="flex items-start gap-2 border border-[var(--gov-warn)]/40 bg-[var(--gov-warn-weak)] p-3 text-[12.5px] text-[var(--gov-warn)]">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            {item.reviewReason}
            <button
              type="button"
              disabled={busy}
              onClick={() => void onPatch(item.id, { action: "clearReview" })}
              className="ml-3 underline disabled:opacity-50"
            >
              확인했음
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
        <div>
          <span className="text-[var(--gov-ink-sub)]">담당자 </span>
          {item.customerName || "-"}
          {item.contactTitle ? ` ${item.contactTitle}` : ""}
        </div>
        <div>
          <span className="text-[var(--gov-ink-sub)]">연락처 </span>
          {item.phone ? formatPhone(item.phone) : "-"}
        </div>
        <div>
          <span className="text-[var(--gov-ink-sub)]">이메일 </span>
          {item.email || "-"}
        </div>
        <div>
          <span className="text-[var(--gov-ink-sub)]">이용 시각 </span>
          {item.startTime && item.endTime
            ? `${item.startTime} ~ ${item.endTime}`
            : "-"}
        </div>
        <div>
          <span className="text-[var(--gov-ink-sub)]">총 이용료 </span>
          {item.totalAmount ? `${money(item.totalAmount)}원` : "-"}
        </div>
        <div>
          <span className="text-[var(--gov-ink-sub)]">예약금 </span>
          {item.depositAmount ? `${money(item.depositAmount)}원` : "-"}
        </div>
        <div>
          <span className="text-[var(--gov-ink-sub)]">잔금 </span>
          {item.balanceAmount ? `${money(item.balanceAmount)}원` : "-"}
        </div>
        <div>
          <span className="text-[var(--gov-ink-sub)]">등록 경로 </span>
          {SOURCE_LABEL[item.source] ?? item.source}
          {item.contractNumber ? (
            <a
              href={`/dashboard/contracts/${item.contractId}`}
              className="ml-2 text-[var(--gov-brand)] underline"
            >
              {item.contractNumber}
            </a>
          ) : null}
        </div>
      </div>

      {item.notes ? (
        <div className="border border-[var(--gov-line)] bg-white p-3">
          <p className="mb-1 text-[11.5px] font-semibold text-[var(--gov-ink-sub)]">
            이용 내역
          </p>
          <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-[var(--gov-ink-sub)]">
            {item.notes}
          </pre>
        </div>
      ) : null}

      {item.status === "active" ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--gov-line)] pt-3">
          <span className="text-[12.5px] text-[var(--gov-ink-sub)]">
            입금 상태
          </span>
          {(["pending", "partial", "completed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              disabled={busy || item.paymentStatus === value}
              onClick={() => void onPatch(item.id, { paymentStatus: value })}
              className={`border px-2.5 py-1 text-[12.5px] transition-colors disabled:cursor-default ${
                item.paymentStatus === value
                  ? PAYMENT_STYLE[value]
                  : "border-[var(--gov-line-strong)] bg-white hover:bg-gray-50"
              }`}
            >
              {PAYMENT_LABEL[value]}
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!confirm("이 예약을 취소로 표시할까요?")) return;
              void onPatch(item.id, { action: "cancel" });
            }}
            className="ml-auto border border-[var(--gov-danger)]/40 px-2.5 py-1 text-[12.5px] text-[var(--gov-danger)] hover:bg-[var(--gov-danger-weak)] disabled:opacity-50"
          >
            예약 취소
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function ReservationsPage() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const [status, setStatus] = useState<"active" | "cancelled" | "all">(
    "active",
  );
  const [source, setSource] = useState<"all" | "contract" | "calendar">("all");
  const [needsReview, setNeedsReview] = useState(false);
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      status,
    });
    if (source !== "all") params.set("source", source);
    if (needsReview) params.set("needsReview", "1");
    if (query) params.set("query", query);
    try {
      const res = await fetch(`/api/reservations?${params}`);
      const body = await res.json();
      setItems(body.items ?? []);
      setTotal(body.total ?? 0);
      setTotalPages(body.totalPages ?? 1);
    } catch {
      setItems([]);
      toast.error("예약을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [page, status, source, needsReview, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const syncCalendar = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/reservations?action=sync-calendar", {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error ?? "동기화하지 못했습니다");
        return;
      }
      const parts = [`새 예약 ${body.created}건`, `갱신 ${body.updated}건`];
      if (body.cancelled) parts.push(`취소 ${body.cancelled}건`);
      if (body.needsReview?.length)
        parts.push(`확인 필요 ${body.needsReview.length}건`);
      toast.success(`캘린더를 읽었습니다 · ${parts.join(" · ")}`);
      await load();
    } catch {
      toast.error("동기화하지 못했습니다");
    } finally {
      setSyncing(false);
    }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.message ?? "변경하지 못했습니다");
        return;
      }
      await load();
    } catch {
      toast.error("변경하지 못했습니다");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-[13px] text-[var(--gov-ink-sub)]">
        약정서에 입금이 확인된 예약과 구글 캘린더에 직접 적으신 예약이 함께
        모입니다. 캘린더에 적으신 건은 아래 단추를 눌러 가져옵니다.
      </p>

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
                placeholder="업체 · 담당자 · 연락처"
                className="h-9 w-52 border border-[var(--gov-line-strong)] pl-8 pr-3 text-[13px] outline-none focus:border-[var(--gov-brand)]"
              />
            </div>
            <button
              type="submit"
              className="h-9 bg-[var(--gov-brand)] px-4 text-[13px] font-medium text-white"
            >
              검색
            </button>
          </form>

          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as typeof status);
            }}
            className="h-9 border border-[var(--gov-line-strong)] px-2 text-[13px]"
          >
            <option value="active">유효한 예약</option>
            <option value="cancelled">취소된 예약</option>
            <option value="all">전체</option>
          </select>

          <select
            value={source}
            onChange={(e) => {
              setPage(1);
              setSource(e.target.value as typeof source);
            }}
            className="h-9 border border-[var(--gov-line-strong)] px-2 text-[13px]"
          >
            <option value="all">모든 경로</option>
            <option value="contract">약정서</option>
            <option value="calendar">캘린더</option>
          </select>

          <label className="flex items-center gap-1.5 text-[13px]">
            <input
              type="checkbox"
              checked={needsReview}
              onChange={(e) => {
                setPage(1);
                setNeedsReview(e.target.checked);
              }}
            />
            확인 필요만
          </label>

          <button
            type="button"
            onClick={() => void syncCalendar()}
            disabled={syncing}
            className="ml-auto flex h-9 items-center gap-1.5 border border-[var(--gov-line-strong)] bg-white px-3 text-[13px] hover:bg-gray-50 disabled:opacity-50"
          >
            <Icon name="refresh" size={15} />
            {syncing ? "읽는 중" : "캘린더 가져오기"}
          </button>
          <span className="text-[13px] text-[var(--gov-ink-sub)]">
            {loading ? "불러오는 중" : `${total.toLocaleString()}건`}
          </span>
        </div>

        {loading ? (
          <p className="px-5 py-10 text-center text-[13px] text-[var(--gov-ink-sub)]">
            불러오는 중입니다.
          </p>
        ) : items.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-[var(--gov-ink-sub)]">
            조건에 맞는 예약이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[13px]">
              <thead>
                <tr className="border-t-2 border-[var(--gov-brand)] bg-[#fafbfc] text-left">
                  <th className="w-[120px] px-5 py-2.5 font-semibold">
                    이용일
                  </th>
                  <th className="w-[128px] px-3 py-2.5 font-semibold">구분</th>
                  <th className="px-3 py-2.5 font-semibold">단체 · 담당자</th>
                  <th className="w-[70px] px-3 py-2.5 text-right font-semibold">
                    인원
                  </th>
                  <th className="w-[124px] px-3 py-2.5 text-right font-semibold">
                    잔금
                  </th>
                  <th className="w-[112px] px-3 py-2.5 font-semibold">입금</th>
                  <th className="w-[92px] px-3 py-2.5 font-semibold">경로</th>
                  <th className="w-[112px] whitespace-nowrap px-5 py-2.5 font-semibold">
                    상세
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Fragment key={item.id}>
                    <tr
                      className={`border-b border-[var(--gov-line)] align-top hover:bg-gray-50 ${
                        item.status === "cancelled"
                          ? "text-[var(--gov-ink-sub)] line-through"
                          : ""
                      }`}
                    >
                      <td className="px-5 py-3">
                        {shortDate(item.useDate)}
                        {item.endDate ? (
                          <span className="block text-[11.5px] text-[var(--gov-ink-sub)]">
                            ~ {shortDate(item.endDate)}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        {item.productName || item.productType}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium">
                          {item.company || item.customerName || "-"}
                          {item.needsReview ? (
                            <Icon
                              name="alert"
                              size={14}
                              className="ml-1.5 inline text-[var(--gov-warn)]"
                            />
                          ) : null}
                        </div>
                        <div className="text-[12px] text-[var(--gov-ink-sub)]">
                          {item.customerName}
                          {item.phone ? ` · ${formatPhone(item.phone)}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {item.peopleCount || "-"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {item.balanceAmount ? money(item.balanceAmount) : "-"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block border px-2 py-0.5 text-[11.5px] ${PAYMENT_STYLE[item.paymentStatus]}`}
                        >
                          {PAYMENT_LABEL[item.paymentStatus]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-[12px] text-[var(--gov-ink-sub)]">
                        {SOURCE_LABEL[item.source] ?? item.source}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenId(openId === item.id ? null : item.id)
                          }
                          className="whitespace-nowrap text-[var(--gov-brand)] underline"
                        >
                          {openId === item.id ? "접기" : "펼쳐 보기"}
                        </button>
                      </td>
                    </tr>
                    {openId === item.id ? (
                      <tr className="border-b border-[var(--gov-line)]">
                        <td colSpan={8} className="bg-[#fafbfc] p-0">
                          <DetailPanel
                            item={item}
                            onPatch={patch}
                            busy={busy}
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
