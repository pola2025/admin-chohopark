"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type PackageType = "daytrip" | "overnight";
type CallbackTime = "" | "09:00-12:00" | "12:00-15:00" | "15:00-18:00";

type FormValues = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerCompany: string;
  packageType: PackageType;
  useDate: string;
  people: string;
  children: string;
  pricePerPerson: string;
  childPricePerPerson: string;
  seminarHours: string;
  seminarPricePerHour: string;
  customerMemo: string;
  callbackTime: CallbackTime;
};

type SourceInquiry = {
  customer_name?: unknown;
  customerName?: unknown;
  phone?: unknown;
  customer_phone?: unknown;
  customerPhone?: unknown;
  email?: unknown;
  customer_email?: unknown;
  customerEmail?: unknown;
  company?: unknown;
  customer_company?: unknown;
  customerCompany?: unknown;
  memo?: unknown;
  customer_memo?: unknown;
  customerMemo?: unknown;
  product_name?: unknown;
  productName?: unknown;
  product_type?: unknown;
  productType?: unknown;
  packageType?: unknown;
  use_date?: unknown;
  useDate?: unknown;
  people_count?: unknown;
  peopleCount?: unknown;
  people?: unknown;
  callback_time?: unknown;
  callbackTime?: unknown;
};

type SourceResponse = {
  inquiry?: SourceInquiry;
  message?: string;
  error?: string;
};

type PreparedQuote = {
  requestId: string;
  inquiryId?: number | null;
  desiredDate?: string;
  useDate?: string;
  people?: number;
  children?: number;
  totalAmount?: number;
  depositAmount?: number;
  balanceAmount?: number;
  pdfBase64: string;
  pdfFileName: string;
  quoteNumber?: string;
  totals?: {
    total?: number;
    deposit?: number;
    balance?: number;
  };
  [key: string]: unknown;
};

type PreviewResponse = {
  ok?: boolean;
  quote?: PreparedQuote;
  message?: string;
  error?: string;
};

type DispatchStatus = {
  ok?: boolean;
  sendState?: string;
  status?: string;
  emailSent?: boolean;
  smsSent?: boolean;
  telegramSent?: boolean;
  message?: string;
  error?: string;
};

class QuoteApiError<TBody extends { message?: string; error?: string } = { message?: string; error?: string }> extends Error {
  readonly status: number;
  readonly body: TBody;

  constructor(status: number, body: TBody) {
    super(body.message || body.error || "요청을 처리하지 못했습니다.");
    this.name = "QuoteApiError";
    this.status = status;
    this.body = body;
  }
}

type PendingDispatch = {
  requestId: string;
  sourceKey: string;
};

type StoredPendingDispatch = PendingDispatch & {
  createdAt: number;
};

const money = new Intl.NumberFormat("ko-KR");
const pendingStorageKey = "choho.manualQuote.pendingDispatch";

const blankForm: FormValues = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  customerCompany: "",
  packageType: "daytrip",
  useDate: "",
  people: "",
  children: "0",
  pricePerPerson: "66000",
  childPricePerPerson: "44000",
  seminarHours: "0",
  seminarPricePerHour: "110000",
  customerMemo: "",
  callbackTime: "",
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return "";
}

function normalizeSourceDate(value: unknown): string {
  const raw = text(value).replace(/\s+/g, " ");
  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dotted = raw.match(/(\d{4})\s*[./년-]\s*(\d{1,2})\s*[./월-]\s*(\d{1,2})/);
  if (!dotted) return "";
  return `${dotted[1]}-${dotted[2].padStart(2, "0")}-${dotted[3].padStart(2, "0")}`;
}

function inferPackageType(source: SourceInquiry): PackageType {
  const product = [
    source.product_name,
    source.productName,
    source.product_type,
    source.productType,
    source.packageType,
  ]
    .map(text)
    .join(" ");
  if (/overnight|숙박|1박|워크샵|workshop/i.test(product)) return "overnight";
  return "daytrip";
}

function defaultAdultPrice(packageType: PackageType): string {
  return packageType === "overnight" ? "99000" : "66000";
}

function defaultChildPrice(packageType: PackageType): string {
  return packageType === "overnight" ? "66000" : "44000";
}

function minPeople(packageType: PackageType): number {
  return packageType === "overnight" ? 10 : 30;
}

