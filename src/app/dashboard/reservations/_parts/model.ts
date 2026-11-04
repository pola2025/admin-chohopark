/**
 * 예약 관리 화면 공용 자료형과 계산.
 *
 * 금액·단계(stage)·남은 금액은 chorigol.net 이 계산해 내려준 값을 그대로 쓴다.
 * 여기서 하는 계산은 날짜 구분(입실·연박·퇴실·당일), 표시 문구, 등록 창 미리보기뿐이다.
 * 기준: docs/specs/261104_reservation-revamp-spec.md 2·3장.
 */

export type Channel = "own" | "weebur";
export type ProductType = "workshop" | "daytrip" | "retreat";
export type PaymentPlan = "split" | "full" | "weebur";
export type Stage =
  | "hold"
  | "confirmed"
  | "paid"
  | "weebur_pending"
  | "settle_pending"
  | "settled"
  | "cancelled";
export type DayRole = "in" | "stay" | "day" | "out";

export interface Payment {
  id: string;
  kind: string;
  amount: number;
  method: string;
  paidAt: string;
  memo: string | null;
  voidedAt?: string | null;
}

export interface ReservationEvent {
  at: string;
  actor: string;
  action: string;
  detail: string | null;
}

export interface Reservation {
  id: string;
  source: string;
  contractId: string | null;
  contractNumber: string | null;
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
  paymentStatus: string;
  status: "active" | "cancelled";
  needsReview: boolean;
  reviewReason: string | null;
  notes: string;
  createdAt: string;
  channel: Channel;
  via: "admin" | "contract" | "partner" | "legacy";
  paymentPlan: PaymentPlan;
  depositRatio: number;
  unitAdult: number;
  unitChild: number;
  extraAmount: number;
  feeRate: number;
  fee: number;
  net: number;
  expected: number;
  received: number;
  remaining: number;
  stage: Stage;
  weeburRef: string | null;
  isAdditional: boolean;
  holdExpiresAt: string | null;
  holdExpired: boolean;
  /** 위버예약: 초호쉼터가 확정한 시각 */
  confirmedAt: string | null;
  /** 위버예약: 초호쉼터가 접수를 거절한 시각(취소로 표시됨) */
  rejectedAt: string | null;
  payments: Payment[];
  events?: ReservationEvent[];
}

export interface Block {
  date: string;
  reason: string;
}

export interface Conflict {
  id: string;
  org: string;
  date: string;
  role: string;
  people: number;
}

/** 상품 3개. 단가는 chorigol.net 기본값과 맞춘다(등록 창 미리 채움용). */
export const PRODUCTS: Record<
  ProductType,
  {
    name: string;
    short: string;
    nights: number;
    in: string;
    out: string;
    unitAdult: number;
    unitChild: number;
  }
> = {
  workshop: {
    name: "1박2일 워크샵",
    short: "워크샵",
    nights: 1,
    in: "15:00",
    out: "11:00",
    unitAdult: 99000,
    unitChild: 66000,
  },
  daytrip: {
    name: "당일 야유회",
    short: "야유회",
    nights: 0,
    in: "10:00",
    out: "16:30",
    unitAdult: 66000,
    unitChild: 44000,
  },
  retreat: {
    name: "2박3일 수련회",
    short: "수련회",
    nights: 2,
    in: "15:00",
    out: "11:00",
    unitAdult: 172000,
    unitChild: 66000,
  },
};
export const PRODUCT_ORDER: ProductType[] = ["workshop", "daytrip", "retreat"];

