/**
 * 예약 관리 화면의 호출 통로 — 차단기 + 메모리 캐시 + 같은 조회 묶기.
 * 기준: F:\agents-rules\global\db-api-runaway-guard.md 화면 항목(11·13·14·15).
 *
 * 차단기(이 화면의 /api/reservations·/api/reservation-blocks 호출에만)
 *   ① 10초에 40번을 넘으면 보내지 않는다
 *   ② 같은 조회(GET 주소)가 10초에 8번을 넘으면 그 조회를 30초 동안 막는다
 *   ③ 서버가 429 를 주면 Retry-After(없으면 30초, 최대 300초) 동안 같은 경로를 보내지 않는다
 *   막힌 호출은 예외 대신 429 응답을 돌려줘 화면의 평소 오류 처리로 넘긴다.
 *
 * 캐시(모듈 메모리, 화면을 떠났다 돌아와도 유지, 새로 고침하면 비움)
 *   - 달력 기간: `from|to` 열쇠, 5분, 최대 12개. 같은 기간을 동시에 부르면 한 번만 보낸다.
 *   - 예약 한 건(변경 기록 포함): 5분, 최대 30개.
 *   - 검색 쪽: 1분, 최대 20개.
 *   - 쓰기에 성공하면 그 예약 날짜와 겹치는 기간 캐시, 그 예약 한 건 캐시, 검색 캐시만 비운다.
 */
import { normalize, type Block, type Reservation } from "./model";

const WINDOW_MS = 10_000;
const MAX_PER_WINDOW = 40;
const SAME_MAX = 8;
const BREAKER_MS = 30_000;
const RETRY_AFTER_MAX_S = 300;

const sent: number[] = [];
const sameHits = new Map<string, number[]>();
const blockedUntil = new Map<string, number>();

function blocked(ms: number) {
  return new Response(JSON.stringify({ error: "요청이 너무 잦아 잠시 멈췄습니다" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(Math.max(1, Math.ceil(ms / 1000))),
    },
  });
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const u = new URL(url, window.location.href);
  const method = (init?.method ?? "GET").toUpperCase();
  const now = Date.now();
  const pathKey = u.pathname.split("/").slice(0, 3).join("/");
  const sameKey = method === "GET" ? `${u.pathname}${u.search}` : "";

  blockedUntil.forEach((until, k) => until <= now && blockedUntil.delete(k));
  const until = Math.max(
    blockedUntil.get(pathKey) ?? 0,
    sameKey ? (blockedUntil.get(`GET ${sameKey}`) ?? 0) : 0,
  );
  if (now < until) return blocked(until - now);

  while (sent.length && now - sent[0] >= WINDOW_MS) sent.shift();
  if (sent.length >= MAX_PER_WINDOW) return blocked(WINDOW_MS - (now - sent[0]));

  if (sameKey) {
    const hits = (sameHits.get(sameKey) ?? []).filter((t) => now - t < WINDOW_MS);
    if (hits.length >= SAME_MAX) {
      blockedUntil.set(`GET ${sameKey}`, now + BREAKER_MS);
      sameHits.delete(sameKey);
      console.warn("[reservations] 같은 조회가 반복되어 30초 동안 막습니다:", sameKey);
      return blocked(BREAKER_MS);
    }
    hits.push(now);
    sameHits.set(sameKey, hits);
  }
  sent.push(now);

  const res = await fetch(url, init);
  if (res.status === 429) {
    const ra = Number(res.headers.get("Retry-After"));
    const hold =
      Number.isFinite(ra) && ra > 0 ? Math.min(ra, RETRY_AFTER_MAX_S) * 1000 : BREAKER_MS;
    blockedUntil.set(pathKey, Date.now() + hold);
  }
  return res;
}

/* ── 작은 TTL 캐시 ─────────────────────────────────────── */

type Entry<T> = { at: number; data: T };
function makeCache<T>(ttlMs: number, max: number) {
  const map = new Map<string, Entry<T>>();
  return {
    get(key: string) {
      const hit = map.get(key);
      if (!hit) return null;
      if (Date.now() - hit.at > ttlMs) {
        map.delete(key);
        return null;
      }
      return hit.data;
    },
    set(key: string, data: T) {
      map.delete(key);
      while (map.size >= max) map.delete(map.keys().next().value!);
      map.set(key, { at: Date.now(), data });
    },
    delete: (key: string) => map.delete(key),
    clear: () => map.clear(),
    keys: () => [...map.keys()],
  };
}

