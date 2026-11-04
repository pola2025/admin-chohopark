"use client";

import {
  ChannelBadge,
  PayBox,
  PayLine,
  Prog,
  RoleTag,
  stageTone,
} from "./bits";
import {
  BAR_EDGE,
  FAINT,
  ROLE_LABEL,
  WEEBUR_INK,
  WEEKDAYS,
  addDays,
  dayNum,
  endOf,
  holdExpired,
  holdHours,
  isCancelled,
  isHold,
  isWeebur,
  kstDue,
  label,
  md,
  monthTitle,
  num,
  orgOf,
  people,
  productName,
  productShort,
  ratioPct,
  roleOn,
  roleShort,
  stageLabel,
  sumPeople,
  timesOf,
  weekdayOf,
  won,
  type DayIndex,
  type Reservation,
} from "./model";

/* ── 요약 4칸 ─────────────────────────────────────────── */

export function Summary({
  items,
  month,
}: {
  items: Reservation[];
  month: string;
}) {
  const live = items.filter(
    (r) => !isCancelled(r) && r.useDate.slice(0, 7) === month,
  );
  const expected = live.reduce((s, r) => s + (r.expected || 0), 0);
  const received = live.reduce((s, r) => s + (r.received || 0), 0);
  const left = live.reduce((s, r) => s + (r.remaining || 0), 0);
  const rate = expected ? Math.round((received / expected) * 100) : 0;
  const own = live.filter((r) => !isWeebur(r)).length;
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded border border-[var(--gov-line)] bg-white px-4 py-3">
        <p className="text-[13px] text-[var(--gov-ink-sub)]">이번 달 예약</p>
        <p className="mt-1 text-[22px] font-bold">{live.length}건</p>
        <p className="text-[12px] text-[var(--gov-ink-sub)]">
          이용 인원 {num(sumPeople(live))}명 · 자체 {own} · 위버{" "}
          {live.length - own}
        </p>
      </div>
      <div className="order-3 col-span-2 rounded border border-[var(--gov-line)] bg-white px-4 py-3 md:order-none">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] text-[var(--gov-ink-sub)]">
            받을 돈 기준 납부 현황{" "}
            <span className="whitespace-nowrap">(위버는 수수료 뺀 정산액)</span>
          </p>
          <p className="shrink-0 text-[13px] font-bold text-[var(--gov-ok)]">
            {rate}% 납부
          </p>
        </div>
        <p className="mt-1 text-[22px] font-bold">
          {won(received)}{" "}
          <span className="text-[15px] font-normal text-[var(--gov-ink-sub)]">
            / {won(expected)}
          </span>
        </p>
        <Prog pct={rate} className="mt-1.5" />
      </div>
      <div className="rounded border border-[var(--gov-warn)]/30 bg-[var(--gov-warn-weak)] px-4 py-3">
        <p className="text-[13px] text-[var(--gov-warn)]">남은 금액</p>
        <p className="mt-1 text-[22px] font-bold text-[var(--gov-warn)]">
          {won(left)}
        </p>
        <p className="text-[12px] text-[var(--gov-warn)]">
          가계약 {live.filter(isHold).length}건 포함 · 기한 지남{" "}
          {live.filter(holdExpired).length}건
        </p>
      </div>
    </section>
  );
}

/* ── 기한 지난 가계약 경고 줄 ─────────────────────────── */

