import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('=== SMS 디버그 시작 ===\n')

  // 1. SMS 스케줄 상태 확인
  const { data: schedules, error: schedError } = await supabase
    .from('sms_schedules')
    .select('*, reservation:reservations(company_name, phone, payment_status)')
    .order('scheduled_at', { ascending: false })
    .limit(10)

  if (schedError) {
    console.log('스케줄 조회 에러:', schedError.message)
  } else {
    console.log('=== 최근 SMS 스케줄 (최근 10건) ===')
    console.log('총', schedules?.length || 0, '건\n')
    schedules?.forEach((s: any, i: number) => {
      console.log(`[${i+1}] ${s.reservation?.company_name || 'N/A'}`)
      console.log(`    연락처: ${s.reservation?.phone}`)
      console.log(`    결제상태: ${s.reservation?.payment_status}`)
      console.log(`    타입: ${s.schedule_type}`)
      console.log(`    예정: ${s.scheduled_at}`)
      console.log(`    상태: ${s.status}`)
      console.log(`    발송: ${s.sent_at || '-'}`)
      console.log('')
    })
  }

  // 2. SMS 로그 확인
  const { data: logs, error: logError } = await supabase
    .from('sms_logs')
    .select('*')
    .order('id', { ascending: false })
    .limit(5)

  if (logError) {
    console.log('로그 조회 에러:', logError.message)
  } else {
    console.log('\n=== SMS 발송 로그 (최근 5건) ===')
    console.log('총', logs?.length || 0, '건\n')
    logs?.forEach((log: any, i: number) => {
      console.log(`[${i+1}] ${log.phone}`)
      console.log(`    상태: ${log.status}`)
      console.log(`    응답:`, JSON.stringify(log.response_data))
      console.log('')
    })
  }
}

main().catch(console.error)
