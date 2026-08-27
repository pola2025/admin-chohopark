"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  confirmDeposit,
  getContract,
  statusClass,
  statusLabel,
  updateContractStatus,
  type ContractDetail,
} from "@/lib/contract-remote-api";

function money(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function dateTime(value: string) {
  if (!value) return "대기";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ko-KR");
}

export default function ContractDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      setContract(await getContract(id));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "약정서를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function deposit() {
    setBusy(true);
    setMessage("");
    setNotice("");
    try {
      const result = await confirmDeposit(id);
      if (result.status === "confirmed") {
        setNotice(
          result.confirmationEmailSent
            ? `예약이 확정되었습니다. 확정본을 ${result.confirmationEmailTo} 으로 보냈습니다.`
            : "예약이 확정되었습니다. 다만 확정본 메일은 발송되지 않았습니다. 담당자 이메일을 확인해 주세요.",
        );
      } else {
        setNotice(
          "예약금은 확인했지만 고객 동의(서명)가 아직입니다. 고객이 서명하면 확정되고 확정본이 발송됩니다.",
        );
      }
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "예약금 확인을 처리하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm("이 약정서를 취소 상태로 변경하시겠습니까?")) return;
    setBusy(true);
    setMessage("");
    try {
      await updateContractStatus(id, "cancelled");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "상태를 변경하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading && !contract) {
    return (
      <div className="flex min-h-80 items-center justify-center text-sm text-gray-500">
        약정서를 불러오는 중입니다.
      </div>
    );
  }
  if (!contract) {
    return (
      <div className="mx-auto max-w-3xl rounded-sm border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-red-700">
          {message || "약정서를 찾을 수 없습니다."}
        </p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm font-semibold text-red-800 underline"
        >
          이전 화면
        </button>
      </div>
    );
  }

  const originalUrl = `/api/contract-proxy/${encodeURIComponent(id)}/original`;
  const canDeposit =
    !contract.depositReceivedAt &&
    !["cancelled", "superseded"].includes(contract.status);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href="/dashboard/contracts"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> 목록
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-950">
              {contract.contractNumber}
            </h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass[contract.status]}`}
            >
              {statusLabel[contract.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {contract.company || "개인 고객"} · {contract.productName}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-sm border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          새로고침
        </button>
      </header>

      {message ? (
        <p
          role="alert"
          className="rounded-sm border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {message}
        </p>
      ) : null}

      {notice ? (
        <p className="rounded-sm border border-[#b9cbe4] bg-[var(--gov-brand-weak)] p-4 text-sm text-[#132a4f]">
          {notice}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-sm border border-gray-200 bg-white shadow-none">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--gov-brand)]" />
              <h2 className="font-semibold text-gray-900">발행 원본 (A4)</h2>
            </div>
            {!contract.originalHtml ? (
              <a
                href={originalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--gov-brand)]"
              >
                새 창에서 열기 <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
          <div className="min-h-[780px] bg-gray-100 p-3 sm:p-5">
            <iframe
              title={`${contract.contractNumber} 발행 원본`}
              className="mx-auto h-[1050px] w-full max-w-[794px] border border-gray-300 bg-white shadow-none"
              sandbox="allow-same-origin"
              src={contract.originalHtml ? undefined : originalUrl}
              srcDoc={contract.originalHtml || undefined}
            />
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-sm border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-[var(--gov-brand)]" />
              <h2 className="font-semibold text-gray-900">거래처 정보</h2>
            </div>
            <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-sm">
              <dt className="text-gray-500">업체명</dt>
              <dd className="font-medium text-gray-900">
                {contract.company || "미입력"}
              </dd>
              <dt className="text-gray-500">대표자</dt>
              <dd>{contract.representative || "미입력"}</dd>
              <dt className="text-gray-500">담당자</dt>
              <dd>
                {[contract.customerName, contract.contactTitle]
                  .filter(Boolean)
                  .join(" ") || "미입력"}
              </dd>
              <dt className="text-gray-500">연락처</dt>
              <dd>{contract.phone || "미입력"}</dd>
              <dt className="text-gray-500">이메일</dt>
              <dd className="break-all">{contract.email || "미입력"}</dd>
              <dt className="text-gray-500">사업자번호</dt>
              <dd>{contract.businessRegistrationNumber || "미입력"}</dd>
              <dt className="text-gray-500">주소</dt>
              <dd>{contract.address || "미입력"}</dd>
            </dl>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500">첨부 사본</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {contract.businessLicenseUrl ? (
                  <a
                    href={`/api/contract-proxy/${encodeURIComponent(id)}/document/business_license`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm border border-[#b9cbe4] bg-[var(--gov-brand-weak)] px-3 py-1.5 font-medium text-[#132a4f]"
                  >
                    사업자등록증 <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="rounded-sm border border-gray-200 px-3 py-1.5 text-gray-400">
                    사업자등록증 없음
                  </span>
                )}
                {contract.businessCardUrl ? (
                  <a
                    href={`/api/contract-proxy/${encodeURIComponent(id)}/document/business_card`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm border border-[#b9cbe4] bg-[var(--gov-brand-weak)] px-3 py-1.5 font-medium text-[#132a4f]"
                  >
                    담당자 명함 <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <span className="rounded-sm border border-gray-200 px-3 py-1.5 text-gray-400">
                    명함 없음
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-sm border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">견적·이용 정보</h2>
            <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-sm">
              <dt className="text-gray-500">이용상품</dt>
              <dd>{contract.productName}</dd>
              <dt className="text-gray-500">이용일</dt>
              <dd>{contract.useDate || "미정"}</dd>
              <dt className="text-gray-500">이용인원</dt>
              <dd>{contract.people ? `${contract.people}명` : "미정"}</dd>
              <dt className="text-gray-500">세미나룸</dt>
              <dd>{contract.seminarTime || "미입력"}</dd>
              <dt className="text-gray-500">추가객실</dt>
              <dd>{contract.extraRooms || "없음"}</dd>
              <dt className="text-gray-500">개별할인</dt>
              <dd>{money(contract.discountAmount)}</dd>
              <dt className="text-gray-500">총 이용금액</dt>
              <dd className="text-lg font-bold text-[var(--gov-brand)]">
                {money(contract.totalAmount)}
              </dd>
              <dt className="text-gray-500">계약금</dt>
              <dd>{money(contract.depositAmount)}</dd>
              <dt className="text-gray-500">잔금</dt>
              <dd>{money(contract.balanceAmount)} (이용 당일 결제)</dd>
            </dl>
          </section>

          <section className="rounded-sm border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">동의·입금 상태</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex gap-3">
                <CheckCircle2
                  className={`mt-0.5 h-5 w-5 ${contract.signedAt ? "text-[var(--gov-brand)]" : "text-gray-300"}`}
                />
                <p>
                  <strong className="block text-gray-900">
                    고객 동의·서명{" "}
                    {contract.signerName ? `· ${contract.signerName}` : ""}
                  </strong>
                  <span className="text-gray-500">
                    {dateTime(contract.signedAt)}
                  </span>
                </p>
              </div>
              <div className="flex gap-3">
                <CheckCircle2
                  className={`mt-0.5 h-5 w-5 ${contract.depositReceivedAt ? "text-[var(--gov-brand)]" : "text-gray-300"}`}
                />
                <p>
                  <strong className="block text-gray-900">
                    예약금 입금 확인
                  </strong>
                  <span className="text-gray-500">
                    {dateTime(contract.depositReceivedAt)}
                  </span>
                </p>
              </div>
              <div className="flex gap-3">
                <CheckCircle2
                  className={`mt-0.5 h-5 w-5 ${contract.confirmedAt ? "text-[var(--gov-brand)]" : "text-gray-300"}`}
                />
                <p>
                  <strong className="block text-gray-900">
                    최종 예약 확정
                  </strong>
                  <span className="text-gray-500">
                    {dateTime(contract.confirmedAt)}
                  </span>
                </p>
              </div>
              <div className="flex gap-3">
                <CheckCircle2
                  className={`mt-0.5 h-5 w-5 ${contract.confirmationEmailSentAt ? "text-[var(--gov-brand)]" : "text-gray-300"}`}
                />
                <p>
                  <strong className="block text-gray-900">
                    확정본 메일 발송
                  </strong>
                  <span className="text-gray-500">
                    {contract.confirmationEmailSentAt
                      ? dateTime(contract.confirmationEmailSentAt)
                      : contract.email || "담당자 이메일 없음"}
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => void deposit()}
                disabled={!canDeposit || busy}
                className="rounded-sm bg-[var(--gov-brand)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {contract.depositReceivedAt
                  ? "예약금 확인 완료"
                  : busy
                    ? "처리 중..."
                    : "예약금 입금 확인 · 최종 확정"}
              </button>
              {!["cancelled", "superseded"].includes(contract.status) ? (
                <button
                  type="button"
                  onClick={() => void cancel()}
                  disabled={busy}
                  className="rounded-sm border border-red-200 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  약정 취소 처리
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-sm border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-900">처리 이력</h2>
            {contract.events.length ? (
              <ol className="mt-4 space-y-4 border-l border-gray-200 pl-4">
                {contract.events.map((event) => (
                  <li key={event.id} className="text-sm">
                    <strong className="text-gray-900">{event.label}</strong>
                    <p className="text-gray-500">
                      {dateTime(event.occurredAt)}{" "}
                      {event.actor ? `· ${event.actor}` : ""}
                    </p>
                    {event.detail ? (
                      <p className="mt-1 text-gray-600">{event.detail}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                기록된 이벤트가 없습니다.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
