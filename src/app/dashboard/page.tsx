import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabaseAdmin } from '@/lib/supabase'

async function getStats() {
  const today = new Date().toISOString().split('T')[0]
  const weekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // 오늘 예약
  const { count: todayCount } = await supabaseAdmin
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('use_date', today)

  // 이번 주 예약
  const { count: weekCount } = await supabaseAdmin
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .gte('use_date', today)
    .lte('use_date', weekLater)

  // 미결제 예약
  const { count: pendingCount } = await supabaseAdmin
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('payment_status', 'pending')

  // 오늘 발송 예정 SMS
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const { count: smsCount } = await supabaseAdmin
    .from('sms_schedules')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gte('scheduled_at', todayStart.toISOString())
    .lte('scheduled_at', todayEnd.toISOString())

  // 새 견적 문의
  const { count: inquiryCount } = await supabaseAdmin
    .from('inquiries')
    .select('*', { count: 'exact', head: true })

  return {
    todayReservations: todayCount || 0,
    weekReservations: weekCount || 0,
    pendingPayments: pendingCount || 0,
    todaySms: smsCount || 0,
    newInquiries: inquiryCount || 0,
  }
}

async function getUpcomingReservations() {
  const today = new Date().toISOString().split('T')[0]

  const { data } = await supabaseAdmin
    .from('reservations')
    .select('*')
    .gte('use_date', today)
    .order('use_date', { ascending: true })
    .limit(5)

  return data || []
}

export default async function DashboardPage() {
  const stats = await getStats()
  const upcomingReservations = await getUpcomingReservations()

  const statCards = [
    { title: '오늘 예약', value: stats.todayReservations, icon: '📅', color: 'bg-blue-50 text-blue-700' },
    { title: '이번 주 예약', value: stats.weekReservations, icon: '📆', color: 'bg-emerald-50 text-emerald-700' },
    { title: '미결제', value: stats.pendingPayments, icon: '💰', color: 'bg-amber-50 text-amber-700' },
    { title: '오늘 SMS', value: stats.todaySms, icon: '💬', color: 'bg-purple-50 text-purple-700' },
    { title: '견적 문의', value: stats.newInquiries, icon: '📩', color: 'bg-pink-50 text-pink-700' },
  ]

  const productTypeLabels: Record<string, string> = {
    overnight: '1박2일 워크샵',
    daytrip: '당일 야유회',
    training: '2박3일 수련회',
  }

  const paymentStatusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: '미결제', color: 'bg-amber-100 text-amber-700' },
    partial: { label: '부분결제', color: 'bg-blue-100 text-blue-700' },
    completed: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${stat.color} mb-3`}>
                <span className="text-xl">{stat.icon}</span>
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Upcoming Reservations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">다가오는 예약</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingReservations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">예정된 예약이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {upcomingReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">
                        {new Date(reservation.use_date).toLocaleDateString('ko-KR', { month: 'short' })}
                      </p>
                      <p className="text-xl font-bold">
                        {new Date(reservation.use_date).getDate()}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">{reservation.company_name || reservation.manager_name}</p>
                      <p className="text-sm text-gray-500">
                        {productTypeLabels[reservation.product_type] || reservation.product_type} · {reservation.people_count}명
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    paymentStatusLabels[reservation.payment_status]?.color || 'bg-gray-100 text-gray-700'
                  }`}>
                    {paymentStatusLabels[reservation.payment_status]?.label || reservation.payment_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
