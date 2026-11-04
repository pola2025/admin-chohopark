"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "./api";
import { INPUT } from "./bits";
import { FAINT, label, type Block } from "./model";

function Modal({
  title,
  onClose,
  children,
  testId,
}: {
  title: string;
  onClose: () => void;
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
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/30 px-4 pt-[12vh]">
      <div className="fixed inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-label={title}
        data-testid={testId}
        className="relative w-full max-w-[440px] rounded border border-[var(--gov-line)] bg-white shadow-2xl"
      >
        <div className="flex items-center border-b border-[var(--gov-line)] px-5 py-3.5">
          <h2 className="text-[16px] font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="ml-auto text-[22px] leading-none text-[var(--gov-ink-sub)]"
          >
            ×
          </button>
        </div>
        <div className="space-y-4 px-5 py-4 text-[14px]">{children}</div>
      </div>
    </div>
  );
}

export const WEEBUR_URL = "https://weebur.chorigol.net";

/**
 * 위버 담당자 접속 안내. 인증은 Cloudflare Access(허용 이메일 + 일회용 코드)가 맡으므로
 * 이 화면은 주소와 설명만 보여 준다. 서버를 부르지 않는다.
 */
export function WeeburAccessDialog({ onClose }: { onClose: () => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(WEEBUR_URL);
      toast.success("주소를 복사했습니다");
    } catch {
      toast.error("복사하지 못했습니다. 주소를 길게 눌러 복사해 주세요.");
    }
  };
  return (
    <Modal title="위버 담당자 접속 안내" onClose={onClose} testId="weebur-dialog">
      <div className="flex gap-2">
        <input
          readOnly
          data-testid="weebur-url"
          className={INPUT}
          value={WEEBUR_URL}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="h-10 shrink-0 rounded bg-[var(--gov-brand)] px-4 text-[13px] font-semibold text-white"
        >
          복사
        </button>
      </div>
      <p className="text-[13.5px] leading-6 text-[var(--gov-ink-sub)]">
        위버 담당자는 허용된 이메일로 받은 일회용 코드로 로그인합니다. 허용
        이메일은 Cloudflare Access 에서 관리합니다.
      </p>
      <p className={`text-[12.5px] leading-5 ${FAINT}`}>
        담당자가 접수한 예약은 이 화면에 위버예약 · 위버 결제 대기로 들어오고,
        월~목 날짜만 고를 수 있습니다.
      </p>
    </Modal>
  );
}

/** 휴무·내부 행사 날짜 막기. 막은 날은 위버 담당자가 고를 수 없고, 관리자 등록은 확인을 거친다. */
export function BlockDialog({
  initialDate,
  blocks,
  onClose,
  onChanged,
}: {
  initialDate: string;
  blocks: Block[];
  onClose: () => void;
  onChanged: (date: string) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // 상태 반영 전 두 번 눌러도 한 번만 보낸다.
  const lock = useRef(false);

  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const add = () =>
    run(async () => {
      if (!date || !reason.trim()) {
        toast.error("날짜와 사유를 넣어 주세요");
        return;
      }
      try {
        const res = await apiFetch("/api/reservation-blocks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, reason: reason.trim() }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(body?.error ?? body?.message ?? "막지 못했습니다");
          return;
        }
        toast.success(`${label(date)} 날짜를 막았습니다`);
        setReason("");
        onChanged(date);
      } catch {
        toast.error("막지 못했습니다");
      }
    });

  const remove = (d: string) => {
    if (!confirm(`${label(d)} 막기를 풀까요?`)) return;
    void run(async () => {
      try {
        const res = await apiFetch(
          `/api/reservation-blocks?date=${encodeURIComponent(d)}`,
          { method: "DELETE" },
        );
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          toast.error(body?.error ?? body?.message ?? "풀지 못했습니다");
          return;
        }
        toast.success(`${label(d)} 막기를 풀었습니다`);
        onChanged(d);
      } catch {
        toast.error("풀지 못했습니다");
      }
    });
  };

  return (
    <Modal title="날짜 막기" onClose={onClose} testId="block-dialog">
      <p className="text-[13.5px] leading-6 text-[var(--gov-ink-sub)]">
        휴무나 내부 행사가 있는 날을 막습니다. 위버 담당자 화면에서는 고를 수
        없고, 이 화면에서 예약을 넣으면 한 번 더 확인합니다.
      </p>
      <div className="grid grid-cols-[150px_1fr] gap-2">
        <input
          type="date"
          className={INPUT}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          className={INPUT}
          value={reason}
          maxLength={60}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유 (예: 정기 휴무, 내부 행사)"
        />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void add()}
        className="h-10 w-full rounded bg-[var(--gov-brand)] text-[13.5px] font-semibold text-white disabled:opacity-50"
      >
        이 날짜 막기
      </button>
      <div>
        <p className="mb-1 text-[12.5px] font-semibold text-[var(--gov-ink-sub)]">
          보이는 달의 막은 날짜
        </p>
        {blocks.length ? (
          blocks.map((b) => (
            <div
              key={b.date}
              className="flex items-baseline gap-2 border-b border-[var(--gov-line)] py-1.5 text-[13.5px]"
            >
              <span className="w-32 shrink-0">{label(b.date)}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--gov-ink-sub)]">
                {b.reason}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => remove(b.date)}
                className="shrink-0 text-[12.5px] text-[var(--gov-danger)] underline disabled:opacity-50"
              >
                풀기
              </button>
            </div>
          ))
        ) : (
          <p className={`py-1.5 text-[13px] ${FAINT}`}>막은 날짜가 없습니다.</p>
        )}
      </div>
    </Modal>
  );
}
