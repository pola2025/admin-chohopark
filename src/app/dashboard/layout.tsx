'use client'

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: '대시보드', href: '/dashboard', icon: '📊' },
  { name: '예약 관리', href: '/dashboard/reservations', icon: '📅' },
  { name: 'SMS 관리', href: '/dashboard/sms', icon: '💬' },
  { name: '메시지 템플릿', href: '/dashboard/templates', icon: '📝' },
  { name: '견적 문의', href: '/dashboard/inquiries', icon: '📩' },
  { name: '방문자 통계', href: '/dashboard/analytics', icon: '📈' },
]

// 모바일 하단바용 주요 메뉴
const mobileNav = [
  { name: '홈', href: '/dashboard', icon: '🏠' },
  { name: '예약', href: '/dashboard/reservations', icon: '📅' },
  { name: 'SMS', href: '/dashboard/sms', icon: '💬' },
  { name: '문의', href: '/dashboard/inquiries', icon: '📩' },
  { name: '더보기', href: '#more', icon: '☰' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const handleMobileNav = (href: string) => {
    if (href === '#more') {
      setSidebarOpen(true)
    } else {
      router.push(href)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-2xl">🏡</span>
              <span className="font-bold text-lg">초호쉼터</span>
            </Link>
            <button
              className="p-2 text-gray-500 hover:text-gray-700"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.name}
                </Link>
              )
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
            >
              로그아웃
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 pb-20 lg:pb-0">
        {/* Top bar - 데스크톱만 표시 */}
        <header className="sticky top-0 z-30 h-14 lg:h-16 bg-white border-b flex items-center px-4 lg:px-6">
          <button
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="ml-2 lg:ml-0 flex-1">
            <h1 className="text-base lg:text-lg font-semibold text-gray-800">
              {navigation.find(n => n.href === pathname)?.name || '관리자 대시보드'}
            </h1>
          </div>
        </header>

        {/* Page content */}
        <main className="p-3 lg:p-6">{children}</main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg">
        <div className="flex justify-around items-center h-16 px-2 safe-area-pb">
          {mobileNav.map((item) => {
            const isActive = pathname === item.href
            return (
              <button
                key={item.name}
                onClick={() => handleMobileNav(item.href)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
                  isActive
                    ? 'text-emerald-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="text-xl mb-0.5">{item.icon}</span>
                <span className={`text-[10px] font-medium ${isActive ? 'text-emerald-600' : ''}`}>
                  {item.name}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
