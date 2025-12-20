import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // ID 10번 스케줄 상세 확인
  const { data, error } = await supabase
    .from('sms_schedules')
    .select('*')
    .eq('id', 10)
    .single()

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('=== ID 10 스케줄 상세 ===')
  console.log('scheduled_at (DB):', data.scheduled_at)
  console.log('sent_at:', data.sent_at)
  console.log('status:', data.status)
  console.log('schedule_type:', data.schedule_type)

  // cron 실행 시간 분석 (Railway 로그: 2025-12-12T01:00:35.856Z)
  const cronTime = new Date('2025-12-12T01:00:35.856Z')
  const scheduledTime = new Date(data.scheduled_at)

  console.log('')
  console.log('=== 시간 분석 ===')
  console.log('Cron 실행 시간 (UTC):', cronTime.toISOString(), '= KST', new Date(cronTime.getTime() + 9*60*60*1000).toLocaleString('ko-KR'))
  console.log('스케줄 예정 (UTC):', scheduledTime.toISOString(), '= KST', new Date(scheduledTime.getTime() + 9*60*60*1000).toLocaleString('ko-KR'))

  // ±15분 윈도우 체크
  const fifteenMinutesAgo = new Date(cronTime.getTime() - 15 * 60 * 1000)
  const fifteenMinutesLater = new Date(cronTime.getTime() + 15 * 60 * 1000)

  console.log('')
  console.log('=== Cron 코드의 ±15분 윈도우 ===')
  console.log('윈도우 시작:', fifteenMinutesAgo.toISOString())
  console.log('윈도우 끝:', fifteenMinutesLater.toISOString())
  console.log('스케줄이 윈도우 안에 있나?:', scheduledTime >= fifteenMinutesAgo && scheduledTime <= fifteenMinutesLater)

  // 실제 차이
  const diffMinutes = (scheduledTime.getTime() - cronTime.getTime()) / (1000 * 60)
  console.log('')
  console.log('스케줄과 cron 실행 시간 차이:', diffMinutes.toFixed(0), '분')
}

main()
