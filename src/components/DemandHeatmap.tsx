"use client";

import { useMemo, useState } from "react";

export interface DemandRow {
  use_date: string;
  quote_count: number;
  quick_count: number;
  total_count: number;
  people_sum: number;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const VISIBLE_MONTHS = 4;

function tone(count: number) {
  if (!count) return "bg-gray-50 text-gray-300";
  if (count === 1) return "bg-[#dce5f1] text-[#0e2140]";
  if (count === 2) return "bg-[#b9cbe4] text-[#0e2140]";
  if (count === 3) return "bg-[#4a75ad] text-white";
  return "bg-[var(--gov-brand)] text-white";
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function shiftMonth(base: Date, delta: number) {
  return new Date(base.getFullYear(), base.getMonth() + delta, 1);
}

export function DemandHeatmap({
  rows,
  selectedDate,
  onSelectDate,
  loading,
}: {
  rows: DemandRow[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
  loading?: boolean;
}) {
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDate = useMemo(() => {
    const map = new Map<string, DemandRow>();
    for (const row of rows) map.set(row.use_date, row);
    return map;
  }, [rows]);

  const top = useMemo(
    () =>
      [...rows]
        .filter((row) => row.total_count > 1)
        .sort(
          (a, b) =>
            b.total_count - a.total_count ||
            a.use_date.localeCompare(b.use_date),
        )
        .slice(0, 5),
    [rows],
  );

  const months = Array.from({ length: VISIBLE_MONTHS }, (_, index) =>
    shiftMonth(anchor, index),
  );

  return (
    <section className="rounded-sm border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-gray-900">
            이용희망일 수요 히트맵
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            문의가 원한 이용 날짜입니다. 진할수록 그 날에 몰렸습니다. 칸을
            누르면 그 날짜 문의만 아래에 걸러집니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1 text-xs text-gray-500 sm:flex">
            <span>적음</span>
            <span className="h-3.5 w-3.5 rounded bg-gray-50 ring-1 ring-gray-200" />
            <span className="h-3.5 w-3.5 rounded bg-[#dce5f1]" />
            <span className="h-3.5 w-3.5 rounded bg-[#b9cbe4]" />
            <span className="h-3.5 w-3.5 rounded bg-[#4a75ad]" />
            <span className="h-3.5 w-3.5 rounded bg-[var(--gov-brand)]" />
            <span>많음</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setAnchor((prev) => shiftMonth(prev, -1))}
              className="rounded-sm border border-gray-300 px-2.5 py-1 text-sm hover:bg-gray-50"
              aria-label="이전 달"
            >
              ‹
            </button>
            <button
              onClick={() => setAnchor((prev) => shiftMonth(prev, 1))}
              className="rounded-sm border border-gray-300 px-2.5 py-1 text-sm hover:bg-gray-50"
              aria-label="다음 달"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-500">
          수요를 불러오는 중입니다.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {months.map((month) => {
            const year = month.getFullYear();
            const key = monthKey(year, month.getMonth());
            const daysInMonth = new Date(
              year,
              month.getMonth() + 1,
              0,
            ).getDate();
            const lead = month.getDay();
            const monthTotal = rows
              .filter((row) => row.use_date.startsWith(key))
              .reduce((sum, row) => sum + row.total_count, 0);

            return (
              <div
                key={key}
                className="rounded-sm border border-gray-200 p-2.5"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-sm font-bold text-gray-900">
                    {year}년 {month.getMonth() + 1}월
                  </h3>
                  <span className="text-xs text-gray-500">{monthTotal}건</span>
                </div>
                <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold">
                  {WEEKDAYS.map((label, index) => (
                    <span
                      key={label}
                      className={
                        index === 0
                          ? "text-red-500"
                          : index === 6
                            ? "text-blue-500"
                            : "text-gray-400"
                      }
                    >
                      {label}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: lead }, (_, i) => (
                    <div key={`lead-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const date = `${key}-${String(day).padStart(2, "0")}`;
                    const row = byDate.get(date);
                    const count = row?.total_count ?? 0;
                    const active = selectedDate === date;
                    return (
                      <button
                        key={date}
                        onClick={() => onSelectDate(active ? null : date)}
                        title={
                          count
                            ? `${date} · ${count}건 · 인원 합계 ${row?.people_sum ?? 0}명`
                            : date
                        }
                        className={`flex aspect-square flex-col items-center justify-center rounded text-[11px] leading-none transition ${tone(count)} ${
                          active
                            ? "ring-2 ring-[var(--gov-brand)]"
                            : "hover:ring-2 hover:ring-[#4a75ad]"
                        }`}
                      >
                        <span className="font-semibold">{day}</span>
                        {count ? (
                          <span className="mt-0.5 text-[10px] font-bold">
                            {count}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {top.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
          <span className="text-xs font-bold text-gray-400">수요 상위</span>
          {top.map((row) => {
            const [, month, day] = row.use_date.split("-");
            const weekday =
              WEEKDAYS[new Date(`${row.use_date}T00:00:00Z`).getUTCDay()];
            return (
              <button
                key={row.use_date}
                onClick={() =>
                  onSelectDate(
                    selectedDate === row.use_date ? null : row.use_date,
                  )
                }
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  selectedDate === row.use_date
                    ? "bg-[var(--gov-brand)] text-white"
                    : "bg-[var(--gov-brand-weak)] text-[#132a4f] hover:bg-[#dce5f1]"
                }`}
              >
                {Number(month)}/{Number(day)} ({weekday}) {row.total_count}건 ·{" "}
                {row.people_sum}명
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
