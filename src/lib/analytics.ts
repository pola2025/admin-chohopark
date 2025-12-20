import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { GoogleAuth } from 'google-auth-library';

// GA4 속성 ID
const propertyId = process.env.GA4_PROPERTY_ID;

// Private key 변환 함수 - 모든 \n 변형을 실제 줄바꿈으로 변환
function normalizePrivateKey(key: string): string {
  // 다양한 형태의 \n을 실제 줄바꿈으로 변환
  return key
    .split(String.raw`\n`).join('\n')  // 문자열 "\n"을 실제 줄바꿈으로
    .replace(/\r\n/g, '\n')             // CRLF -> LF
    .trim();
}

// 서비스 계정 인증 설정
function getCredentials(): { client_email: string; private_key: string } | undefined {
  // 방법 1: GOOGLE_APPLICATION_CREDENTIALS_JSON (JSON 전체)
  const jsonCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (jsonCredentials) {
    try {
      const parsed = JSON.parse(jsonCredentials);
      if (parsed.private_key) {
        parsed.private_key = normalizePrivateKey(parsed.private_key);
      }
      console.log('[GA4] Using GOOGLE_APPLICATION_CREDENTIALS_JSON');
      console.log('[GA4] client_email:', parsed.client_email);
      console.log('[GA4] private_key length:', parsed.private_key?.length);
      console.log('[GA4] private_key has real newlines:', parsed.private_key?.includes('\n'));
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      };
    } catch (e) {
      console.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', e);
    }
  }

  // 방법 2: 개별 환경변수
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (email && key) {
    const privateKey = normalizePrivateKey(key);
    console.log('[GA4] Using individual env vars');
    console.log('[GA4] private_key length:', privateKey.length);
    return {
      client_email: email,
      private_key: privateKey,
    };
  }

  console.log('[GA4] No credentials found');
  return undefined;
}

// GoogleAuth를 사용한 인증
function createAnalyticsClient() {
  const credentials = getCredentials();

  if (!credentials) {
    console.error('[GA4] No credentials available');
    return new BetaAnalyticsDataClient();
  }

  const auth = new GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });

  return new BetaAnalyticsDataClient({ auth });
}

const analyticsDataClient = createAnalyticsClient();

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

export interface TrafficSourceMedium {
  source: string;
  medium: string;
  users: number;
  sessions: number;
  bounceRate: number;
}

export interface ChannelGroup {
  channel: string;
  users: number;
  sessions: number;
  pageViews: number;
}

export interface LandingPage {
  page: string;
  sessions: number;
  users: number;
  bounceRate: number;
}

export interface DeviceData {
  device: string;
  users: number;
  sessions: number;
  pageViews: number;
}

export interface CityData {
  city: string;
  users: number;
  sessions: number;
}

export interface BrowserData {
  browser: string;
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

// 소스 + 매체별 트래픽 조회
export async function getTrafficSourceMedium(days: number = 30): Promise<TrafficSourceMedium[]> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [
        { name: 'sessionSource' },
        { name: 'sessionMedium' },
      ],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: 15,
    });

    if (response.rows) {
      return response.rows.map((row) => ({
        source: row.dimensionValues?.[0]?.value || '(direct)',
        medium: row.dimensionValues?.[1]?.value || '(none)',
        users: parseInt(row.metricValues?.[0]?.value || '0'),
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[2]?.value || '0') * 100,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching traffic source/medium:', error);
    return [];
  }
}

// 채널 그룹별 트래픽 조회
export async function getChannelGroups(days: number = 30): Promise<ChannelGroup[]> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    });

    if (response.rows) {
      return response.rows.map((row) => ({
        channel: row.dimensionValues?.[0]?.value || 'Other',
        users: parseInt(row.metricValues?.[0]?.value || '0'),
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
        pageViews: parseInt(row.metricValues?.[2]?.value || '0'),
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching channel groups:', error);
    return [];
  }
}

// 랜딩 페이지 조회
export async function getLandingPages(days: number = 30, limit: number = 10): Promise<LandingPage[]> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'landingPage' }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'bounceRate' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit,
    });

    if (response.rows) {
      return response.rows.map((row) => ({
        page: row.dimensionValues?.[0]?.value || '/',
        sessions: parseInt(row.metricValues?.[0]?.value || '0'),
        users: parseInt(row.metricValues?.[1]?.value || '0'),
        bounceRate: parseFloat(row.metricValues?.[2]?.value || '0') * 100,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching landing pages:', error);
    return [];
  }
}

// 기기별 통계 조회
export async function getDeviceStats(days: number = 30): Promise<DeviceData[]> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    });

    if (response.rows) {
      return response.rows.map((row) => ({
        device: row.dimensionValues?.[0]?.value || 'unknown',
        users: parseInt(row.metricValues?.[0]?.value || '0'),
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
        pageViews: parseInt(row.metricValues?.[2]?.value || '0'),
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching device stats:', error);
    return [];
  }
}

// 도시별 통계 조회
export async function getCityStats(days: number = 30, limit: number = 15): Promise<CityData[]> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'city' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit,
    });

    if (response.rows) {
      return response.rows.map((row) => ({
        city: row.dimensionValues?.[0]?.value || '(not set)',
        users: parseInt(row.metricValues?.[0]?.value || '0'),
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching city stats:', error);
    return [];
  }
}

// 브라우저별 통계 조회
export async function getBrowserStats(days: number = 30, limit: number = 10): Promise<BrowserData[]> {
  if (!propertyId) {
    console.error('GA4_PROPERTY_ID is not set');
    return [];
  }

  try {
    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
      dimensions: [{ name: 'browser' }],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit,
    });

    if (response.rows) {
      return response.rows.map((row) => ({
        browser: row.dimensionValues?.[0]?.value || 'unknown',
        users: parseInt(row.metricValues?.[0]?.value || '0'),
        sessions: parseInt(row.metricValues?.[1]?.value || '0'),
      }));
    }

    return [];
  } catch (error) {
    console.error('Error fetching browser stats:', error);
    return [];
  }
}
