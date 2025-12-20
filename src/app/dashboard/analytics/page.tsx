'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// 날짜 유틸리티 함수
function formatDateToString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 기간 프리셋 정의
type PeriodPreset = {
  label: string;
  value: string;
  getRange: () => { startDate: string; endDate: string; days?: number };
};

function getPeriodPresets(): PeriodPreset[] {
  const today = new Date();
  const formatDate = formatDateToString;

  return [
    { label: '7일', value: '7days', getRange: () => ({ days: 7, startDate: '', endDate: '' }) },
    { label: '30일', value: '30days', getRange: () => ({ days: 30, startDate: '', endDate: '' }) },
    { label: '90일', value: '90days', getRange: () => ({ days: 90, startDate: '', endDate: '' }) },
    {
      label: '이번 주',
      value: 'this-week',
      getRange: () => {
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        return { startDate: formatDate(start), endDate: formatDate(today) };
      },
    },
    {
      label: '지난 주',
      value: 'last-week',
      getRange: () => {
        const end = new Date(today);
        end.setDate(today.getDate() - today.getDay() - 1);
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      },
    },
    {
      label: '이번 달',
      value: 'this-month',
      getRange: () => {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { startDate: formatDate(start), endDate: formatDate(today) };
      },
    },
    {
      label: '지난 달',
      value: 'last-month',
      getRange: () => {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        return { startDate: formatDate(start), endDate: formatDate(end) };
      },
    },
  ];
}

interface AnalyticsSummary {
  totalUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
}

interface DailyData {
  date: string;
  users: number;
  sessions: number;
  pageViews: number;
}

interface PageData {
  path: string;
  title: string;
  views: number;
}

interface TrafficSource {
  source: string;
  users: number;
  sessions: number;
}

interface SourceMedium {
  source: string;
  medium: string;
  users: number;
  sessions: number;
  bounceRate: number;
}

interface ChannelGroup {
  channel: string;
  users: number;
  sessions: number;
  pageViews: number;
}

interface LandingPage {
  page: string;
  sessions: number;
  users: number;
  bounceRate: number;
}

interface DeviceData {
  device: string;
  users: number;
  sessions: number;
  pageViews: number;
}

interface CityData {
  city: string;
  users: number;
  sessions: number;
}

interface BrowserData {
  browser: string;
  users: number;
  sessions: number;
}

interface AnalyticsData {
  summary: AnalyticsSummary | null;
  daily: DailyData[];
  pages: PageData[];
  sources: TrafficSource[];
  realtimeUsers: number;
  sourceMedium: SourceMedium[];
  channels: ChannelGroup[];
  landingPages: LandingPage[];
  devices: DeviceData[];
  cities: CityData[];
  browsers: BrowserData[];
  source?: 'ga' | 'airtable' | 'mixed';
}

// 채널 색상 매핑
const channelColors: Record<string, string> = {
  'Organic Search': 'bg-emerald-600',
  Direct: 'bg-blue-500',
  Referral: 'bg-purple-500',
  'Organic Social': 'bg-pink-500',
  'Paid Search': 'bg-orange-500',
  Display: 'bg-yellow-500',
  Email: 'bg-teal-500',
  Affiliates: 'bg-indigo-500',
  Other: 'bg-gray-500',
};

// 기기 아이콘
const deviceIcons: Record<string, string> = {
  desktop: '🖥️',
  mobile: '📱',
  tablet: '📟',
};

