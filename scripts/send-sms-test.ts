import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// SMS 발송 함수
async function sendSms(to: string, content: string) {
  const accessKey = process.env.NCLOUD_ACCESS_KEY
  const secretKey = process.env.NCLOUD_SECRET_KEY
  const serviceId = process.env.NCLOUD_SERVICE_ID
  const callingNumber = process.env.NCLOUD_CALLING_NUMBER

  if (!accessKey || !secretKey || !serviceId || !callingNumber) {
    console.log('SMS 설정이 완료되지 않았습니다.')
    console.log('환경변수 확인:')
    console.log('  NCLOUD_ACCESS_KEY:', accessKey ? '설정됨' : '없음')
    console.log('  NCLOUD_SECRET_KEY:', secretKey ? '설정됨' : '없음')
    console.log('  NCLOUD_SERVICE_ID:', serviceId ? '설정됨' : '없음')
    console.log('  NCLOUD_CALLING_NUMBER:', callingNumber ? '설정됨' : '없음')
    return { success: false, error: 'SMS 설정 없음' }
  }

  const timestamp = Date.now().toString()
  const url = `/sms/v2/services/${serviceId}/messages`
  const method = 'POST'

  // Create signature
  const hmac = crypto.createHmac('sha256', secretKey)
  const message = `${method} ${url}\n${timestamp}\n${accessKey}`
  hmac.update(message)
  const signature = hmac.digest('base64')

  // 90자 초과 시 LMS로 자동 전환
  const messageType = content.length > 90 ? 'LMS' : 'SMS'

  const body = {
    type: messageType,
    from: callingNumber,
    content,
    messages: [{ to: to.replace(/-/g, '') }],
  }

  console.log('발송 요청:', {
    to: to.replace(/-/g, ''),
    from: callingNumber,
    type: messageType,
    contentLength: content.length,
  })

  try {
    const response = await fetch(`https://sens.apigw.ntruss.com${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': accessKey,
        'x-ncp-apigw-signature-v2': signature,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log('응답:', response.status, data)

    if (response.ok) {
      return { success: true, requestId: data.requestId }
    } else {
      return { success: false, error: data.error || 'SMS 발송 실패' }
    }
  } catch (error) {
    console.error('SMS 발송 오류:', error)
    return { success: false, error: 'SMS 발송 중 오류 발생' }
  }
}

// 템플릿 변수 치환
function replaceTemplateVariables(
  template: string,
  data: {
    company_name?: string | null
    manager_name?: string
    phone?: string
    use_date?: string
    people_count?: number
  }
): string {
  return template
    .replace(/{company_name}/g, data.company_name || data.manager_name || '')
    .replace(/{manager_name}/g, data.manager_name || '')
    .replace(/{phone}/g, data.phone || '')
    .replace(/{use_date}/g, data.use_date || '')
    .replace(/{people_count}/g, String(data.people_count || ''))
}

async function main() {
  const scheduleId = parseInt(process.argv[2] || '1')

  console.log(`\n=== SMS 발송 테스트 (Schedule ID: ${scheduleId}) ===\n`)

  // 스케줄 조회
  const { data: schedule, error: scheduleError } = await supabase
    .from('sms_schedules')
    .select('*, reservation:reservations(*)')
    .eq('id', scheduleId)
    .single()

  if (scheduleError || !schedule) {
    console.log('스케줄을 찾을 수 없습니다:', scheduleError?.message)
    return
  }

  console.log('스케줄 정보:')
  console.log('  ID:', schedule.id)
  console.log('  유형:', schedule.schedule_type)
  console.log('  상태:', schedule.status)
  console.log('  예정 시간:', schedule.scheduled_at)
  console.log('')

  const reservation = schedule.reservation
  if (!reservation) {
    console.log('예약 정보가 없습니다.')
    return
  }

  console.log('예약 정보:')
  console.log('  업체명:', reservation.company_name)
  console.log('  담당자:', reservation.manager_name)
  console.log('  연락처:', reservation.phone)
  console.log('  이용일:', reservation.use_date)
  console.log('  상품:', reservation.product_type)
  console.log('')

  // 템플릿 조회
  const { data: template } = await supabase
    .from('message_templates')
    .select('message_content')
    .eq('product_type', reservation.product_type)
    .eq('schedule_type', schedule.schedule_type)
    .single()

  if (!template) {
    console.log('템플릿을 찾을 수 없습니다.')
    return
  }

  // 메시지 생성
  const message = replaceTemplateVariables(template.message_content, {
    company_name: reservation.company_name,
    manager_name: reservation.manager_name,
    phone: reservation.phone,
    use_date: reservation.use_date,
    people_count: reservation.people_count,
  })

  console.log('발송할 메시지:')
  console.log('---')
  console.log(message)
  console.log('---')
  console.log(`(${message.length}자)\n`)

  // 발송
  console.log('SMS 발송 중...')
  const result = await sendSms(reservation.phone, message)

  if (result.success) {
    console.log('\n✅ SMS 발송 성공!')
    console.log('Request ID:', result.requestId)

    // 상태 업데이트
    await supabase
      .from('sms_schedules')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', scheduleId)

    console.log('스케줄 상태 업데이트 완료')
  } else {
    console.log('\n❌ SMS 발송 실패:', result.error)
  }
}

main()
