import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 대기 중인 SMS 스케줄 조회
  const { data, error } = await supabase
    .from('sms_schedules')
    .select('*, reservation:reservations(company_name, manager_name, phone, product_type, use_date)')
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(10)

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('=== 대기 중인 SMS 스케줄 ===')
  console.log('총', data.length, '건')
  console.log('')

  data.forEach((s: any, i: number) => {
    console.log(`[${i+1}] ID: ${s.id}`)
    console.log(`    예정 시간: ${s.scheduled_at}`)
    console.log(`    유형: ${s.schedule_type}`)
    console.log(`    수신자: ${s.reservation?.company_name || s.reservation?.manager_name}`)
    console.log(`    연락처: ${s.reservation?.phone}`)
    console.log(`    이용일: ${s.reservation?.use_date}`)
    console.log('')
  })
}

main()
