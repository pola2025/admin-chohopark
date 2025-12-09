import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 이모지 제거 함수
function removeEmojis(text: string): string {
  // 이모지 패턴 (대부분의 이모지 커버)
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')  // 이모지
    .replace(/[\u{2600}-\u{26FF}]/gu, '')    // 기타 기호
    .replace(/[\u{2700}-\u{27BF}]/gu, '')    // 딩뱃
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')    // 변형 선택자
    .replace(/[\u{1F000}-\u{1F02F}]/gu, '')  // 마작 타일
    .replace(/[\u{1F0A0}-\u{1F0FF}]/gu, '')  // 카드
}

async function main() {
  console.log('=== 템플릿 이모지 제거 ===\n')

  // 모든 템플릿 조회
  const { data: templates, error } = await supabase
    .from('message_templates')
    .select('*')

  if (error || !templates) {
    console.log('Error:', error?.message)
    return
  }

  console.log('총', templates.length, '개 템플릿 확인\n')

  for (const template of templates) {
    const original = template.message_content
    const cleaned = removeEmojis(original)

    if (original !== cleaned) {
      console.log(`[${template.id}] ${template.product_type} - ${template.schedule_type}`)
      console.log('  이모지 제거됨')

      // 업데이트
      const { error: updateError } = await supabase
        .from('message_templates')
        .update({ message_content: cleaned })
        .eq('id', template.id)

      if (updateError) {
        console.log('  ❌ 업데이트 실패:', updateError.message)
      } else {
        console.log('  ✅ 업데이트 완료')
      }
      console.log('')
    }
  }

  console.log('완료!')
}

main()
