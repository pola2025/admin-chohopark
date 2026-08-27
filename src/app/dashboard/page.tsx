import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { ReservationCalendar } from "@/components/dashboard/ReservationCalendar";
import { Icon } from "@/components/ui/icon";
import { PRODUCT_TYPES } from "@/types/reservation";
import type { Reservation } from "@/types/reservation";
import {
  getKSTTodayString,
  getKSTDateAfterDays,
  getKSTTodayStart,
  getKSTTodayEnd,
  getKSTEndOfMonth,
} from "@/lib/kst";

async function getStats() {
  // KST 기준 날짜 계산
  const today = getKSTTodayString();
  const weekLater = getKSTDateAfterDays(7);

  // 오늘 예약
  const { count: todayCount } = await supabaseAdmin
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .eq("use_date", today);

  // 이번 주 예약
  const { count: weekCount } = await supabaseAdmin
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .gte("use_date", today)
    .lte("use_date", weekLater);

  // 잔금이 남은 예약
  const { count: pendingCount } = await supabaseAdmin
    .from("reservations")
    .select("*", { count: "exact", head: true })
    .neq("payment_status", "completed");

  // 오늘 발송 예정 문자 (KST 기준)
  const todayStart = getKSTTodayStart();
  const todayEnd = getKSTTodayEnd();

  const { count: smsCount } = await supabaseAdmin
    .from("sms_schedules")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .gte("scheduled_at", todayStart.toISOString())
    .lte("scheduled_at", todayEnd.toISOString());

  // 새 견적 문의
  const { count: inquiryCount } = await supabaseAdmin
    .from("inquiries")
    .select("*", { count: "exact", head: true });

  return {
    todayReservations: todayCount || 0,
    weekReservations: weekCount || 0,
    pendingPayments: pendingCount || 0,
    todaySms: smsCount || 0,
    newInquiries: inquiryCount || 0,
  };
}

async function getUpcomingReservations(): Promise<Reservation[]> {
  const todayStr = getKSTTodayString();
  const endOfMonthStr = getKSTEndOfMonth();

  const { data } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .gte("use_date", todayStr)
    .lte("use_date", endOfMonthStr)
    .order("use_date", { ascending: true });

  return data || [];
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** `2026-09-15` 를 `09-15 (화)` 로 바꾼다. */
function listDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const weekday = WEEKDAYS[new Date(`${value}T00:00:00Z`).getUTCDay()] ?? "";
  return `${m[2]}-${m[3]} (${weekday})`;
}

function money(value: number): string {
  return value.toLocaleString("ko-KR");
}

export default async function DashboardPage() {
  const stats = await getStats();
  const upcomingReservations = await getUpcomingReservations();
  const nextReservations = upcomingReservations.slice(0, 6);

  const summary = [
    { title: "오늘 예약", value: stats.todayReservations, unit: "건" },
    { title: "이번 주 예약", value: stats.weekReservations, unit: "건" },
    {
      title: "잔금 미수",
      value: stats.pendingPayments,
      unit: "건",
      emphasis: stats.pendingPayments > 0,
    },
    { title: "오늘 발송 문자", value: stats.todaySms, unit: "건" },
    { title: "견적 문의", value: stats.newInquiries, unit: "건" },
  ];

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 border border-[var(--gov-line)] bg-white sm:grid-cols-3 lg:grid-cols-5">
        {summary.map((item) => (
          <div
            key={item.title}
            className="border-b border-r border-[var(--gov-line)] px-5 py-4 last:border-r-0 lg:border-b-0"
          >
            <p className="mb-1.5 text-[12.5px] text-[var(--gov-ink-sub)]">
              {item.title}
            </p>
            <p
              className={`text-[26px] font-bold leading-none ${
                item.emphasis ? "text-[var(--gov-warn)]" : ""
              }`}
            >
              {item.value}
              <span className="ml-1 text-[13px] font-normal text-[var(--gov-ink-sub)]">
                {item.unit}
              </span>
            </p>
          </div>
        ))}
      </section>

      <section className="border border-[var(--gov-line)] bg-white">
        <div className="flex h-12 items-center gap-2 border-b border-[var(--gov-line)] px-5">
          <h2 className="text-[14px] font-bold">다가오는 예약</h2>
          <span className="hidden text-[12px] text-[var(--gov-ink-sub)] sm:inline">
            약정서 입금 확인이 끝나면 이 목록에 올라옵니다
          </span>
          <Link
            href="/dashboard/reservations"
            className="ml-auto text-[12.5px] text-[var(--gov-brand)] underline"
          >
            전체 보기
          </Link>
        </div>

        {nextReservations.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-[var(--gov-ink-sub)]">
            이번 달에 잡힌 예약이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-t-2 border-[var(--gov-brand)] bg-[#fafbfc] text-left">
                  <th className="w-[120px] px-5 py-2.5 font-semibold">
                    이용일
                  </th>
                  <th className="w-[110px] px-3 py-2.5 font-semibold">구분</th>
                  <th className="px-3 py-2.5 font-semibold">단체명</th>
                  <th className="w-[110px] px-3 py-2.5 font-semibold">
                    담당자
                  </th>
                  <th className="w-[70px] px-3 py-2.5 text-right font-semibold">
                    인원
                  </th>
                  <th className="w-[120px] px-3 py-2.5 text-right font-semibold">
                    예약금
                  </th>
                  <th className="w-[92px] px-5 py-2.5 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {nextReservations.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--gov-line)] hover:bg-gray-50"
                  >
                    <td className="px-5 py-3">{listDate(item.use_date)}</td>
                    <td className="px-3 py-3">
                      {PRODUCT_TYPES[item.product_type] ?? item.product_type}
                    </td>
                    <td className="px-3 py-3 font-medium">
                      {item.company_name || "-"}
                    </td>
                    <td className="px-3 py-3">{item.manager_name}</td>
                    <td className="px-3 py-3 text-right">
                      {item.people_count}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {money(item.deposit_amount)}
                    </td>
                    <td className="px-5 py-3">
                      {item.payment_status === "completed" ? (
                        <span className="inline-block bg-[var(--gov-ok-weak)] px-2 py-0.5 text-[11.5px] text-[var(--gov-ok)]">
                          확정
                        </span>
                      ) : (
                        <span className="inline-block bg-[var(--gov-warn-weak)] px-2 py-0.5 text-[11.5px] text-[var(--gov-warn)]">
                          입금 대기
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="border border-[var(--gov-line)] bg-white">
        <div className="flex h-12 items-center gap-2 border-b border-[var(--gov-line)] px-5">
          <Icon name="calendar" size={17} className="text-[var(--gov-brand)]" />
          <h2 className="text-[14px] font-bold">이번 달 일정</h2>
        </div>
        <div className="p-5">
          <ReservationCalendar reservations={upcomingReservations} />
        </div>
      </section>
    </div>
  );
}
