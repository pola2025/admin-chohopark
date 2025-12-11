'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface SmsSchedule {
  id: number
  reservation_id: number
  schedule_type: string
  scheduled_at: string
  sent_at: string | null
  status: string
  reservation?: {
    company_name: string | null
    manager_name: string
    phone: string
    product_type: string
  }
}

const SCHEDULE_TYPES: Record<string, string> = {
  d_minus_1: 'D-1 안내',
  d_day_morning: '당일 아침',
  before_meal: '식사 안내',
  before_close: '퇴실 안내',
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: '대기', color: 'bg-amber-100 text-amber-700' },
  sent: { label: '발송완료', color: 'bg-emerald-100 text-emerald-700' },
  failed: { label: '실패', color: 'bg-red-100 text-red-700' },
  skipped: { label: '건너뜀', color: 'bg-gray-100 text-gray-600' },
}

export default function SmsPage() {
  const [schedules, setSchedules] = useState<SmsSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [viewType, setViewType] = useState<'all' | 'daily' | 'monthly'>('all')
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0] // YYYY-MM-DD
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}` // YYYY-MM
  })

  // 테스트 발송 관련 상태
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('[초호쉼터] 테스트 메시지입니다.')
  const [sending, setSending] = useState(false)

  // 모바일 아코디언 상태
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)
  const [expandedSchedule, setExpandedSchedule] = useState<number | null>(null)

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)
      params.set('viewType', viewType)
      if (viewType === 'daily') params.set('date', selectedDate)
      if (viewType === 'monthly') params.set('date', selectedMonth)

      const res = await fetch(`/api/sms/schedules?${params}`)
      const data = await res.json()
      setSchedules(data.data || [])
    } catch {
      toast.error('SMS 스케줄을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedules()
  }, [filter, viewType, selectedDate, selectedMonth])

  // 테스트 발송 함수
  const handleTestSend = async () => {
    if (!testPhone.trim()) {
      toast.error('전화번호를 입력해주세요')
      return
    }
    if (!testMessage.trim()) {
      toast.error('메시지를 입력해주세요')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/sms/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: testPhone,
          message: testMessage,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('테스트 SMS가 발송되었습니다')
        setTestDialogOpen(false)
        setTestPhone('')
        setTestMessage('[초호쉼터] 테스트 메시지입니다.')
      } else {
        toast.error(data.error || 'SMS 발송 실패')
      }
    } catch {
      toast.error('SMS 발송 중 오류가 발생했습니다')
    } finally {
      setSending(false)
    }
  }

  // 시간을 KST로 표시
  const formatKSTTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">SMS 관리</h1>
        <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              📤 테스트 발송
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>SMS 테스트 발송</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="test-phone">수신 전화번호</Label>
                <Input
                  id="test-phone"
                  placeholder="010-1234-5678"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  실제로 SMS가 발송됩니다. 본인 번호를 입력해주세요.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-message">메시지 내용</Label>
                <Textarea
                  id="test-message"
                  rows={5}
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  {testMessage.length} / 90자 (90자 초과 시 LMS로 발송)
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleTestSend} disabled={sending}>
                  {sending ? '발송 중...' : '발송'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 현재 시간 (KST) 표시 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <strong>⏰ 현재 시간 (KST):</strong>{' '}
        {new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
        <span className="ml-4 text-blue-600">
          모든 시간은 한국 표준시(KST) 기준입니다.
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-600">
              {schedules.filter(s => s.status === 'pending').length}
            </div>
            <p className="text-sm text-gray-500">대기 중</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-emerald-600">
              {schedules.filter(s => s.status === 'sent').length}
            </div>
            <p className="text-sm text-gray-500">발송 완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {schedules.filter(s => s.status === 'failed').length}
            </div>
            <p className="text-sm text-gray-500">실패</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">
              {schedules.filter(s => s.status === 'skipped').length}
            </div>
            <p className="text-sm text-gray-500">건너뜀</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* 기간 필터 */}
            <div className="flex items-center gap-2">
              <Label>기간</Label>
              <Select value={viewType} onValueChange={(v) => setViewType(v as 'all' | 'daily' | 'monthly')}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="daily">일별</SelectItem>
                  <SelectItem value="monthly">월별</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 일별 선택 */}
            {viewType === 'daily' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                />
              </div>
            )}

            {/* 월별 선택 */}
            {viewType === 'monthly' && (
              <div className="flex items-center gap-2">
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-40"
                />
              </div>
            )}

            {/* 상태 필터 */}
            <div className="flex items-center gap-2">
              <Label>상태</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="pending">대기</SelectItem>
                  <SelectItem value="sent">발송완료</SelectItem>
                  <SelectItem value="failed">실패</SelectItem>
                  <SelectItem value="skipped">건너뜀</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={fetchSchedules}>
              🔄 새로고침
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SMS 스케줄 목록 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg">SMS 스케줄 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-gray-500">로딩 중...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-10 text-gray-500">스케줄이 없습니다</div>
          ) : (
            <>
              {/* 모바일 아코디언 뷰 */}
              <div className="lg:hidden space-y-2">
                {(() => {
                  // 업체별로 그룹핑
                  const grouped = schedules.reduce((acc, s) => {
                    const key = s.reservation?.company_name || s.reservation?.manager_name || '미지정'
                    if (!acc[key]) acc[key] = []
                    acc[key].push(s)
                    return acc
                  }, {} as Record<string, SmsSchedule[]>)

                  return Object.entries(grouped).map(([company, items]) => (
                    <div key={company} className="border rounded-lg overflow-hidden">
                      {/* 업체명 헤더 */}
                      <button
                        onClick={() => setExpandedCompany(expandedCompany === company ? null : company)}
                        className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`transition-transform ${expandedCompany === company ? 'rotate-90' : ''}`}>
                            ▶
                          </span>
                          <span className="font-semibold text-gray-900">{company}</span>
                          <span className="text-sm text-gray-500">({items.length}건)</span>
                        </div>
                        <div className="flex gap-1">
                          {items.some(i => i.status === 'pending') && (
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                          )}
                          {items.some(i => i.status === 'sent') && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          )}
                        </div>
                      </button>

                      {/* 스케줄 목록 */}
                      {expandedCompany === company && (
                        <div className="border-t">
                          {items.map((s) => (
                            <div key={s.id} className="border-b last:border-b-0">
                              {/* 스케줄 헤더 */}
                              <button
                                onClick={() => setExpandedSchedule(expandedSchedule === s.id ? null : s.id)}
                                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs transition-transform ${expandedSchedule === s.id ? 'rotate-90' : ''}`}>
                                    ▶
                                  </span>
                                  <span className="text-sm font-medium">
                                    {SCHEDULE_TYPES[s.schedule_type] || s.schedule_type}
                                  </span>
                                </div>
                                <Badge className={`text-xs ${STATUS_LABELS[s.status]?.color}`}>
                                  {STATUS_LABELS[s.status]?.label || s.status}
                                </Badge>
                              </button>

                              {/* 스케줄 상세 */}
                              {expandedSchedule === s.id && (
                                <div className="px-4 pb-3 pt-1 bg-gray-50 space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">예정 시간</span>
                                    <span className="font-medium">{formatKSTTime(s.scheduled_at)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">연락처</span>
                                    <a href={`tel:${s.reservation?.phone}`} className="text-blue-600 font-medium">
                                      {s.reservation?.phone || '-'}
                                    </a>
                                  </div>
                                  {s.sent_at && (
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">발송 시간</span>
                                      <span className="font-medium text-emerald-600">{formatKSTTime(s.sent_at)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                })()}
              </div>

              {/* 데스크톱 테이블 뷰 */}
              <Table className="hidden lg:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>예정 시간 (KST)</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>수신자</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>발송 시간 (KST)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        {formatKSTTime(s.scheduled_at)}
                      </TableCell>
                      <TableCell>{SCHEDULE_TYPES[s.schedule_type] || s.schedule_type}</TableCell>
                      <TableCell>
                        {s.reservation?.company_name || s.reservation?.manager_name || '-'}
                      </TableCell>
                      <TableCell>{s.reservation?.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_LABELS[s.status]?.color}>
                          {STATUS_LABELS[s.status]?.label || s.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.sent_at ? formatKSTTime(s.sent_at) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
