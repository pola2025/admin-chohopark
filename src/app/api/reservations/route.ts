import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

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

    // SMS 스케줄 자동 생성
    await createSmsSchedules(data.id, data.use_date, data.product_type)

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: '예약 생성 실패' }, { status: 500 })
  }
}

async function createSmsSchedules(reservationId: number, useDate: string, productType: string) {
  const scheduleTypes = ['d_minus_1', 'd_day_morning', 'before_meal', 'before_close']
  const date = new Date(useDate)

  const schedules = scheduleTypes.map((type) => {
    let scheduledAt: Date

    switch (type) {
      case 'd_minus_1':
        scheduledAt = new Date(date)
        scheduledAt.setDate(scheduledAt.getDate() - 1)
        scheduledAt.setHours(10, 0, 0, 0)
        break
      case 'd_day_morning':
        scheduledAt = new Date(date)
        scheduledAt.setHours(8, 0, 0, 0)
        break
      case 'before_meal':
        scheduledAt = new Date(date)
        scheduledAt.setHours(productType === 'daytrip' ? 11 : 17, 30, 0, 0)
        break
      case 'before_close':
        if (productType === 'daytrip') {
          scheduledAt = new Date(date)
          scheduledAt.setHours(16, 0, 0, 0)
        } else if (productType === 'training') {
          scheduledAt = new Date(date)
          scheduledAt.setDate(scheduledAt.getDate() + 2)
          scheduledAt.setHours(10, 0, 0, 0)
        } else {
          scheduledAt = new Date(date)
          scheduledAt.setDate(scheduledAt.getDate() + 1)
          scheduledAt.setHours(10, 0, 0, 0)
        }
        break
      default:
        scheduledAt = new Date(date)
    }

    return {
      reservation_id: reservationId,
      schedule_type: type,
      scheduled_at: scheduledAt.toISOString(),
      status: 'pending',
    }
  })

  await supabaseAdmin.from('sms_schedules').insert(schedules)
}
