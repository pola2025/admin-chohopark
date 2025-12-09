import crypto from 'crypto'

interface SendSmsParams {
  to: string
  content: string
}

interface SmsResponse {
  success: boolean
  requestId?: string
  error?: string
}

export async function sendSms({ to, content }: SendSmsParams): Promise<SmsResponse> {
  const accessKey = process.env.NCLOUD_ACCESS_KEY
  const secretKey = process.env.NCLOUD_SECRET_KEY
  const serviceId = process.env.NCLOUD_SERVICE_ID
  const callingNumber = process.env.NCLOUD_CALLING_NUMBER

  if (!accessKey || !secretKey || !serviceId || !callingNumber) {
    console.log('SMS 설정이 완료되지 않았습니다. (개발 모드)')
    return { success: true, requestId: 'dev-mode' }
  }

  const timestamp = Date.now().toString()
  const url = `/sms/v2/services/${serviceId}/messages`
  const method = 'POST'

  // Create signature
  const hmac = crypto.createHmac('sha256', secretKey)
  const message = `${method} ${url}\n${timestamp}\n${accessKey}`
  hmac.update(message)
  const signature = hmac.digest('base64')

  const body = {
    type: 'SMS',
    from: callingNumber,
    content,
    messages: [{ to: to.replace(/-/g, '') }],
  }

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

export function replaceTemplateVariables(
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
