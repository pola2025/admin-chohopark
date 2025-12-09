'use client'

import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'

interface Reservation {
  id: number
  use_date: string
  company_name: string | null
  manager_name: string
  product_type: string
  people_count: number
  payment_status: string
}

interface ReservationCalendarProps {
  reservations: Reservation[]
}

const productTypeLabels: Record<string, string> = {
  overnight: '워크샵',
  daytrip: '야유회',
  training: '수련회',
}

const productTypeColors: Record<string, { bg: string; text: string; dot: string }> = {
  overnight: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  daytrip: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  training: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
}

const paymentStatusLabels: Record<string, string> = {
  pending: '미결제',
  partial: '부분결제',
  completed: '완료',
}

const paymentStatusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

export function ReservationCalendar({ reservations }: ReservationCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  // 예약 날짜별로 그룹화
  const reservationsByDate = reservations.reduce((acc, res) => {
    const dateKey = res.use_date
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(res)
    return acc
  }, {} as Record<string, Reservation[]>)

  const reservedDates = Object.keys(reservationsByDate).map(d => new Date(d))

  // 선택된 날짜의 예약 또는 전체 예약
  const displayReservations = selectedDate
    ? reservations.filter(res => res.use_date === selectedDate.toISOString().split('T')[0])
    : reservations

  const handleDateSelect = (date: Date | undefined) => {
    if (date && selectedDate && date.getTime() === selectedDate.getTime()) {
      setSelectedDate(undefined)
    } else {
      setSelectedDate(date)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* 달력 - 모바일 반응형 */}
      <div className="flex-shrink-0 overflow-x-auto">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          modifiers={{
            reserved: reservedDates,
          }}
          modifiersClassNames={{
            reserved: 'bg-amber-100 text-amber-800 font-semibold',
          }}
          className="rounded-lg border p-2 sm:p-4"
          classNames={{
            months: 'flex flex-col',
            month: 'space-y-2 sm:space-y-4',
            month_caption: 'flex justify-center pt-1 relative items-center mb-2 sm:mb-4',
            caption_label: 'text-sm sm:text-base font-semibold',
            nav: 'flex items-center gap-1',
            button_previous: 'absolute left-0 sm:left-1 h-7 w-7 sm:h-8 sm:w-8 bg-transparent p-0 opacity-50 hover:opacity-100 flex items-center justify-center rounded-md hover:bg-gray-100',
            button_next: 'absolute right-0 sm:right-1 h-7 w-7 sm:h-8 sm:w-8 bg-transparent p-0 opacity-50 hover:opacity-100 flex items-center justify-center rounded-md hover:bg-gray-100',
            month_grid: 'w-full border-collapse',
            weekdays: 'flex',
            weekday: 'text-gray-500 rounded-md w-8 sm:w-10 lg:w-12 h-8 sm:h-10 font-medium text-xs sm:text-sm flex items-center justify-center',
            week: 'flex w-full',
            day: 'h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-center text-xs sm:text-sm p-0 relative focus-within:relative focus-within:z-20',
            day_button: cn(
              'h-7 w-7 sm:h-9 sm:w-9 lg:h-10 lg:w-10 p-0 font-normal rounded-lg text-xs sm:text-sm',
              'hover:bg-gray-100 focus:bg-gray-100 transition-colors'
            ),
            selected: 'bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white focus:bg-emerald-600 focus:text-white rounded-lg font-semibold',
            today: 'ring-2 ring-emerald-500 ring-inset rounded-lg',
            outside: 'text-gray-300',
            disabled: 'text-gray-300 cursor-not-allowed',
          }}
        />

        {/* 범례 - 상품별 색상 */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mt-3 sm:mt-4 px-1 sm:px-2 text-[10px] sm:text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-amber-100 border border-amber-300"></span> 예약
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-blue-500"></span> 워크샵
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-emerald-500"></span> 야유회
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-purple-500"></span> 수련회
          </span>
        </div>
      </div>

      {/* 예약 목록 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">
            {selectedDate
              ? `${selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 예약`
              : '이번 달 예약'
            }
          </h4>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(undefined)}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              전체 보기
            </button>
          )}
        </div>

        {displayReservations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-gray-400">
            <svg className="w-10 h-10 sm:w-12 sm:h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs sm:text-sm">
              {selectedDate ? '이 날짜에 예약이 없습니다' : '예정된 예약이 없습니다'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] sm:max-h-[320px] overflow-y-auto pr-1">
            {displayReservations.map((res) => {
              const productColor = productTypeColors[res.product_type] || productTypeColors.overnight
              return (
                <div
                  key={res.id}
                  className={cn(
                    'flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg cursor-pointer transition-colors',
                    productColor.bg,
                    'hover:opacity-80'
                  )}
                  onClick={() => {
                    const date = new Date(res.use_date)
                    setSelectedDate(date)
                  }}
                >
                  {/* 상품 타입 표시 */}
                  <div className={cn(
                    'w-1 sm:w-1.5 h-10 sm:h-12 rounded-full flex-shrink-0',
                    productColor.dot
                  )} />

                  <div className="text-center min-w-[36px] sm:min-w-[44px] py-1 bg-white rounded-md shadow-sm">
                    <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase">
                      {new Date(res.use_date).toLocaleDateString('ko-KR', { month: 'short' })}
                    </p>
                    <p className="text-base sm:text-lg font-bold text-gray-800">
                      {new Date(res.use_date).getDate()}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium',
                        productColor.bg,
                        productColor.text
                      )}>
                        {productTypeLabels[res.product_type] || res.product_type}
                      </span>
                    </div>
                    <p className="font-medium truncate text-gray-800 text-xs sm:text-sm">
                      {res.company_name || res.manager_name}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-500">
                      {res.people_count}명
                    </p>
                  </div>

                  <span
                    className={cn(
                      'px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-medium flex-shrink-0',
                      paymentStatusColors[res.payment_status] || 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {paymentStatusLabels[res.payment_status] || res.payment_status}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* 결제 상태 범례 */}
        <div className="flex gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 border-t text-[10px] sm:text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> 미결제
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> 부분결제
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 완료
          </span>
        </div>
      </div>
    </div>
  )
}
