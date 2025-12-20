import crypto from 'crypto'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const accessKey = process.env.NCLOUD_ACCESS_KEY!
  const secretKey = process.env.NCLOUD_SECRET_KEY!
  const serviceId = process.env.NCLOUD_SERVICE_ID!

  // 최근 발송 requestId (인자로 받거나 기본값)
  const requestId = process.argv[2] || 'RSSA-1765531326701-5397-78003170-MfTSMCSd'

  const timestamp = Date.now().toString()
  const url = `/sms/v2/services/${serviceId}/messages?requestId=${requestId}`
  const method = 'GET'

  const hmac = crypto.createHmac('sha256', secretKey)
  const message = `${method} ${url}\n${timestamp}\n${accessKey}`
  hmac.update(message)
  const signature = hmac.digest('base64')

  console.log('=== SMS 발송 상태 조회 ===')
  console.log('RequestId:', requestId)

  try {
    const response = await fetch(`https://sens.apigw.ntruss.com${url}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': accessKey,
        'x-ncp-apigw-signature-v2': signature,
      },
    })

    const data = await response.json()
    console.log('Status:', response.status)
    console.log('Response:', JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Error:', err)
  }
}

main()
