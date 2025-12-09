'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Template {
  id: number
  product_type: string
  schedule_type: string
  message_content: string
}

const PRODUCT_TABS = [
  { key: 'overnight', label: '1박2일 워크샵', icon: '🏕️' },
  { key: 'daytrip', label: '당일 야유회', icon: '☀️' },
  { key: 'training', label: '2박3일 수련회', icon: '🎯' },
]

const SCHEDULE_TYPES: Record<string, { label: string; color: string }> = {
  d_minus_1: { label: 'D-1 안내', color: 'bg-blue-500' },
  d_day_morning: { label: '당일 아침', color: 'bg-orange-500' },
  before_meal: { label: '식사 안내', color: 'bg-green-500' },
  before_close: { label: '퇴실 안내', color: 'bg-purple-500' },
}

// 발송 시점 데이터
const SEND_SCHEDULE: Record<string, { d_minus_1: string; d_day_morning: string; before_meal: string; before_close: string; timeline: { time: string; label: string; color: string }[] }> = {
  overnight: {
    d_minus_1: '전날 10:00',
    d_day_morning: '당일 08:00',
    before_meal: '당일 17:30',
    before_close: '익일 10:00',
    timeline: [
      { time: '전날 10:00', label: 'D-1 안내', color: 'bg-blue-500' },
      { time: '당일 08:00', label: '당일 아침', color: 'bg-orange-500' },
      { time: '당일 15:00', label: '입실', color: 'bg-gray-400' },
      { time: '당일 17:30', label: '식사 안내', color: 'bg-green-500' },
      { time: '익일 10:00', label: '퇴실 안내', color: 'bg-purple-500' },
      { time: '익일 11:00', label: '퇴실', color: 'bg-gray-400' },
    ]
  },
  daytrip: {
    d_minus_1: '전날 10:00',
    d_day_morning: '당일 08:00',
    before_meal: '당일 11:30',
    before_close: '당일 16:00',
    timeline: [
      { time: '전날 10:00', label: 'D-1 안내', color: 'bg-blue-500' },
      { time: '당일 08:00', label: '당일 아침', color: 'bg-orange-500' },
      { time: '당일 10:00', label: '입실', color: 'bg-gray-400' },
      { time: '당일 11:30', label: '식사 안내', color: 'bg-green-500' },
      { time: '당일 16:00', label: '퇴실 안내', color: 'bg-purple-500' },
      { time: '당일 17:00', label: '퇴실', color: 'bg-gray-400' },
    ]
  },
  training: {
    d_minus_1: '전날 10:00',
    d_day_morning: '당일 08:00',
    before_meal: '당일 17:30',
    before_close: '3일차 10:00',
    timeline: [
      { time: '전날 10:00', label: 'D-1 안내', color: 'bg-blue-500' },
      { time: '당일 08:00', label: '당일 아침', color: 'bg-orange-500' },
      { time: '당일 15:00', label: '입실', color: 'bg-gray-400' },
      { time: '당일 17:30', label: '식사 안내', color: 'bg-green-500' },
      { time: '3일차 10:00', label: '퇴실 안내', color: 'bg-purple-500' },
      { time: '3일차 11:00', label: '퇴실', color: 'bg-gray-400' },
    ]
  },
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overnight')
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

  // 현재 탭의 템플릿만 필터링
  const currentTemplates = templates
    .filter(t => t.product_type === activeTab)
    .sort((a, b) => {
      const order = ['d_minus_1', 'd_day_morning', 'before_meal', 'before_close']
      return order.indexOf(a.schedule_type) - order.indexOf(b.schedule_type)
    })

  if (loading) {
    return <div className="text-center py-10 text-gray-500">로딩 중...</div>
  }

  return (
    <div className="space-y-6 max-w-4xl pb-[300px]">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">메시지 템플릿</h1>
      </div>

      {/* 변수 안내 */}
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

      {/* 상품별 탭 */}
      <div className="flex gap-2 border-b">
        {PRODUCT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-3 font-medium text-sm transition-all border-b-2 -mb-[2px]',
              activeTab === tab.key
                ? 'border-green-600 text-green-600 bg-green-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            )}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 발송 타임라인 시각화 */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span>📤</span> 발송 타임라인
          </h3>
          <div className="relative">
            {/* 타임라인 선 */}
            <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 rounded" />

            {/* 타임라인 포인트들 */}
            <div className="relative flex justify-between">
              {SEND_SCHEDULE[activeTab]?.timeline.map((item, index) => (
                <div key={index} className="flex flex-col items-center" style={{ width: `${100 / SEND_SCHEDULE[activeTab].timeline.length}%` }}>
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10',
                    item.color
                  )}>
                    {item.label === '입실' || item.label === '퇴실' ? '⏰' : '📩'}
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-xs font-medium text-gray-600">{item.time}</p>
                    <p className={cn(
                      'text-xs font-semibold mt-1',
                      item.label === '입실' || item.label === '퇴실' ? 'text-gray-500' : 'text-gray-800'
                    )}>
                      {item.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 선택된 상품의 템플릿 */}
      <div className="grid gap-4">
        {currentTemplates.map((template) => {
          const scheduleInfo = SCHEDULE_TYPES[template.schedule_type] || { label: template.schedule_type, color: 'bg-gray-500' }

          return (
            <Card key={template.id} className="overflow-hidden">
              <div className={cn('px-4 py-2 text-white font-medium', scheduleInfo.color)}>
                {scheduleInfo.label}
              </div>
              <CardContent className="p-4">
                <div className="flex justify-end mb-2">
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
                    rows={10}
                    className="font-mono text-sm"
                  />
                ) : (
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 text-sm whitespace-pre-wrap font-mono border border-green-200">
                    {template.message_content}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
