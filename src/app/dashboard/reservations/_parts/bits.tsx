"use client";

import { useEffect } from "react";
import {
  CH_TONE,
  CHANNEL_LABEL,
  FAINT,
  RT_TONE,
  WEEBUR_INK,
  holdExpired,
  holdHours,
  isCancelled,
  isHold,
  isWeebur,
  kstDue,
  num,
  ratioPct,
  roleShort,
  roleText,
  stageLabel,
  won,
  type DayRole,
  type Reservation,
} from "./model";

export function RoleTag({
  role,
  r,
  short,
  small,
  text,
}: {
  role: DayRole;
  r?: Reservation;
  short?: boolean;
  small?: boolean;
  text?: string;
}) {
  const body =
    text ?? (r ? (short ? roleShort(role, r) : roleText(role, r)) : role);
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-[3px] px-[5px] font-bold leading-[1.6] ${
        small ? "text-[11px]" : "text-[12px]"
      } ${RT_TONE[role]}`}
    >
      {body}
    </span>
  );
}

export function ChannelBadge({
  r,
  small,
}: {
  r: Pick<Reservation, "channel">;
  small?: boolean;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-[3px] border px-[5px] align-[1px] font-bold leading-[1.6] ${
        small ? "text-[10px]" : "text-[11px]"
      } ${CH_TONE[r.channel] ?? CH_TONE.own}`}
    >
      {CHANNEL_LABEL[r.channel] ?? r.channel}
    </span>
  );
}

