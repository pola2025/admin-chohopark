"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "./api";
import { Drawer, INPUT, MoneyInput, RoleTag, SEC_T, segBtn } from "./bits";
import {
  PRODUCTS,
  PRODUCT_ORDER,
  ROLE_LABEL,
  addDays,
  daysBetween,
  endOf,
  label,
  num,
  won,
  type Channel,
  type Conflict,
  type DayRole,
  type ProductType,
  type Reservation,
} from "./model";

type RatioChoice = "0.3" | "0.2" | "0.5" | "custom";

type FormState = {
  channel: Channel;
  weeburRef: string;
  productType: ProductType | "";
  useDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  company: string;
  customerName: string;
  phone: string;
  email: string;
  adultCount: string;
  childCount: string;
  unitAdult: string;
  unitChild: string;
  extraAmount: string;
  paymentPlan: "split" | "full";
  ratioChoice: RatioChoice;
  ratioCustom: string;
  notes: string;
};

type PaidState = {
  deposit: boolean;
  balance: boolean;
  full: boolean;
  paidAt: string;
  method: "transfer" | "card" | "cash";
};

const n = (v: string) => {
  const x = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};

function initialState(day: string, r?: Reservation): FormState {
  if (!r) {
    const p = PRODUCTS.workshop;
    return {
      channel: "own",
      weeburRef: "",
      productType: "workshop",
      useDate: day,
      startTime: p.in,
      endDate: addDays(day, p.nights),
      endTime: p.out,
      company: "",
      customerName: "",
      phone: "",
      email: "",
      adultCount: "",
      childCount: "0",
      unitAdult: String(p.unitAdult),
      unitChild: String(p.unitChild),
      extraAmount: "0",
      paymentPlan: "split",
      ratioChoice: "0.3",
      ratioCustom: "30",
      notes: "",
    };
  }
  const pt = (PRODUCT_ORDER as string[]).includes(r.productType)
    ? (r.productType as ProductType)
    : "";
  const p = pt ? PRODUCTS[pt] : null;
  const ratio = r.depositRatio || 0.3;
  const choice: RatioChoice =
    (["0.3", "0.2", "0.5"] as const).find(
      (c) => Math.abs(Number(c) - ratio) < 0.001,
    ) ?? "custom";
  return {
    channel: r.channel,
    weeburRef: r.weeburRef ?? "",
    productType: pt,
    useDate: r.useDate,
    startTime: r.startTime || p?.in || "",
    endDate: r.endDate && r.endDate > r.useDate ? r.endDate : r.useDate,
    endTime: r.endTime || p?.out || "",
    company: r.company,
    customerName: r.customerName,
    phone: r.phone,
    email: r.email,
    adultCount: String(r.adultCount),
    childCount: String(r.childCount),
    unitAdult: String(r.unitAdult || p?.unitAdult || 0),
    unitChild: String(r.unitChild || p?.unitChild || 0),
    extraAmount: String(r.extraAmount || 0),
    paymentPlan: r.paymentPlan === "full" ? "full" : "split",
    ratioChoice: choice,
    ratioCustom: String(Math.round(ratio * 100)),
    notes: r.notes ?? "",
  };
}

/** 서버로 보내는 본문(입금·확인 표시 제외). 수정 때는 이 값끼리 비교해 바뀐 칸만 보낸다. */
function payloadOf(f: FormState) {
  const weebur = f.channel === "weebur";
  const nights = daysBetween(f.useDate, f.endDate);
  const ratio =
    f.ratioChoice === "custom"
      ? Math.min(Math.max(n(f.ratioCustom), 1), 100) / 100
      : Number(f.ratioChoice);
  const body: Record<string, unknown> = {
    channel: f.channel,
    productType: f.productType,
    useDate: f.useDate,
    endDate: nights > 0 ? f.endDate : f.useDate,
    startTime: f.startTime,
    endTime: f.endTime,
    adultCount: n(f.adultCount),
    childCount: n(f.childCount),
    unitAdult: n(f.unitAdult),
    unitChild: n(f.unitChild),
    extraAmount: n(f.extraAmount),
    company: f.company.trim(),
    customerName: f.customerName.trim(),
    phone: f.phone.trim(),
    email: f.email.trim(),
    paymentPlan: weebur ? "weebur" : f.paymentPlan,
    notes: f.notes.trim(),
  };
  if (!weebur && f.paymentPlan === "split") body.depositRatio = ratio;
  if (weebur) body.weeburRef = f.weeburRef.trim() || null;
  return body;
}

