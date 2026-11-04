"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import {
  apiFetch,
  invalidate,
  loadDetail,
  loadRange,
  loadSearch,
  peekDetail,
  peekRange,
  type SearchData,
} from "./_parts/api";
import { INPUT } from "./_parts/bits";
import { ReservationDetail, type PaymentDraft } from "./_parts/detail";
import { ReservationForm, type FormMode } from "./_parts/form";
import {
  addDays,
  dayIndex,
  endOf,
  isCancelled,
  kstToday,
  label,
  monthGrid,
  monthTitle,
  orgOf,
  shiftMonth,
  type Block,
  type Channel,
  type Reservation,
} from "./_parts/model";
import { BlockDialog, WeeburAccessDialog } from "./_parts/tools";
import {
  CalendarGrid,
  DayPanel,
  HoldAlert,
  Legend,
  ListView,
  MobileMonth,
  MobileWeek,
  Summary,
} from "./_parts/views";

/** 검색은 입력이 멈추고 이만큼 지나야 보낸다. */
const SEARCH_DEBOUNCE_MS = 400;

const spansOf = (r: Reservation): [string, string][] => [[r.useDate, endOf(r)]];

export default function ReservationsPage() {
  const [today] = useState(() => kstToday());
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [view, setView] = useState<"cal" | "list">("cal");
  const [mobileMode, setMobileMode] = useState<"week" | "month">("week");
  const [channel, setChannel] = useState<"all" | Channel>("all");
  const [showCancelled, setShowCancelled] = useState(false);

  const [items, setItems] = useState<Reservation[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  /** 쓰기 성공 뒤에만 올린다. 캐시를 비운 기간만 실제로 다시 부른다. */
  const [reloadKey, setReloadKey] = useState(0);

  const [queryInput, setQueryInput] = useState("");
  const [search, setSearch] = useState({ q: "", page: 1 });
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [searching, setSearching] = useState(false);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<Reservation | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [dialog, setDialog] = useState<"weebur" | "block" | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const grid = useMemo(() => monthGrid(month), [month]);
  // 날짜 패널의 다음날 미리보기까지 그리도록 달력 끝 다음 날까지 받는다.
  const from = grid.start;
  const to = addDays(grid.end, 1);

  /* 보이는 달 칸 기간 한 번. 캐시가 있으면 부르지 않는다(같은 달 재진입 0회). */
  useEffect(() => {
    let alive = true;
    const cached = peekRange(from, to);
    if (cached) {
      setItems(cached.items);
      setBlocks(cached.blocks);
      setLoadError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    loadRange(from, to)
      .then((d) => {
        if (!alive) return;
        setItems(d.items);
        setBlocks(d.blocks);
        setLoadError("");
      })
      .catch(() => {
        if (alive) setLoadError("예약을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [from, to, reloadKey]);

  /* 검색 입력 디바운스. 두 글자 이상일 때만 찾는다. */
  useEffect(() => {
    const t = setTimeout(() => {
      const q = queryInput.trim();
      const next = q.length >= 2 ? q : "";
      setSearch((prev) => (prev.q === next ? prev : { q: next, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [queryInput]);

  /* 검색은 기간 없이 한 쪽(100건)씩. */
  useEffect(() => {
    if (!search.q) {
      setSearchData(null);
      return;
    }
    setView("list");
    let alive = true;
    setSearching(true);
    loadSearch(search.q, search.page)
      .then((d) => {
        if (alive) setSearchData(d);
      })
      .catch(() => {
        if (alive) toast.error("검색하지 못했습니다");
      })
      .finally(() => {
        if (alive) setSearching(false);
      });
    return () => {
      alive = false;
    };
  }, [search, reloadKey]);

  /* 상세 창: 목록 값으로 먼저 그리고, 변경 기록이 담긴 한 건 조회로 바꾼다. */
  useEffect(() => {
    if (!detailId) return;
    const cached = peekDetail(detailId);
    if (cached) {
      setDetailItem(cached);
      setEventsLoading(false);
      return;
    }
    let alive = true;
    setEventsLoading(true);
    loadDetail(detailId)
      .then((item) => {
        if (alive && item) setDetailItem(item);
      })
      .catch(() => {
        if (alive) toast.error("변경 기록을 불러오지 못했습니다");
      })
      .finally(() => {
        if (alive) setEventsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [detailId, reloadKey]);

  const index = useMemo(
    () => dayIndex(items, { channel, showCancelled }),
    [items, channel, showCancelled],
  );
  const blockMap = useMemo(
    () => new Map(blocks.map((b) => [b.date, b.reason])),
    [blocks],
  );
  const monthBlocks = useMemo(
    () =>
      blocks
        .filter((b) => b.date.slice(0, 7) === month)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [blocks, month],
  );
  const detail = detailItem ?? items.find((r) => r.id === detailId) ?? null;

  /* 목록: 달 보기는 달력 응답을 그대로 쓴다(한 달 건수는 수용 인원으로 한정). 검색은 쪽 단위. */
  const listRows = useMemo(() => {
    const monthStart = `${month}-01`;
    const monthEnd = addDays(`${shiftMonth(month, 1)}-01`, -1);
    const base =
      searchData?.items ??
      items.filter((r) => r.useDate <= monthEnd && endOf(r) >= monthStart);
    return base
      .filter(
        (r) =>
          (channel === "all" || r.channel === channel) &&
          (showCancelled || !isCancelled(r)),
      )
      .sort((a, b) => a.useDate.localeCompare(b.useDate));
  }, [items, searchData, month, channel, showCancelled]);

  /* ── 이동 ── */
  const goMonth = (n: number) => {
    const m = shiftMonth(month, n);
    setMonth(m);
    setSelected(today.slice(0, 7) === m ? today : `${m}-01`);
  };
  const goToday = () => {
    setMonth(today.slice(0, 7));
    setSelected(today);
  };
  const selectDay = (day: string) => {
    if (day.slice(0, 7) !== month) setMonth(day.slice(0, 7));
    setSelected(day);
  };

  /* ── 창 ── */
  const openDetail = (r: Reservation) => {
    setFormMode(null);
    setDetailItem(peekDetail(r.id) ?? r);
    setDetailId(r.id);
  };
  const closeDetail = useCallback(() => {
    setDetailId(null);
    setDetailItem(null);
  }, []);
  const openForm = (mode: FormMode) => {
    setDetailId(null);
    setDetailItem(null);
    setFormKey((k) => k + 1);
    setFormMode(mode);
  };
  const closeForm = useCallback(() => setFormMode(null), []);

  /** 쓰기 뒤: 바뀐 날짜와 겹치는 기간 캐시만 비우고 다시 그린다. */
  const afterWrite = useCallback(
    (spans: [string, string][], id?: string) => {
      invalidate(spans, id);
      setReloadKey((k) => k + 1);
    },
    [],
  );

  /* ── 바꾸기 (진행 중에는 잠근다) ── */
  const send = async (
    url: string,
    init: RequestInit,
    okText: string,
    spans: [string, string][],
    id?: string,
  ): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await apiFetch(url, init);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(body?.error ?? body?.message ?? "변경하지 못했습니다");
        return false;
      }
      toast.success(okText);
      afterWrite(spans, id);
      return true;
    } catch {
      toast.error("변경하지 못했습니다");
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const jsonInit = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const patch = (r: Reservation, body: Record<string, unknown>) =>
    send(
      `/api/reservations/${encodeURIComponent(r.id)}`,
      jsonInit("PATCH", body),
      body.action === "cancel"
        ? `${orgOf(r)} 예약을 취소했습니다`
        : body.action === "extendHold"
          ? "가계약을 24시간 연장했습니다"
          : "변경했습니다",
      spansOf(r),
      r.id,
    );
  const addPayment = (r: Reservation, body: PaymentDraft) =>
    send(
      `/api/reservations/${encodeURIComponent(r.id)}/payments`,
      jsonInit("POST", body),
      "입금 기록을 남겼습니다",
      spansOf(r),
      r.id,
    );
  const voidPayment = (r: Reservation, paymentId: string) =>
    send(
      `/api/reservations/${encodeURIComponent(r.id)}/payments/${encodeURIComponent(paymentId)}`,
      { method: "DELETE" },
      "입금 기록을 무효로 했습니다",
      spansOf(r),
      r.id,
    );
  const unblock = (day: string) => {
    if (!confirm(`${label(day)} 막기를 풀까요?`)) return;
    void send(
      `/api/reservation-blocks?date=${encodeURIComponent(day)}`,
      { method: "DELETE" },
      "막기를 풀었습니다",
      [[day, day]],
    );
  };
  const holdCancel = (r: Reservation) => {
    if (!confirm(`${orgOf(r)} 가계약을 취소할까요?`)) return;
    void patch(r, { action: "cancel" });
  };

  const selectedHasBooking = index.liveMain(selected).length > 0;
  const clearSearch = () => {
    setQueryInput("");
    setSearch({ q: "", page: 1 });
  };
  const searchCaption = searchData ? (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--gov-line)] bg-[var(--gov-brand-weak)] px-4 py-2 text-[13px]">
      <span>
        「{search.q}」 검색 결과 {searchData.total}건 · 기간과 관계없이 찾습니다
      </span>
      {searchData.totalPages > 1 ? (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={search.page <= 1 || searching}
            onClick={() => setSearch((s) => ({ ...s, page: s.page - 1 }))}
            className="h-7 rounded border border-[var(--gov-line-strong)] bg-white px-2 disabled:opacity-40"
          >
            이전
          </button>
          {search.page} / {searchData.totalPages}
          <button
            type="button"
            disabled={search.page >= searchData.totalPages || searching}
            onClick={() => setSearch((s) => ({ ...s, page: s.page + 1 }))}
            className="h-7 rounded border border-[var(--gov-line-strong)] bg-white px-2 disabled:opacity-40"
          >
            다음
          </button>
        </span>
      ) : null}
      <button
        type="button"
        onClick={clearSearch}
        className="ml-auto text-[var(--gov-brand)] underline"
      >
        검색 지우기
      </button>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <Summary items={items} month={month} />

      <HoldAlert
        items={items}
        busy={busy}
        onOpen={openDetail}
        onExtend={(r) => void patch(r, { action: "extendHold" })}
        onCancel={holdCancel}
      />

      {/* 도구 줄 */}
      <section className="flex flex-wrap items-center gap-2 rounded border border-[var(--gov-line)] bg-white px-4 py-3">
        <div className="hidden items-center md:flex">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            title="이전 달"
            aria-label="이전 달"
            className="h-9 w-9 rounded border border-[var(--gov-line-strong)] text-[16px]"
          >
            ‹
          </button>
          <span className="px-3 text-[16px] font-bold" data-testid="month-title">
            {monthTitle(month)}
          </span>
          <button
            type="button"
            onClick={() => goMonth(1)}
            title="다음 달"
            aria-label="다음 달"
            className="h-9 w-9 rounded border border-[var(--gov-line-strong)] text-[16px]"
          >
            ›
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-2 h-9 rounded border border-[var(--gov-line-strong)] px-3 text-[13px]"
          >
            오늘
          </button>
        </div>
        <div className="hidden md:ml-2 md:flex">
          {(["cal", "list"] as const).map((v, i) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`h-9 border px-3 text-[13px] ${i === 0 ? "rounded-l" : "-ml-px rounded-r"} ${
                view === v
                  ? "relative z-[1] border-[var(--gov-brand)] bg-[var(--gov-brand)] text-white"
                  : "border-[var(--gov-line-strong)] bg-white"
              }`}
            >
              {v === "cal" ? "달력" : "목록"}
            </button>
          ))}
        </div>
        <div className="flex md:hidden">
          {(["week", "month"] as const).map((v, i) => (
            <button
              key={v}
              type="button"
              aria-pressed={mobileMode === v}
              onClick={() => setMobileMode(v)}
              className={`h-9 border px-3 text-[13px] ${i === 0 ? "rounded-l" : "-ml-px rounded-r"} ${
                mobileMode === v
                  ? "relative z-[1] border-[var(--gov-brand)] bg-[var(--gov-brand)] text-white"
                  : "border-[var(--gov-line-strong)] bg-white"
              }`}
            >
              {v === "week" ? "주" : "월"}
            </button>
          ))}
        </div>
        <form
          className="relative order-last w-full md:order-none md:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            const q = queryInput.trim();
            if (q.length === 1) {
              toast.message("두 글자 이상 넣어 주세요");
              return;
            }
            setSearch((prev) => (prev.q === q ? prev : { q, page: 1 }));
          }}
        >
          <Icon
            name="search"
            size={16}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--gov-ink-sub)]"
          />
          <input
            data-testid="search-input"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="단체 · 담당자 · 연락처 검색"
            maxLength={60}
            className={`${INPUT} !h-9 pl-8 text-[13px] md:!w-64`}
          />
        </form>
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as typeof channel)}
          className="h-9 rounded border border-[var(--gov-line-strong)] bg-white px-2 text-[13px]"
          aria-label="예약 경로"
        >
          <option value="all">모든 경로</option>
          <option value="own">자체예약만</option>
          <option value="weebur">위버예약만</option>
        </select>
        <label className="flex items-center gap-1.5 text-[13px] text-[var(--gov-ink-sub)]">
          <input
            type="checkbox"
            checked={showCancelled}
            onChange={(e) => setShowCancelled(e.target.checked)}
          />
          취소 포함
        </label>
        <div className="flex w-full flex-wrap items-center gap-2 md:ml-auto md:w-auto">
          <button
            type="button"
            onClick={() => setDialog("weebur")}
            className="h-9 rounded border border-[#d8ccf2] bg-[#faf8fe] px-3 text-[13px] text-[#5b3fa3]"
          >
            위버 담당자 접속 안내
          </button>
          <button
            type="button"
            onClick={() => setDialog("block")}
            className="h-9 rounded border border-[var(--gov-line-strong)] bg-white px-3 text-[13px]"
          >
            날짜 막기
          </button>
          <button
            type="button"
            data-testid="btn-new"
            onClick={() => openForm({ kind: "new", day: selected })}
            className="hidden h-9 rounded bg-[var(--gov-brand)] px-4 text-[13px] font-semibold text-white md:block"
          >
            + 예약 등록
          </button>
        </div>
        {loading || searching ? (
          <span className="text-[12.5px] text-[var(--gov-ink-sub)]">
            불러오는 중
          </span>
        ) : null}
      </section>

      {loadError ? (
        <div className="flex items-center gap-3 rounded border border-[var(--gov-danger)]/40 bg-[var(--gov-danger-weak)] px-4 py-3 text-[13.5px] text-[var(--gov-danger)]">
          {loadError}
          <button
            type="button"
            onClick={() => afterWrite([[from, to]])}
            className="underline"
          >
            다시 불러오기
          </button>
        </div>
      ) : null}

      {/* 데스크톱 */}
      <div className="hidden space-y-4 md:block">
        {view === "cal" ? (
          <>
            <Legend />
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <CalendarGrid
                month={month}
                days={grid.days}
                selected={selected}
                today={today}
                index={index}
                blocks={blockMap}
                onSelect={selectDay}
                onOpen={openDetail}
              />
              <aside className="self-start rounded border border-[var(--gov-line)] bg-white">
                <DayPanel
                  day={selected}
                  index={index}
                  blockReason={blockMap.get(selected)}
                  onOpen={openDetail}
                  onUnblock={unblock}
                />
                <div className="border-t border-[var(--gov-line)] p-4">
                  <button
                    type="button"
                    onClick={() => openForm({ kind: "new", day: selected })}
                    className="h-10 w-full rounded bg-[var(--gov-brand)] text-[14px] font-semibold text-white"
                  >
                    {selectedHasBooking
                      ? "이 날짜에 추가 예약"
                      : "이 날짜에 예약 추가"}
                  </button>
                </div>
              </aside>
            </section>
          </>
        ) : (
          <ListView rows={listRows} onOpen={openDetail} caption={searchCaption} />
        )}
      </div>

      {/* 휴대폰 */}
      <div className="space-y-3 md:hidden">
        {searchData ? (
          <ListView rows={listRows} onOpen={openDetail} caption={searchCaption} />
        ) : mobileMode === "week" ? (
          <MobileWeek
            selected={selected}
            today={today}
            index={index}
            onSelect={selectDay}
            onShift={(n) => selectDay(addDays(selected, n))}
            onOpen={openDetail}
          />
        ) : (
          <MobileMonth
            month={month}
            days={grid.days}
            selected={selected}
            today={today}
            index={index}
            onSelect={selectDay}
            onMonth={goMonth}
            panel={
              <DayPanel
                day={selected}
                index={index}
                blockReason={blockMap.get(selected)}
                onOpen={openDetail}
                onUnblock={unblock}
              />
            }
          />
        )}
        <button
          type="button"
          onClick={() => openForm({ kind: "new", day: selected })}
          className="h-11 w-full rounded bg-[var(--gov-brand)] text-[15px] font-semibold text-white"
        >
          + 예약 등록
        </button>
      </div>

      {detail && detailId ? (
        <ReservationDetail
          key={detail.id}
          r={detail}
          index={index}
          today={today}
          busy={busy}
          eventsLoading={eventsLoading}
          onClose={closeDetail}
          onEdit={(r) => openForm({ kind: "edit", r })}
          onPatch={(body) => patch(detail, body)}
          onAddPayment={(body) => addPayment(detail, body)}
          onVoidPayment={(pid) => voidPayment(detail, pid)}
        />
      ) : null}

      {formMode ? (
        <ReservationForm
          key={formKey}
          mode={formMode}
          today={today}
          blocks={blockMap}
          onClose={closeForm}
          onSaved={(id, spans) => {
            const wasEdit = formMode.kind === "edit";
            setFormMode(null);
            afterWrite(spans, id ?? undefined);
            if (wasEdit && id) setDetailId(id);
          }}
        />
      ) : null}

      {dialog === "weebur" ? (
        <WeeburAccessDialog onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "block" ? (
        <BlockDialog
          initialDate={selected}
          blocks={monthBlocks}
          onClose={() => setDialog(null)}
          onChanged={(date) => afterWrite([[date, date]])}
        />
      ) : null}
    </div>
  );
}
