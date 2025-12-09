import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { sendSms } from '@/lib/sms'

// SMS 테스트 발송 API
export async function POST(request: NextRequest) {
  const isAuthenticated = await getSession()
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { phone, message } = body

    if (!phone || !message) {
      return NextResponse.json(
        { error: '전화번호와 메시지는 필수입니다' },
        { status: 400 }
      )
    }

    // 전화번호 형식 검증
    const phoneRegex = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/
    if (!phoneRegex.test(phone.replace(/-/g, ''))) {
      return NextResponse.json(
        { error: '올바른 전화번호 형식이 아닙니다' },
        { status: 400 }
      )
    }

    // SMS 발송
    const result = await sendSms({
      to: phone,
      content: message,
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'SMS 발송 성공',
        requestId: result.requestId,
      })
    } else {
      return NextResponse.json(
        { error: result.error || 'SMS 발송 실패' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('SMS test error:', error)
    return NextResponse.json(
      { error: 'SMS 발송 중 오류 발생' },
      { status: 500 }
    )
  }
}
