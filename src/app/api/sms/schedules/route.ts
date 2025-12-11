import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const isAuthenticated = await getSession()
  if (!isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const status = searchParams.get('status')
  const viewType = searchParams.get('viewType') || 'all' // all, daily, monthly
  const date = searchParams.get('date') // YYYY-MM-DD for daily, YYYY-MM for monthly

  let query = supabaseAdmin
    .from('sms_schedules')
    .select(`
      *,
      reservation:reservations(company_name, manager_name, phone, product_type)
    `)
    .order('scheduled_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  // 일별/월별 필터
  if (viewType === 'daily' && date) {
    const startDate = `${date}T00:00:00+09:00`
    const endDate = `${date}T23:59:59+09:00`
    query = query.gte('scheduled_at', startDate).lte('scheduled_at', endDate)
  } else if (viewType === 'monthly' && date) {
    const [year, month] = date.split('-')
    const startDate = `${year}-${month}-01T00:00:00+09:00`
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
    const endDate = `${year}-${month}-${lastDay}T23:59:59+09:00`
    query = query.gte('scheduled_at', startDate).lte('scheduled_at', endDate)
  }

  const { data, error } = await query.limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}
