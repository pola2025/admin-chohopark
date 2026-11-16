"use client";

// 업무 관리 › 폴라애드 작업 기록 — 폴라애드가 한 일을 날짜별 짧은 제목 + 설명 한 줄로 보여 준다.
// 와이어프레임 F:\admin-chohopark\docs\wireframes\261116_work-log-wireframe.html (3차, 사용자 승인 2026-11-16)
import { useEffect, useState } from "react";

type Item = { id: number; date: string; category: string; title: string; note: string; status: "done" | "doing" };

const CATEGORIES: Array<{ key: string; label: string; chip: string }> = [
  { key: "reservation", label: "예약", chip: "bg-blue-100 text-blue-800" },
  { key: "homepage", label: "홈페이지", chip: "bg-violet-100 text-violet-800" },
  { key: "promo", label: "홍보", chip: "bg-pink-100 text-pink-800" },
  { key: "ads", label: "광고", chip: "bg-emerald-100 text-emerald-800" },
  { key: "ops", label: "관리·알림", chip: "bg-slate-200 text-slate-700" },
];
const BY_KEY = new Map(CATEGORIES.map((c) => [c.key, c]));
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function dateLabel(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const w = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${y}년 ${m}월 ${day}일 (${WEEK[w]})`;
}

export default function WorkLogPage() {
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (before: string | null, replace: boolean) => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (category) qs.set("category", category);
      if (before) qs.set("before", before);
      const res = await fetch(`/api/work-log?${qs}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { items?: Item[]; next?: string | null } | null;
      if (!res.ok || !data?.items) throw new Error();
      setItems((prev) => (replace ? data.items! : [...prev, ...data.items!]));
      setNext(data.next ?? null);
    } catch {
      setError("기록을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.");
    } finally {
      setLoading(false);
    }
  };

  // 분류를 바꾸면 처음부터 다시 읽는다
  useEffect(() => {
    void load(null, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const groups: Array<{ date: string; list: Item[] }> = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    if (g && g.date === it.date) g.list.push(it);
    else groups.push({ date: it.date, list: [it] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-black">폴라애드 작업 기록</h1>
        <p className="mt-1 text-sm text-slate-500">홈페이지·예약·홍보·광고에서 폴라애드가 한 일을 날짜별로 모았습니다.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[{ key: "", label: "전체", chip: "" }, ...CATEGORIES].map((c) => (
          <button
            key={c.key || "all"}
            type="button"
            onClick={() => setCategory(c.key)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${category === c.key ? "bg-slate-900 text-white" : "bg-white text-slate-700 ring-1 ring-slate-300"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="text-sm text-slate-500">아직 기록이 없습니다.</p>}

      {groups.map((g) => (
        <section key={g.date}>
          <h2 className="text-[13px] font-black text-slate-500">{dateLabel(g.date)}</h2>
          <ul className="mt-2 divide-y rounded-xl border bg-white">
            {g.list.map((it) => {
              const c = BY_KEY.get(it.category);
              return (
                <li key={it.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-extrabold ${c?.chip ?? "bg-slate-100"}`}>{c?.label ?? it.category}</span>
                    <b className="text-[14.5px]">{it.title}</b>
                    {it.status === "doing" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-extrabold text-amber-800">진행 중</span>}
                  </div>
                  {it.note && <p className="mt-0.5 text-[13px] text-slate-500">{it.note}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {next && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(next, false)}
          className="w-full rounded-lg bg-white py-2 text-sm font-bold text-slate-600 ring-1 ring-slate-300 disabled:opacity-50"
        >
          {loading ? "불러오는 중…" : "지난 기록 더 보기"}
        </button>
      )}
    </div>
  );
}
