'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface Template {
  id: number
  product_type: string
  schedule_type: string
  message_content: string
}

const PRODUCT_TYPES: Record<string, string> = {
  overnight: '1박2일 워크샵',
  daytrip: '당일 야유회',
  training: '2박3일 수련회',
}

const SCHEDULE_TYPES: Record<string, string> = {
  d_minus_1: 'D-1 안내',
  d_day_morning: '당일 아침',
  before_meal: '식사 안내',
  before_close: '퇴실 안내',
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates')
      const data = await res.json()
      setTemplates(data.data || [])
    } catch {
      toast.error('템플릿을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const startEdit = (template: Template) => {
    setEditingId(template.id)
    setEditContent(template.message_content)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const saveEdit = async (id: number) => {
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_content: editContent }),
      })

      if (res.ok) {
        toast.success('템플릿이 수정되었습니다')
        setEditingId(null)
        fetchTemplates()
      } else {
        toast.error('수정 실패')
      }
    } catch {
      toast.error('오류 발생')
    }
  }

  // Group by product type
  const groupedTemplates = templates.reduce((acc, template) => {
    if (!acc[template.product_type]) {
      acc[template.product_type] = []
    }
    acc[template.product_type].push(template)
    return acc
  }, {} as Record<string, Template[]>)

  if (loading) {
    return <div className="text-center py-10 text-gray-500">로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">메시지 템플릿</h1>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        <strong>사용 가능한 변수:</strong>
        <div className="mt-2 flex flex-wrap gap-2">
          <code className="bg-amber-100 px-2 py-1 rounded">{'{company_name}'}</code>
          <code className="bg-amber-100 px-2 py-1 rounded">{'{manager_name}'}</code>
          <code className="bg-amber-100 px-2 py-1 rounded">{'{phone}'}</code>
          <code className="bg-amber-100 px-2 py-1 rounded">{'{use_date}'}</code>
          <code className="bg-amber-100 px-2 py-1 rounded">{'{people_count}'}</code>
        </div>
      </div>

      {Object.entries(groupedTemplates).map(([productType, productTemplates]) => (
        <Card key={productType}>
          <CardHeader>
            <CardTitle>{PRODUCT_TYPES[productType] || productType}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {productTemplates.map((template) => (
              <div key={template.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-sm text-gray-600">
                    {SCHEDULE_TYPES[template.schedule_type] || template.schedule_type}
                  </span>
                  {editingId === template.id ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveEdit(template.id)}>저장</Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>취소</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startEdit(template)}>
                      수정
                    </Button>
                  )}
                </div>
                {editingId === template.id ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                  />
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                    {template.message_content}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
