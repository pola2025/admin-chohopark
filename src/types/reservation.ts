export interface Reservation {
  id: number
  use_date: string
  product_type: 'overnight' | 'daytrip' | 'training'
  people_count: number
  company_name: string | null
  manager_name: string
  phone: string
  email: string | null
  deposit_amount: number
  payment_status: 'pending' | 'partial' | 'completed'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ReservationFormData {
  use_date: string
  product_type: string
  people_count: number
  company_name: string
  manager_name: string
  phone: string
  email: string
  deposit_amount: number
  payment_status: string
  notes: string
}

export const PRODUCT_TYPES = {
  overnight: '1박2일 워크샵',
  daytrip: '당일 야유회',
  training: '2박3일 수련회',
} as const

export const PAYMENT_STATUS = {
  pending: { label: '미결제', color: 'bg-amber-100 text-amber-700' },
  partial: { label: '부분결제', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '완료', color: 'bg-emerald-100 text-emerald-700' },
} as const
