"use client";

import Link from "next/link";
import { FileText, RefreshCw, Search } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import {
  getContracts,
  statusClass,
  statusLabel,
  type ContractStatus,
  type ContractSummary,
} from "@/lib/contract-remote-api";

function money(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async (nextQuery = "", nextStatus = "") => {
    setLoading(true);
    setMessage("");
    try {
      setContracts(await getContracts({ query: nextQuery.trim(), status: nextStatus }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void load(query, status);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">CHOHO AGREEMENTS</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">약정서 관리</h1>
          <p className="mt-1 text-sm text-gray-600">텔레그램에서 발행된 약정서 원본과 거래처 진행 상태를 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => void load(query, status)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> 새로고침
        </button>
      </header>

      <form onSubmit={search} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
        <label className="relative">
          <span className="sr-only">약정서 검색</span>
          <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="약정번호, 업체명, 담당자, 연락처 검색"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <select
          aria-label="진행 상태"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600"
        >
          <option value="">전체 상태</option>
          {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button className="rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">검색</button>
      </form>

      {message ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</p> : null}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="hidden grid-cols-[1.1fr_1fr_1.4fr_.8fr_1fr_.8fr] gap-4 border-b border-gray-200 bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-600 lg:grid">
          <span>약정번호·상품</span><span>이용일</span><span>거래처·담당자</span><span>인원</span><span>총 금액</span><span>상태</span>
        </div>
        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-gray-500">약정서를 불러오는 중입니다.</div>
        ) : contracts.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-gray-500">
            <FileText className="h-8 w-8" /><p className="text-sm">조건에 맞는 약정서가 없습니다.</p>
          </div>
        ) : contracts.map((contract) => (
          <Link
            key={contract.id}
            href={`/dashboard/contracts/${encodeURIComponent(contract.id)}`}
            className="grid gap-2 border-b border-gray-100 px-5 py-5 transition-colors last:border-0 hover:bg-emerald-50/50 lg:grid-cols-[1.1fr_1fr_1.4fr_.8fr_1fr_.8fr] lg:items-center lg:gap-4"
          >
            <span><strong className="block text-sm text-emerald-800">{contract.contractNumber}</strong><small className="text-gray-500">{contract.productName}</small></span>
            <span className="text-sm text-gray-700">{contract.useDate || "미정"}</span>
            <span className="text-sm text-gray-800">{contract.company || "개인 고객"}<small className="block text-gray-500">{contract.customerName} {contract.phone}</small></span>
            <span className="text-sm text-gray-700">{contract.people ? `${contract.people}명` : "미정"}</span>
            <strong className="text-sm text-gray-900">{money(contract.totalAmount)}</strong>
            <span><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[contract.status as ContractStatus]}`}>{statusLabel[contract.status]}</span></span>
          </Link>
        ))}
      </section>
    </div>
  );
}
