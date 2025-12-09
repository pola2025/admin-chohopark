'use client'

import { useState, useEffect } from 'react'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
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
}

export default function SmsPage() {
  const [schedules, setSchedules] = useState<SmsSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const fetchSchedules = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') params.set('status', filter)

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
  }, [filter])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">SMS 관리</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
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
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Label>상태</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="pending">대기</SelectItem>
                <SelectItem value="sent">발송완료</SelectItem>
                <SelectItem value="failed">실패</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>SMS 스케줄 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-gray-500">로딩 중...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-10 text-gray-500">스케줄이 없습니다</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>예정 시간</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>수신자</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>발송 시간</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      {new Date(s.scheduled_at).toLocaleString('ko-KR')}
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
                      {s.sent_at ? new Date(s.sent_at).toLocaleString('ko-KR') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