export type RangeData = { items: Reservation[]; blocks: Block[] };
export type SearchData = { items: Reservation[]; total: number; totalPages: number };

const rangeCache = makeCache<RangeData>(5 * 60_000, 12);
const detailCache = makeCache<Reservation>(5 * 60_000, 30);
const searchCache = makeCache<SearchData>(60_000, 20);
const inflight = new Map<string, Promise<unknown>>();

function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const task = load().finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

type ListBody = {
  items?: Record<string, unknown>[];
  total?: number;
  totalPages?: number;
  blocks?: Block[];
  error?: string;
  message?: string;
};

async function readList(params: Record<string, string>): Promise<ListBody> {
  const res = await apiFetch(`/api/reservations?${new URLSearchParams(params)}`);
  const body = (await res.json().catch(() => ({}))) as ListBody;
  if (!res.ok) throw new Error(body.error ?? body.message ?? "조회 실패");
  return body;
}

/** 검색 목록 한 쪽 크기. 프록시도 100 으로 자른다. */
export const PAGE_SIZE = 100;
/** 달력 기간 조회 한 쪽 크기(기간이 있으면 프록시·서버 모두 200 까지). */
const RANGE_PAGE_SIZE = 200;
/** 달력 한 칸 기간(약 6주)에 200건을 넘는 일은 없지만, 넘어도 2쪽에서 멈춘다. */
const RANGE_MAX_PAGES = 2;

const rangeKey = (from: string, to: string) => `${from}|${to}`;

export function peekRange(from: string, to: string) {
  return rangeCache.get(rangeKey(from, to));
}

/** 보이는 달 칸 기간을 한 번에 받는다. 캐시가 있으면 부르지 않는다. */
export function loadRange(from: string, to: string): Promise<RangeData> {
  const key = rangeKey(from, to);
  const hit = rangeCache.get(key);
  if (hit) return Promise.resolve(hit);
  return once(`range ${key}`, async () => {
    const items: Reservation[] = [];
    let blocks: Block[] = [];
    // runaway-ok: RANGE_MAX_PAGES 로 쪽 수를 막는다
    for (let page = 1; page <= RANGE_MAX_PAGES; page += 1) {
      const body = await readList({
        from,
        to,
        status: "all",
        channel: "all",
        page: String(page),
        pageSize: String(RANGE_PAGE_SIZE),
      });
      items.push(...(body.items ?? []).map(normalize));
      if (page === 1) blocks = Array.isArray(body.blocks) ? body.blocks : [];
      if (page >= (Number(body.totalPages) || 1)) break;
    }
    const data = { items, blocks };
    rangeCache.set(key, data);
    return data;
  });
}

/** 검색은 기간 없이 한 쪽씩 받는다. */
export function loadSearch(query: string, page: number): Promise<SearchData> {
  const key = `${query}|${page}`;
  const hit = searchCache.get(key);
  if (hit) return Promise.resolve(hit);
  return once(`search ${key}`, async () => {
    const body = await readList({
      query,
      status: "all",
      channel: "all",
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });
    const data = {
      items: (body.items ?? []).map(normalize),
      total: Number(body.total) || 0,
      totalPages: Math.max(Number(body.totalPages) || 1, 1),
    };
    searchCache.set(key, data);
    return data;
  });
}

export function peekDetail(id: string) {
  return detailCache.get(id);
}

/** 예약 한 건(변경 기록 포함). */
export function loadDetail(id: string): Promise<Reservation | null> {
  const hit = detailCache.get(id);
  if (hit) return Promise.resolve(hit);
  return once(`detail ${id}`, async () => {
    const res = await apiFetch(`/api/reservations/${encodeURIComponent(id)}`);
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(body?.error ?? "조회 실패");
    const raw = body?.item ?? body;
    if (!raw?.id) return null;
    const item = normalize(raw);
    detailCache.set(id, item);
    return item;
  });
}

/**
 * 쓰기 성공 뒤 비울 캐시. spans 는 바뀐 날짜 구간(예약의 입실~퇴실, 막은 날짜 하루).
 * 그 구간과 겹치는 달력 기간만 지우므로 다른 달로 갔다 와도 다시 부르지 않는다.
 */
export function invalidate(spans: [string, string][], reservationId?: string) {
  for (const key of rangeCache.keys()) {
    const [from, to] = key.split("|");
    if (spans.some(([a, b]) => a <= to && b >= from)) rangeCache.delete(key);
  }
  if (reservationId) detailCache.delete(reservationId);
  searchCache.clear();
}