export function HoldAlert({
  items,
  busy,
  onOpen,
  onExtend,
  onCancel,
}: {
  items: Reservation[];
  busy: boolean;
  onOpen: (r: Reservation) => void;
  onExtend: (r: Reservation) => void;
  onCancel: (r: Reservation) => void;
}) {
  const expired = items.filter(holdExpired);
  if (!expired.length) return null;
  return (
    <section className="rounded border border-[var(--gov-danger)]/40 bg-[var(--gov-danger-weak)] px-4 py-3 text-[13.5px]">
      <p className="font-semibold text-[var(--gov-danger)]">
        ⚠ 24시간 안에 입금이 없는 가계약 {expired.length}건
      </p>
      {expired.map((r) => (
        <div key={r.id} className="mt-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(r)}
            className="font-semibold underline"
          >
            {orgOf(r)}
          </button>
          <span className="text-[var(--gov-ink-sub)]">
            {md(r.useDate)} · {people(r)}명
            {r.holdExpiresAt ? ` · ${kstDue(r.holdExpiresAt)}까지였음` : ""}
          </span>
          <span className="ml-auto flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onExtend(r)}
              className="h-8 rounded border border-[var(--gov-line-strong)] bg-white px-3 text-[12.5px] disabled:opacity-50"
            >
              24시간 연장
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancel(r)}
              className="h-8 rounded border border-[var(--gov-danger)]/40 bg-white px-3 text-[12.5px] text-[var(--gov-danger)] disabled:opacity-50"
            >
              가계약 취소
            </button>
          </span>
        </div>
      ))}
    </section>
  );
}

/* ── 범례 ─────────────────────────────────────────────── */

