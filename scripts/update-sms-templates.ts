/**
 * SMS 템플릿 업데이트 스크립트
 * 실행: npx tsx scripts/update-sms-templates.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env.local 직접 파싱
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=')
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim()
  }
})

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['SUPABASE_SERVICE_ROLE_KEY']
)

// 수정된 SMS 템플릿 (2024-12-09 업데이트)
const UPDATED_TEMPLATES = [
  // ============ 1박2일 워크샵 ============
  {
    product_type: 'overnight',
    schedule_type: 'd_minus_1',
    message_content: `[초호쉼터] {company_name} 담당자님, 내일 워크샵 이용 예정입니다.

▶ 일시: {use_date}
▶ 인원: {people_count}명
▶ 입실: 오후 3시 / 퇴실: 익일 오전 11시

📌 필수 안내사항
• 축구화(스터드) 착용 금지
• 21:30 이후 매너타임
• 개별 앰프 사용 불가
• 오후 3시 전 이용 시 1만원/시간/인당 추가

☕ 초리골164 카페 30% 할인 혜택!

🏠 주소: 경기 파주시 법원읍 초리골길 134
📞 문의: 010-3254-0029`
  },
  {
    product_type: 'overnight',
    schedule_type: 'd_day_morning',
    message_content: `[초호쉼터] {company_name} 담당자님, 오늘 워크샵 일정입니다.

▶ 입실: 오후 3시 (15:00)
▶ 퇴실: 내일 오전 11시
▶ 주차: 대형버스/승용차 가능

⚠️ 오후 3시 전 이용 시 1만원/시간/인당 추가
⚠️ 시간 초과 시 1만원/시간/인당 추가

🏠 경기 파주시 법원읍 초리골길 134
📞 현장: 010-3254-0029`
  },
  {
    product_type: 'overnight',
    schedule_type: 'before_meal',
    message_content: `[초호쉼터] {company_name} 담당자님, 저녁 식사 안내드립니다.

⏰ 저녁 식사: 6시 30분 (18:30~21:30)
🍖 메뉴: 6시간 훈연 바베큐
   - 등갈비/삼겹살/오리
🍺 주류/음료 무한리필

⚠️ 21:30 이후 매너타임 준수

즐거운 식사 되세요!`
  },
  {
    product_type: 'overnight',
    schedule_type: 'before_close',
    message_content: `[초호쉼터] {company_name} 담당자님, 퇴실 안내드립니다.

⏰ 퇴실: 오전 11시 (11:00)
☕ 조식: 8시 30분~10시

⚠️ 퇴실 시간 초과 시
   1만원/시간/인당 추가됩니다.

이용해 주셔서 감사합니다!`
  },

  // ============ 당일 야유회 ============
  {
    product_type: 'daytrip',
    schedule_type: 'd_minus_1',
    message_content: `[초호쉼터] {company_name} 담당자님, 내일 야유회 이용 예정입니다.

▶ 일시: {use_date}
▶ 인원: {people_count}명
▶ 입실: 오전 10시 / 퇴실: 오후 5시

📌 필수 안내사항
• 축구화(스터드) 착용 금지
• 개별 앰프 사용 불가
• 17시 퇴실 시간 엄수!
• 오전 10시 전 이용 시 1만원/시간/인당 추가

☕ 초리골164 카페 30% 할인 혜택!

🏠 주소: 경기 파주시 법원읍 초리골길 134
📞 문의: 010-3254-0029`
  },
  {
    product_type: 'daytrip',
    schedule_type: 'd_day_morning',
    message_content: `[초호쉼터] {company_name} 담당자님, 오늘 야유회 일정입니다.

▶ 입실: 오전 10시 (10:00)
▶ 퇴실: 오후 5시 (17:00) ⚠️엄수

⚠️ 오전 10시 전 이용 시 1만원/시간/인당 추가
⚠️ 17시 퇴실 절대 준수
   (초과 시 1만원/시간/인당 추가)

🏠 경기 파주시 법원읍 초리골길 134
📞 현장: 010-3254-0029`
  },
  {
    product_type: 'daytrip',
    schedule_type: 'before_meal',
    message_content: `[초호쉼터] {company_name} 담당자님, 점심 식사 안내드립니다.

⏰ 점심 식사: 12시 (12:00)
🍖 메뉴: 6시간 훈연 바베큐
   - 등갈비/삼겹살/오리
🍺 주류/음료 무한리필

⚠️ 퇴실: 오후 5시 (17:00)
즐거운 식사 되세요!`
  },
  {
    product_type: 'daytrip',
    schedule_type: 'before_close',
    message_content: `[초호쉼터] {company_name} 담당자님, 퇴실 1시간 전입니다.

⏰ 퇴실: 오후 5시 (17:00)

⚠️ 퇴실 시간 엄수 부탁드립니다!
   초과 시 1만원/시간/인 추가

이용해 주셔서 감사합니다!`
  },

  // ============ 2박3일 수련회 ============
  {
    product_type: 'training',
    schedule_type: 'd_minus_1',
    message_content: `[초호쉼터] {company_name} 담당자님, 내일 수련회가 시작됩니다.

▶ 일시: {use_date} (2박3일)
▶ 인원: {people_count}명
▶ 입실: 오후 3시 / 퇴실: 3일차 오전 11시

📌 필수 안내사항
• 축구화(스터드) 착용 금지
• 21:30 이후 매너타임
• 개별 앰프 사용 불가
• 오후 3시 전 이용 시 1만원/시간/인당 추가

☕ 초리골164 카페 30% 할인 혜택!

🏠 주소: 경기 파주시 법원읍 초리골길 134
📞 문의: 010-3254-0029`
  },
  {
    product_type: 'training',
    schedule_type: 'd_day_morning',
    message_content: `[초호쉼터] {company_name} 담당자님, 오늘 수련회가 시작됩니다.

▶ 입실: 오후 3시 (15:00)
▶ 퇴실: 3일차 오전 11시
▶ 주차: 대형버스/승용차 가능

⚠️ 오후 3시 전 이용 시 1만원/시간/인당 추가
⚠️ 시간 초과 시 1만원/시간/인당 추가

🏠 경기 파주시 법원읍 초리골길 134
📞 현장: 010-3254-0029`
  },
  {
    product_type: 'training',
    schedule_type: 'before_meal',
    message_content: `[초호쉼터] {company_name} 담당자님, 저녁 식사 안내드립니다.

⏰ 저녁 식사: 6시 30분 (18:30~21:30)
🍖 메뉴: 6시간 훈연 바베큐
   - 등갈비/삼겹살/오리
🍺 주류/음료 무한리필

⚠️ 21:30 이후 매너타임 준수

즐거운 식사 되세요!`
  },
  {
    product_type: 'training',
    schedule_type: 'before_close',
    message_content: `[초호쉼터] {company_name} 담당자님, 퇴실 안내드립니다.

⏰ 퇴실: 오전 11시 (11:00)
☕ 조식: 8시 30분~10시

⚠️ 퇴실 시간 초과 시
   1만원/시간/인당 추가됩니다.

2박3일 이용해 주셔서 감사합니다!`
  },
]

async function updateTemplates() {
  console.log('SMS 템플릿 업데이트 시작...\n')

  for (const template of UPDATED_TEMPLATES) {
    const { data, error } = await supabase
      .from('message_templates')
      .update({ message_content: template.message_content })
      .eq('product_type', template.product_type)
      .eq('schedule_type', template.schedule_type)
      .select()

    if (error) {
      console.error(`❌ 실패: ${template.product_type} - ${template.schedule_type}`)
      console.error(error.message)
    } else if (data && data.length > 0) {
      console.log(`✅ 업데이트: ${template.product_type} - ${template.schedule_type}`)
    } else {
      // 존재하지 않으면 새로 생성
      const { error: insertError } = await supabase
        .from('message_templates')
        .insert(template)

      if (insertError) {
        console.error(`❌ 생성 실패: ${template.product_type} - ${template.schedule_type}`)
        console.error(insertError.message)
      } else {
        console.log(`🆕 생성: ${template.product_type} - ${template.schedule_type}`)
      }
    }
  }

  console.log('\n✅ SMS 템플릿 업데이트 완료!')
}

updateTemplates()
