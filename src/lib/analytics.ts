import { BetaAnalyticsDataClient } from '@google-analytics/data';

// GA4 속성 ID
const propertyId = process.env.GA4_PROPERTY_ID;

// 서비스 계정 인증
const analyticsDataClient = new BetaAnalyticsDataClient({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

export interface AnalyticsData {
  totalUsers: number;
  newUsers: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number;
  bounceRate: number;
}

export interface DailyData {
  date: string;
  users: number;
  sessions: number;
  pageViews: number;
}

export interface PageData {
  path: string;
  title: string;
  views: number;
}

export interface TrafficSource {
  source: string;
  users: number;
  sessions: number;
}

// 기본 통계 조회 (오늘 ~ N일 전)
export async function getAnalyticsSummary(days: number = 30): Promise<AnalyticsData | null> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return null;
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: `${days}daysAgo`,
          endDate: 'today',
        },
      ],
      metrics: [
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
        { name: 'bounceRate' },
      ],
    });

    if (response.rows && response.rows.length > 0) {
      const row = response.rows[0];
      return {
        totalUsers: parseInt(row.metricValues?.[0]?.value || '0'),
        newUsers: parseInt(row.metricValues?.[1]?.value || '0'),
        sessions: parseInt(row.metricValues?.[2]?.value || '0'),
        pageViews: parseInt(row.metricValues?.[3]?.value || '0'),
        avgSessionDuration: parseFloat(row.metricValues?.[4]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[5]?.value || '0') * 100,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    return null;
  }
}

// 일별 데이터 조회
export async function getDailyAnalytics(days: number = 30): Promise<DailyData[]> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: `${days}daysAgo`,
          endDate: 'today',
        },
      ],
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
      ],
      orderBys: [
        {
          dimension: { dimensionName: 'date' },
          desc: false,
        },
      ],
    });

    if (response.rows) {
      return response.rows.map((row) => ({
        date: row.dimensionValues?.[0]?.value || '',
        users: parseInt(row.metricValues?.[0]?.value || '0'),
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
        pageViews: parseInt(row.metricValues?.[2]?.value || '0'),
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching daily analytics:', error);
    return [];
  }
}

// 인기 페이지 조회
export async function getTopPages(days: number = 30, limit: number = 10): Promise<PageData[]> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: `${days}daysAgo`,
          endDate: 'today',
        },
      ],
      dimensions: [
        { name: 'pagePath' },
        { name: 'pageTitle' },
      ],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [
        {
          metric: { metricName: 'screenPageViews' },
          desc: true,
        },
      ],
      limit,
    });

    if (response.rows) {
      return response.rows.map((row) => ({
        path: row.dimensionValues?.[0]?.value || '',
        title: row.dimensionValues?.[1]?.value || '',
        views: parseInt(row.metricValues?.[0]?.value || '0'),
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching top pages:', error);
    return [];
  }
}

// 트래픽 소스 조회
export async function getTrafficSources(days: number = 30): Promise<TrafficSource[]> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: `${days}daysAgo`,
          endDate: 'today',
        },
      ],
      dimensions: [{ name: 'sessionSource' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
      ],
      orderBys: [
        {
          metric: { metricName: 'sessions' },
          desc: true,
        },
      ],
      limit: 10,
    });

    if (response.rows) {
      return response.rows.map((row) => ({
        source: row.dimensionValues?.[0]?.value || '(direct)',
        users: parseInt(row.metricValues?.[0]?.value || '0'),
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching traffic sources:', error);
    return [];
  }
}

// 실시간 사용자 수 (최근 30분)
export async function getRealtimeUsers(): Promise<number> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return 0;
  }

  try {
    const [response] = await analyticsDataClient.runRealtimeReport({
      property: `properties/${propertyId}`,
      metrics: [{ name: 'activeUsers' }],
    });

    if (response.rows && response.rows.length > 0) {
      return parseInt(response.rows[0].metricValues?.[0]?.value || '0');
    }

    return 0;
  } catch (error) {
    console.error('Error fetching realtime users:', error);
    return 0;
  }
}