export function Legend() {
  return (
    <div className="hidden flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-[var(--gov-ink-sub)] md:flex">
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-4 w-[3px] bg-[#1b3b6f]" />
        <RoleTag role="in" text="입실 15:00" />
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-4 w-[3px] bg-[#9ca3af]" />
        <RoleTag role="out" text="퇴실 11:00" />
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-4 w-[3px] bg-[#1d5b2c]" />
        <RoleTag role="day" text="당일 10:00~16:30" />
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-4 w-[3px] bg-[#9fb3d6]" />
        <RoleTag role="stay" text="연박" /> 수련회 둘째 날
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-3.5 w-6 rounded-sm border border-dashed border-[#c99a4a]" />
        가계약 (24시간 안에 첫 입금 · ⏱남은 시간)
      </span>
      <span className="flex items-center gap-1.5">
        <i className="inline-block h-3.5 w-6 rounded-sm bg-[repeating-linear-gradient(135deg,#f6eaea_0_4px,#fff_4px_8px)] ring-1 ring-[var(--gov-danger)]/30" />
        막은 날짜
      </span>
    </div>
  );
}

/* ── 월 달력 ─────────────────────────────────────────── */

function Bar({
  r,
  day,
  onOpen,
}: {
  r: Reservation;
  day: string;
  onOpen: (r: Reservation) => void;
}) {
  const k = roleOn(r, day);
  const hold = isHold(r) && Boolean(r.holdExpiresAt);
  const exp = holdExpired(r);
  const tone = exp
    ? "bg-[var(--gov-danger-weak)] outline-1 -outline-offset-1 outline-dashed outline-[var(--gov-danger)]"
    : hold
      ? "bg-white outline-1 -outline-offset-1 outline-dashed outline-[#c99a4a]"
      : "bg-[#f3f4f6] hover:bg-[#e9ecf1]";
  return (
    <button
      type="button"
      data-res={r.id}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(r);
      }}
      className={`block w-full rounded-[3px] border-l-[3px] py-[2px] pb-[3px] pl-1 pr-1 text-left ${BAR_EDGE[k]} ${tone} ${
        isCancelled(r) ? "line-through opacity-50" : ""
      }`}
    >
      <span className="flex gap-1 text-[12.5px] leading-[1.35]">
        <span className="min-w-0 truncate font-semibold">{orgOf(r)}</span>
        <span className="ml-auto shrink-0 font-bold">{people(r)}</span>
      </span>
      <span className="block truncate text-[10.5px] leading-[1.3] text-[var(--gov-ink-sub)]">
        {isWeebur(r) ? (
          <>
            <b className={WEEBUR_INK}>위버</b> ·{" "}
          </>
        ) : null}
        {hold ? (
          <>
            {ROLE_LABEL[k]} ·{" "}
            <span
              className={
                exp
                  ? "font-bold text-[var(--gov-danger)]"
                  : "font-semibold text-[var(--gov-warn)]"
              }
            >
              {exp ? "기한 지남" : `${Math.max(holdHours(r), 0)}h 남음`}
            </span>
          </>
        ) : (
          roleShort(k, r)
        )}
      </span>
    </button>
  );
}

export function CalendarGrid({
  month,
  days,
  selected,
  today,
  index,
  blocks,
  onSelect,
  onOpen,
}: {
  month: string;
  days: string[];
  selected: string;
  today: string;
  index: DayIndex;
  blocks: Map<string, string>;
  onSelect: (day: string) => void;
  onOpen: (r: Reservation) => void;
}) {
  return (
    <div className="self-start overflow-hidden rounded border border-[var(--gov-line)] bg-white">
      <div className="grid grid-cols-7 border-b border-[var(--gov-line)] text-center text-[12.5px] font-semibold text-[var(--gov-ink-sub)]">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-2 ${i === 0 ? "text-[var(--gov-danger)]" : i === 6 ? "text-[var(--gov-brand)]" : ""}`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" data-testid="cal-grid">
        {days.map((day) => {
          const inMonth = day.slice(0, 7) === month;
          const wd = weekdayOf(day);
          if (!inMonth) {
            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelect(day)}
                className="flex min-h-[128px] items-start border-b border-r border-[var(--gov-line)] bg-[#fafbfc] p-1 text-left"
              >
                <span className={`px-0.5 text-[13px] ${FAINT}`}>
                  {dayNum(day)}
                </span>
              </button>
            );
          }
          const list = index.mainOnDay(day);
          const outs = index.outOnDay(day);
          const total = sumPeople(index.liveMain(day));
          const blocked = blocks.get(day);
          return (
            <div
              key={day}
              data-day={day}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(day)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(day);
              }}
              className={`min-h-[128px] cursor-pointer border-b border-r border-[var(--gov-line)] p-1 hover:bg-[#fafbfc] ${
                day === selected
                  ? "bg-[#fbfcfe] shadow-[inset_0_0_0_2px_var(--gov-brand)]"
                  : ""
              } ${blocked ? "bg-[repeating-linear-gradient(135deg,#fbf3f3_0_6px,#fff_6px_12px)]" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span
                  className={`text-[13px] font-semibold ${
                    day === today
                      ? "rounded-full bg-[var(--gov-brand)] px-1.5 text-white"
                      : wd === 0
                        ? "text-[var(--gov-danger)]"
                        : wd === 6
                          ? "text-[var(--gov-brand)]"
                          : ""
                  }`}
                >
                  {dayNum(day)}
                </span>
                {total ? (
                  <span className="text-[13px] font-bold">{total}명</span>
                ) : null}
              </div>
              {blocked ? (
                <p className="truncate px-1 pb-0.5 text-[11px] font-semibold text-[var(--gov-danger)]">
                  막음 · {blocked}
                </p>
              ) : null}
              {outs.map((o) => (
                <p
                  key={o.id}
                  className={`truncate px-1 pb-0.5 text-[11px] ${FAINT}`}
                >
                  ↳ {orgOf(o)} 퇴실
                </p>
              ))}
              <div className="space-y-1">
                {list.slice(0, 3).map((r) => (
                  <Bar key={r.id} r={r} day={day} onOpen={onOpen} />
                ))}
                {list.length > 3 ? (
                  <p className="px-1 text-[11.5px] text-[var(--gov-ink-sub)]">
                    외 {list.length - 3}건
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 날짜 패널 ───────────────────────────────────────── */

function MiniRow({
  r,
  day,
  sub,
  onOpen,
}: {
  r: Reservation;
  day: string;
  sub?: string;
  onOpen: (r: Reservation) => void;
}) {
  const k = roleOn(r, day);
  return (
    <button
      type="button"
      onClick={() => onOpen(r)}
      className="flex w-full items-baseline gap-2 px-4 py-2 text-left text-[13.5px] hover:bg-[#fafbfc]"
    >
      <span className="min-w-0 flex-1 truncate">
        {orgOf(r)} <ChannelBadge r={r} small />{" "}
        <RoleTag role={k} r={r} short small />
        {sub ? <span className={`text-[12px] ${FAINT}`}> {sub}</span> : null}
      </span>
      <b className="shrink-0">
        {people(r)}
        <span className="text-[11px] font-normal text-[var(--gov-ink-sub)]">
          명
        </span>
      </b>
    </button>
  );
}

function SecHead({
  title,
  right,
  tone = "bg-[#fafbfc]",
}: {
  title: string;
  right?: string;
  tone?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between border-t border-[var(--gov-line)] px-4 py-2 ${tone}`}
    >
      <span className="text-[12.5px] font-semibold text-[var(--gov-ink-sub)]">
        {title}
      </span>
      <span className="text-[12.5px] text-[var(--gov-ink-sub)]">
        {right ?? ""}
      </span>
    </div>
  );
}

export function DayPanel({
  day,
  index,
  blockReason,
  onOpen,
  onUnblock,
}: {
  day: string;
  index: DayIndex;
  blockReason?: string;
  onOpen: (r: Reservation) => void;
  onUnblock?: (day: string) => void;
}) {
  const list = index.mainOnDay(day);
  const live = index.liveMain(day);
  const outs = index.outOnDay(day);
  const total = sumPeople(live);
  const night = sumPeople(
    live.filter((r) => ["in", "stay"].includes(roleOn(r, day))),
  );
  const nd = addDays(day, 1);
  const nextList = index.liveMain(nd);
  return (
    <div data-testid="day-panel">
      <div className="flex items-end justify-between px-4 py-4">
        <div>
          <p className="text-[17px] font-bold">{label(day)}</p>
          {live.length ? (
            <p className="text-[13px] text-[var(--gov-ink-sub)]">
              이날 예약 {live.length}팀
            </p>
          ) : null}
        </div>
        {total ? (
          <p className="text-right">
            <span className="text-[13px] text-[var(--gov-ink-sub)]">이날 </span>
            <b className="text-[26px] leading-none">{total}</b>
            <span className="text-[14px]">명</span>
          </p>
        ) : null}
      </div>
      {blockReason ? (
        <div className="flex items-center gap-2 border-t border-[var(--gov-danger)]/30 bg-[var(--gov-danger-weak)] px-4 py-2 text-[13px] text-[var(--gov-danger)]">
          <span className="flex-1">막은 날짜 · {blockReason}</span>
          {onUnblock ? (
            <button
              type="button"
              onClick={() => onUnblock(day)}
              className="shrink-0 underline"
            >
              막기 풀기
            </button>
          ) : null}
        </div>
      ) : null}
      <SecHead
        title="① 이날 예약"
        right={live.length ? `${live.length}팀 · ${total}명` : ""}
      />
      {list.length ? (
        <div className="divide-y divide-[var(--gov-line)]">
          {list.map((r) => {
            const k = roleOn(r, day);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpen(r)}
                className={`block w-full px-4 py-3 text-left hover:bg-[#fafbfc] ${
                  isCancelled(r) ? "line-through opacity-50" : ""
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-bold">
                    {orgOf(r)} <ChannelBadge r={r} />
                  </span>
                  <span className="shrink-0 text-[17px] font-bold">
                    {people(r)}
                    <span className="text-[12px] font-normal text-[var(--gov-ink-sub)]">
                      명
                    </span>
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-[var(--gov-ink-sub)]">
                  <RoleTag role={k} r={r} />
                  <span>{productShort(r)}</span>
                  <span>·</span>
                  <span>
                    성인 {r.adultCount} 어린이 {r.childCount}
                  </span>
                  {r.isAdditional ? (
                    <span className="text-[var(--gov-danger)]">
                      · 추가 예약
                    </span>
                  ) : null}
                </div>
                <div className="mt-2">
                  <PayBox r={r} />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="px-4 py-5 text-center text-[13.5px] text-[var(--gov-ink-sub)]">
          이날 새로 들어오는 예약이 없습니다.
        </p>
      )}
      {night ? (
        <div className="flex justify-between border-t border-[var(--gov-line)] bg-[var(--gov-brand-weak)] px-4 py-2 text-[13.5px]">
          <span>오늘 밤 숙박</span>
          <b className="text-[var(--gov-brand)]">{night}명</b>
        </div>
      ) : null}
      {outs.length ? (
        <>
          <SecHead
            title="② 이날 오전 퇴실 · 전날 입실 단체"
            right={`조식 ${sumPeople(outs)}명`}
          />
          <div className="text-[var(--gov-ink-sub)]">
            {outs.map((o) => (
              <MiniRow
                key={o.id}
                r={o}
                day={day}
                sub={`${md(o.useDate)} 입실`}
                onOpen={onOpen}
              />
            ))}
          </div>
        </>
      ) : null}
      <SecHead
        title={`${outs.length ? "③" : "②"} 다음날 예약 미리보기 · ${label(nd)}`}
        right={
          nextList.length
            ? `${nextList.length}팀 · ${sumPeople(nextList)}명`
            : ""
        }
        tone="bg-[#f7f8fa]"
      />
      {nextList.length ? (
        <div className="pb-1">
          {nextList.map((o) => (
            <MiniRow key={o.id} r={o} day={nd} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <p className={`px-4 py-3 text-[13px] ${FAINT}`}>
          다음날 예약이 없습니다.
        </p>
      )}
    </div>
  );
}

/* ── 목록 ─────────────────────────────────────────────── */

export function ListView({
  rows,
  onOpen,
  caption,
}: {
  rows: Reservation[];
  onOpen: (r: Reservation) => void;
  caption?: React.ReactNode;
}) {
  return (
    <section className="overflow-x-auto rounded border border-[var(--gov-line)] bg-white">
      {caption}
      <table className="w-full min-w-[920px] text-[14px]">
        <thead>
          <tr className="border-b border-[var(--gov-line)] text-left text-[12.5px] text-[var(--gov-ink-sub)]">
            <th className="px-4 py-2.5 font-semibold">단체</th>
            <th className="px-3 py-2.5 font-semibold">일정</th>
            <th className="px-3 py-2.5 text-right font-semibold">인원</th>
            <th className="w-[240px] px-3 py-2.5 font-semibold">납부 현황</th>
            <th className="px-4 py-2.5 text-right font-semibold">남은 금액</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-10 text-center text-[13.5px] text-[var(--gov-ink-sub)]"
              >
                조건에 맞는 예약이 없습니다.
              </td>
            </tr>
          ) : null}
          {rows.map((r) => {
            const pct = r.totalAmount
              ? Math.round((r.received / r.totalAmount) * 100)
              : 0;
            const end = endOf(r);
            return (
              <tr
                key={r.id}
                onClick={() => onOpen(r)}
                className={`cursor-pointer border-b border-[var(--gov-line)] align-top hover:bg-[#fafbfc] ${
                  isCancelled(r) ? "line-through opacity-50" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <b>{orgOf(r)}</b> <ChannelBadge r={r} />
                  {r.isAdditional ? (
                    <span className="text-[12px] text-[var(--gov-danger)]">
                      {" "}
                      추가 예약
                    </span>
                  ) : null}
                  <span className="block text-[12.5px] text-[var(--gov-ink-sub)]">
                    {productName(r)}
                    {r.customerName ? ` · ${r.customerName}` : ""}
                    {r.contactTitle ? ` ${r.contactTitle}` : ""}
                  </span>
                </td>
                <td className="px-3 py-3 text-[13.5px]">
                  {r.useDate === end ? (
                    <>
                      {md(r.useDate)} <RoleTag role="day" text="당일" />
                    </>
                  ) : (
                    <>
                      {md(r.useDate)} <RoleTag role="in" text="입실" />
                      <span className="block">
                        {md(end)} <RoleTag role="out" text="퇴실" />
                      </span>
                    </>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <b>{people(r)}명</b>
                  <span className="block text-[12px] text-[var(--gov-ink-sub)]">
                    성인 {r.adultCount} · 어린이 {r.childCount}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {isWeebur(r) ? (
                    <>
                      <div className="flex justify-between text-[13px]">
                        <span>
                          전체 <b>{num(r.totalAmount)}</b>
                        </span>
                        <span className={`text-[12px] ${stageTone(r)}`}>
                          {stageLabel(r)}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[var(--gov-ink-sub)]">
                        위버 수수료 {ratioPct({ depositRatio: r.feeRate })}% −
                        {num(r.fee)} ·{" "}
                        <span className="whitespace-nowrap">
                          정산 <b className={WEEBUR_INK}>{num(r.net)}</b>
                        </span>
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-[13px]">
                        <span>
                          <b
                            className={r.received ? "text-[var(--gov-ok)]" : ""}
                          >
                            {num(r.received)}
                          </b>{" "}
                          <span className="text-[var(--gov-ink-sub)]">
                            / {num(r.totalAmount)}
                          </span>
                        </span>
                        <span className={`text-[12px] ${stageTone(r)}`}>
                          {stageLabel(r)}
                        </span>
                      </div>
                      <Prog
                        pct={pct}
                        tick={
                          r.paymentPlan === "full" ? undefined : ratioPct(r)
                        }
                        className="mt-1"
                      />
                      <p className="mt-1 text-[11.5px] text-[var(--gov-ink-sub)]">
                        {r.paymentPlan === "full"
                          ? "전액 한 번에"
                          : `예약금 ${ratioPct(r)}% + 잔금`}
                      </p>
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {isWeebur(r) ? (
                    r.remaining ? (
                      <>
                        <span className={`block text-[11.5px] ${WEEBUR_INK}`}>
                          정산 예정
                        </span>
                        <b className={WEEBUR_INK}>{won(r.remaining)}</b>
                      </>
                    ) : (
                      <span className="font-semibold text-[var(--gov-ok)]">
                        정산 완료
                      </span>
                    )
                  ) : r.remaining ? (
                    <b className="text-[var(--gov-warn)]">{won(r.remaining)}</b>
                  ) : (
                    <span className="font-semibold text-[var(--gov-ok)]">
                      완납
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/* ── 휴대폰: 주 보기 · 월 보기 ───────────────────────── */

export function MobileWeek({
  selected,
  today,
  index,
  onSelect,
  onShift,
  onOpen,
}: {
  selected: string;
  today: string;
  index: DayIndex;
  onSelect: (day: string) => void;
  onShift: (days: number) => void;
  onOpen: (r: Reservation) => void;
}) {
  const start = addDays(selected, -weekdayOf(selected));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const last = days[6];
  return (
    <div className="overflow-hidden rounded border border-[var(--gov-line)]">
      <div className="flex items-center justify-between bg-white px-2 py-2 text-[15px] font-bold">
        <button
          type="button"
          onClick={() => onShift(-7)}
          className="h-9 w-9"
          aria-label="이전 주"
        >
          ‹
        </button>
        <span>
          {label(start).replace(/ \(.\)/, "")} ~{" "}
          {last.slice(5, 7) === start.slice(5, 7)
            ? `${dayNum(last)}일`
            : label(last).replace(/ \(.\)/, "")}
        </span>
        <button
          type="button"
          onClick={() => onShift(7)}
          className="h-9 w-9"
          aria-label="다음 주"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 border-b border-[var(--gov-line)] bg-white px-2 pb-2">
        {days.map((day, i) => {
          const total = sumPeople(index.liveMain(day));
          const sel = day === selected;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              className={`flex flex-col items-center rounded py-1.5 ${sel ? "bg-[var(--gov-brand)] text-white" : ""}`}
            >
              <span
                className={`text-[11px] ${sel ? "" : i === 0 ? "text-[var(--gov-danger)]" : i === 6 ? "text-[var(--gov-brand)]" : "text-[var(--gov-ink-sub)]"}`}
              >
                {WEEKDAYS[i]}
              </span>
              <span
                className={`text-[15px] font-semibold ${day === today && !sel ? "underline" : ""}`}
              >
                {dayNum(day)}
              </span>
              <span
                className={`text-[11px] font-bold ${sel ? "" : "text-[var(--gov-brand)]"}`}
              >
                {total || " "}
              </span>
            </button>
          );
        })}
      </div>
      <div className="bg-[var(--gov-bg)]">
        {days.map((day) => {
          const list = index.mainOnDay(day);
          const outs = index.outOnDay(day);
          const live = index.liveMain(day);
          const total = sumPeople(live);
          const night = sumPeople(
            live.filter((r) => ["in", "stay"].includes(roleOn(r, day))),
          );
          return (
            <div
              key={day}
              className="border-b border-[var(--gov-line)] bg-white"
            >
              <div
                className={`flex items-baseline justify-between px-3 pb-1.5 pt-3 ${day === selected ? "bg-[var(--gov-brand-weak)]" : ""}`}
              >
                <span className="text-[14px] font-bold">{label(day)}</span>
                {total ? (
                  <span className="text-[13px]">
                    <b className="text-[16px]">{total}</b>명
                    {night ? (
                      <span className="text-[11.5px] text-[var(--gov-brand)]">
                        {" "}
                        · 숙박 {night}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className={`text-[12px] ${FAINT}`}>
                    {outs.length ? "새 예약 없음" : "예약 없음"}
                  </span>
                )}
              </div>
              {outs.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onOpen(o)}
                  className={`block w-full border-t border-[var(--gov-line)] px-3 py-1.5 text-left text-[12px] ${FAINT}`}
                >
                  ↳ {orgOf(o)} {people(o)}명 · 오전 퇴실 {timesOf(o).out} (
                  {md(o.useDate)} 입실)
                </button>
              ))}
              {list.map((r) => {
                const k = roleOn(r, day);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onOpen(r)}
                    className={`block w-full border-t border-[var(--gov-line)] px-3 py-2 text-left ${isCancelled(r) ? "line-through opacity-50" : ""}`}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">
                        {orgOf(r)} <ChannelBadge r={r} small />
                      </span>
                      <span className="shrink-0 text-[15px] font-bold">
                        {people(r)}
                        <span className="text-[11px] font-normal text-[var(--gov-ink-sub)]">
                          명
                        </span>
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[var(--gov-ink-sub)]">
                      <RoleTag role={k} r={r} />
                      <span>{productShort(r)}</span>
                      {r.isAdditional ? (
                        <span className="text-[var(--gov-danger)]">· 추가</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[12px]">
                      <PayLine r={r} />
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MobileMonth({
  month,
  days,
  selected,
  today,
  index,
  onSelect,
  onMonth,
  panel,
}: {
  month: string;
  days: string[];
  selected: string;
  today: string;
  index: DayIndex;
  onSelect: (day: string) => void;
  onMonth: (n: number) => void;
  panel: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded border border-[var(--gov-line)]">
      <div className="flex items-center justify-between bg-white px-2 py-2 text-[15px] font-bold">
        <button
          type="button"
          onClick={() => onMonth(-1)}
          className="h-9 w-9"
          aria-label="이전 달"
        >
          ‹
        </button>
        <span>{monthTitle(month)}</span>
        <button
          type="button"
          onClick={() => onMonth(1)}
          className="h-9 w-9"
          aria-label="다음 달"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 bg-white px-2 pb-1 text-center text-[11px] text-[var(--gov-ink-sub)]">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 bg-white px-2 pb-3">
        {days.map((day) => {
          if (day.slice(0, 7) !== month) return <span key={day} />;
          const total = sumPeople(index.liveMain(day));
          const sel = day === selected;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              className={`flex h-12 flex-col items-center justify-center rounded text-[14px] ${sel ? "bg-[var(--gov-brand)] text-white" : ""} `}
            >
              <span
                className={day === today && !sel ? "font-bold underline" : ""}
              >
                {dayNum(day)}
              </span>
              <span
                className={`text-[11px] font-bold ${sel ? "" : "text-[var(--gov-brand)]"}`}
              >
                {total || " "}
              </span>
            </button>
          );
        })}
      </div>
      <div className="bg-[var(--gov-bg)] p-3">
        <div className="rounded border border-[var(--gov-line)] bg-white">
          {panel}
        </div>
      </div>
    </div>
  );
}
