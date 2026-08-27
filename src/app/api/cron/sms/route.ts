import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendSms, replaceTemplateVariables } from '@/lib/sms'

// 텔레그램 알림 발송
async function sendTelegramNotification(message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) return

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })
  } catch (error) {
    console.error('텔레그램 알림 실패:', error)
  }
}

/**
 * 이용일 전후 안내 문자 자동 발송 스위치.
 *
 * 고객에게 실제로 나가는 발송이라 기본은 꺼진 상태다.
 * 문구를 검수한 뒤 SMS_AUTO_SEND 를 'on' 으로 두면 그때부터 나간다.
 * 꺼져 있는 동안에도 예약을 등록하면 발송 일정은 쌓인다.
 */
function autoSendEnabled(): boolean {
  return process.env.SMS_AUTO_SEND?.trim().toLowerCase() === 'on'
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!autoSendEnabled()) {
    return NextResponse.json({
      skipped: true,
      reason: '자동 발송이 꺼져 있습니다 (SMS_AUTO_SEND)',
      sent: 0,
    })
  }

  const now = new Date()
  // GitHub Actions cron은 최대 10분 지연될 수 있으므로 ±15분 윈도우 사용
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
  const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000)

  try {
    // Get pending SMS schedules within the time window
    const { data: schedules, error: schedulesError } = await supabaseAdmin
      .from('sms_schedules')
      .select(`
        *,
        reservation:reservations(*)
      `)
      .eq('status', 'pending')
      .gte('scheduled_at', fifteenMinutesAgo.toISOString())
      .lte('scheduled_at', fifteenMinutesLater.toISOString())

    if (schedulesError) {
      throw schedulesError
    }

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ message: 'No SMS to send', count: 0 })
    }

    const results = []

    for (const schedule of schedules) {
      const reservation = schedule.reservation

      if (!reservation) {
        // Mark as failed if reservation not found
        await supabaseAdmin
          .from('sms_schedules')
          .update({ status: 'failed' })
          .eq('id', schedule.id)
        continue
      }

      // 미결제 상태면 발송하지 않음 (주의: 'paid'가 아닌 'completed' 체크!)
      if (reservation.payment_status !== 'completed') {
        await supabaseAdmin
          .from('sms_schedules')
          .update({ status: 'skipped' })
          .eq('id', schedule.id)
        continue
      }

      // Get message template
      const { data: template } = await supabaseAdmin
        .from('message_templates')
        .select('message_content')
        .eq('product_type', reservation.product_type)
        .eq('schedule_type', schedule.schedule_type)
        .single()

      if (!template) {
        await supabaseAdmin
          .from('sms_schedules')
          .update({ status: 'failed' })
          .eq('id', schedule.id)
        continue
      }

      // Replace variables in template
      const message = replaceTemplateVariables(template.message_content, {
        company_name: reservation.company_name,
        manager_name: reservation.manager_name,
        phone: reservation.phone,
        use_date: reservation.use_date,
        people_count: reservation.people_count,
      })

      // Send SMS
      const smsResult = await sendSms({
        to: reservation.phone,
        content: message,
        companyName: reservation.company_name || reservation.manager_name,
        scheduleType: schedule.schedule_type,
      })

      // Update schedule status
      await supabaseAdmin
        .from('sms_schedules')
        .update({
          status: smsResult.success ? 'sent' : 'failed',
          sent_at: smsResult.success ? new Date().toISOString() : null,
        })
        .eq('id', schedule.id)

      // Log the SMS
      await supabaseAdmin.from('sms_logs').insert({
        reservation_id: reservation.id,
        phone: reservation.phone,
        message,
        status: smsResult.success ? 'sent' : 'failed',
        response_data: smsResult,
      })

      results.push({
        scheduleId: schedule.id,
        companyName: reservation.company_name || reservation.manager_name,
        scheduleType: schedule.schedule_type,
        success: smsResult.success,
      })
    }

    // Cron 실행 결과 텔레그램 알림
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length
    const kstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000).toLocaleString('ko-KR', { timeZone: 'UTC' })

    const scheduleLabels: Record<string, string> = {
      d_minus_7: 'D-7 사전안내',
      d_minus_1: 'D-1 안내',
      d_day_morning: '당일 아침',
      before_meal: '식사 안내',
      before_close: '퇴실 안내',
    }

    let telegramMsg = `🤖 <b>Railway Cron 실행 결과</b>\n\n`
    telegramMsg += `⏰ 실행시간: ${kstTime}\n`
    telegramMsg += `📊 처리: ${results.length}건 (성공 ${successCount}, 실패 ${failCount})\n`

    if (results.length > 0) {
      telegramMsg += `\n<b>상세내역:</b>\n`
      for (const r of results) {
        const typeLabel = scheduleLabels[r.scheduleType] || r.scheduleType
        telegramMsg += `${r.success ? '✅' : '❌'} ${r.companyName} - ${typeLabel}\n`
      }
    }

    await sendTelegramNotification(telegramMsg)

    return NextResponse.json({
      message: 'SMS processing completed',
      count: results.length,
      results,
    })
  } catch (error) {
    console.error('Cron SMS error:', error)

    // 에러 발생 시 텔레그램 알림
    const kstTime = new Date(Date.now() + 9 * 60 * 60 * 1000).toLocaleString('ko-KR', { timeZone: 'UTC' })
    await sendTelegramNotification(
      `❌ <b>Railway Cron 에러</b>\n\n` +
      `⏰ 시간: ${kstTime}\n` +
      `💥 에러: ${error instanceof Error ? error.message : 'Unknown error'}`
    )

    return NextResponse.json(
      { error: 'SMS processing failed' },
      { status: 500 }
    )
  }
}

// Vercel Cron support
export async function GET(request: NextRequest) {
  // For Vercel Cron
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Call POST handler
  return POST(request)
}
