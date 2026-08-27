"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";

type NavItem = { name: string; href: string; icon: IconName };

/** 하는 일 기준으로 묶는다. 메뉴가 늘어도 찾는 자리가 흔들리지 않는다. */
const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "운영 관리",
    items: [
      { name: "대시보드", href: "/dashboard", icon: "dashboard" },
      { name: "예약 관리", href: "/dashboard/reservations", icon: "calendar" },
      { name: "약정서 관리", href: "/dashboard/contracts", icon: "contract" },
      { name: "예약 고객", href: "/dashboard/reservation-customers", icon: "users" },
      { name: "견적 문의", href: "/dashboard/inquiries", icon: "inbox" },
      { name: "문의 고객", href: "/dashboard/customers", icon: "user" },
    ],
  },
  {
    title: "고객 안내",
    items: [
      { name: "문자 발송", href: "/dashboard/sms", icon: "message" },
      { name: "문구 템플릿", href: "/dashboard/templates", icon: "template" },
    ],
  },
  {
    title: "현황",
    items: [
      { name: "방문자 통계", href: "/dashboard/analytics", icon: "chart" },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((group) => group.items);

const MOBILE_NAV: Array<NavItem & { action?: "more" }> = [
  { name: "홈", href: "/dashboard", icon: "home" },
  { name: "예약", href: "/dashboard/reservations", icon: "calendar" },
  { name: "약정서", href: "/dashboard/contracts", icon: "contract" },
  { name: "문의", href: "/dashboard/inquiries", icon: "inbox" },
  { name: "더보기", href: "#more", icon: "more", action: "more" },
];

function pageTitle(pathname: string): string {
  // 상세 화면까지 감안해 가장 길게 겹치는 메뉴를 고른다.
  const matched = ALL_NAV.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
  return matched?.name ?? "관리자";
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const handleMobileNav = (item: (typeof MOBILE_NAV)[number]) => {
    if (item.action === "more") {
      setSidebarOpen(true);
      return;
    }
    router.push(item.href);
  };

  const isCurrent = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-[var(--gov-bg)] text-[var(--gov-ink)]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 border-r border-[var(--gov-line)] bg-white transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between bg-[var(--gov-brand)] px-4">
            <Link
              href="/dashboard"
              className="text-[15px] font-bold text-white"
            >
              초호쉼터 관리자
            </Link>
            <button
              type="button"
              className="p-1 text-white/80 hover:text-white lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="메뉴 닫기"
            >
              <Icon name="close" size={18} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-3">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="pb-2">
                <p className="px-4 pb-1.5 pt-2 text-[11px] font-semibold tracking-wide text-[var(--gov-ink-sub)]">
                  {group.title}
                </p>
                {group.items.map((item) => {
                  const active = isCurrent(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-10 items-center gap-2.5 border-l-[3px] px-4 text-[13.5px] transition-colors ${
                        active
                          ? "border-[var(--gov-brand)] bg-[var(--gov-brand-weak)] font-medium text-[var(--gov-brand)]"
                          : "border-transparent text-[var(--gov-ink-sub)] hover:bg-gray-50"
                      }`}
                    >
                      <Icon name={item.icon} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="border-t border-[var(--gov-line)] p-3">
            <button
              type="button"
              onClick={handleLogout}
              className="h-9 w-full border border-[var(--gov-line-strong)] bg-white text-[13px] hover:bg-gray-50"
            >
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      <div className="pb-16 lg:pb-0 lg:pl-60">
        <header className="sticky top-0 z-30 h-14 border-b border-[var(--gov-line)] bg-white">
          <div className="mx-auto flex h-full w-full max-w-[1200px] items-center px-4 lg:px-6">
            <button
              type="button"
              className="-ml-1 mr-2 p-1 text-[var(--gov-ink-sub)] lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="메뉴 열기"
            >
              <Icon name="menu" size={22} />
            </button>
            <h1 className="text-[15px] font-bold">{pageTitle(pathname)}</h1>
            <p className="ml-auto hidden items-center gap-1.5 text-[12px] text-[var(--gov-ink-sub)] sm:flex">
              <Icon name="clock" size={15} />
              모든 시각은 한국 표준시 기준입니다
            </p>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1200px] px-4 py-5 lg:px-6 lg:py-6">
          {children}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--gov-line)] bg-white lg:hidden">
        <div className="flex h-16 items-center justify-around px-1">
          {MOBILE_NAV.map((item) => {
            const active = item.action !== "more" && isCurrent(item.href);
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => handleMobileNav(item)}
                className={`flex h-full flex-1 flex-col items-center justify-center gap-1 ${
                  active
                    ? "text-[var(--gov-brand)]"
                    : "text-[var(--gov-ink-sub)]"
                }`}
              >
                <Icon name={item.icon} size={21} />
                <span className="text-[10.5px] font-medium">{item.name}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
