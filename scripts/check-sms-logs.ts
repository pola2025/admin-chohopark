import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // SMS 로그 확인
  const { data: logs, error } = await supabase
    .from('sms_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('=== 최근 SMS 발송 로그 ===')
  console.log('총', logs.length, '건\n')

  logs.forEach((log: any, i: number) => {
    console.log(`[${i+1}]`)
    console.log(`    발송시간: ${log.created_at}`)
    console.log(`    수신번호: ${log.phone}`)
    console.log(`    상태: ${log.status}`)
    console.log(`    응답:`, log.response_data)
    console.log('')
  })
}

main()