export function productOf(r: Pick<Reservation, "productType">) {
  return (PRODUCTS as Record<string, (typeof PRODUCTS)[ProductType]>)[
    r.productType
  ];
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
export const CHANNEL_LABEL: Record<Channel, string> = {
  own: "자체예약",
  weebur: "위버예약",
};
export const ROLE_LABEL: Record<DayRole, string> = {
  in: "입실",
  stay: "연박",
  day: "당일",
  out: "퇴실",
};
const ROLE_ORDER: DayRole[] = ["stay", "day", "out", "in"];

export const KIND_LABEL: Record<string, string> = {
  deposit: "예약금",
  balance: "잔금",
  full: "전액",
  partial: "일부 입금",
  guest_paid: "손님 → 위버 결제 (참고)",
  settlement: "위버 정산 입금",
};
export const METHOD_LABEL: Record<string, string> = {
  transfer: "계좌이체",
  card: "카드",
  cash: "현금",
  weebur: "위버 결제",
  site: "사이트 결제",
};
export const STAGE_LABEL: Record<Stage, string> = {
  hold: "가계약",
  confirmed: "확정",
  paid: "완납",
  weebur_pending: "확정 대기",
  settle_pending: "확정 · 정산 대기",
  settled: "정산 완료",
  cancelled: "취소",
};

/* ── 숫자·날짜 ─────────────────────────────────────────── */

export const num = (n: number) => Math.round(n || 0).toLocaleString("ko-KR");
export const won = (n: number) => `${num(n)}원`;
export const pad = (n: number) => String(n).padStart(2, "0");

function parseDay(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmtDay(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function addDays(s: string, n: number) {
  const d = parseDay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDay(d);
}
export const weekdayOf = (s: string) => parseDay(s).getUTCDay();
export const dayNum = (s: string) => Number(s.slice(8, 10));
export function daysBetween(a: string, b: string) {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);
}

/** 한국 시각 기준 오늘 `YYYY-MM-DD`. */
export function kstToday(now = Date.now()) {
  return new Date(now + 9 * 3600e3).toISOString().slice(0, 10);
}

export const label = (s: string) =>
  `${Number(s.slice(5, 7))}월 ${dayNum(s)}일 (${WEEKDAYS[weekdayOf(s)]})`;
export const md = (s: string) =>
  `${Number(s.slice(5, 7))}/${dayNum(s)}(${WEEKDAYS[weekdayOf(s)]})`;
export const monthTitle = (m: string) =>
  `${m.slice(0, 4)}년 ${Number(m.slice(5, 7))}월`;
export function shiftMonth(m: string, n: number) {
  const d = parseDay(`${m}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return fmtDay(d).slice(0, 7);
}
export function lastDayOf(m: string) {
  return addDays(`${shiftMonth(m, 1)}-01`, -1);
}

/** 달력 칸: 그 달 1일이 든 주 일요일부터 말일이 든 주 토요일까지. */
export function monthGrid(m: string) {
  const first = `${m}-01`;
  const start = addDays(first, -weekdayOf(first));
  const last = lastDayOf(m);
  const end = addDays(last, 6 - weekdayOf(last));
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return { start, end, days };
}

/** DB 시각(UTC, 'Z' 없이 오기도 함)을 한국 시각 Date 처럼 쓸 수 있게 바꾼다. */
function kstParts(at: string) {
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(at)
    ? at
    : `${at.replace(" ", "T")}Z`;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + 9 * 3600e3);
}
export function kstStamp(at: string) {
  const d = kstParts(at);
  if (!d) return at;
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function kstDue(at: string) {
  const d = kstParts(at);
  if (!d) return at;
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]}) ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/* ── 예약 한 건 ───────────────────────────────────────── */

export const endOf = (r: Pick<Reservation, "useDate" | "endDate">) =>
  r.endDate && r.endDate > r.useDate ? r.endDate : r.useDate;
export const covers = (r: Reservation, day: string) =>
  r.useDate <= day && day <= endOf(r);
export function roleOn(r: Reservation, day: string): DayRole {
  const end = endOf(r);
  if (r.useDate === end) return "day";
  if (day === r.useDate) return "in";
  if (day === end) return "out";
  return "stay";
}
export const nightsOf = (r: Reservation) => daysBetween(r.useDate, endOf(r));
export const people = (r: Reservation) =>
  r.adultCount + r.childCount || r.peopleCount || 0;
export const orgOf = (r: Reservation) =>
  r.company || r.customerName || "이름 없음";
export const isWeebur = (r: Reservation) => r.channel === "weebur";
export const isCancelled = (r: Reservation) =>
  r.status === "cancelled" || r.stage === "cancelled";
export const isHold = (r: Reservation) =>
  !isCancelled(r) && !isWeebur(r) && r.stage === "hold";
export const holdExpired = (r: Reservation) => isHold(r) && r.holdExpired;
export function holdHours(r: Reservation, now = Date.now()) {
  if (!r.holdExpiresAt) return 0;
  const d = kstParts(r.holdExpiresAt);
  if (!d) return 0;
  return Math.round((d.getTime() - 9 * 3600e3 - now) / 3600e3);
}
export const stageLabel = (r: Reservation) =>
  r.rejectedAt
    ? "접수 거절"
    : (STAGE_LABEL[isCancelled(r) ? "cancelled" : r.stage] ?? r.stage);
/** 초호쉼터가 아직 확정·거절하지 않은 위버 접수 */
export const awaitingWeeburConfirm = (r: Reservation) =>
  isWeebur(r) && !isCancelled(r) && r.stage === "weebur_pending";
export const productName = (r: Reservation) =>
  productOf(r)?.name ?? r.productName ?? r.productType;
export const productShort = (r: Reservation) =>
  productOf(r)?.short ?? r.productName ?? "";
export function timesOf(r: Reservation) {
  const p = productOf(r);
  return {
    in: r.startTime || p?.in || "",
    out: r.endTime || p?.out || "",
  };
}
export const ratioPct = (r: Pick<Reservation, "depositRatio">) =>
  Math.round((r.depositRatio || 0) * 100);

export function roleText(role: DayRole, r: Reservation) {
  const t = timesOf(r);
  if (role === "in") return `입실 ${t.in}`.trim();
  if (role === "out") return `퇴실 ${t.out}`.trim();
  if (role === "day") return `당일 ${t.in}~${t.out}`;
  return "연박";
}
export function roleShort(role: DayRole, r: Reservation) {
  const t = timesOf(r);
  if (role === "day") return `당일 ${t.in}`.trim();
  if (role === "in") return `입실 ${t.in}`.trim();
  if (role === "out") return `퇴실 ${t.out}`.trim();
  return "연박";
}

export function formatPhone(value: string) {
  const d = (value || "").replace(/[^0-9]/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return value;
}

/* ── 날짜별 묶음 ──────────────────────────────────────── */

export type Filters = { channel: "all" | Channel; showCancelled: boolean };

/**
 * 「이날 예약」 = 입실·연박·당일. 퇴실일은 전날 예약이 이어진 것이라 따로 센다.
 * `all*` 은 경로 필터를 무시한다(상세 창의 같은 날 다른 예약처럼 수용 인원 판단용).
 */
export function dayIndex(items: Reservation[], f: Filters) {
  const chOk = (r: Reservation) =>
    f.channel === "all" || r.channel === f.channel;
  const byRole = (day: string) => (a: Reservation, b: Reservation) =>
    ROLE_ORDER.indexOf(roleOn(a, day)) - ROLE_ORDER.indexOf(roleOn(b, day));
  const pick = (day: string, keep: (r: Reservation) => boolean) =>
    items.filter((r) => covers(r, day) && keep(r)).sort(byRole(day));
  return {
    chOk,
    /** 달력·패널에 그리는 이날 예약(취소 포함 설정 따름) */
    mainOnDay: (day: string) =>
      pick(
        day,
        (r) =>
          chOk(r) &&
          (f.showCancelled || !isCancelled(r)) &&
          roleOn(r, day) !== "out",
      ),
    /** 인원 합계용 이날 예약(취소 제외) */
    liveMain: (day: string) =>
      pick(day, (r) => chOk(r) && !isCancelled(r) && roleOn(r, day) !== "out"),
    outOnDay: (day: string) =>
      pick(day, (r) => chOk(r) && !isCancelled(r) && roleOn(r, day) === "out"),
    allLiveMain: (day: string) =>
      pick(day, (r) => !isCancelled(r) && roleOn(r, day) !== "out"),
  };
}
export type DayIndex = ReturnType<typeof dayIndex>;

export const sumPeople = (list: Reservation[]) =>
  list.reduce((s, r) => s + people(r), 0);

/** 상세 창 다음 단계 단추가 미리 채울 입금 기록. 없으면 null. */
export function nextStep(
  r: Reservation,
): { label: string; kind: string; amount: number; method: string } | null {
  if (isCancelled(r)) return null;
  if (isWeebur(r)) {
    // 확정 전(weebur_pending)은 입금 단추 대신 「예약 확정」·「접수 거절」을 보인다.
    if (r.stage === "settle_pending")
      return {
        label: "정산 입금 확인",
        kind: "settlement",
        amount: r.remaining || r.net,
        method: "transfer",
      };
    return null;
  }
  if (r.remaining <= 0) return null;
  if (r.paymentPlan === "full")
    return {
      label: "전액 입금 확인",
      kind: r.received > 0 ? "balance" : "full",
      amount: r.remaining,
      method: "transfer",
    };
  if (r.received < r.depositAmount)
    return {
      label: "예약금 입금 확인",
      kind: "deposit",
      amount: r.depositAmount - r.received,
      method: "transfer",
    };
  return {
    label: "잔금 입금 확인",
    kind: "balance",
    amount: r.remaining,
    method: "transfer",
  };
}

/* ── 표시용 class 묶음 (와이어프레임 .rt·.bar·.ch) ─────── */

export const RT_TONE: Record<DayRole, string> = {
  in: "bg-[#e3eaf6] text-[#1b3b6f]",
  out: "bg-[#eceef1] text-[#4b5563]",
  day: "bg-[var(--gov-ok-weak)] text-[var(--gov-ok)]",
  stay: "bg-[#f1f4fa] text-[#5a6f96]",
};
export const BAR_EDGE: Record<DayRole, string> = {
  in: "border-l-[#1b3b6f]",
  out: "border-l-[#9ca3af]",
  day: "border-l-[#1d5b2c]",
  stay: "border-l-[#9fb3d6]",
};
export const CH_TONE: Record<Channel, string> = {
  own: "border-[#c9d5ea] bg-[#eef2f8] text-[#1b3b6f]",
  weebur: "border-[#d8ccf2] bg-[#f1ecfb] text-[#5b3fa3]",
};
export const FAINT = "text-[#8b929c]";
export const WEEBUR_INK = "text-[#5b3fa3]";

/* ── 응답 정리 ───────────────────────────────────────── */

const numOr = (v: unknown, d = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};

/**
 * 서버 응답을 화면이 쓰는 모양으로 맞춘다. 새 칸이 빠진 옛 응답이 와도 화면이
 * 깨지지 않게 기본값을 채울 뿐, 금액·단계를 새로 계산하지는 않는다.
 */
export function normalize(raw: Record<string, unknown>): Reservation {
  const x = raw as Partial<Reservation> & Record<string, unknown>;
  const total = numOr(x.totalAmount);
  const fee = numOr(x.fee);
  const net = numOr(x.net, total - fee);
  const weebur = x.channel === "weebur";
  const expected = numOr(x.expected, weebur ? net : total);
  const received = numOr(x.received);
  const legacyStage: Stage =
    x.status === "cancelled"
      ? "cancelled"
      : x.paymentStatus === "completed"
        ? "paid"
        : x.paymentStatus === "partial"
          ? "confirmed"
          : "hold";
  return {
    ...(x as Reservation),
    id: String(x.id ?? ""),
    useDate: String(x.useDate ?? ""),
    endDate: x.endDate ? String(x.endDate) : null,
    company: String(x.company ?? ""),
    customerName: String(x.customerName ?? ""),
    phone: String(x.phone ?? ""),
    email: String(x.email ?? ""),
    contactTitle: String(x.contactTitle ?? ""),
    notes: String(x.notes ?? ""),
    status: x.status === "cancelled" ? "cancelled" : "active",
    adultCount: numOr(x.adultCount),
    childCount: numOr(x.childCount),
    peopleCount: numOr(x.peopleCount),
    totalAmount: total,
    depositAmount: numOr(x.depositAmount),
    balanceAmount: numOr(x.balanceAmount),
    channel: weebur ? "weebur" : "own",
    via: (x.via as Reservation["via"]) ?? "legacy",
    paymentPlan: (x.paymentPlan as PaymentPlan) ?? (weebur ? "weebur" : "split"),
    depositRatio: numOr(x.depositRatio, 0.3),
    unitAdult: numOr(x.unitAdult),
    unitChild: numOr(x.unitChild),
    extraAmount: numOr(x.extraAmount),
    feeRate: numOr(x.feeRate, weebur ? 0.1 : 0),
    fee,
    net,
    expected,
    received,
    remaining: numOr(x.remaining, Math.max(expected - received, 0)),
    stage: (x.stage as Stage) ?? legacyStage,
    weeburRef: x.weeburRef ? String(x.weeburRef) : null,
    isAdditional: Boolean(x.isAdditional),
    holdExpiresAt: x.holdExpiresAt ? String(x.holdExpiresAt) : null,
    holdExpired: Boolean(x.holdExpired),
    confirmedAt: x.confirmedAt ? String(x.confirmedAt) : null,
    rejectedAt: x.rejectedAt ? String(x.rejectedAt) : null,
    needsReview: Boolean(x.needsReview),
    payments: Array.isArray(x.payments) ? (x.payments as Payment[]) : [],
    events: Array.isArray(x.events)
      ? (x.events as ReservationEvent[])
      : undefined,
  };
}