// 누적 데이터 섹션 컴포넌트
function CumulativeDataSection({ daily }: { daily: DailyData[] }) {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  if (!daily || daily.length === 0) return null;

  // 주별 데이터 계산
  const getWeeklyData = () => {
    const weeklyMap: Record<string, { users: number; sessions: number; pageViews: number; startDate: string; endDate: string }> = {};

    daily.forEach((d) => {
      try {
        // YYYYMMDD 또는 YYYY-MM-DD 형식 처리
        let year, month, day;
        if (d.date.includes('-')) {
          [year, month, day] = d.date.split('-').map(Number);
        } else {
          year = parseInt(d.date.substring(0, 4));
          month = parseInt(d.date.substring(4, 6));
          day = parseInt(d.date.substring(6, 8));
        }
        const date = new Date(year, month - 1, day);
        if (isNaN(date.getTime())) return;

        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = formatDateToString(weekStart);

        if (!weeklyMap[weekKey]) {
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weeklyMap[weekKey] = {
            users: 0,
            sessions: 0,
            pageViews: 0,
            startDate: weekKey,
            endDate: formatDateToString(weekEnd),
          };
        }
        weeklyMap[weekKey].users += d.users;
        weeklyMap[weekKey].sessions += d.sessions;
        weeklyMap[weekKey].pageViews += d.pageViews;
      } catch {
        // Skip invalid dates
      }
    });

    return Object.entries(weeklyMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, data]) => data);
  };

  // 월별 데이터 계산
  const getMonthlyData = () => {
    const monthlyMap: Record<string, { users: number; sessions: number; pageViews: number; label: string }> = {};

    daily.forEach((d) => {
      let monthKey;
      if (d.date.includes('-')) {
        monthKey = d.date.substring(0, 7);
      } else {
        monthKey = `${d.date.substring(0, 4)}-${d.date.substring(4, 6)}`;
      }
      const [year, month] = monthKey.split('-');

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          users: 0,
          sessions: 0,
          pageViews: 0,
          label: `${year}년 ${parseInt(month)}월`,
        };
      }
      monthlyMap[monthKey].users += d.users;
      monthlyMap[monthKey].sessions += d.sessions;
      monthlyMap[monthKey].pageViews += d.pageViews;
    });

    return Object.entries(monthlyMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([, data]) => data);
  };

  const weeklyData = getWeeklyData();
  const monthlyData = getMonthlyData();

  // 전체 합계
  const totals = daily.reduce(
    (acc, d) => ({
      users: acc.users + d.users,
      sessions: acc.sessions + d.sessions,
      pageViews: acc.pageViews + d.pageViews,
    }),
    { users: 0, sessions: 0, pageViews: 0 }
  );

  const formatDateShort = (dateStr: string) => {
    const [, month, day] = dateStr.split('-');
    return `${parseInt(month)}/${parseInt(day)}`;
  };

  // 일별 데이터 날짜 포맷
  const formatDailyDate = (dateStr: string) => {
    if (dateStr.includes('-')) return dateStr;
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <span>📈</span> 누적 데이터
          </CardTitle>
          <div className="flex gap-1">
            {(['daily', 'weekly', 'monthly'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === mode
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {mode === 'daily' ? '일별' : mode === 'weekly' ? '주별' : '월별'}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 전체 합계 */}
        <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-emerald-50 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-gray-500">총 방문자</p>
            <p className="text-xl font-bold text-emerald-700">{totals.users.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">총 세션</p>
            <p className="text-xl font-bold text-emerald-700">{totals.sessions.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500">총 페이지뷰</p>
            <p className="text-xl font-bold text-emerald-700">{totals.pageViews.toLocaleString()}</p>
          </div>
        </div>

        {/* 테이블 */}
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-gray-600">기간</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">방문자</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">세션</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">페이지뷰</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {viewMode === 'daily' &&
                [...daily]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((d, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="py-2 px-3">{formatDailyDate(d.date)}</td>
                      <td className="py-2 px-3 text-right font-medium text-emerald-700">
                        {d.users.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right">{d.sessions.toLocaleString()}</td>
                      <td className="py-2 px-3 text-right">{d.pageViews.toLocaleString()}</td>
                    </tr>
                  ))}
              {viewMode === 'weekly' &&
                weeklyData.map((w, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <span className="font-medium">{formatDateShort(w.startDate)}</span>
                      <span className="text-gray-400 mx-1">~</span>
                      <span className="font-medium">{formatDateShort(w.endDate)}</span>
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-700">
                      {w.users.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right">{w.sessions.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">{w.pageViews.toLocaleString()}</td>
                  </tr>
                ))}
              {viewMode === 'monthly' &&
                monthlyData.map((m, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{m.label}</td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-700">
                      {m.users.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right">{m.sessions.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right">{m.pageViews.toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// 달력 팝업 컴포넌트
function DatePickerPopup({
  isOpen,
  onClose,
  startDate,
  endDate,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  startDate: string;
  endDate: string;
  onApply: (start: string, end: string) => void;
}) {
  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd] = useState(endDate);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalStart(startDate);
    setLocalEnd(endDate);
  }, [startDate, endDate, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50 min-w-[320px]"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
            <input
              type="date"
              value={localStart}
              onChange={(e) => setLocalStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">종료일</label>
            <input
              type="date"
              value={localEnd}
              onChange={(e) => setLocalEnd(e.target.value)}
              max={formatDateToString(new Date())}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md">
            취소
          </button>
          <button
            onClick={() => {
              if (localStart && localEnd) {
                onApply(localStart, localEnd);
                onClose();
              }
            }}
            disabled={!localStart || !localEnd}
            className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('30days');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'traffic' | 'cumulative'>('overview');

  const periodPresets = getPeriodPresets();

  useEffect(() => {
    fetchAnalytics();
  }, [days, startDate, endDate]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/analytics';
      if (startDate && endDate) {
        url += `?startDate=${startDate}&endDate=${endDate}`;
      } else {
        url += `?days=${days}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = (preset: PeriodPreset) => {
    setSelectedPreset(preset.value);
    const range = preset.getRange();
    if (range.days) {
      setDays(range.days);
      setStartDate('');
      setEndDate('');
    } else if (range.startDate && range.endDate) {
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      setDays(0);
    }
  };

  const handleDatePickerApply = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedPreset('custom');
    setDays(0);
  };

  const getSelectedPeriodLabel = () => {
    if (selectedPreset === 'custom' && startDate && endDate) {
      return `${startDate} ~ ${endDate}`;
    }
    const preset = periodPresets.find((p) => p.value === selectedPreset);
    return preset?.label || '30일';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}분 ${secs}초`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${month}/${day}`;
  };

  const getChannelKorean = (channel: string) => {
    const map: Record<string, string> = {
      'Organic Search': '자연 검색',
      Direct: '직접 방문',
      Referral: '외부 링크',
      'Organic Social': '소셜 미디어',
      'Paid Search': '유료 검색',
      Display: '디스플레이 광고',
      Email: '이메일',
      Affiliates: '제휴',
      Unassigned: '미분류',
    };
    return map[channel] || channel;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">방문자 통계</h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-20 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">방문자 통계</h1>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-500">
              <p className="text-lg font-medium">데이터를 불러오지 못했습니다</p>
              <p className="text-sm mt-2">{error}</p>
              <button
                onClick={fetchAnalytics}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                다시 시도
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-xl lg:text-2xl font-bold">방문자 통계</h1>
            {data?.source && (
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  data.source === 'airtable'
                    ? 'bg-purple-100 text-purple-700'
                    : data.source === 'mixed'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {data.source === 'airtable' ? '캐시' : data.source === 'mixed' ? '혼합' : 'GA4'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Tab 버튼 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'overview' ? 'bg-white shadow text-emerald-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                개요
              </button>
              <button
                onClick={() => setActiveTab('traffic')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'traffic' ? 'bg-white shadow text-emerald-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                유입 분석
              </button>
              <button
                onClick={() => setActiveTab('cumulative')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeTab === 'cumulative' ? 'bg-white shadow text-emerald-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                누적
              </button>
            </div>
            <button
              onClick={fetchAnalytics}
              className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              title="새로고침"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* 기간 선택 UI */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex flex-wrap gap-1">
            {periodPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetSelect(preset)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  selectedPreset === preset.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-gray-300 mx-1"></div>

          {/* 달력 버튼 */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
                selectedPreset === 'custom'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {selectedPreset === 'custom' ? getSelectedPeriodLabel() : '날짜 선택'}
            </button>
            <DatePickerPopup
              isOpen={showDatePicker}
              onClose={() => setShowDatePicker(false)}
              startDate={startDate || formatDateToString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))}
              endDate={endDate || formatDateToString(new Date())}
              onApply={handleDatePickerApply}
            />
          </div>

          <span className="text-sm text-gray-500 ml-2">조회: {getSelectedPeriodLabel()}</span>
        </div>
      </div>

      {/* 개요 탭 */}
      {activeTab === 'overview' && (
        <>
          {/* Realtime Users */}
          {data?.realtimeUsers !== undefined && (
            <Card className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  <span className="text-lg">현재 접속자</span>
                  <span className="text-3xl font-bold ml-auto">{data.realtimeUsers}명</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Stats */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">총 방문자</p>
                  <p className="text-2xl font-bold text-blue-600">{summary.totalUsers.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">신규 방문자</p>
                  <p className="text-2xl font-bold text-emerald-700">{summary.newUsers.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">세션 수</p>
                  <p className="text-2xl font-bold text-purple-600">{summary.sessions.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">페이지뷰</p>
                  <p className="text-2xl font-bold text-amber-600">{summary.pageViews.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">평균 체류시간</p>
                  <p className="text-2xl font-bold text-teal-600">{formatDuration(summary.avgSessionDuration)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">이탈률</p>
                  <p className="text-2xl font-bold text-red-500">{summary.bounceRate.toFixed(1)}%</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">일별 방문자 추이</CardTitle>
              </CardHeader>
              <CardContent>
                {data?.daily && data.daily.length > 0 ? (
                  <div className="space-y-2">
                    <div className="h-48 flex items-end gap-1">
                      {data.daily.slice(-14).map((day, index) => {
                        const maxUsers = Math.max(...data.daily.slice(-14).map((d) => d.users));
                        const height = maxUsers > 0 ? (day.users / maxUsers) * 100 : 0;
                        return (
                          <div
                            key={index}
                            className="flex-1 bg-emerald-600 rounded-t hover:bg-emerald-700 transition-colors relative group"
                            style={{ height: `${Math.max(height, 2)}%` }}
                          >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                              {formatDate(day.date)}: {day.users}명
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{formatDate(data.daily[Math.max(0, data.daily.length - 14)]?.date)}</span>
                      <span>{formatDate(data.daily[data.daily.length - 1]?.date)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">데이터가 없습니다</p>
                )}
              </CardContent>
            </Card>

            {/* Traffic Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">트래픽 소스</CardTitle>
              </CardHeader>
              <CardContent>
                {data?.sources && data.sources.length > 0 ? (
                  <div className="space-y-3">
                    {data.sources.slice(0, 5).map((source, index) => {
                      const maxSessions = Math.max(...data.sources.map((s) => s.sessions));
                      const width = maxSessions > 0 ? (source.sessions / maxSessions) * 100 : 0;
                      return (
                        <div key={index}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{source.source || '(direct)'}</span>
                            <span className="text-gray-500">{source.sessions} 세션</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">데이터가 없습니다</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Pages */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">인기 페이지</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.pages && data.pages.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 text-sm font-medium text-gray-500">페이지</th>
                        <th className="text-right py-2 px-3 text-sm font-medium text-gray-500">조회수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pages.map((page, index) => (
                        <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-3">
                            <p className="font-medium text-sm truncate max-w-xs">{page.title || page.path}</p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">{page.path}</p>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-semibold text-blue-600">{page.views.toLocaleString()}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">데이터가 없습니다</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 유입 분석 탭 */}
      {activeTab === 'traffic' && (
        <>
          {/* 채널 그룹 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>📊</span> 트래픽 채널
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.channels && data.channels.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex h-8 rounded-lg overflow-hidden">
                    {data.channels.map((channel, index) => {
                      const totalSessions = data.channels.reduce((sum, c) => sum + c.sessions, 0);
                      const width = totalSessions > 0 ? (channel.sessions / totalSessions) * 100 : 0;
                      return (
                        <div
                          key={index}
                          className={`${channelColors[channel.channel] || 'bg-gray-400'} relative group`}
                          style={{ width: `${width}%` }}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                            {getChannelKorean(channel.channel)}: {channel.sessions} ({width.toFixed(1)}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {data.channels.map((channel, index) => {
                      const totalSessions = data.channels.reduce((sum, c) => sum + c.sessions, 0);
                      const percent = totalSessions > 0 ? (channel.sessions / totalSessions) * 100 : 0;
                      return (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          <div className={`w-3 h-3 rounded-full ${channelColors[channel.channel] || 'bg-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{getChannelKorean(channel.channel)}</p>
                            <p className="text-xs text-gray-500">
                              {channel.sessions}명 ({percent.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">데이터가 없습니다</p>
              )}
            </CardContent>
          </Card>

          {/* 소스/매체 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <span>🔗</span> 유입 소스 / 매체
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.sourceMedium && data.sourceMedium.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-2 px-3 font-medium text-gray-600">소스 / 매체</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">사용자</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">세션</th>
                        <th className="text-right py-2 px-3 font-medium text-gray-600">이탈률</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sourceMedium.map((item, index) => (
                        <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2 px-3">
                            <span className="font-medium text-blue-600">{item.source}</span>
                            <span className="text-gray-400 mx-1">/</span>
                            <span className="text-gray-600">{item.medium}</span>
                          </td>
                          <td className="py-2 px-3 text-right">{item.users.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right font-medium">{item.sessions.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{item.bounceRate.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">데이터가 없습니다</p>
              )}
            </CardContent>
          </Card>

          {/* 기기, 지역, 브라우저 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 기기별 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>📱</span> 기기
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.devices && data.devices.length > 0 ? (
                  <div className="space-y-3">
                    {data.devices.map((device, index) => {
                      const total = data.devices.reduce((sum, d) => sum + d.sessions, 0);
                      const percent = total > 0 ? (device.sessions / total) * 100 : 0;
                      return (
                        <div key={index} className="flex items-center gap-3">
                          <span className="text-2xl">{deviceIcons[device.device] || '❓'}</span>
                          <div className="flex-1">
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium capitalize">{device.device}</span>
                              <span className="text-gray-500">{percent.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">데이터가 없습니다</p>
                )}
              </CardContent>
            </Card>

            {/* 도시별 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>📍</span> 지역
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.cities && data.cities.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {data.cities.slice(0, 10).map((city, index) => (
                      <div key={index} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                        <span className="font-medium">{city.city === '(not set)' ? '알 수 없음' : city.city}</span>
                        <span className="text-gray-500">{city.sessions}명</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">데이터가 없습니다</p>
                )}
              </CardContent>
            </Card>

            {/* 브라우저별 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>🌐</span> 브라우저
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.browsers && data.browsers.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {data.browsers.map((browser, index) => (
                      <div key={index} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                        <span className="font-medium">{browser.browser}</span>
                        <span className="text-gray-500">{browser.sessions}명</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-4">데이터가 없습니다</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 누적 탭 */}
      {activeTab === 'cumulative' && data?.daily && <CumulativeDataSection daily={data.daily} />}
    </div>
  );
}
