import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin-token')?.value
  const { pathname } = request.nextUrl

  // 로그인 페이지는 인증 체크 제외
  if (pathname === '/login') {
    // 이미 로그인된 경우 대시보드로 리다이렉트
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // API 라우트는 제외 (각 API에서 처리)
  if (pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  // 보호된 라우트 (dashboard 하위)
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // 루트 경로 처리
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*'],
}