function parseAmount(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function base64ToPdfUrl(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 20000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const body = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };
    if (!response.ok) {
      throw new QuoteApiError(response.status, body);
    }
    return body;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다. 처리 상태를 확인하기 전까지 다시 발송하지 마세요.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function readError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isNotStartedSendError(error: unknown): error is QuoteApiError<DispatchStatus> {
  return error instanceof QuoteApiError && error.body.sendState === "not_started";
}

function applySourceInquiry(current: FormValues, source: SourceInquiry): FormValues {
  const packageType = inferPackageType(source);
  const callbackTime = text(source.callback_time ?? source.callbackTime) as CallbackTime;
  const people = numberText(source.people_count ?? source.peopleCount ?? source.people);

  return {
    ...current,
    customerName: text(source.customer_name ?? source.customerName) || current.customerName,
    customerPhone: text(source.customer_phone ?? source.customerPhone ?? source.phone) || current.customerPhone,
    customerEmail: text(source.customer_email ?? source.customerEmail ?? source.email) || current.customerEmail,
    customerCompany: text(source.customer_company ?? source.customerCompany ?? source.company) || current.customerCompany,
    customerMemo: text(source.customer_memo ?? source.customerMemo ?? source.memo) || current.customerMemo,
    callbackTime: callbackTime || current.callbackTime,
    useDate: normalizeSourceDate(source.use_date ?? source.useDate) || current.useDate,
    people: people || current.people,
    packageType,
    pricePerPerson: defaultAdultPrice(packageType),
    childPricePerPerson: defaultChildPrice(packageType),
  };
}

function formatAmount(value: unknown): string {
  return `${money.format(Number(value || 0))}원`;
}

function statusLine(status: DispatchStatus): string {
  const state = status.sendState || status.status || "확인 필요";
  return [
    `상태: ${state}`,
    `이메일 ${status.emailSent ? "성공" : "미확인"}`,
    `문자 ${status.smsSent ? "성공" : "미확인"}`,
    `텔레그램 ${status.telegramSent ? "성공" : "미확인"}`,
  ].join(" · ");
}

function pendingStorageKeyFor(sourceKey: string): string {
  return `${pendingStorageKey}.${sourceKey.replace(/[^A-Za-z0-9:_-]/g, "_")}`;
}

function readStoredPendingDispatch(sourceKey: string): PendingDispatch | null {
  try {
    const raw = window.sessionStorage.getItem(pendingStorageKeyFor(sourceKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPendingDispatch>;
    if (parsed.sourceKey !== sourceKey || typeof parsed.requestId !== "string") return null;
    if (!/^[0-9a-f-]{20,80}$/i.test(parsed.requestId)) return null;
    return { requestId: parsed.requestId, sourceKey };
  } catch {
    return null;
  }
}

function storePendingDispatch(pending: PendingDispatch) {
  const stored: StoredPendingDispatch = { ...pending, createdAt: Date.now() };
  window.sessionStorage.setItem(pendingStorageKeyFor(pending.sourceKey), JSON.stringify(stored));
}

function clearStoredPendingDispatch(sourceKey: string) {
  const pending = readStoredPendingDispatch(sourceKey);
  if (pending) window.sessionStorage.removeItem(pendingStorageKeyFor(sourceKey));
}

function QuoteCompose() {
  const searchParams = useSearchParams();
  const kind = searchParams.get("kind") === "quote" ? "quote" : "quick";
  const sourceId = searchParams.get("inquiryId") || searchParams.get("id") || "";
  const sourceKey = `${kind}:${sourceId || "new"}`;

  const [values, setValues] = useState<FormValues>(blankForm);
  const [requestId, setRequestId] = useState("");
  const [preparedQuote, setPreparedQuote] = useState<PreparedQuote | null>(null);
  const [pendingDispatch, setPendingDispatch] = useState<PendingDispatch | null>(null);
  const [lastStatus, setLastStatus] = useState<DispatchStatus | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldError, setFieldError] = useState("");
  const lastPdfUrl = useRef<string | null>(null);

  const totalPeople = parseAmount(values.people);
  const childCount = parseAmount(values.children);
  const adultCount = Math.max(0, totalPeople - childCount);
  const minimumPeople = minPeople(values.packageType);
  const estimatedTotal =
    adultCount * parseAmount(values.pricePerPerson) +
    childCount * parseAmount(values.childPricePerPerson) +
    parseAmount(values.seminarHours) * parseAmount(values.seminarPricePerHour);
  const preparedTotal = Number(preparedQuote?.totalAmount ?? preparedQuote?.totals?.total ?? estimatedTotal);
  const preparedDeposit = Number(preparedQuote?.depositAmount ?? preparedQuote?.totals?.deposit ?? Math.round(preparedTotal * 0.3));
  const preparedBalance = Number(preparedQuote?.balanceAmount ?? preparedQuote?.totals?.balance ?? preparedTotal - preparedDeposit);
  const useYear = values.useDate ? Number(values.useDate.slice(0, 4)) : 0;
  const childLabel = useYear
    ? `어린이: ${useYear - 5}년생부터 초등학교 6학년까지 (${useYear}년 이용 기준)`
    : "어린이 인원(선택)";
  const canStartNewQuote = Boolean(lastStatus?.emailSent);

  const payload = useMemo(
    () => ({
      requestId,
      inquiryId: sourceId && kind === "quick" ? Number(sourceId) : null,
      quoteId: sourceId && kind === "quote" ? Number(sourceId) : null,
      customerName: values.customerName,
      customerPhone: values.customerPhone,
      customerEmail: values.customerEmail,
      customerCompany: values.customerCompany,
      packageType: values.packageType,
      useDate: values.useDate,
      desiredDate: values.useDate,
      people: totalPeople,
      children: childCount,
      adultCount,
      pricePerPerson: parseAmount(values.pricePerPerson),
      childPricePerPerson: parseAmount(values.childPricePerPerson),
      seminarHours: parseAmount(values.seminarHours),
      seminarPricePerHour: parseAmount(values.seminarPricePerHour),
      customerMemo: values.customerMemo,
      callbackTime: values.callbackTime,
    }),
    [adultCount, childCount, kind, requestId, sourceId, totalPeople, values],
  );

  useEffect(() => {
    const restoredPending = readStoredPendingDispatch(sourceKey);
    setValues(blankForm);
    setPreparedQuote(null);
    setPdfUrl(null);
    setFieldError("");
    setLastStatus(null);
    setPendingDispatch(restoredPending);
    setRequestId(restoredPending?.requestId || crypto.randomUUID());
    setMessage(restoredPending ? "이 견적서는 발송 결과가 불명확합니다. 상태 조회로만 확인하세요." : "");
  }, [sourceKey]);

  useEffect(() => {
    if (!requestId) setRequestId(crypto.randomUUID());
  }, [requestId]);

  useEffect(() => {
    let active = true;
    if (!sourceId) return undefined;

    fetchJson<SourceResponse>(
      `/api/quotes/source?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(sourceId)}`,
      { cache: "no-store" },
      15000,
    )
      .then((body) => {
        if (!active || !body.inquiry) return;
        setValues((current) => applySourceInquiry(current, body.inquiry as SourceInquiry));
      })
      .catch((error) => {
        if (active) setMessage(readError(error, "문의 원본을 불러오지 못했습니다."));
      });

    return () => {
      active = false;
    };
  }, [kind, sourceId]);

  useEffect(() => {
    if (lastPdfUrl.current) {
      URL.revokeObjectURL(lastPdfUrl.current);
      lastPdfUrl.current = null;
    }
    if (!preparedQuote?.pdfBase64) {
      setPdfUrl(null);
      return undefined;
    }

    const url = base64ToPdfUrl(preparedQuote.pdfBase64);
    lastPdfUrl.current = url;
    setPdfUrl(url);

    return () => {
      URL.revokeObjectURL(url);
      if (lastPdfUrl.current === url) lastPdfUrl.current = null;
    };
  }, [preparedQuote]);

  function clearPreparedForEdit() {
    if (pendingDispatch) return;
    setPreparedQuote(null);
    setMessage("");
    setFieldError("");
    setLastStatus(null);
    setRequestId(crypto.randomUUID());
  }

  function editField(name: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    clearPreparedForEdit();
  }

  function changePackageType(value: PackageType) {
    setValues((current) => ({
      ...current,
      packageType: value,
      pricePerPerson: defaultAdultPrice(value),
      childPricePerPerson: defaultChildPrice(value),
    }));
    clearPreparedForEdit();
  }

  function validate(): boolean {
    if (totalPeople < minimumPeople) {
      setFieldError(`${values.packageType === "overnight" ? "숙박 워크샵" : "당일 야유회"} 최소 인원은 ${minimumPeople}명입니다.`);
      return false;
    }
    if (childCount < 0 || childCount > totalPeople) {
      setFieldError("어린이 인원은 0명 이상이며 총 인원을 넘을 수 없습니다.");
      return false;
    }
    setFieldError("");
    return true;
  }

  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    setBusy(true);
    setMessage("");
    try {
      const body = await fetchJson<PreviewResponse>(
        "/api/quotes/preview",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        },
        60000,
      );
      if (!body.ok || !body.quote?.pdfBase64) {
        throw new Error(body.message || body.error || "미리보기 응답에 PDF가 없습니다.");
      }
      setPreparedQuote(body.quote);
      setMessage("PDF와 금액을 확인한 뒤 발송하세요.");
    } catch (error) {
      setPreparedQuote(null);
      setMessage(readError(error, "미리보기를 만들지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }

  async function sendQuote() {
    if (!preparedQuote || pendingDispatch) return;
    const contact = values.customerEmail || values.customerPhone || "연락처 없음";
    const confirmed = window.confirm(
      `${values.customerName || "고객명 없음"} / ${contact}\n총액 ${formatAmount(preparedTotal)}\n\n이 견적서를 발송합니다.`,
    );
    if (!confirmed) return;

    const locked: PendingDispatch = { requestId: preparedQuote.requestId || requestId, sourceKey };
    storePendingDispatch(locked);
    setPendingDispatch(locked);
    setBusy(true);
    setLastStatus(null);
    setMessage("발송 요청을 접수했습니다. 결과가 불명확하면 상태 조회만 사용하세요.");

    try {
      const body = await fetchJson<DispatchStatus>(
        "/api/quotes/send",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(preparedQuote),
          cache: "no-store",
        },
        60000,
      );
      setLastStatus(body);
      setMessage(statusLine(body));
    } catch (error) {
      if (isNotStartedSendError(error)) {
        clearStoredPendingDispatch(sourceKey);
        setPendingDispatch(null);
        setLastStatus(error.body);
        setMessage(error.body.message || "발송 요청을 저장하지 못했습니다. 고객에게 발송되지 않았습니다.");
        return;
      }
      setMessage(`${readError(error, "발송 결과를 확인하지 못했습니다.")} 상태 확인 전까지 다시 발송하지 마세요.`);
    } finally {
      setBusy(false);
    }
  }

  async function checkStatus() {
    const id = pendingDispatch?.requestId || preparedQuote?.requestId || requestId;
    setBusy(true);
    try {
      const body = await fetchJson<DispatchStatus>(`/api/quotes/status/${encodeURIComponent(id)}`, { cache: "no-store" }, 20000);
      setLastStatus(body);
      setMessage(statusLine(body));
    } catch (error) {
      setMessage(readError(error, "상태를 조회하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  }

  function startNewQuote() {
    if (!canStartNewQuote) return;
    clearStoredPendingDispatch(sourceKey);
    setValues(blankForm);
    setPreparedQuote(null);
    setPendingDispatch(null);
    setLastStatus(null);
    setFieldError("");
    setMessage("");
    setRequestId(crypto.randomUUID());
  }

  const formLocked = Boolean(pendingDispatch);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-950">견적서 작성</h1>
        <p className="mt-1 text-sm text-gray-600">원본 문의를 바탕으로 금액을 확인하고 PDF 견적서를 발송합니다.</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(430px,0.9fr)_minmax(520px,1.1fr)]">
        <form onSubmit={preview} className="space-y-5 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <fieldset disabled={busy || formLocked} className="space-y-4 disabled:opacity-70">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-800">
                고객명
                <input
                  required
                  value={values.customerName}
                  onChange={(event) => editField("customerName", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                연락처
                <input
                  required
                  value={values.customerPhone}
                  onChange={(event) => editField("customerPhone", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                이메일
                <input
                  required
                  type="email"
                  value={values.customerEmail}
                  onChange={(event) => editField("customerEmail", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                회사명
                <input
                  value={values.customerCompany}
                  onChange={(event) => editField("customerCompany", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-800">
                이용일
                <input
                  required
                  type="date"
                  value={values.useDate}
                  onChange={(event) => editField("useDate", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                상품
                <select
                  value={values.packageType}
                  onChange={(event) => changePackageType(event.target.value as PackageType)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="daytrip">당일 야유회</option>
                  <option value="overnight">숙박 워크샵</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-800">
                총 인원
                <input
                  required
                  type="number"
                  min={minimumPeople}
                  value={values.people}
                  onChange={(event) => editField("people", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                {childLabel}
                <input
                  type="number"
                  min={0}
                  max={Math.max(totalPeople, 0)}
                  value={values.children}
                  onChange={(event) => editField("children", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                성인 1인 단가
                <input
                  required
                  type="number"
                  min={0}
                  value={values.pricePerPerson}
                  onChange={(event) => editField("pricePerPerson", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                어린이 1인 단가(선택)
                <input
                  type="number"
                  min={0}
                  value={values.childPricePerPerson}
                  onChange={(event) => editField("childPricePerPerson", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                세미나 시간
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={values.seminarHours}
                  onChange={(event) => editField("seminarHours", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-medium text-gray-800">
                세미나 시간당 금액
                <input
                  type="number"
                  min={0}
                  value={values.seminarPricePerHour}
                  onChange={(event) => editField("seminarPricePerHour", event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <label className="block text-sm font-medium text-gray-800">
              회신 희망 시간
              <select
                value={values.callbackTime}
                onChange={(event) => editField("callbackTime", event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">선택 안 함</option>
                <option value="09:00-12:00">09:00-12:00</option>
                <option value="12:00-15:00">12:00-15:00</option>
                <option value="15:00-18:00">15:00-18:00</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-gray-800">
              메모
              <textarea
                rows={4}
                value={values.customerMemo}
                onChange={(event) => editField("customerMemo", event.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </fieldset>

          {fieldError ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {fieldError}
            </p>
          ) : null}

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
            <div className="grid gap-2 sm:grid-cols-2">
              <p>총 인원 {money.format(totalPeople)}명</p>
              <p>성인 {money.format(adultCount)}명 · 어린이 {money.format(childCount)}명</p>
              <p>총액 {formatAmount(preparedTotal)}</p>
              <p>예약금 30% {formatAmount(preparedDeposit)}</p>
              <p>잔금 {formatAmount(preparedBalance)}</p>
              <p>요청 ID {pendingDispatch?.requestId || requestId || "생성 중"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || formLocked || !requestId}
              className="rounded-md bg-[var(--gov-brand)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              PDF 미리보기
            </button>
            <button
              type="button"
              onClick={sendQuote}
              disabled={!preparedQuote || busy || formLocked}
              className="rounded-md bg-[#132a4f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              확인 후 발송
            </button>
            {pendingDispatch ? (
              <button
                type="button"
                onClick={checkStatus}
                disabled={busy}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                상태 조회
              </button>
            ) : null}
            {canStartNewQuote ? (
              <button
                type="button"
                onClick={startNewQuote}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800"
              >
                새 견적 작성
              </button>
            ) : null}
          </div>

          {message ? (
            <p role="status" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
              {message}
            </p>
          ) : null}
        </form>

        <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-950">PDF 미리보기</h2>
              <p className="mt-1 text-sm text-gray-600">
                {preparedQuote?.quoteNumber ? `견적번호 ${preparedQuote.quoteNumber}` : "미리보기를 생성하면 실제 PDF가 표시됩니다."}
              </p>
            </div>
            {preparedQuote?.pdfFileName ? <p className="text-sm text-gray-500">{preparedQuote.pdfFileName}</p> : null}
          </div>

          {preparedQuote ? (
            <div className="grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 sm:grid-cols-3">
              <p>총액 {formatAmount(preparedTotal)}</p>
              <p>예약금 30% {formatAmount(preparedDeposit)}</p>
              <p>잔금 {formatAmount(preparedBalance)}</p>
              <p>성인 {money.format(adultCount)}명</p>
              <p>어린이 {money.format(childCount)}명</p>
              <p>전체 {money.format(totalPeople)}명</p>
            </div>
          ) : null}

          {pdfUrl ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                >
                  실제 PDF 열기
                </a>
                <a
                  href={pdfUrl}
                  download={preparedQuote?.pdfFileName || "quote.pdf"}
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                >
                  다운로드
                </a>
              </div>
              <iframe title="견적서 PDF 미리보기" src={pdfUrl} className="h-[680px] w-full rounded-md border border-gray-300" />
            </div>
          ) : (
            <div className="flex h-[420px] items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-6 text-center text-sm text-gray-500">
              금액과 인원을 입력한 뒤 PDF 미리보기를 생성하세요.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function QuoteComposePage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">불러오는 중입니다.</p>}>
      <QuoteCompose />
    </Suspense>
  );
}
