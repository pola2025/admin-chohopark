import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // pending 상태인 스케줄을 찾아서 현재 시간으로 변경
  const { data: pending, error } = await supabase
    .from('sms_schedules')
    .select('id, schedule_type, scheduled_at')
    .eq('status', 'pending')
    .limit(1)
    .single()

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('Found pending schedule:', pending)

  // 현재 시간으로 업데이트
  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('sms_schedules')
    .update({ scheduled_at: now })
    .eq('id', pending.id)

  if (updateError) {
    console.log('Update error:', updateError.message)
  } else {
    console.log('Updated scheduled_at to:', now)
    console.log('\nNow trigger the cron:')
    console.log('curl -X POST "https://admin-chohopark.vercel.app/api/cron/sms" -H "Authorization: Bearer X4yH9kM2pQ6tR8wZ3vB5nL7jF0sD1aE4cU6iO9nG2xM"')
  }
}

main()
