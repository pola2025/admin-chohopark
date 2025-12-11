'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

interface AnalyticsData {
  summary: AnalyticsSummary | null;
  daily: DailyData[];
  pages: PageData[];
  sources: TrafficSource[];
  realtimeUsers: number;
}

// 누적 통계 타입
interface CumulativeStats {
  total_users: number;
  total_sessions: number;
  total_page_views: number;
  avg_daily_users: number;
  comparison?: {
    users_change: number;
    sessions_change: number;
    page_views_change: number;
  };
}

interface WeeklyVisitor {
  week_start: string;
  week_end: string;
  year: number;
  week_number: number;
  total_users: number;
  sessions: number;
  page_views: number;
  avg_daily_users: number;
}

interface MonthlyVisitor {
  year: number;
  month: number;
  total_users: number;
  sessions: number;
  page_views: number;
  avg_daily_users: number;
}

interface StoredStats {
  cumulative?: CumulativeStats;
  weekly?: WeeklyVisitor[];
  monthly?: MonthlyVisitor[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [storedStats, setStoredStats] = useState<StoredStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState<'realtime' | 'stored'>('realtime');

  useEffect(() => {
    fetchAnalytics();
    fetchStoredStats();
  }, [days]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/analytics?days=${days}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStoredStats = async () => {
    try {
      const response = await fetch('/api/analytics/stats');
      if (response.ok) {
        const result = await response.json();
        setStoredStats(result);
      }
    } catch (err) {
      console.error('Failed to fetch stored stats:', err);
    }
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

  const formatWeekDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    const color = change >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={color}>{sign}{change.toFixed(1)}%</span>;
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
  const cumulative = storedStats?.cumulative;

  return (
    <div className="space-y-6 pb-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl lg:text-2xl font-bold whitespace-nowrap">방문자 통계</h1>
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Tab 버튼 */}
          <div className="flex bg-gray-100 rounded-lg p-1 flex-shrink-0">
            <button
              onClick={() => setActiveTab('realtime')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'realtime'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              실시간
            </button>
            <button
              onClick={() => setActiveTab('stored')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'stored'
                  ? 'bg-white shadow text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              누적
            </button>
          </div>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-2 py-1.5 border rounded-lg text-sm flex-shrink-0"
          >
            <option value={7}>7일</option>
            <option value={30}>30일</option>
            <option value={90}>90일</option>
          </select>
          <button
            onClick={() => { fetchAnalytics(); fetchStoredStats(); }}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 flex-shrink-0"
            title="새로고침"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Realtime Tab */}
      {activeTab === 'realtime' && (
        <>
          {/* Realtime Users */}
          {data?.realtimeUsers !== undefined && (
            <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
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
                  <p className="text-2xl font-bold text-green-600">{summary.newUsers.toLocaleString()}</p>
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
                            className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors relative group"
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
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
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

      {/* Stored Stats Tab */}
      {activeTab === 'stored' && (
        <>
          {/* 자동 동기화 안내 */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>매일 새벽 3시(KST) 자동 동기화됩니다</span>
            </div>
            <span className="text-xs text-blue-500">
              {storedStats?.weekly?.[0]?.week_end
                ? `마지막 데이터: ${storedStats.weekly[0].week_end}`
                : '아직 동기화된 데이터가 없습니다'}
            </span>
          </div>

          {/* Cumulative Stats */}
          {cumulative ? (
            <>
              <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                <CardHeader>
                  <CardTitle className="text-lg text-white">전체 누적 통계</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-indigo-100 text-sm">총 방문자 (누적)</p>
                      <p className="text-3xl font-bold">{cumulative.total_users.toLocaleString()}</p>
                      {cumulative.comparison && (
                        <p className="text-sm mt-1 text-white/80">
                          전월 대비 {formatChange(cumulative.comparison.users_change)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm">총 세션 (누적)</p>
                      <p className="text-3xl font-bold">{cumulative.total_sessions.toLocaleString()}</p>
                      {cumulative.comparison && (
                        <p className="text-sm mt-1 text-white/80">
                          전월 대비 {formatChange(cumulative.comparison.sessions_change)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm">총 페이지뷰 (누적)</p>
                      <p className="text-3xl font-bold">{cumulative.total_page_views.toLocaleString()}</p>
                      {cumulative.comparison && (
                        <p className="text-sm mt-1 text-white/80">
                          전월 대비 {formatChange(cumulative.comparison.page_views_change)}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm">일평균 방문자</p>
                      <p className="text-3xl font-bold">{cumulative.avg_daily_users.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">주간 통계</CardTitle>
                </CardHeader>
                <CardContent>
                  {storedStats?.weekly && storedStats.weekly.length > 0 ? (
                    <div className="space-y-4">
                      {/* 주간 차트 */}
                      <div className="h-48 flex items-end gap-2">
                        {storedStats.weekly.slice(0, 8).reverse().map((week, index) => {
                          const maxUsers = Math.max(...storedStats.weekly!.slice(0, 8).map((w) => w.total_users));
                          const height = maxUsers > 0 ? (week.total_users / maxUsers) * 100 : 0;
                          return (
                            <div
                              key={index}
                              className="flex-1 bg-purple-500 rounded-t hover:bg-purple-600 transition-colors relative group"
                              style={{ height: `${Math.max(height, 2)}%` }}
                            >
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                {week.year}년 {week.week_number}주차: {week.total_users.toLocaleString()}명
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* 주간 테이블 */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3 font-medium text-gray-500">기간</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-500">방문자</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-500">세션</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-500">페이지뷰</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-500">일평균</th>
                            </tr>
                          </thead>
                          <tbody>
                            {storedStats.weekly.slice(0, 8).map((week, index) => (
                              <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-2 px-3">
                                  <span className="font-medium">{week.year}년 {week.week_number}주차</span>
                                  <br />
                                  <span className="text-xs text-gray-500">
                                    {formatWeekDate(week.week_start)} ~ {formatWeekDate(week.week_end)}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-right font-semibold text-blue-600">
                                  {week.total_users.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right">{week.sessions.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right">{week.page_views.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right text-gray-500">
                                  {Math.round(week.avg_daily_users).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">저장된 주간 데이터가 없습니다</p>
                      <p className="text-sm text-gray-400 mt-2">매일 새벽 3시에 자동 동기화됩니다</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Monthly Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">월간 통계</CardTitle>
                </CardHeader>
                <CardContent>
                  {storedStats?.monthly && storedStats.monthly.length > 0 ? (
                    <div className="space-y-4">
                      {/* 월간 차트 */}
                      <div className="h-48 flex items-end gap-3">
                        {storedStats.monthly.slice(0, 6).reverse().map((month, index) => {
                          const maxUsers = Math.max(...storedStats.monthly!.slice(0, 6).map((m) => m.total_users));
                          const height = maxUsers > 0 ? (month.total_users / maxUsers) * 100 : 0;
                          return (
                            <div
                              key={index}
                              className="flex-1 bg-amber-500 rounded-t hover:bg-amber-600 transition-colors relative group"
                              style={{ height: `${Math.max(height, 2)}%` }}
                            >
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                {month.year}년 {month.month}월: {month.total_users.toLocaleString()}명
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {/* 월간 테이블 */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3 font-medium text-gray-500">기간</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-500">방문자</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-500">세션</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-500">페이지뷰</th>
                              <th className="text-right py-2 px-3 font-medium text-gray-500">일평균</th>
                            </tr>
                          </thead>
                          <tbody>
                            {storedStats.monthly.slice(0, 6).map((month, index) => (
                              <tr key={index} className="border-b last:border-0 hover:bg-gray-50">
                                <td className="py-2 px-3 font-medium">{month.year}년 {month.month}월</td>
                                <td className="py-2 px-3 text-right font-semibold text-blue-600">
                                  {month.total_users.toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-right">{month.sessions.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right">{month.page_views.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right text-gray-500">
                                  {Math.round(month.avg_daily_users).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500">저장된 월간 데이터가 없습니다</p>
                      <p className="text-sm text-gray-400 mt-2">매일 새벽 3시에 자동 동기화됩니다</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="p-8">
                <div className="text-center">
                  <p className="text-gray-500 mb-2">저장된 누적 통계가 없습니다</p>
                  <p className="text-sm text-gray-400">
                    매일 새벽 3시(KST)에 GA4 데이터가 자동 동기화됩니다
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
