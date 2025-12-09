'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface Inquiry {
  id: number
  product_name: string
  people_count: number
  customer_name: string
  customer_phone: string
  customer_email: string | null
  customer_company: string | null
  customer_memo: string | null
  total_amount: string | null
  deposit_amount: string | null
  created_at: string
}

export default function InquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null)

  const fetchInquiries = async () => {
    try {
      const res = await fetch('/api/inquiries')
      const data = await res.json()
      setInquiries(data.data || [])
    } catch {
      toast.error('견적 문의를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInquiries()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/inquiries/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('삭제되었습니다')
        fetchInquiries()
      } else {
        toast.error('삭제 실패')
      }
    } catch {
      toast.error('오류 발생')
    }
  }

  const convertToReservation = async (inquiry: Inquiry) => {
    toast.info('예약으로 변환하려면 예약 관리에서 새 예약을 등록하세요')
    setSelectedInquiry(null)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">견적 문의</h1>

      <Card>
        <CardHeader>
          <CardTitle>문의 목록 ({inquiries.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-10 text-gray-500">로딩 중...</div>
          ) : inquiries.length === 0 ? (
            <div className="text-center py-10 text-gray-500">문의가 없습니다</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>접수일</TableHead>
                  <TableHead>상품</TableHead>
                  <TableHead>업체/담당자</TableHead>
                  <TableHead>인원</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inquiry) => (
                  <TableRow key={inquiry.id}>
                    <TableCell>
                      {new Date(inquiry.created_at).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>{inquiry.product_name}</TableCell>
                    <TableCell>
                      <div>{inquiry.customer_company || '-'}</div>
                      <div className="text-sm text-gray-500">{inquiry.customer_name}</div>
                    </TableCell>
                    <TableCell>{inquiry.people_count}명</TableCell>
                    <TableCell>{inquiry.customer_phone}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedInquiry(inquiry)}
                        >
                          상세
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(inquiry.id)}
                        >
                          삭제
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedInquiry} onOpenChange={() => setSelectedInquiry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>문의 상세</DialogTitle>
          </DialogHeader>
          {selectedInquiry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">상품:</span>
                  <span className="ml-2 font-medium">{selectedInquiry.product_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">인원:</span>
                  <span className="ml-2 font-medium">{selectedInquiry.people_count}명</span>
                </div>
                <div>
                  <span className="text-gray-500">업체:</span>
                  <span className="ml-2 font-medium">{selectedInquiry.customer_company || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">담당자:</span>
                  <span className="ml-2 font-medium">{selectedInquiry.customer_name}</span>
                </div>
                <div>
                  <span className="text-gray-500">연락처:</span>
                  <span className="ml-2 font-medium">{selectedInquiry.customer_phone}</span>
                </div>
                <div>
                  <span className="text-gray-500">이메일:</span>
                  <span className="ml-2 font-medium">{selectedInquiry.customer_email || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">예상 금액:</span>
                  <span className="ml-2 font-medium">{selectedInquiry.total_amount || '-'}</span>
                </div>
                <div>
                  <span className="text-gray-500">예약금:</span>
                  <span className="ml-2 font-medium">{selectedInquiry.deposit_amount || '-'}</span>
                </div>
              </div>
              {selectedInquiry.customer_memo && (
                <div>
                  <span className="text-gray-500 text-sm">메모:</span>
                  <p className="mt-1 p-3 bg-gray-50 rounded text-sm">
                    {selectedInquiry.customer_memo}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setSelectedInquiry(null)}>
                  닫기
                </Button>
                <Button onClick={() => convertToReservation(selectedInquiry)}>
                  예약으로 변환
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
