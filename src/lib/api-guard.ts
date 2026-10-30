/**
 * 관리자 조회 API 공용 가드 — 호출 상한 + TTL 캐시 + 동시 실행 묶기
 *
 * - 분당 호출 상한: 라우트별 카운터(isolate 단위). 넘으면 429.
 * - 캐시: 같은 조회 조건은 TTL 동안 D1 을 다시 부르지 않는다(LRU 상한).
 * - 같은 조건의 요청이 동시에 오면 한 번만 실행하고 결과를 나눠 쓴다.
 */

const rates = new Map<string, { start: number; count: number }>();

/** 상한 안이면 true. 초과하면 false (호출 측에서 429 반환) */
export function withinRate(route: string, perMinute: number): boolean {
  const now = Date.now();
  const r = rates.get(route);
  if (!r || now - r.start > 60_000) {
    rates.set(route, { start: now, count: 1 });
    return true;
  }
  r.count += 1;
  return r.count <= perMinute;
}

const cache = new Map<string, { expires: number; data: unknown }>();
const pending = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 48;
const MAX_PENDING = 6;

export class BusyError extends Error {
  constructor() {
    super("READ_BUSY");
  }
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) {
    cache.delete(key);
    cache.set(key, hit);
    return hit.data as T;
  }
  if (hit) cache.delete(key);
  const inflight = pending.get(key);
  if (inflight) return inflight as Promise<T>;
  if (pending.size >= MAX_PENDING) throw new BusyError();
  const task = load()
    .then((data) => {
      for (const [k, e] of cache) if (e.expires <= Date.now()) cache.delete(k);
      while (cache.size >= MAX_ENTRIES)
        cache.delete(cache.keys().next().value!);
      cache.set(key, { expires: Date.now() + ttlMs, data });
      return data;
    })
    .finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** ?start=&end= 검증 (KST 날짜, 최대 길이 제한). 실패 시 null */
export function parseStrictRange(
  url: URL,
  maxDays = 400,
): { start: string; end: string; days: number } | null {
  const start = url.searchParams.get("start") || "";
  const end = url.searchParams.get("end") || "";
  if (!YMD.test(start) || !YMD.test(end)) return null;
  const a = Date.parse(start + "T00:00:00Z");
  const b = Date.parse(end + "T00:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return null;
  if (
    new Date(a).toISOString().slice(0, 10) !== start ||
    new Date(b).toISOString().slice(0, 10) !== end
  )
    return null;
  const days = Math.round((b - a) / 86_400_000) + 1;
  if (days > maxDays) return null;
  return { start, end, days };
}

/** KST 날짜 경계 → UTC 문자열 (visit_events: ISO `...T..Z`, inquiries: `YYYY-MM-DD HH:MM:SS`) */
export function kstBoundsUtc(start: string, end: string) {
  const from = new Date(Date.parse(start + "T00:00:00+09:00"));
  const to = new Date(Date.parse(end + "T00:00:00+09:00") + 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 19) + "Z";
  const sql = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  return {
    isoFrom: iso(from),
    isoTo: iso(to),
    sqlFrom: sql(from),
    sqlTo: sql(to),
  };
}

export function shiftYmd(ymd: string, days: number): string {
  return new Date(Date.parse(ymd + "T00:00:00Z") + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}
