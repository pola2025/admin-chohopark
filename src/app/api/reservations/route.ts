import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { calculateSmsScheduleTime } from '@/lib/kst'

export async function GET(request: NextRequest) {
  const isAuthenticated = await getSession()
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabaseAdmin
    .from('reservations')
    .select('*', { count: 'exact' })
    .order('use_date', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('payment_status', status)
  }
  if (from) {
    query = query.gte('use_date', from)
  }
  if (to) {
    query = query.lte('use_date', to)
  }

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

export async function POST(request: NextRequest) {
  const isAuthenticated = await getSession()
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .insert([body])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // SMS 스케줄 자동 생성 (KST 기준)
    await createSmsSchedules(data.id, data.use_date, data.product_type)

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: '예약 생성 실패' }, { status: 500 })
  }
}

/**
 * SMS 스케줄 생성 (KST 기준)
 * 모든 시간은 KST 기준으로 계산되어 UTC로 저장됨
 */
async function createSmsSchedules(reservationId: number, useDate: string, productType: string) {
  const scheduleTypes = ['d_minus_1', 'd_day_morning', 'before_meal', 'before_close']

  const schedules = scheduleTypes.map((type) => {
    // KST 기준으로 스케줄 시간 계산
    const scheduledAt = calculateSmsScheduleTime(useDate, type, productType)

    return {
      reservation_id: reservationId,
      schedule_type: type,
      scheduled_at: scheduledAt.toISOString(),
      status: 'pending',
    }
  })

  await supabaseAdmin.from('sms_schedules').insert(schedules)
}
