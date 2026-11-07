"use client";

import { useState } from "react";
import {
  ChannelBadge,
  Drawer,
  INPUT,
  MoneyInput,
  PayBox,
  RoleTag,
  SEC_T,
  stageTone,
} from "./bits";
import {
  FAINT,
  KIND_LABEL,
  METHOD_LABEL,
  WEEBUR_INK,
  addDays,
  endOf,
  formatPhone,
  isCancelled,
  isHold,
  holdExpired,
  isWeebur,
  kstStamp,
  label,
  md,
  nextStep,
  awaitingWeeburConfirm,
  nightsOf,
  num,
  orgOf,
  people,
  productName,
  ratioPct,
  roleOn,
  roleShort,
  stageLabel,
  timesOf,
  type DayIndex,
  type Reservation,
} from "./model";

const VIA_LABEL: Record<string, string> = {
  admin: "관리자 직접 등록",
  contract: "약정서",
  legacy: "예전 등록",
};
const ACTION_LABEL: Record<string, string> = {
  created: "예약 등록",
  updated: "내용 수정",
  payment_added: "입금 기록 추가",
  payment_voided: "입금 기록 무효",
  hold_extended: "가계약 24시간 연장",
  cancelled: "예약 취소",
  additional_confirmed: "같은 날 다른 단체 확인 후 추가 예약으로 저장",
  weebur_confirmed: "위버예약 확정",
  weebur_rejected: "위버 접수 거절",
};

export type PaymentDraft = {
  kind: string;
  amount: number;
  method: string;
  paidAt: string;
  memo?: string;
};

function RelRow({
  o,
  day,
  prefix,
}: {
  o: Reservation;
  day: string;
  prefix?: string;
}) {
  const k = roleOn(o, day);
  return (
    <div className="flex items-baseline gap-2 border-t border-[var(--gov-line)] px-3 py-1.5 text-[13.5px]">
      <span className="min-w-0 flex-1">
        {prefix ? <span className={`text-[12px] ${FAINT}`}>{prefix} </span> : null}
        {orgOf(o)} <RoleTag role={k} text={roleShort(k, o)} small />
      </span>
      <b>{people(o)}명</b>
    </div>
  );
}

