/**
 * D1 Client — choho-blog D1 Proxy Worker 호출 래퍼
 *
 * 프록시 계약 (workers/d1-proxy/src/index.ts):
 *   POST /query  { sql, params }              → { ok, result: [d1AllResult] }
 *   POST /batch  { statements: [{sql,params}] } → { ok, result: [...] }
 *   Bearer PROXY_TOKEN 인증
 *
 * 환경변수:
 *   D1_PROXY_URL    — Worker 배포 URL (choho-blog-d1-proxy.mkt9834.workers.dev)
 *   D1_PROXY_TOKEN  — Worker PROXY_TOKEN 과 동일값
 *
 * 사용법:
 *   const rows = await d1All<Row>("SELECT * FROM daily_analytics WHERE date > ?", [start]);
 *   const row  = await d1First<Row>("SELECT * FROM daily_analytics WHERE date = ?", [date]);
 *   await d1Run("INSERT INTO ...", [...]);
 *   await d1Batch([{ sql: "INSERT ...", params: [...] }]);
 *
 * 모든 함수는 prepared statements + 파라미터 바인딩 사용. SQL 인터폴레이션 금지.
 */

const D1_PROXY_URL = process.env.D1_PROXY_URL;
const D1_PROXY_TOKEN = process.env.D1_PROXY_TOKEN;

export type D1Param = string | number | boolean | null;

export interface D1RunMeta {
  changes: number;
  last_row_id: number;
  duration: number;
  rows_read: number;
  rows_written: number;
}

/** D1 .all() 결과 형태 (프록시가 배열로 감싸서 반환) */
interface D1Result<T> {
  results?: T[];
  success?: boolean;
  meta?: D1RunMeta;
}

interface ProxyResponse<T> {
  ok: boolean;
  result?: T[];
  error?: string;
}

function assertConfig(): void {
  if (!D1_PROXY_URL || !D1_PROXY_TOKEN) {
    throw new Error("D1 proxy 환경변수 누락: D1_PROXY_URL, D1_PROXY_TOKEN");
  }
}

const RETRY_DELAYS_MS = [100, 300];

function isTransientError(message: string, status: number): boolean {
  const lower = message.toLowerCase();
  if (
    lower.includes("no such table") ||
    lower.includes("duplicate column") ||
    lower.includes("no such column") ||
    lower.includes("syntax error") ||
    lower.includes("constraint failed")
  ) {
    return false;
  }
  return (
    lower.includes("network connection lost") ||
    lower.includes("fetch failed") ||
    lower.includes("connection reset") ||
    lower.includes("connection closed") ||
    lower.includes("timeout") ||
    lower.includes("econnreset") ||
    status >= 500
  );
}

async function callProxy<T>(
  path: "/query" | "/batch",
  body: unknown,
): Promise<ProxyResponse<T>> {
  assertConfig();
  const payload = JSON.stringify(body);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${D1_PROXY_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${D1_PROXY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: payload,
        cache: "no-store",
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("D1 proxy fetch 실패");
      if (
        attempt < RETRY_DELAYS_MS.length &&
        isTransientError(lastError.message, 0)
      ) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw lastError;
    }

    let data: ProxyResponse<T>;
    try {
      data = (await res.json()) as ProxyResponse<T>;
    } catch {
      lastError = new Error(`D1 proxy 응답 파싱 실패: HTTP ${res.status}`);
      if (attempt < RETRY_DELAYS_MS.length && isTransientError("", res.status)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw lastError;
    }

    if (!res.ok || !data.ok) {
      const errMsg = data.error ?? "unknown";
      lastError = new Error(`D1 proxy 오류 (HTTP ${res.status}): ${errMsg}`);
      if (
        attempt < RETRY_DELAYS_MS.length &&
        isTransientError(errMsg, res.status)
      ) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw lastError;
    }

    return data;
  }

  throw lastError ?? new Error("D1 proxy 호출 실패");
}

/** SELECT — 모든 행을 배열로 반환. */
export async function d1All<T = Record<string, unknown>>(
  sql: string,
  params: D1Param[] = [],
): Promise<T[]> {
  const data = await callProxy<D1Result<T>>("/query", { sql, params });
  return data.result?.[0]?.results ?? [];
}

/** SELECT — 첫 행 하나만. 없으면 null. */
export async function d1First<T = Record<string, unknown>>(
  sql: string,
  params: D1Param[] = [],
): Promise<T | null> {
  const data = await callProxy<D1Result<T>>("/query", { sql, params });
  return data.result?.[0]?.results?.[0] ?? null;
}

/** INSERT/UPDATE/DELETE — 변경 메타정보 반환. */
export async function d1Run(
  sql: string,
  params: D1Param[] = [],
): Promise<{ success: boolean; meta: D1RunMeta }> {
  const data = await callProxy<D1Result<unknown>>("/query", { sql, params });
  const first = data.result?.[0];
  return {
    success: first?.success ?? false,
    meta:
      first?.meta ?? {
        changes: 0,
        last_row_id: 0,
        duration: 0,
        rows_read: 0,
        rows_written: 0,
      },
  };
}

/** batch — 프록시가 env.DB.batch() 로 실행 (statements 키). */
export async function d1Batch(
  queries: { sql: string; params?: D1Param[] }[],
): Promise<unknown[]> {
  if (queries.length === 0) return [];
  const statements = queries.map((q) => ({ sql: q.sql, params: q.params ?? [] }));
  const data = await callProxy<unknown>("/batch", { statements });
  return data.result ?? [];
}

// ─────────────────────────────────────────────────────────────
// 헬퍼: 짧은 ID (신규 레코드 PK용) — 'rec' + 14자 alphanumeric
// ─────────────────────────────────────────────────────────────
const ID_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function newId(prefix = "rec"): string {
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let out = prefix;
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

/** ISO datetime (밀리초 제거) */
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
