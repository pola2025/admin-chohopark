import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendSms, replaceTemplateVariables } from '@/lib/sms'

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
  const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000)

  try {
    // Get pending SMS schedules within the time window
    const { data: schedules, error: schedulesError } = await supabaseAdmin
      .from('sms_schedules')
      .select(`
        *,
        reservation:reservations(*)
      `)
      .eq('status', 'pending')
      .gte('scheduled_at', fiveMinutesAgo.toISOString())
      .lte('scheduled_at', fiveMinutesLater.toISOString())

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
        success: smsResult.success,
      })
    }

    return NextResponse.json({
      message: 'SMS processing completed',
      count: results.length,
      results,
    })
  } catch (error) {
    console.error('Cron SMS error:', error)
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
