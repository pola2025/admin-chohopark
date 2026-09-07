"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContractMutationError, createContract, getPendingContractMutation } from "@/lib/contract-remote-api";
import { ContractAdvancedFields } from "./advanced-fields";

export default function NewContractPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingInput, setPendingInput] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    const pending = getPendingContractMutation("create");
    const input = pending?.input;
    if (input && typeof input === "object" && !Array.isArray(input)) {
      setPendingInput(input as Record<string, unknown>);
      setMessage("이전 약정서 생성 요청의 결과가 확인되지 않았습니다. 원래 요청을 다시 확인하세요.");
    }
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const extraRooms = [0, 1, 2].map((index) => ({ name: value(`roomName${index}`), count: Number(value(`roomCount${index}`) || 0), unitPrice: Number(value(`roomPrice${index}`) || 0), note: value(`roomNote${index}`) })).filter((room) => room.name && room.count > 0);
    const input = pendingInput ?? {
      productType: value("productType") || "daytrip",
      useDate: value("useDate"), endDate: value("endDate") || undefined,
      company: value("company"), customerName: value("customerName"), phone: value("phone"), email: value("email"),
      businessRegistrationNumber: value("businessRegistrationNumber"), companyRepresentative: value("companyRepresentative"),
      contactTitle: value("contactTitle"), adultCount: Number(value("adultCount") || 0), childCount: Number(value("childCount") || 0),
      seminarStart: value("seminarStart") || undefined, seminarEnd: value("seminarEnd") || undefined, seminarHours: Number(value("seminarHours") || 0) || undefined, extraRooms,
      earlyUse: value("earlyUseStart") ? { startTime: value("earlyUseStart"), hours: Number(value("earlyUseHours") || 0), people: Number(value("earlyUsePeople") || 0) } : undefined,
      adminDiscount: Number(value("discountAmount") || 0) ? { amount: Number(value("discountAmount") || 0), reason: value("discountReason") } : undefined,
      depositAmount: value("depositAmount") ? Number(value("depositAmount")) : undefined, notes: value("notes"), blankIssueConfirmed: value("blankIssueConfirmed") === "on",
    };
    if (!input.useDate || !input.company || !input.customerName || !input.phone || Number(input.adultCount) < 1) { setMessage("이용일, 업체, 담당자, 연락처, 성인 인원을 입력해 주세요."); return; }
    setBusy(true); setMessage("");
    try { const result = await createContract(input); router.push(`/dashboard/contracts/${encodeURIComponent(result.id)}`); }
    catch (error) { if (error instanceof ContractMutationError && error.unknownResult) setPendingInput(input); else setPendingInput(null); setMessage(error instanceof ContractMutationError && error.unknownResult ? `${error.message} 기존 요청 결과를 확인하세요.` : error instanceof Error ? error.message : "약정서를 생성하지 못했습니다."); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-3xl space-y-5"><Link href="/dashboard/contracts" className="text-sm text-gray-500 underline">목록으로</Link><h1 className="text-2xl font-bold">약정서 작성</h1>{message ? <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}<form onSubmit={submit} className="grid gap-4 rounded border bg-white p-5 sm:grid-cols-2"><fieldset disabled={busy || Boolean(pendingInput)} className="contents">{[["company","업체명","text"],["customerName","담당자","text"],["phone","연락처","tel"],["email","이메일","email"],["businessRegistrationNumber","사업자등록번호","text"],["companyRepresentative","대표자","text"],["useDate","이용일","date"],["endDate","종료일","date"],["adultCount","성인 인원","number"],["childCount","어린이 인원","number"],["depositAmount","계약금","number"]].map(([name,label,type])=><label key={name} className="grid gap-1 text-sm font-medium">{label}<input name={name} type={type} min={type === "number" ? "0" : undefined} className="rounded border px-3 py-2" /></label>)}<ContractAdvancedFields /><label className="grid gap-1 text-sm font-medium sm:col-span-2">특이사항<textarea name="notes" rows={4} className="rounded border px-3 py-2" /></label></fieldset><button disabled={busy} className="rounded bg-[#132a4f] px-4 py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2">{busy ? "생성 중..." : pendingInput ? "기존 요청 결과 확인" : "약정서 생성"}</button></form></div>;
}
