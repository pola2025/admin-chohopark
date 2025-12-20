import crypto from 'crypto'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const accessKey = process.env.NCLOUD_ACCESS_KEY
  const secretKey = process.env.NCLOUD_SECRET_KEY
  const serviceId = process.env.NCLOUD_SERVICE_ID
  const callingNumber = process.env.NCLOUD_CALLING_NUMBER

  console.log('=== NCloud SMS 환경변수 확인 ===')
  console.log('ACCESS_KEY:', accessKey ? accessKey.substring(0, 15) + '...' : 'NOT SET')
  console.log('SECRET_KEY:', secretKey ? secretKey.substring(0, 15) + '...' : 'NOT SET')
  console.log('SERVICE_ID:', serviceId || 'NOT SET')
  console.log('CALLING_NUMBER:', callingNumber || 'NOT SET')

  if (!accessKey || !secretKey || !serviceId || !callingNumber) {
    console.log('\n❌ 환경변수가 설정되지 않았습니다!')
    process.exit(1)
  }

  // 테스트 발송
  const timestamp = Date.now().toString()
  const url = `/sms/v2/services/${serviceId}/messages`
  const method = 'POST'

  const hmac = crypto.createHmac('sha256', secretKey)
  const message = `${method} ${url}\n${timestamp}\n${accessKey}`
  hmac.update(message)
  const signature = hmac.digest('base64')

  const body = {
    type: 'SMS',
    from: callingNumber,
    content: '[초호쉼터] SMS 테스트 발송입니다.',
    messages: [{ to: '01098979834' }],
  }

  console.log('\n=== API 호출 테스트 ===')
  console.log('URL:', `https://sens.apigw.ntruss.com${url}`)

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
    console.log('Status:', response.status)
    console.log('OK:', response.ok)
    console.log('Response:', JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Error:', err)
  }
}

main()
