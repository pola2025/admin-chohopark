/**
 * Analytics 데이터를 Airtable에 저장/조회하는 라이브러리
 * GA4 API 호출 제한을 피하기 위한 캐시 용도
 */

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_ANALYTICS_BASE_ID;

const TABLES = {
  summary: process.env.AIRTABLE_ANALYTICS_SUMMARY_TABLE,
  pages: process.env.AIRTABLE_ANALYTICS_PAGES_TABLE,
  sources: process.env.AIRTABLE_ANALYTICS_SOURCES_TABLE,
  devices: process.env.AIRTABLE_ANALYTICS_DEVICES_TABLE,
} as const;

type TableName = keyof typeof TABLES;

interface AirtableRecord {
  id?: string;
  fields: Record<string, unknown>;
}

// Airtable API 호출 헬퍼
async function airtableRequest(
  tableId: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
  params?: Record<string, string>
) {
  if (!AIRTABLE_API_KEY || !BASE_ID) {
    console.warn('[Airtable] API key or Base ID not configured');
    return { records: [] };
  }

  const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Airtable API error: ${JSON.stringify(error)}`);
  }

  return response.json();
}

// 레코드 조회 (날짜 기준)
export async function getRecordsByDate(
  table: TableName,
  date: string
): Promise<AirtableRecord[]> {
  const tableId = TABLES[table];
  if (!tableId) {
    console.warn(`[Airtable] Unknown table: ${table}`);
    return [];
  }

  try {
    const result = await airtableRequest(tableId, 'GET', undefined, {
      filterByFormula: `{date}='${date}'`,
    });
    return result.records || [];
  } catch (error) {
    console.error(`[Airtable] getRecordsByDate error:`, error);
    return [];
  }
}

// 레코드 조회 (날짜 범위)
export async function getRecordsByDateRange(
  table: TableName,
  startDate: string,
  endDate: string
): Promise<AirtableRecord[]> {
  const tableId = TABLES[table];
  if (!tableId) {
    console.warn(`[Airtable] Unknown table: ${table}`);
    return [];
  }

  try {
    const result = await airtableRequest(tableId, 'GET', undefined, {
      filterByFormula: `AND({date}>='${startDate}', {date}<='${endDate}')`,
      'sort[0][field]': 'date',
      'sort[0][direction]': 'desc',
    });
    return result.records || [];
  } catch (error) {
    console.error(`[Airtable] getRecordsByDateRange error:`, error);
    return [];
  }
}

// 레코드 생성
export async function createRecords(
  table: TableName,
  records: Array<Record<string, unknown>>
): Promise<AirtableRecord[]> {
  const tableId = TABLES[table];
  if (!tableId) throw new Error(`Unknown table: ${table}`);

  // Airtable은 한 번에 10개까지만 생성 가능
  const batches: Array<Record<string, unknown>[]> = [];
  for (let i = 0; i < records.length; i += 10) {
    batches.push(records.slice(i, i + 10));
  }

  const allRecords: AirtableRecord[] = [];
  for (const batch of batches) {
    const result = await airtableRequest(tableId, 'POST', {
      records: batch.map((fields) => ({ fields })),
    });
    allRecords.push(...(result.records || []));
  }

  return allRecords;
}

// 레코드 삭제 (날짜 기준)
export async function deleteRecordsByDate(
  table: TableName,
  date: string
): Promise<number> {
  const existing = await getRecordsByDate(table, date);
  if (existing.length === 0) return 0;

  const tableId = TABLES[table];
  if (!tableId) throw new Error(`Unknown table: ${table}`);

  // Airtable은 한 번에 10개까지만 삭제 가능
  const ids = existing.map((r) => r.id).filter(Boolean) as string[];
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    const params: Record<string, string> = {};
    batch.forEach((id, index) => {
      params[`records[${index}]`] = id;
    });
    await airtableRequest(tableId, 'DELETE', undefined, params);
  }

  return ids.length;
}

// Upsert: 있으면 삭제 후 생성 (날짜 기준)
export async function upsertByDate(
  table: TableName,
  date: string,
  records: Array<Record<string, unknown>>
): Promise<{ created: number; deleted: number }> {
  const deleted = await deleteRecordsByDate(table, date);

  if (records.length > 0) {
    await createRecords(table, records);
  }

  return {
    created: records.length,
    deleted,
  };
}

// Summary 데이터 저장
export async function saveSummary(
  date: string,
  data: {
    totalUsers: number;
    newUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionDuration: number;
    bounceRate: number;
  }
) {
  return upsertByDate('summary', date, [
    {
      date,
      ...data,
      syncedAt: new Date().toISOString(),
    },
  ]);
}

// Pages 데이터 저장
export async function savePages(
  date: string,
  pages: Array<{ path: string; title: string; views: number }>
) {
  const records = pages.map((page) => ({
    date,
    ...page,
    syncedAt: new Date().toISOString(),
  }));
  return upsertByDate('pages', date, records);
}

// Sources 데이터 저장
export async function saveSources(
  date: string,
  sources: Array<{ source: string; medium: string; users: number; sessions: number }>
) {
  const records = sources.map((src) => ({
    date,
    ...src,
    syncedAt: new Date().toISOString(),
  }));
  return upsertByDate('sources', date, records);
}

// Devices 데이터 저장
export async function saveDevices(
  date: string,
  devices: Array<{ device: string; users: number; sessions: number; pageViews: number }>
) {
  const records = devices.map((dev) => ({
    date,
    ...dev,
    syncedAt: new Date().toISOString(),
  }));
  return upsertByDate('devices', date, records);
}

// 최신 Summary 조회 (최근 N일)
export async function getLatestSummary(days: number = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const records = await getRecordsByDateRange(
    'summary',
    formatDate(startDate),
    formatDate(endDate)
  );

  return records.map((r) => r.fields);
}

// 최신 Pages 조회
export async function getLatestPages(days: number = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const records = await getRecordsByDateRange(
    'pages',
    formatDate(startDate),
    formatDate(endDate)
  );

  return records.map((r) => r.fields);
}

// 최신 Sources 조회
export async function getLatestSources(days: number = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const records = await getRecordsByDateRange(
    'sources',
    formatDate(startDate),
    formatDate(endDate)
  );

  return records.map((r) => r.fields);
}

// 최신 Devices 조회
export async function getLatestDevices(days: number = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  const records = await getRecordsByDateRange(
    'devices',
    formatDate(startDate),
    formatDate(endDate)
  );

  return records.map((r) => r.fields);
}

// Airtable 설정 여부 확인
export function isAirtableConfigured(): boolean {
  return !!(AIRTABLE_API_KEY && BASE_ID && TABLES.summary);
}
