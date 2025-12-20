import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 오늘 날짜 범위 (KST 기준)
  const now = new Date()
  const kstOffset = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffset)

  // 오늘 KST 0시 ~ 23:59
  const todayKstStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate(), 0, 0, 0)
  const todayKstEnd = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate(), 23, 59, 59)

  // UTC로 변환
  const todayUtcStart = new Date(todayKstStart.getTime() - kstOffset)
  const todayUtcEnd = new Date(todayKstEnd.getTime() - kstOffset)

  console.log('현재 KST:', kstNow.toISOString())
  console.log('조회 범위 (UTC):', todayUtcStart.toISOString(), '~', todayUtcEnd.toISOString())

  // 오늘 스케줄된 모든 SMS 조회
  const { data, error } = await supabase
    .from('sms_schedules')
    .select('*, reservation:reservations(company_name, manager_name, phone, product_type, use_date, payment_status)')
    .gte('scheduled_at', todayUtcStart.toISOString())
    .lte('scheduled_at', todayUtcEnd.toISOString())
    .order('scheduled_at', { ascending: true })

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('\n=== 오늘 SMS 스케줄 ===')
  console.log('총', data.length, '건\n')

  data.forEach((s: any, i: number) => {
    const scheduledKst = new Date(new Date(s.scheduled_at).getTime() + kstOffset)
    console.log(`[${i+1}] ID: ${s.id}`)
    console.log(`    상태: ${s.status}`)
    console.log(`    예정 시간 (KST): ${scheduledKst.toLocaleString('ko-KR')}`)
    console.log(`    발송 시간: ${s.sent_at || '(미발송)'}`)
    console.log(`    유형: ${s.schedule_type}`)
    console.log(`    수신자: ${s.reservation?.company_name || s.reservation?.manager_name}`)
    console.log(`    연락처: ${s.reservation?.phone}`)
    console.log(`    이용일: ${s.reservation?.use_date}`)
    console.log(`    결제상태: ${s.reservation?.payment_status}`)
    console.log('')
  })
}

main()