function amounts(f: FormState, feeRate: number) {
  const total =
    n(f.adultCount) * n(f.unitAdult) +
    n(f.childCount) * n(f.unitChild) +
    n(f.extraAmount);
  const ratio =
    f.ratioChoice === "custom"
      ? Math.min(Math.max(n(f.ratioCustom), 1), 100) / 100
      : Number(f.ratioChoice);
  const deposit =
    f.paymentPlan === "full"
      ? total
      : Math.round((total * ratio) / 1000) * 1000;
  const fee = Math.round(total * feeRate);
  return { total, deposit, balance: total - deposit, fee, net: total - fee };
}

export type FormMode =
  { kind: "new"; day: string } | { kind: "edit"; r: Reservation };

export function ReservationForm({
  mode,
  today,
  blocks,
  onClose,
  onSaved,
}: {
  mode: FormMode;
  today: string;
  blocks: Map<string, string>;
  onClose: () => void;
  /** spans: 바뀐 날짜 구간(그 기간 캐시만 비운다) */
  onSaved: (id: string | null, spans: [string, string][]) => void;
}) {
  const editing = mode.kind === "edit" ? mode.r : undefined;
  const initial = useMemo(
    () => initialState(mode.kind === "new" ? mode.day : "", editing),
    // 창을 열 때 한 번만 만든다(창은 열 때마다 새로 그린다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [f, setF] = useState<FormState>(initial);
  const [paid, setPaid] = useState<PaidState>({
    deposit: false,
    balance: false,
    full: false,
    paidAt: today,
    method: "transfer",
  });
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [addOk, setAddOk] = useState(false);
  const [blockedDates, setBlockedDates] = useState<string[] | null>(null);
  const [blockOk, setBlockOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirmRef = useRef<HTMLDivElement>(null);
  // 상태가 반영되기 전 두 번 눌러도 한 번만 보낸다.
  const savingRef = useRef(false);

  const weebur = f.channel === "weebur";
  const feeRate = editing?.feeRate || 0.1;
  const a = amounts(f, feeRate);
  const mine = n(f.adultCount) + n(f.childCount);
  const nights = Math.max(daysBetween(f.useDate, f.endDate), 0);
  const dayOnly = f.productType === "daytrip" || nights === 0;

  /** 날짜·상품이 바뀌면 받아 둔 겹침·막은 날짜 확인은 다시 받아야 한다. */
  const resetChecks = () => {
    setConflicts(null);
    setAddOk(false);
    setBlockedDates(null);
    setBlockOk(false);
  };
  const set = (patch: Partial<FormState>, dateChange = false) => {
    setF((prev) => ({ ...prev, ...patch }));
    setError("");
    if (dateChange) resetChecks();
  };
  const setProduct = (pt: ProductType) => {
    const p = PRODUCTS[pt];
    set(
      {
        productType: pt,
        endDate: addDays(f.useDate, p.nights),
        startTime: p.in,
        endTime: p.out,
        unitAdult: String(p.unitAdult),
        unitChild: String(p.unitChild),
      },
      true,
    );
  };
  const setStart = (useDate: string) => {
    if (!useDate) return;
    const p = f.productType ? PRODUCTS[f.productType] : null;
    set(
      {
        useDate,
        endDate: addDays(useDate, p ? p.nights : Math.max(nights, 0)),
      },
      true,
    );
  };

  const roleOfMine = (day: string): DayRole =>
    nights === 0
      ? "day"
      : day === f.useDate
        ? "in"
        : day === f.endDate
          ? "out"
          : "stay";

  const conflictDays = useMemo(() => {
    if (!conflicts?.length) return [];
    const byDay = new Map<string, Conflict[]>();
    for (const c of conflicts) {
      const list = byDay.get(c.date) ?? [];
      list.push(c);
      byDay.set(c.date, list);
    }
    return [...byDay.entries()].sort(([x], [y]) => x.localeCompare(y));
  }, [conflicts]);

  const needAdd = Boolean(conflicts?.length) && !addOk;
  const needBlock = Boolean(blockedDates?.length) && !blockOk;

  const validate = () => {
    if (!f.productType) return "상품을 골라 주세요.";
    if (!f.useDate) return "이용일을 넣어 주세요.";
    if (f.endDate < f.useDate) return "퇴실일이 입실일보다 빠릅니다.";
    if (!f.company.trim()) return "단체명을 넣어 주세요.";
    if (!f.customerName.trim()) return "담당자 이름을 넣어 주세요.";
    if (f.phone.replace(/[^0-9]/g, "").length < 9)
      return "연락처를 확인해 주세요.";
    if (mine < 1) return "인원을 넣어 주세요.";
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
      return "이메일 형식을 확인해 주세요.";
    return "";
  };

  const save = async () => {
    if (savingRef.current) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const full = payloadOf(f);
    let body: Record<string, unknown>;
    if (editing) {
      const before = payloadOf(initial);
      const changed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(full)) {
        if (JSON.stringify(v) !== JSON.stringify(before[k])) changed[k] = v;
      }
      if (!Object.keys(changed).length) {
        toast.message("바뀐 내용이 없습니다");
        onClose();
        return;
      }
      body = { action: "update", ...changed };
    } else {
      body = { ...full };
      if (!f.email.trim()) delete body.email;
      if (!weebur) {
        const pays: Record<string, unknown>[] = [];
        const pay = (kind: string, amount: number) =>
          pays.push({ kind, amount, method: paid.method, paidAt: paid.paidAt });
        if (f.paymentPlan === "full") {
          if (paid.full) pay("full", a.total);
        } else {
          if (paid.deposit) pay("deposit", a.deposit);
          if (paid.balance) pay("balance", a.balance);
        }
        if (pays.length) body.initialPayments = pays;
      }
    }
    if (conflicts?.length && addOk) body.confirmAdditional = true;
    if (blockedDates?.length && blockOk) body.confirmBlocked = true;

    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch(
        editing ? `/api/reservations/${editing.id}` : "/api/reservations",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.error === "conflict") {
        setConflicts(Array.isArray(data.conflicts) ? data.conflicts : []);
        setAddOk(false);
        requestAnimationFrame(() =>
          confirmRef.current?.scrollIntoView({ block: "center" }),
        );
        return;
      }
      if (res.status === 409 && data?.error === "blocked") {
        setBlockedDates(Array.isArray(data.dates) ? data.dates : []);
        setBlockOk(false);
        requestAnimationFrame(() =>
          confirmRef.current?.scrollIntoView({ block: "center" }),
        );
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? data?.message ?? "저장하지 못했습니다.");
        return;
      }
      toast.success(editing ? "예약을 고쳤습니다" : "예약을 등록했습니다");
      const spans: [string, string][] = [
        [String(full.useDate), String(full.endDate)],
      ];
      if (editing) spans.push([editing.useDate, endOf(editing)]);
      onSaved(data?.item?.id ?? editing?.id ?? null, spans);
    } catch {
      setError("저장하지 못했습니다. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const saveLabel = saving
    ? "저장하는 중"
    : conflicts?.length
      ? "추가 예약으로 저장"
      : "저장";

  return (
    <Drawer
      title={editing ? "예약 수정" : "예약 등록"}
      width="max-w-[520px]"
      onClose={onClose}
      testId="form-drawer"
      footer={
        <div className="space-y-2">
          {error ? (
            <p className="text-[13px] text-[var(--gov-danger)]">{error}</p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 flex-1 rounded border border-[var(--gov-line-strong)] text-[14px]"
            >
              닫기
            </button>
            <button
              type="button"
              data-testid="form-save"
              disabled={saving || needAdd || needBlock}
              onClick={() => void save()}
              className="h-11 flex-[2] rounded bg-[var(--gov-brand)] text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <p className={SEC_T}>예약 경로</p>
          <div className="grid grid-cols-2">
            {(["own", "weebur"] as const).map((ch, i) => (
              <button
                key={ch}
                type="button"
                aria-pressed={f.channel === ch}
                onClick={() => set({ channel: ch })}
                className={`${segBtn(f.channel === ch)} ${i === 0 ? "rounded-l" : "-ml-px rounded-r"}`}
              >
                {ch === "own" ? "자체예약" : "위버예약"}
              </button>
            ))}
          </div>
          {weebur ? (
            <label className="mt-2 block text-[13px] text-[var(--gov-ink-sub)]">
              <span className="mb-1 block">
                위버 예약번호{" "}
                <em className="not-italic text-[#8b929c]">(선택)</em>
              </span>
              <input
                className={INPUT}
                value={f.weeburRef}
                maxLength={60}
                onChange={(e) => set({ weeburRef: e.target.value })}
                placeholder="위버에서 받은 예약번호"
              />
            </label>
          ) : null}
        </div>

        <div>
          <p className={SEC_T}>상품</p>
          <div className="grid grid-cols-3">
            {PRODUCT_ORDER.map((pt, i) => (
              <button
                key={pt}
                type="button"
                aria-pressed={f.productType === pt}
                onClick={() => setProduct(pt)}
                className={`${segBtn(f.productType === pt)} ${i === 0 ? "rounded-l" : i === 2 ? "-ml-px rounded-r" : "-ml-px"}`}
              >
                {PRODUCTS[pt].name}
              </button>
            ))}
          </div>
          {!f.productType ? (
            <p className="mt-1 text-[12.5px] text-[var(--gov-warn)]">
              예전에 들어온 예약이라 상품이 비어 있습니다. 하나를 골라 주세요.
            </p>
          ) : null}
        </div>

        <div>
          <p className={SEC_T}>일정</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[13px] text-[var(--gov-ink-sub)]">
              <span className="mb-1 block">
                {dayOnly ? (
                  <RoleTag role="day" text="당일 시작" />
                ) : (
                  <RoleTag role="in" text="입실" />
                )}
              </span>
              <input
                type="date"
                data-testid="form-start"
                className={INPUT}
                value={f.useDate}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="block text-[13px] text-[var(--gov-ink-sub)]">
              <span className="mb-1 block">&nbsp;</span>
              <input
                type="time"
                className={INPUT}
                value={f.startTime}
                onChange={(e) => set({ startTime: e.target.value })}
              />
            </label>
            <label className="block text-[13px] text-[var(--gov-ink-sub)]">
              <span className="mb-1 block">
                {dayOnly ? (
                  <RoleTag role="day" text="당일 종료" />
                ) : (
                  <RoleTag role="out" text="퇴실" />
                )}
              </span>
              <input
                type="date"
                className={INPUT}
                value={f.endDate}
                min={f.useDate}
                disabled={f.productType === "daytrip"}
                onChange={(e) =>
                  e.target.value && set({ endDate: e.target.value }, true)
                }
              />
            </label>
            <label className="block text-[13px] text-[var(--gov-ink-sub)]">
              <span className="mb-1 block">
                {nights > 0 ? `${nights}박` : " "}
              </span>
              <input
                type="time"
                className={INPUT}
                value={f.endTime}
                onChange={(e) => set({ endTime: e.target.value })}
              />
            </label>
          </div>
        </div>

        {blockedDates?.length || conflicts?.length ? (
          <div ref={confirmRef} className="space-y-3">
            {blockedDates?.length ? (
              <div
                data-testid="blocked-box"
                className="rounded border border-[var(--gov-danger)]/40 bg-[var(--gov-danger-weak)] p-4 text-[13.5px]"
              >
                <p className="font-semibold text-[var(--gov-danger)]">
                  막아 둔 날짜가 들어 있습니다
                </p>
                <ul className="mt-1.5 space-y-0.5">
                  {blockedDates.map((d) => (
                    <li key={d}>
                      {label(d)}
                      {blocks.get(d) ? ` · ${blocks.get(d)}` : ""}
                    </li>
                  ))}
                </ul>
                <label className="mt-3 flex items-start gap-2 border-t border-[var(--gov-danger)]/25 pt-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={blockOk}
                    onChange={(e) => setBlockOk(e.target.checked)}
                  />
                  <span>막은 날짜인 것을 확인했고 그래도 받습니다.</span>
                </label>
              </div>
            ) : null}
            {conflicts?.length ? (
              <div
                data-testid="conflict-box"
                className="rounded border border-[var(--gov-danger)]/40 bg-[var(--gov-danger-weak)] p-4 text-[13.5px]"
              >
                <p className="font-semibold text-[var(--gov-danger)]">
                  이 날짜에 다른 단체가 있습니다
                </p>
                <div className="mt-2 space-y-3">
                  {conflictDays.map(([day, list]) => {
                    const my = roleOfMine(day);
                    const sum = list.reduce((s, c) => s + (c.people || 0), 0);
                    return (
                      <div key={day}>
                        <p className="mb-1 font-semibold">{label(day)}</p>
                        {list.map((c) => {
                          const role = (
                            ["in", "stay", "day", "out"].includes(c.role)
                              ? c.role
                              : "day"
                          ) as DayRole;
                          return (
                            <p
                              key={`${c.id}-${day}`}
                              className="flex items-baseline gap-2 py-0.5"
                            >
                              <span className="flex-1">
                                {c.org}{" "}
                                <RoleTag
                                  role={role}
                                  text={ROLE_LABEL[role]}
                                  small
                                />
                              </span>
                              <b>{num(c.people)}명</b>
                            </p>
                          );
                        })}
                        <p className="flex items-baseline gap-2 py-0.5 font-semibold text-[var(--gov-brand)]">
                          <span className="flex-1">
                            이번 예약{" "}
                            <RoleTag role={my} text={ROLE_LABEL[my]} small />
                          </span>
                          <b>{num(mine)}명</b>
                        </p>
                        <p className="mt-1 flex justify-between border-t border-[var(--gov-danger)]/20 pt-1">
                          <span>그날 합계</span>
                          <b data-testid="conflict-sum">{num(sum + mine)}명</b>
                        </p>
                      </div>
                    );
                  })}
                </div>
                <label className="mt-3 flex items-start gap-2 border-t border-[var(--gov-danger)]/25 pt-3">
                  <input
                    type="checkbox"
                    data-testid="conflict-ok"
                    className="mt-1"
                    checked={addOk}
                    onChange={(e) => setAddOk(e.target.checked)}
                  />
                  <span>
                    확인했고 <b>추가 예약</b>으로 함께 받습니다.
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <p className={SEC_T}>단체·담당자</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              className={`${INPUT} col-span-2`}
              data-testid="form-company"
              value={f.company}
              maxLength={80}
              onChange={(e) => set({ company: e.target.value })}
              placeholder="단체명 (회사·모임)"
            />
            <input
              className={INPUT}
              data-testid="form-name"
              value={f.customerName}
              maxLength={40}
              onChange={(e) => set({ customerName: e.target.value })}
              placeholder="담당자 이름"
            />
            <input
              className={INPUT}
              data-testid="form-phone"
              value={f.phone}
              maxLength={20}
              inputMode="tel"
              onChange={(e) => set({ phone: e.target.value })}
              placeholder="연락처"
            />
            <label className="col-span-2 block text-[13px] text-[var(--gov-ink-sub)]">
              <span className="mb-1 block">
                담당자 이메일{" "}
                <em className="not-italic text-[#8b929c]">
                  (선택 · 확정본·안내 메일을 받을 주소)
                </em>
              </span>
              <input
                type="email"
                className={INPUT}
                value={f.email}
                maxLength={120}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="예: manager@company.co.kr"
              />
            </label>
          </div>
        </div>

        <div>
          <p className={SEC_T}>인원</p>
          <div className="flex items-end gap-3">
            <label className="block flex-1 text-[13px] text-[var(--gov-ink-sub)]">
              <span className="mb-1 block">성인</span>
              <input
                type="number"
                min={0}
                data-testid="form-adult"
                className={INPUT}
                value={f.adultCount}
                onChange={(e) => set({ adultCount: e.target.value })}
              />
            </label>
            <label className="block flex-1 text-[13px] text-[var(--gov-ink-sub)]">
              <span className="mb-1 block">어린이</span>
              <input
                type="number"
                min={0}
                data-testid="form-child"
                className={INPUT}
                value={f.childCount}
                onChange={(e) => set({ childCount: e.target.value })}
              />
            </label>
            <div className="flex-1 text-right">
              <p className="text-[13px] text-[var(--gov-ink-sub)]">총</p>
              <p className="text-[26px] font-bold leading-tight">{mine}명</p>
            </div>
          </div>
        </div>

        <div>
          <p className={SEC_T}>금액</p>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[14px] text-[var(--gov-ink-sub)]">
              총액{" "}
              <span className="text-[12px]">
                (성인 {n(f.adultCount)} × {num(n(f.unitAdult))} + 어린이{" "}
                {n(f.childCount)} × {num(n(f.unitChild))}
                {n(f.extraAmount) ? ` + ${num(n(f.extraAmount))}` : ""})
              </span>
            </span>
            <b className="shrink-0 text-[20px]" data-testid="form-total">
              {won(a.total)}
            </b>
          </div>
          <details className="mt-1 text-[13px] text-[var(--gov-ink-sub)]">
            <summary className="cursor-pointer">단가·추가 금액 바꾸기</summary>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <label className="block">
                <span className="mb-1 block">성인 1인</span>
                <MoneyInput
                  value={f.unitAdult}
                  onChange={(v) => set({ unitAdult: v })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block">어린이 1인</span>
                <MoneyInput
                  value={f.unitChild}
                  onChange={(v) => set({ unitChild: v })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block">추가 금액</span>
                <MoneyInput
                  allowNegative
                  value={f.extraAmount}
                  onChange={(v) => set({ extraAmount: v })}
                />
              </label>
            </div>
          </details>
        </div>

        <div>
          <p className={SEC_T}>결제 방식</p>
          {weebur ? (
            <div className="rounded border border-[#d8ccf2] bg-[#faf8fe] p-3 text-[14px]">
              <p className="mb-1 text-[12px] font-semibold text-[#5b3fa3]">
                위버예약은 결제를 위버가 받습니다
              </p>
              <div className="flex justify-between">
                <span>전체 금액</span>
                <b>{won(a.total)}</b>
              </div>
              <div className="flex justify-between text-[var(--gov-danger)]">
                <span>위버 수수료 {Math.round(feeRate * 100)}%</span>
                <span>− {won(a.fee)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-[#e4dcf5] pt-1 text-[#5b3fa3]">
                <span>초호쉼터 정산 예정</span>
                <b>{won(a.net)}</b>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2">
                {(["split", "full"] as const).map((plan, i) => (
                  <button
                    key={plan}
                    type="button"
                    aria-pressed={f.paymentPlan === plan}
                    onClick={() => set({ paymentPlan: plan })}
                    className={`${segBtn(f.paymentPlan === plan)} ${i === 0 ? "rounded-l" : "-ml-px rounded-r"}`}
                  >
                    {plan === "split" ? "예약금 + 잔금" : "전액 한 번에"}
                  </button>
                ))}
              </div>
              {f.paymentPlan === "split" ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-[14px]">
                    <span className="w-14 shrink-0 text-[var(--gov-ink-sub)]">
                      예약금
                    </span>
                    <select
                      className={`${INPUT} !w-28`}
                      value={f.ratioChoice}
                      onChange={(e) =>
                        set({ ratioChoice: e.target.value as RatioChoice })
                      }
                    >
                      <option value="0.3">30%</option>
                      <option value="0.2">20%</option>
                      <option value="0.5">50%</option>
                      <option value="custom">직접 입력</option>
                    </select>
                    {f.ratioChoice === "custom" ? (
                      <span className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className={`${INPUT} !w-20`}
                          value={f.ratioCustom}
                          onChange={(e) => set({ ratioCustom: e.target.value })}
                        />
                        %
                      </span>
                    ) : null}
                    <b className="ml-auto">{won(a.deposit)}</b>
                  </div>
                  <div className="flex items-center gap-2 text-[14px]">
                    <span className="w-14 shrink-0 text-[var(--gov-ink-sub)]">
                      잔금
                    </span>
                    <span className="text-[12.5px] text-[var(--gov-ink-sub)]">
                      이용일 전까지
                    </span>
                    <b className="ml-auto">{won(a.balance)}</b>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 text-[14px]">
                  <span className="text-[var(--gov-ink-sub)]">전액</span>
                  <b className="ml-auto">{won(a.total)}</b>
                </div>
              )}
            </>
          )}
        </div>

        {!weebur && !editing ? (
          <div>
            <p className={SEC_T}>이미 받은 입금 (선택)</p>
            <div className="rounded border border-[var(--gov-line)] p-3">
              <div className="space-y-1.5 text-[14px]">
                {f.paymentPlan === "split" ? (
                  <>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={paid.deposit}
                        onChange={(e) =>
                          setPaid({ ...paid, deposit: e.target.checked })
                        }
                      />
                      예약금 {won(a.deposit)} 받음
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={paid.balance}
                        onChange={(e) =>
                          setPaid({ ...paid, balance: e.target.checked })
                        }
                      />
                      잔금 {won(a.balance)} 받음
                    </label>
                  </>
                ) : (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={paid.full}
                      onChange={(e) =>
                        setPaid({ ...paid, full: e.target.checked })
                      }
                    />
                    전액 {won(a.total)} 받음
                  </label>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-[13px] text-[var(--gov-ink-sub)]">
                  <span className="mb-1 block">입금일</span>
                  <input
                    type="date"
                    className={INPUT}
                    value={paid.paidAt}
                    onChange={(e) =>
                      e.target.value &&
                      setPaid({ ...paid, paidAt: e.target.value })
                    }
                  />
                </label>
                <label className="block text-[13px] text-[var(--gov-ink-sub)]">
                  <span className="mb-1 block">방법</span>
                  <select
                    className={INPUT}
                    value={paid.method}
                    onChange={(e) =>
                      setPaid({
                        ...paid,
                        method: e.target.value as PaidState["method"],
                      })
                    }
                  >
                    <option value="transfer">계좌이체</option>
                    <option value="card">카드</option>
                    <option value="cash">현금</option>
                  </select>
                </label>
              </div>
              <p className="mt-2 text-[12px] text-[#8b929c]">
                입금이 하나도 없으면 가계약으로 저장됩니다. 사이트 예약결제가
                붙으면 그 결제는 「사이트 결제」로 자동 기록됩니다.
              </p>
            </div>
          </div>
        ) : null}

        <div>
          <p className={SEC_T}>메모</p>
          <textarea
            rows={3}
            maxLength={1000}
            className="w-full rounded border border-[var(--gov-line-strong)] bg-white px-2.5 py-2 text-[14px] outline-none focus:border-[var(--gov-brand)]"
            value={f.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="버스 도착 시각, 채식 인원, 세미나실 사용 등"
          />
        </div>
      </div>
    </Drawer>
  );
}