/** 진행 막대. 예약금 + 잔금이면 예약금 비율 자리에 흰 눈금을 둔다. */
export function Prog({
  pct,
  tick,
  className = "",
}: {
  pct: number;
  tick?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative h-1.5 overflow-hidden rounded-[3px] bg-[#e9ecf1] ${className}`}
    >
      <i
        className="absolute inset-y-0 left-0 bg-[var(--gov-ok)]"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
      {tick ? (
        <b
          className="absolute inset-y-0 w-0.5 bg-white"
          style={{ left: `${tick}%` }}
        />
      ) : null}
    </div>
  );
}

const TONE = {
  done: "font-semibold text-[var(--gov-ok)]",
  wait: "font-semibold text-[var(--gov-warn)]",
  later: "text-[var(--gov-ink-sub)]",
};

function Step({
  name,
  amount,
  done,
  hint,
}: {
  name: string;
  amount?: number;
  done: boolean;
  hint: string;
}) {
  const tone = done ? TONE.done : hint === "입금 전" ? TONE.wait : TONE.later;
  return (
    <div className="flex items-baseline gap-1.5 text-[12.5px]">
      <span className={tone}>{done ? "✓" : "○"}</span>
      <span className="text-[var(--gov-ink-sub)]">{name}</span>
      {amount !== undefined ? <b>{num(amount)}</b> : null}
      {hint ? (
        <span className={`${tone} text-[12px]`}>{done ? "입금" : hint}</span>
      ) : null}
    </div>
  );
}

/** 가계약 24시간 남은 시간 · 기한 지남 줄. */
export function HoldLine({ r, big }: { r: Reservation; big?: boolean }) {
  if (!isHold(r) || !r.holdExpiresAt) return null;
  const exp = holdExpired(r);
  const h = holdHours(r);
  return (
    <div className={`mb-1.5 ${big ? "text-[13.5px]" : "text-[12.5px]"}`}>
      <p
        className={`font-semibold ${exp ? "text-[var(--gov-danger)]" : "text-[var(--gov-warn)]"}`}
      >
        {exp
          ? `⚠ 가계약 기한 지남 · ${Math.max(-h, 0)}시간 지남`
          : `⏱ 가계약 · ${Math.max(h, 0)}시간 남음`}
      </p>
      <p
        className={`text-[11.5px] ${exp ? "text-[var(--gov-danger)]" : "text-[var(--gov-ink-sub)]"}`}
      >
        {kstDue(r.holdExpiresAt)}
        {exp ? "까지였음 · 관리자 알림 대상" : "까지 첫 입금이 없으면 관리자 알림"}
      </p>
    </div>
  );
}

function Row({
  k,
  v,
  tone = "",
}: {
  k: string;
  v: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-[var(--gov-ink-sub)]">{k}</span>
      <span className={tone}>{v}</span>
    </div>
  );
}

/** 위버예약: 전체 금액 · 위버 수수료 · 초호쉼터 정산 예정 + 두 단계. */
export function WeeburBox({ r, big }: { r: Reservation; big?: boolean }) {
  const confirmed = r.stage === "settle_pending" || r.stage === "settled";
  const settled = r.stage === "settled";
  return (
    <div
      className={`rounded border border-[#d8ccf2] bg-[#faf8fe] px-3 py-2 ${big ? "text-[14px]" : "text-[13px]"}`}
    >
      <p className={`mb-1 text-[12px] font-semibold ${WEEBUR_INK}`}>
        위버 결제 · 결제는 위버가 받음
      </p>
      <Row k="전체 금액" v={<b>{won(r.totalAmount)}</b>} />
      <Row
        k={`위버 수수료 ${ratioPct({ depositRatio: r.feeRate })}%`}
        v={`− ${won(r.fee)}`}
        tone="text-[var(--gov-danger)]"
      />
      <div className="my-1 border-t border-[#e4dcf5]" />
      <Row
        k={`초호쉼터 정산 ${settled ? "완료" : "예정"}`}
        v={<b>{won(r.net)}</b>}
        tone={WEEBUR_INK}
      />
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
        <Step name="초호쉼터 확정" done={confirmed} hint={confirmed ? "" : "확인 전"} />
        <Step name="위버 → 초호쉼터 정산" done={settled} hint="" />
      </div>
    </div>
  );
}

/** 자체예약: 「납부 / 총액 · 남은 금액」 + 진행 막대 + 예약금·잔금(또는 전액) 단계. */
export function PayBox({ r, big }: { r: Reservation; big?: boolean }) {
  if (isWeebur(r)) return <WeeburBox r={r} big={big} />;
  const total = r.totalAmount;
  const paid = r.received;
  const left = r.remaining;
  const pct = total ? Math.round((paid / total) * 100) : 0;
  const split = r.paymentPlan !== "full";
  const depositDone = r.depositAmount > 0 && paid >= r.depositAmount;
  const tone = holdExpired(r)
    ? "border-[var(--gov-danger)]/50 bg-[var(--gov-danger-weak)]"
    : left && !paid
      ? "border-[var(--gov-line)] bg-[var(--gov-warn-weak)]"
      : "border-[var(--gov-line)] bg-white";
  return (
    <div className={`rounded border px-3 py-2 ${tone}`}>
      <HoldLine r={r} big={big} />
      <div
        className={`flex items-baseline justify-between gap-2 ${big ? "text-[15px]" : "text-[13px]"}`}
      >
        <span>
          납부{" "}
          <b className={paid ? "text-[var(--gov-ok)]" : ""}>{num(paid)}</b>{" "}
          <span className="text-[var(--gov-ink-sub)]">/ {num(total)}원</span>
        </span>
        {left ? (
          <span className="text-[var(--gov-warn)]">
            남은 <b>{num(left)}</b>
          </span>
        ) : (
          <span className={TONE.done}>완납</span>
        )}
      </div>
      <Prog pct={pct} tick={split ? ratioPct(r) : undefined} className="my-1.5" />
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {split ? (
          <>
            <Step
              name={`예약금 ${ratioPct(r)}%`}
              amount={r.depositAmount}
              done={depositDone}
              hint="입금 전"
            />
            <Step
              name="잔금"
              amount={r.balanceAmount}
              done={left <= 0}
              hint={depositDone ? "이용일 전까지" : "예약금 뒤"}
            />
          </>
        ) : (
          <Step name="전액" amount={total} done={left <= 0} hint="입금 전" />
        )}
      </div>
    </div>
  );
}

/** 휴대폰 주 보기 한 줄 납부 상태. */
export function PayLine({ r }: { r: Reservation }) {
  if (isCancelled(r)) return <span className={FAINT}>취소</span>;
  if (isWeebur(r))
    return (
      <>
        <span className={`font-semibold ${WEEBUR_INK}`}>
          위버 · {stageLabel(r)}
        </span>{" "}
        <span className="text-[var(--gov-ink-sub)]">
          · 전체 {num(r.totalAmount)} · 수수료 {num(r.fee)} · 정산 {num(r.net)}
        </span>
      </>
    );
  if (!r.remaining) return <span className={TONE.done}>완납</span>;
  if (!r.received) {
    const exp = holdExpired(r);
    return (
      <>
        <span
          className={
            exp ? "font-semibold text-[var(--gov-danger)]" : TONE.wait
          }
        >
          가계약 ·{" "}
          {r.holdExpiresAt
            ? exp
              ? "기한 지남"
              : `${Math.max(holdHours(r), 0)}시간 남음`
            : "입금 전"}
        </span>{" "}
        <span className="text-[var(--gov-ink-sub)]">
          · 입금 0 / {num(r.totalAmount)}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="text-[var(--gov-ink-sub)]">납부 {num(r.received)}</span>{" "}
      · <span className={TONE.wait}>남은 {num(r.remaining)}</span>
    </>
  );
}

export function stageTone(r: Reservation) {
  if (isCancelled(r)) return FAINT;
  if (r.stage === "hold") return TONE.wait;
  if (r.stage === "paid" || r.stage === "settled") return TONE.done;
  if (isWeebur(r)) return `font-semibold ${WEEBUR_INK}`;
  return TONE.later;
}

/** 오른쪽에서 여는 창(등록·상세 공용). Esc·바깥 누르면 닫는다. */
export function Drawer({
  title,
  width,
  onClose,
  footer,
  children,
  testId,
}: {
  title: string;
  width: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/30" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        data-testid={testId}
        className={`fixed inset-y-0 right-0 z-[70] flex w-full flex-col bg-white shadow-2xl ${width}`}
      >
        <div className="flex items-center border-b border-[var(--gov-line)] px-5 py-4">
          <h2 className="text-[17px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto text-[24px] leading-none text-[var(--gov-ink-sub)]"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <div className="border-t border-[var(--gov-line)] px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </>
  );
}

export const INPUT =
  "h-10 w-full rounded border border-[var(--gov-line-strong)] bg-white px-2.5 text-[14px] outline-none focus:border-[var(--gov-brand)] disabled:bg-[#f4f5f7]";
export const segBtn = (on: boolean) =>
  `h-11 border text-[14px] ${
    on
      ? "relative z-[1] border-[var(--gov-brand)] bg-[var(--gov-brand)] text-white"
      : "border-[var(--gov-line-strong)] bg-white"
  }`;
export const SEC_T =
  "mb-2 text-[12px] font-semibold tracking-[0.02em] text-[#8b929c]";

/** 금액 입력. 세 자리마다 콤마를 찍어 보이고, 값은 숫자 문자열로 돌려준다. */
export function MoneyInput({
  value,
  onChange,
  allowNegative,
  testId,
}: {
  value: string;
  onChange: (digits: string) => void;
  allowNegative?: boolean;
  testId?: string;
}) {
  const digits = String(value ?? "").replace(/[^0-9-]/g, "");
  const shown =
    digits === "" || digits === "-"
      ? digits
      : Number(digits).toLocaleString("ko-KR");
  return (
    <input
      type="text"
      inputMode="numeric"
      data-testid={testId}
      className={INPUT}
      value={shown}
      onChange={(e) => {
        let raw = e.target.value.replace(/[^0-9-]/g, "");
        raw = allowNegative
          ? raw.replace(/(?!^)-/g, "")
          : raw.replace(/-/g, "");
        onChange(raw.replace(/^(-?)0+(?=\d)/, "$1"));
      }}
    />
  );
}