export function ReservationDetail({
  r,
  index,
  today,
  busy,
  eventsLoading,
  onClose,
  onEdit,
  onPatch,
  onAddPayment,
  onVoidPayment,
}: {
  r: Reservation;
  index: DayIndex;
  today: string;
  busy: boolean;
  eventsLoading: boolean;
  onClose: () => void;
  onEdit: (r: Reservation) => void;
  onPatch: (body: Record<string, unknown>) => Promise<boolean>;
  onAddPayment: (body: PaymentDraft) => Promise<boolean>;
  onVoidPayment: (paymentId: string) => Promise<boolean>;
}) {
  const weebur = isWeebur(r);
  const cancelled = isCancelled(r);
  const end = endOf(r);
  const nights = nightsOf(r);
  const t = timesOf(r);
  const step = nextStep(r);
  const awaiting = awaitingWeeburConfirm(r);

  const stayDays: string[] = [];
  if (nights === 0) stayDays.push(r.useDate);
  else for (let d = r.useDate; d < end; d = addDays(d, 1)) stayDays.push(d);
  const sameRows = stayDays.flatMap((day) =>
    index
      .allLiveMain(day)
      .filter((o) => o.id !== r.id)
      .map((o) => ({ day, o })),
  );
  const nd = nights === 0 ? addDays(r.useDate, 1) : end;
  const nextRows = index.allLiveMain(nd).filter((o) => o.id !== r.id);

  const [payOpen, setPayOpen] = useState(false);
  const [draft, setDraft] = useState<PaymentDraft>({
    kind: weebur ? "settlement" : "partial",
    amount: 0,
    method: weebur ? "transfer" : "transfer",
    paidAt: today,
    memo: "",
  });
  const openPayment = (preset?: Partial<PaymentDraft>) => {
    setDraft({
      kind: weebur ? "settlement" : "partial",
      amount: r.remaining || 0,
      method: "transfer",
      paidAt: today,
      memo: "",
      ...preset,
    });
    setPayOpen(true);
    requestAnimationFrame(() =>
      document
        .getElementById("payment-form")
        ?.scrollIntoView({ block: "center" }),
    );
  };
  const submitPayment = async () => {
    if (!draft.amount || draft.amount < 0) return;
    const ok = await onAddPayment({
      ...draft,
      memo: draft.memo?.trim() || undefined,
    });
    if (ok) setPayOpen(false);
  };

  const kinds = weebur
    ? ["settlement"]
    : ["deposit", "balance", "full", "partial"];
  const methods = weebur ? ["transfer"] : ["transfer", "card", "cash"];
  const payments = r.payments ?? [];

  return (
    <Drawer
      title="예약 상세"
      width="max-w-[440px]"
      onClose={onClose}
      testId="detail-drawer"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEdit(r)}
            disabled={cancelled}
            className={`h-11 rounded border border-[var(--gov-line-strong)] text-[14px] disabled:opacity-40 ${step || awaiting ? "" : "col-span-2"}`}
          >
            수정
          </button>
          {awaiting ? (
            <button
              type="button"
              data-testid="detail-confirm-weebur"
              disabled={busy}
              onClick={() => {
                if (!confirm(`${orgOf(r)} 위버예약을 확정할까요?`)) return;
                void onPatch({ action: "confirmWeebur" });
              }}
              className="h-11 rounded bg-[var(--gov-brand)] text-[14px] font-semibold text-white disabled:opacity-50"
            >
              예약 확정
            </button>
          ) : null}
          {awaiting ? (
            <button
              type="button"
              data-testid="detail-reject-weebur"
              disabled={busy}
              onClick={() => {
                if (!confirm(`${orgOf(r)} 위버예약 접수를 거절할까요? 취소로 표시되고 날짜가 비워집니다.`)) return;
                void onPatch({ action: "rejectWeebur" });
              }}
              className="col-span-2 h-9 text-[13px] text-[var(--gov-danger)] underline disabled:opacity-50"
            >
              접수 거절
            </button>
          ) : null}
          {step ? (
            <button
              type="button"
              data-testid="detail-next"
              disabled={busy}
              onClick={() =>
                openPayment({
                  kind: step.kind,
                  amount: step.amount,
                  method: step.method,
                })
              }
              className="h-11 rounded bg-[var(--gov-brand)] text-[14px] font-semibold text-white disabled:opacity-50"
            >
              {step.label}
            </button>
          ) : null}
          {!cancelled && !awaiting ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!confirm(`${orgOf(r)} 예약을 취소할까요?`)) return;
                void onPatch({ action: "cancel" });
              }}
              className="col-span-2 h-9 text-[13px] text-[var(--gov-danger)] underline disabled:opacity-50"
            >
              예약 취소
            </button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6 text-[14px]">
        <div>
          <p className="text-[13px] text-[var(--gov-ink-sub)]">
            <ChannelBadge r={r} /> {productName(r)} ·{" "}
            <span className={stageTone(r)}>{stageLabel(r)}</span>
            {r.isAdditional ? (
              <>
                {" "}
                · <span className="text-[var(--gov-danger)]">추가 예약</span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-[22px] font-bold leading-tight">{orgOf(r)}</p>
          <p className="mt-1 text-[14px] text-[var(--gov-ink-sub)]">
            {r.customerName}
            {r.contactTitle ? ` ${r.contactTitle}` : ""}
            {r.phone ? (
              <>
                {" "}
                · {formatPhone(r.phone)}{" "}
                <a
                  href={`tel:${r.phone.replace(/[^0-9+]/g, "")}`}
                  className="ml-1 text-[var(--gov-brand)] underline"
                >
                  전화
                </a>{" "}
                <a
                  href={`sms:${r.phone.replace(/[^0-9+]/g, "")}`}
                  className="text-[var(--gov-brand)] underline"
                >
                  문자
                </a>
              </>
            ) : null}
          </p>
          <p className="text-[14px] text-[var(--gov-ink-sub)]">
            {r.email ? (
              <>
                {r.email}{" "}
                <a
                  href={`mailto:${r.email}`}
                  className="ml-1 text-[var(--gov-brand)] underline"
                >
                  메일
                </a>
              </>
            ) : (
              <span className={FAINT}>이메일 없음 (선택 항목)</span>
            )}
          </p>
          {weebur && r.weeburRef ? (
            <p className={`text-[13px] ${WEEBUR_INK}`}>
              위버 예약번호 {r.weeburRef}
            </p>
          ) : null}
          {r.contractId ? (
            <a
              href={`/dashboard/contracts/${r.contractId}`}
              className="text-[13px] text-[var(--gov-brand)] underline"
            >
              약정서 {r.contractNumber ?? "보기"}
            </a>
          ) : null}
        </div>

        {r.needsReview && r.reviewReason ? (
          <div className="rounded border border-[var(--gov-warn)]/40 bg-[var(--gov-warn-weak)] p-3 text-[13px] text-[var(--gov-warn)]">
            {r.reviewReason}
            <button
              type="button"
              disabled={busy}
              onClick={() => void onPatch({ action: "clearReview" })}
              className="ml-2 underline disabled:opacity-50"
            >
              확인했음
            </button>
          </div>
        ) : null}

        <div>
          <p className={SEC_T}>일정</p>
          {nights === 0 ? (
            <p>
              <b>{label(r.useDate)}</b>{" "}
              <RoleTag role="day" text={`당일 ${t.in}~${t.out}`} />
            </p>
          ) : (
            <>
              <p>
                <b>{label(r.useDate)}</b>{" "}
                <RoleTag role="in" text={`입실 ${t.in}`} />
              </p>
              <p className="mt-1.5">
                <b>{label(end)}</b>{" "}
                <RoleTag role="out" text={`퇴실 ${t.out}`} />{" "}
                <span className="text-[13px] text-[var(--gov-ink-sub)]">
                  {nights}박
                </span>
              </p>
            </>
          )}
          <div className="mt-4 rounded border border-[var(--gov-line)]">
            <p className="bg-[#fafbfc] px-3 py-1.5 text-[12px] font-semibold text-[var(--gov-ink-sub)]">
              같은 날 다른 예약
            </p>
            {sameRows.length ? (
              sameRows.map(({ day, o }) => (
                <RelRow
                  key={`${day}-${o.id}`}
                  o={o}
                  day={day}
                  prefix={stayDays.length > 1 ? md(day) : ""}
                />
              ))
            ) : (
              <p
                className={`border-t border-[var(--gov-line)] px-3 py-1.5 text-[13px] ${FAINT}`}
              >
                없음
              </p>
            )}
          </div>
          <div className="mt-2 rounded border border-[var(--gov-line)]">
            <p className="bg-[#f7f8fa] px-3 py-1.5 text-[12px] font-semibold text-[var(--gov-ink-sub)]">
              다음날 예약 미리보기 · {label(nd)}
              {nights > 0 ? " (퇴실하는 날)" : ""}
            </p>
            {nextRows.length ? (
              nextRows.map((o) => <RelRow key={o.id} o={o} day={nd} />)
            ) : (
              <p
                className={`border-t border-[var(--gov-line)] px-3 py-1.5 text-[13px] ${FAINT}`}
              >
                다음날 예약이 없습니다.
              </p>
            )}
          </div>
        </div>

        <div>
          <p className={SEC_T}>인원</p>
          <p>
            <b className="text-[26px] leading-none">{people(r)}</b>명{" "}
            <span className="ml-2 text-[14px] text-[var(--gov-ink-sub)]">
              성인 {r.adultCount} · 어린이 {r.childCount}
            </span>
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className={`${SEC_T} !mb-0`}>
              {weebur
                ? `위버 결제 · 수수료 ${ratioPct({ depositRatio: r.feeRate })}%`
                : `납부 · ${r.paymentPlan === "full" ? "전액 한 번에" : `예약금 ${ratioPct(r)}% + 잔금`}`}
            </p>
            {!cancelled ? (
              <button
                type="button"
                onClick={() => onEdit(r)}
                className="text-[12.5px] text-[var(--gov-brand)] underline"
              >
                결제 방식 바꾸기
              </button>
            ) : null}
          </div>
          <PayBox r={r} big />
          {isHold(r) && r.holdExpiresAt ? (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onPatch({ action: "extendHold" })}
                  className="h-9 rounded border border-[var(--gov-line-strong)] text-[13px] disabled:opacity-50"
                >
                  24시간 연장
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm(`${orgOf(r)} 가계약을 취소할까요?`)) return;
                    void onPatch({ action: "cancel" });
                  }}
                  className="h-9 rounded border border-[var(--gov-danger)]/40 text-[13px] text-[var(--gov-danger)] disabled:opacity-50"
                >
                  가계약 취소
                </button>
              </div>
              <p className={`mt-1 text-[12px] ${FAINT}`}>
                {holdExpired(r)
                  ? "기한이 지나 관리자 알림 대상입니다. 자동으로 취소하지 않습니다."
                  : "24시간 안에 첫 입금이 없으면 관리자에게 알립니다."}
              </p>
            </>
          ) : null}

          <div className="mt-3">
            <p className="mb-1 text-[12.5px] font-semibold text-[var(--gov-ink-sub)]">
              입금 기록
            </p>
            {payments.length ? (
              payments.map((p) => (
                <div
                  key={p.id}
                  data-testid="payment-row"
                  className={`flex items-baseline gap-2 border-b border-[var(--gov-line)] py-1.5 text-[13.5px] ${p.voidedAt ? "line-through opacity-50" : ""}`}
                >
                  <span className="w-14 shrink-0 text-[var(--gov-ink-sub)]">
                    {md(p.paidAt).replace(/\(.\)/, "")}
                  </span>
                  <span className="min-w-0 flex-1">
                    {KIND_LABEL[p.kind] ?? p.kind} ·{" "}
                    {METHOD_LABEL[p.method] ?? p.method}
                    {p.memo ? (
                      <span className={`block text-[12px] ${FAINT}`}>
                        {p.memo}
                      </span>
                    ) : null}
                  </span>
                  <b>{num(p.amount)}</b>
                  {!p.voidedAt && !cancelled ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          !confirm(
                            `${KIND_LABEL[p.kind] ?? p.kind} ${num(p.amount)}원 기록을 무효로 할까요? 기록은 지워지지 않고 무효 표시만 남습니다.`,
                          )
                        )
                          return;
                        void onVoidPayment(p.id);
                      }}
                      className="shrink-0 text-[12px] text-[var(--gov-danger)] underline disabled:opacity-50"
                    >
                      무효
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className={`py-1.5 text-[13px] ${FAINT}`}>
                아직 입금이 없습니다.
              </p>
            )}
            {!cancelled && !payOpen ? (
              <button
                type="button"
                data-testid="payment-open"
                onClick={() => openPayment()}
                className="mt-2 text-[13px] text-[var(--gov-brand)] underline"
              >
                + 입금 기록 추가 (일부 금액도 가능)
              </button>
            ) : null}
            {payOpen ? (
              <div
                id="payment-form"
                data-testid="payment-form"
                className="mt-2 space-y-2 rounded border border-[var(--gov-brand)]/40 bg-[var(--gov-brand-weak)] p-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-[12.5px] text-[var(--gov-ink-sub)]">
                    <span className="mb-1 block">구분</span>
                    <select
                      data-testid="payment-kind"
                      className={INPUT}
                      value={draft.kind}
                      onChange={(e) =>
                        setDraft({ ...draft, kind: e.target.value })
                      }
                    >
                      {kinds.map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[12.5px] text-[var(--gov-ink-sub)]">
                    <span className="mb-1 block">금액 (원)</span>
                    <MoneyInput
                      testId="payment-amount"
                      value={draft.amount ? String(draft.amount) : ""}
                      onChange={(v) =>
                        setDraft({ ...draft, amount: Math.max(Number(v) || 0, 0) })
                      }
                    />
                  </label>
                  <label className="block text-[12.5px] text-[var(--gov-ink-sub)]">
                    <span className="mb-1 block">입금일</span>
                    <input
                      type="date"
                      className={INPUT}
                      value={draft.paidAt}
                      onChange={(e) =>
                        e.target.value &&
                        setDraft({ ...draft, paidAt: e.target.value })
                      }
                    />
                  </label>
                  <label className="block text-[12.5px] text-[var(--gov-ink-sub)]">
                    <span className="mb-1 block">방법</span>
                    <select
                      data-testid="payment-method"
                      className={INPUT}
                      value={draft.method}
                      onChange={(e) =>
                        setDraft({ ...draft, method: e.target.value })
                      }
                    >
                      {methods.map((m) => (
                        <option key={m} value={m}>
                          {METHOD_LABEL[m]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <input
                  className={INPUT}
                  maxLength={200}
                  value={draft.memo ?? ""}
                  onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
                  placeholder="메모 (선택)"
                />
                <p className="text-[12px] text-[var(--gov-ink-sub)]">
                  {num(draft.amount)}원 기록 · 남은 금액 {num(r.remaining)}원
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPayOpen(false)}
                    className="h-9 flex-1 rounded border border-[var(--gov-line-strong)] bg-white text-[13px]"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    data-testid="payment-save"
                    disabled={busy || !draft.amount}
                    onClick={() => void submitPayment()}
                    className="h-9 flex-[2] rounded bg-[var(--gov-brand)] text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    입금 기록
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {r.notes ? (
          <div>
            <p className={SEC_T}>메모</p>
            <p className="whitespace-pre-wrap">{r.notes}</p>
          </div>
        ) : null}

        <details className="text-[13px] text-[var(--gov-ink-sub)]">
          <summary className="cursor-pointer">
            변경 기록 · 등록 경로 ({VIA_LABEL[r.via] ?? r.via})
          </summary>
          {eventsLoading ? (
            <p className="mt-2">불러오는 중입니다.</p>
          ) : r.events?.length ? (
            <ul className="mt-2 space-y-1">
              {r.events.map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  {kstStamp(e.at)} ·{" "}
                  {e.detail || ACTION_LABEL[e.action] || e.action}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2">기록이 없습니다.</p>
          )}
        </details>
      </div>
    </Drawer>
  );
}
