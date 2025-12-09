'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { Reservation, PRODUCT_TYPES, PAYMENT_STATUS } from '@/types/reservation'

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [filter, setFilter] = useState({ status: 'all', from: '', to: '' })
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })

  const fetchReservations = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: '20',
      ...(filter.status !== 'all' && { status: filter.status }),
      ...(filter.from && { from: filter.from }),
      ...(filter.to && { to: filter.to }),
    })

    try {
      const res = await fetch(`/api/reservations?${params}`)
      const data = await res.json()
      setReservations(data.data || [])
      setPagination(prev => ({ ...prev, ...data.pagination }))
    } catch {
      toast.error('예약 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [pagination.page, filter])

  useEffect(() => {
    fetchReservations()
  }, [fetchReservations])

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/reservations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('예약이 삭제되었습니다')
        fetchReservations()
      } else {
        toast.error('삭제 실패')
      }
    } catch {
      toast.error('삭제 중 오류 발생')
    }
  }

  const openEditDialog = (reservation: Reservation) => {
    setEditingReservation(reservation)
    setIsDialogOpen(true)
  }

  // 결제 상태 토글
  const togglePaymentStatus = async (reservation: Reservation) => {
    const newStatus = reservation.payment_status === 'paid' ? 'pending' : 'paid'
    try {
      const res = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_status: newStatus }),
      })
      if (res.ok) {
        toast.success(newStatus === 'paid' ? '결제 완료 처리됨' : '미결제로 변경됨')
        fetchReservations()
      } else {
        toast.error('상태 변경 실패')
      }
    } catch {
      toast.error('상태 변경 중 오류 발생')
    }
  }

  const openNewDialog = () => {
    setEditingReservation(null)
    setIsDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">예약 관리</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNewDialog}>+ 새 예약</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingReservation ? '예약 수정' : '새 예약 등록'}
              </DialogTitle>
            </DialogHeader>
            <ReservationForm
              reservation={editingReservation}
              onSuccess={() => {
                setIsDialogOpen(false)
                fetchReservations()
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label>상태</Label>
              <Select value={filter.status} onValueChange={(v) => setFilter(f => ({ ...f, status: v }))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="pending">미결제</SelectItem>
                  <SelectItem value="partial">부분결제</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>시작일</Label>
              <Input
                type="date"
                value={filter.from}
                onChange={(e) => setFilter(f => ({ ...f, from: e.target.value }))}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label>종료일</Label>
              <Input
                type="date"
                value={filter.to}
                onChange={(e) => setFilter(f => ({ ...f, to: e.target.value }))}
                className="w-40"
              />
            </div>
            <Button variant="outline" onClick={() => setFilter({ status: 'all', from: '', to: '' })}>
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>예약 목록 ({pagination.total}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-gray-500">로딩 중...</div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-10 text-gray-500">예약이 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이용일</TableHead>
                    <TableHead>상품</TableHead>
                    <TableHead>업체/담당자</TableHead>
                    <TableHead>인원</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead>예약금</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {new Date(r.use_date).toLocaleDateString('ko-KR')}
                      </TableCell>
                      <TableCell>{PRODUCT_TYPES[r.product_type]}</TableCell>
                      <TableCell>
                        <div>{r.company_name || '-'}</div>
                        <div className="text-sm text-gray-500">{r.manager_name}</div>
                      </TableCell>
                      <TableCell>{r.people_count}명</TableCell>
                      <TableCell>{r.phone}</TableCell>
                      <TableCell>{r.deposit_amount.toLocaleString()}원</TableCell>
                      <TableCell>
                        <button
                          onClick={() => togglePaymentStatus(r)}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 active:scale-95
                            ${r.payment_status === 'paid'
                              ? 'bg-emerald-500 text-white shadow hover:bg-blue-500 hover:shadow-xl hover:-translate-y-1'
                              : 'bg-amber-100 text-amber-700 border border-amber-300 shadow hover:bg-blue-500 hover:text-white hover:border-blue-500 hover:shadow-xl hover:-translate-y-1'
                            }`}
                        >
                          {r.payment_status === 'paid' ? '결제완료' : '미결제'}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(r)}>
                            수정
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(r.id)}>
                            삭제
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === 1}
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  >
                    이전
                  </Button>
                  <span className="py-2 px-4 text-sm">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page === pagination.totalPages}
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// 상품별 인당 가격 (원)
const PRODUCT_PRICES: Record<string, number> = {
  overnight: 99000,  // 1박2일 워크샵: 인당 99,000원
  daytrip: 66000,    // 당일 수련회/야유회: 인당 66,000원
  training: 165000,  // 2박3일 수련회: 인당 165,000원
}

function ReservationForm({
  reservation,
  onSuccess,
}: {
  reservation: Reservation | null
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    use_date: reservation?.use_date || '',
    product_type: reservation?.product_type || 'overnight',
    people_count: reservation?.people_count || 30,
    company_name: reservation?.company_name || '',
    manager_name: reservation?.manager_name || '',
    phone: reservation?.phone || '',
    email: reservation?.email || '',
    deposit_amount: reservation?.deposit_amount || 500000,
    payment_status: reservation?.payment_status || 'pending',
    notes: reservation?.notes || '',
  })

  // 상품 또는 인원 변경 시 예약금 자동 계산
  const updateDepositAmount = (productType: string, peopleCount: number) => {
    const pricePerPerson = PRODUCT_PRICES[productType] || 50000
    const calculatedAmount = pricePerPerson * peopleCount
    setFormData(f => ({ ...f, deposit_amount: calculatedAmount }))
  }

  const handleProductChange = (value: string) => {
    setFormData(f => ({ ...f, product_type: value as 'overnight' | 'daytrip' | 'training' }))
    if (!reservation) {
      updateDepositAmount(value, formData.people_count)
    }
  }

  const handlePeopleCountChange = (value: number) => {
    setFormData(f => ({ ...f, people_count: value }))
    if (!reservation) {
      updateDepositAmount(formData.product_type, value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = reservation
        ? `/api/reservations/${reservation.id}`
        : '/api/reservations'
      const method = reservation ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        toast.success(reservation ? '예약이 수정되었습니다' : '예약이 등록되었습니다')
        onSuccess()
      } else {
        const data = await res.json()
        toast.error(data.error || '처리 실패')
      }
    } catch {
      toast.error('오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>이용일 *</Label>
          <DatePicker
            date={formData.use_date ? parseISO(formData.use_date) : undefined}
            onDateChange={(date) => {
              setFormData(f => ({
                ...f,
                use_date: date ? format(date, 'yyyy-MM-dd') : ''
              }))
            }}
            placeholder="이용일을 선택하세요"
            minDate={new Date()}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product_type">상품 *</Label>
          <Select
            value={formData.product_type}
            onValueChange={handleProductChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRODUCT_TYPES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label} ({(PRODUCT_PRICES[key] || 0).toLocaleString()}원/인)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="company_name">업체명</Label>
          <Input
            id="company_name"
            value={formData.company_name}
            onChange={(e) => setFormData(f => ({ ...f, company_name: e.target.value }))}
            placeholder="(주)회사명"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manager_name">담당자명 *</Label>
          <Input
            id="manager_name"
            value={formData.manager_name}
            onChange={(e) => setFormData(f => ({ ...f, manager_name: e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">연락처 *</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => {
              // 숫자만 추출
              const nums = e.target.value.replace(/\D/g, '')
              // 010-0000-0000 형식으로 포맷
              let formatted = nums
              if (nums.length > 3 && nums.length <= 7) {
                formatted = nums.slice(0, 3) + '-' + nums.slice(3)
              } else if (nums.length > 7) {
                formatted = nums.slice(0, 3) + '-' + nums.slice(3, 7) + '-' + nums.slice(7, 11)
              }
              setFormData(f => ({ ...f, phone: formatted }))
            }}
            placeholder="010-1234-5678"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData(f => ({ ...f, email: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="people_count">인원 *</Label>
          <Input
            id="people_count"
            type="number"
            value={formData.people_count}
            onChange={(e) => handlePeopleCountChange(parseInt(e.target.value) || 1)}
            min={1}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_status">결제상태</Label>
          <Select
            value={formData.payment_status}
            onValueChange={(v) => setFormData(f => ({ ...f, payment_status: v as 'pending' | 'partial' | 'completed' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_STATUS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="deposit_amount">예약금 *</Label>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Input
              id="deposit_amount"
              type="text"
              value={formData.deposit_amount.toLocaleString()}
              onChange={(e) => {
                const value = parseInt(e.target.value.replace(/,/g, '')) || 0
                setFormData(f => ({ ...f, deposit_amount: value }))
              }}
              className="pr-8"
              required
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">원</span>
          </div>
          <p className="text-sm text-gray-500 whitespace-nowrap">
            {PRODUCT_PRICES[formData.product_type]?.toLocaleString()}원 × {formData.people_count}명 = {(PRODUCT_PRICES[formData.product_type] * formData.people_count).toLocaleString()}원
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">메모</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={loading}>
          {loading ? '처리 중...' : reservation ? '수정' : '등록'}
        </Button>
      </div>
    </form>
  )
}
