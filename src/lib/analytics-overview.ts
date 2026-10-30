import { d1All, d1Batch } from "@/lib/d1-client";
import { kstBoundsUtc, shiftYmd } from "@/lib/api-guard";
import {
  CHANNELS,
  type ChannelKey,
  classifyInflow,
  inquiryChannel,
  matchMetaCampaign,
  metaPlatformLabel,
  pageLabel,
  type PageKind,
} from "@/lib/inflow";

/**
 * 방문자 통계 개편 화면의 기간 의존 데이터 전부 (visit_events · inquiries · daily_analytics · posts).
 * 모든 조회는 LIMIT 을 두고, 기간 조건은 created_at 인덱스를 탄다.
 */

const META_ACCOUNT = "639564975420619";
/** 상품·요금/견적 화면으로 보는 경로 */
const OFFER_PATHS = ["/booking", "/workshop"];

export interface OverviewChannelRow {
  key: ChannelKey;
  label: string;
  color: string;
  paid: boolean;
  sessions: number;
  inquiries: number;
}
export interface OverviewMetaCampaign {
  key: string;
  campaignId: string | null;
  name: string;
  sessions: number;
  inquiries: number;
  platforms: Array<{ label: string; sessions: number }>;
}
export interface OverviewPage {
  path: string;
  label: string;
  kind: PageKind;
  pageviews: number;
  sessions: number;
  landings: number;
}
export interface OverviewTopic {
  topic: string;
  kind: PageKind;
  pages: number;
  pageviews: number;
  landings: number;
}
export interface AnalyticsOverview {
  range: {
    start: string;
    end: string;
    days: number;
    prevStart: string;
    prevEnd: string;
  };
  self: {
    sessions: number;
    visitors: number;
    returning: number;
    pageviews: number;
    prev: { sessions: number; visitors: number; pageviews: number };
    since: string | null;
  };
  ga4: {
    pageviews: number;
    sessions: number;
    visitors: number;
    avgDurationSec: number | null;
    bounceRate: number | null;
    days: number;
    lastDate: string | null;
    prev: {
      pageviews: number;
      avgDurationSec: number | null;
      bounceRate: number | null;
    };
  };
  inquiries: { total: number; prevTotal: number };
  funnel: {
    sessions: number;
    reachedOffer: number;
    quoteOpenSessions: number;
    leadSessions: number;
    inquiries: number;
  };
  channels: OverviewChannelRow[];
  metaCampaigns: OverviewMetaCampaign[];
  pages: OverviewPage[];
  topics: OverviewTopic[];
  daily: Array<{ date: string; sessions: number; ga4Visitors: number | null }>;
  patterns: {
    from: string;
    to: string;
    total: number;
    hours: number[];
    weekdays: number[];
  };
  ops: {
    month: string;
    current: number;
    forecast: number;
    prevMonth: number;
    paid: number;
    paidNaver: number;
    paidMeta: number;
    elapsedDays: number;
  };
  insights: Array<{ tag: string; text: string }>;
}

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const str = (v: unknown) =>
  typeof v === "string" ? v : v == null ? "" : String(v);

function rowsOf(result: unknown): Row[] {
  const r = result as { results?: Row[] } | undefined;
  return Array.isArray(r?.results) ? r!.results : [];
}

function kstToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

function weighted(rows: Row[], key: string): number | null {
  let w = 0;
  let s = 0;
  for (const r of rows) {
    const sessions = num(r.sessions);
    if (sessions <= 0) continue;
    w += sessions;
    s += num(r[key]) * sessions;
  }
  return w > 0 ? s / w : null;
}

export async function loadOverview(
  start: string,
  end: string,
  days: number,
): Promise<AnalyticsOverview> {
  const prevEnd = shiftYmd(start, -1);
  const prevStart = shiftYmd(prevEnd, -(days - 1));
  const cur = kstBoundsUtc(start, end);
  const prev = kstBoundsUtc(prevStart, prevEnd);
  const patFrom = shiftYmd(end, -89);
  const pat = kstBoundsUtc(patFrom, end);
  const today = kstToday();
  const monthStart = today.slice(0, 8) + "01";
  const prevMonthStart = shiftYmd(monthStart, -1).slice(0, 8) + "01";
  const month = kstBoundsUtc(monthStart, today);
  const prevMonth = kstBoundsUtc(prevMonthStart, shiftYmd(monthStart, -1));

  const human = "event_type='page_view' AND is_bot=0";
  const firstTouch = `WITH f AS (SELECT session_id, MIN(created_at) m FROM visit_events WHERE created_at>=? AND created_at<? AND ${human} GROUP BY session_id)`;

  const results = await d1Batch([
    /* 0 */ {
      sql: `SELECT COUNT(*) pv, COUNT(DISTINCT session_id) s, COUNT(DISTINCT visitor_id) uv, COUNT(DISTINCT CASE WHEN is_new_visitor=0 THEN visitor_id END) ret FROM visit_events WHERE created_at>=? AND created_at<? AND ${human}`,
      params: [cur.isoFrom, cur.isoTo],
    },
    /* 1 */ {
      sql: `SELECT COUNT(*) pv, COUNT(DISTINCT session_id) s, COUNT(DISTINCT visitor_id) uv FROM visit_events WHERE created_at>=? AND created_at<? AND ${human}`,
      params: [prev.isoFrom, prev.isoTo],
    },
    /* 2 */ {
      sql: `SELECT substr(datetime(created_at,'+9 hours'),1,10) d, COUNT(DISTINCT session_id) s FROM visit_events WHERE created_at>=? AND created_at<? AND ${human} GROUP BY d ORDER BY d LIMIT 400`,
      params: [cur.isoFrom, cur.isoTo],
    },
    /* 3 */ {
      sql: `${firstTouch} SELECT e.referrer ref, e.utm_source src, e.utm_medium med, e.utm_campaign camp,
        CASE WHEN instr(e.query,'NaPm=')>0 OR instr(e.query,'n_media=')>0 THEN 1 ELSE 0 END napm,
        CASE WHEN instr(e.query,'utm_id=')>0 THEN substr(e.query, instr(e.query,'utm_id=')+7, 24) ELSE '' END uid,
        COUNT(DISTINCT e.session_id) n
        FROM visit_events e JOIN f ON e.session_id=f.session_id AND e.created_at=f.m
        WHERE e.event_type='page_view' AND e.is_bot=0
        GROUP BY 1,2,3,4,5,6 ORDER BY n DESC LIMIT 3000`,
      params: [cur.isoFrom, cur.isoTo],
    },
    /* 4 */ {
      sql: `SELECT COUNT(DISTINCT CASE WHEN event_type='page_view' AND path IN (${OFFER_PATHS.map(() => "?").join(",")}) THEN session_id WHEN event_type IN ('quote_open','lead') THEN session_id END) reach,
        COUNT(DISTINCT CASE WHEN event_type='quote_open' THEN session_id END) q,
        COUNT(DISTINCT CASE WHEN event_type='lead' THEN session_id END) l
        FROM visit_events WHERE created_at>=? AND created_at<? AND is_bot=0 AND (event_type IN ('quote_open','lead') OR path IN (${OFFER_PATHS.map(() => "?").join(",")}))`,
      params: [...OFFER_PATHS, cur.isoFrom, cur.isoTo, ...OFFER_PATHS],
    },
    /* 5 */ {
      sql: `SELECT path, COUNT(*) pv, COUNT(DISTINCT session_id) s FROM visit_events WHERE created_at>=? AND created_at<? AND ${human} AND path!='' GROUP BY path ORDER BY pv DESC LIMIT 80`,
      params: [cur.isoFrom, cur.isoTo],
    },
    /* 6 */ {
      sql: `${firstTouch} SELECT e.path path, COUNT(DISTINCT e.session_id) n FROM visit_events e JOIN f ON e.session_id=f.session_id AND e.created_at=f.m WHERE e.event_type='page_view' AND e.is_bot=0 GROUP BY e.path ORDER BY n DESC LIMIT 80`,
      params: [cur.isoFrom, cur.isoTo],
    },
    /* 7 */ {
      sql: `SELECT created_at, product_name, source_channel, referrer, landing_url FROM inquiries WHERE created_at>=? AND created_at<? ORDER BY created_at DESC LIMIT 2000`,
      params: [cur.sqlFrom, cur.sqlTo],
    },
    /* 8 */ {
      sql: `SELECT COUNT(*) n FROM inquiries WHERE created_at>=? AND created_at<?`,
      params: [prev.sqlFrom, prev.sqlTo],
    },
    /* 9 */ {
      sql: `SELECT CAST(strftime('%H',created_at,'+9 hours') AS INTEGER) h, CAST(strftime('%w',created_at,'+9 hours') AS INTEGER) w, COUNT(*) n FROM inquiries WHERE created_at>=? AND created_at<? GROUP BY h, w LIMIT 200`,
      params: [pat.sqlFrom, pat.sqlTo],
    },
    /* 10 */ {
      sql: `SELECT referrer, landing_url, source_channel FROM inquiries WHERE created_at>=? AND created_at<? LIMIT 2000`,
      params: [month.sqlFrom, month.sqlTo],
    },
    /* 11 */ {
      sql: `SELECT COUNT(*) n FROM inquiries WHERE created_at>=? AND created_at<?`,
      params: [prevMonth.sqlFrom, prevMonth.sqlTo],
    },
    /* 12 */ {
      sql: `SELECT date, visitors, pageviews, sessions, bounce_rate, avg_duration FROM daily_analytics WHERE date>=? AND date<=? ORDER BY date LIMIT 400`,
      params: [start, end],
    },
    /* 13 */ {
      sql: `SELECT date, visitors, pageviews, sessions, bounce_rate, avg_duration FROM daily_analytics WHERE date>=? AND date<=? ORDER BY date LIMIT 400`,
      params: [prevStart, prevEnd],
    },
    /* 14 */ {
      sql: `SELECT campaign_id, name FROM meta_ads_campaigns WHERE account_id=? LIMIT 100`,
      params: [META_ACCOUNT],
    },
    /* 15 */ { sql: `SELECT MAX(date) d FROM daily_analytics`, params: [] },
    /* 16 */ { sql: `SELECT MIN(created_at) m FROM visit_events`, params: [] },
  ]);

  const r = results.map(rowsOf);
  const k0 = r[0][0] || {};
  const k1 = r[1][0] || {};

  /* 채널 (세션 첫 유입) */
  const metaNames = new Map(
    r[14].map((x) => [str(x.campaign_id), str(x.name)]),
  );
  const sessionsBy = new Map<ChannelKey, number>();
  const metaBy = new Map<
    string,
    { sessions: number; inquiries: number; platforms: Map<string, number> }
  >();
  const metaLabels = new Map<string, string>();
  for (const x of r[3]) {
    const n = num(x.n);
    const key = classifyInflow({
      referrer: str(x.ref),
      utmSource: str(x.src),
      utmMedium: str(x.med),
      naverAd: num(x.napm) === 1,
    });
    sessionsBy.set(key, (sessionsBy.get(key) || 0) + n);
    if (key === "meta_ad") {
      const uid = str(x.uid).split("&")[0];
      const ck = /^\d{8,}$/.test(uid) ? uid : str(x.camp) || "(없음)";
      if (str(x.camp)) metaLabels.set(ck, str(x.camp));
      const m = metaBy.get(ck) || {
        sessions: 0,
        inquiries: 0,
        platforms: new Map(),
      };
      m.sessions += n;
      const pl = metaPlatformLabel(str(x.src));
      m.platforms.set(pl, (m.platforms.get(pl) || 0) + n);
      metaBy.set(ck, m);
    }
  }

  /* 문의 (접수 때 저장된 첫 유입) */
  const inquiriesBy = new Map<ChannelKey, number>();
  for (const x of r[7]) {
    const ch = inquiryChannel({
      referrer: str(x.referrer),
      landing_url: str(x.landing_url),
      source_channel: str(x.source_channel),
    });
    inquiriesBy.set(ch.key, (inquiriesBy.get(ch.key) || 0) + 1);
    if (ch.key === "meta_ad") {
      const ck = /^\d{8,}$/.test(ch.utmId)
        ? ch.utmId
        : ch.utmCampaign || "(없음)";
      const m = metaBy.get(ck) || {
        sessions: 0,
        inquiries: 0,
        platforms: new Map(),
      };
      m.inquiries += 1;
      metaBy.set(ck, m);
    }
  }

  const keys = new Set<ChannelKey>([
    ...sessionsBy.keys(),
    ...inquiriesBy.keys(),
  ]);
  const channels: OverviewChannelRow[] = [...keys]
    .map((key) => ({
      key,
      label: CHANNELS[key].label,
      color: CHANNELS[key].color,
      paid: !!CHANNELS[key].paid,
      sessions: sessionsBy.get(key) || 0,
      inquiries: inquiriesBy.get(key) || 0,
    }))
    .sort((a, b) => b.sessions - a.sessions || b.inquiries - a.inquiries);

  // utm_id 로 묶인 것과 utm_campaign 으로 묶인 것이 같은 캠페인이면 합친다
  const merged = new Map<
    string,
    OverviewMetaCampaign & { pmap: Map<string, number> }
  >();
  for (const [ck, m] of metaBy) {
    const { id, name } = matchMetaCampaign(ck, metaNames, metaLabels.get(ck));
    const mk = id || name;
    const cur0 = merged.get(mk) || {
      key: mk,
      campaignId: id,
      name,
      sessions: 0,
      inquiries: 0,
      platforms: [],
      pmap: new Map<string, number>(),
    };
    cur0.sessions += m.sessions;
    cur0.inquiries += m.inquiries;
    for (const [p, n] of m.platforms)
      cur0.pmap.set(p, (cur0.pmap.get(p) || 0) + n);
    merged.set(mk, cur0);
  }
  const metaCampaigns: OverviewMetaCampaign[] = [...merged.values()]
    .map(({ pmap, ...c }) => ({
      ...c,
      platforms: [...pmap]
        .map(([label, sessions]) => ({ label, sessions }))
        .sort((a, b) => b.sessions - a.sessions),
    }))
    .sort((a, b) => b.name.localeCompare(a.name));

  /* 페이지 — 소식 글 제목은 posts 에서 */
  const landings = new Map(r[6].map((x) => [str(x.path), num(x.n)]));
  const allPaths = new Set([
    ...r[5].map((x) => str(x.path)),
    ...r[6].map((x) => str(x.path)),
  ]);
  const slugs = [...allPaths]
    .map((p) => pageLabel(p).newsSlug)
    .filter((s): s is string => !!s)
    .slice(0, 90);
  const titles: Record<string, string> = {};
  if (slugs.length) {
    const rows = await d1All<{ slug: string; title: string }>(
      `SELECT slug, title FROM posts WHERE slug IN (${slugs.map(() => "?").join(",")}) LIMIT 100`,
      slugs,
    );
    for (const row of rows) titles[row.slug] = row.title;
  }
  // 같은 주소가 인코딩만 달리해 갈라진 경우를 합친다
  const pageMap = new Map<string, OverviewPage & { topic: string }>();
  for (const x of r[5]) {
    const lab = pageLabel(str(x.path), titles);
    const p = pageMap.get(lab.decodedPath) || {
      path: lab.decodedPath,
      label: lab.label,
      kind: lab.kind,
      topic: lab.topic,
      pageviews: 0,
      sessions: 0,
      landings: 0,
    };
    p.pageviews += num(x.pv);
    p.sessions += num(x.s);
    p.landings += landings.get(str(x.path)) || 0;
    pageMap.set(lab.decodedPath, p);
  }
  const pageList = [...pageMap.values()].sort(
    (a, b) => b.pageviews - a.pageviews,
  );
  const topicMap = new Map<string, OverviewTopic>();
  for (const p of pageList) {
    const t = topicMap.get(p.topic) || {
      topic: p.topic,
      kind: p.kind,
      pages: 0,
      pageviews: 0,
      landings: 0,
    };
    t.pages += 1;
    t.pageviews += p.pageviews;
    t.landings += p.landings;
    topicMap.set(p.topic, t);
  }

  /* GA4 */
  const ga = r[12];
  const gaPrev = r[13];
  const sum = (rows: Row[], k: string) =>
    rows.reduce((a, x) => a + num(x[k]), 0);

  /* 일별 */
  const gaByDate = new Map(ga.map((x) => [str(x.date), num(x.visitors)]));
  const selfByDate = new Map(r[2].map((x) => [str(x.d), num(x.s)]));
  const daily: AnalyticsOverview["daily"] = [];
  for (let d = start, i = 0; d <= end && i < 400; d = shiftYmd(d, 1), i++) {
    daily.push({
      date: d,
      sessions: selfByDate.get(d) || 0,
      ga4Visitors: gaByDate.has(d) ? gaByDate.get(d)! : null,
    });
  }

  /* 문의 패턴 (최근 90일) */
  const hours = Array.from({ length: 24 }, () => 0);
  const weekdays = Array.from({ length: 7 }, () => 0);
  let patTotal = 0;
  for (const x of r[9]) {
    const h = num(x.h);
    const w = num(x.w);
    const n = num(x.n);
    if (h >= 0 && h < 24) hours[h] += n;
    if (w >= 0 && w < 7) weekdays[w] += n;
    patTotal += n;
  }

  /* 이번 달 운영 판단 */
  let paidNaver = 0;
  let paidMeta = 0;
  for (const x of r[10]) {
    const key = inquiryChannel({
      referrer: str(x.referrer),
      landing_url: str(x.landing_url),
      source_channel: str(x.source_channel),
    }).key;
    if (key === "naver_ad") paidNaver += 1;
    if (key === "meta_ad") paidMeta += 1;
  }
  const elapsedDays = Number(today.slice(8, 10));
  const daysInMonth = new Date(
    Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0),
  ).getUTCDate();
  const monthCount = r[10].length;

  const selfSince = str(r[16][0]?.m) || null;
  const out: AnalyticsOverview = {
    range: { start, end, days, prevStart, prevEnd },
    self: {
      sessions: num(k0.s),
      visitors: num(k0.uv),
      returning: num(k0.ret),
      pageviews: num(k0.pv),
      prev: {
        sessions: num(k1.s),
        visitors: num(k1.uv),
        pageviews: num(k1.pv),
      },
      since: selfSince ? selfSince.slice(0, 10) : null,
    },
    ga4: {
      pageviews: sum(ga, "pageviews"),
      sessions: sum(ga, "sessions"),
      visitors: sum(ga, "visitors"),
      avgDurationSec: weighted(ga, "avg_duration"),
      bounceRate: weighted(ga, "bounce_rate"),
      days: ga.length,
      lastDate: str(r[15][0]?.d) || null,
      prev: {
        pageviews: sum(gaPrev, "pageviews"),
        avgDurationSec: weighted(gaPrev, "avg_duration"),
        bounceRate: weighted(gaPrev, "bounce_rate"),
      },
    },
    inquiries: { total: r[7].length, prevTotal: num(r[8][0]?.n) },
    funnel: {
      sessions: num(k0.s),
      reachedOffer: num(r[4][0]?.reach),
      quoteOpenSessions: num(r[4][0]?.q),
      leadSessions: num(r[4][0]?.l),
      inquiries: r[7].length,
    },
    channels,
    metaCampaigns,
    pages: pageList.slice(0, 10).map((p) => ({
      path: p.path,
      label: p.label,
      kind: p.kind,
      pageviews: p.pageviews,
      sessions: p.sessions,
      landings: p.landings,
    })),
    topics: [...topicMap.values()]
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, 10),
    daily,
    patterns: { from: patFrom, to: end, total: patTotal, hours, weekdays },
    ops: {
      month: monthStart.slice(0, 7),
      current: monthCount,
      forecast:
        elapsedDays > 0
          ? Math.round((monthCount / elapsedDays) * daysInMonth)
          : monthCount,
      prevMonth: num(r[11][0]?.n),
      paid: paidNaver + paidMeta,
      paidNaver,
      paidMeta,
      elapsedDays,
    },
    insights: [],
  };
  out.insights = buildInsights(out);
  return out;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);
/** 받침 유무로 이/가 고르기 (한글로 끝나지 않으면 「이(가)」) */
function iGa(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return word + "이(가)";
  return word + (code % 28 ? "이" : "가");
}

/** 숫자 규칙으로 만드는 「확인할 것」 문장 */
function buildInsights(
  o: AnalyticsOverview,
): Array<{ tag: string; text: string }> {
  const out: Array<{ tag: string; text: string }> = [];
  for (const c of o.metaCampaigns.slice(0, 2)) {
    if (c.sessions === 0 && c.inquiries === 0) continue;
    out.push({
      tag: "Meta",
      text: `${c.name}: 사이트 도착 ${c.sessions.toLocaleString("ko-KR")}명, 문의 ${c.inquiries}건${c.sessions > 0 ? ` (도착 대비 ${pct(c.inquiries, c.sessions).toFixed(1)}%)` : ""}입니다.`,
    });
  }
  const eligible = o.channels.filter(
    (c) => c.sessions >= 30 && c.inquiries > 0,
  );
  const best = [...eligible].sort(
    (a, b) => b.inquiries / b.sessions - a.inquiries / a.sessions,
  )[0];
  if (best)
    out.push({
      tag: "전환",
      text: `${iGa(best.label)} 방문 대비 문의 ${pct(best.inquiries, best.sessions).toFixed(1)}%로 가장 높습니다.`,
    });
  const direct = o.channels.find((c) => c.key === "direct");
  if (
    direct &&
    direct.sessions >= 50 &&
    o.funnel.sessions > 0 &&
    direct.sessions / o.funnel.sessions > 0.3
  ) {
    out.push({
      tag: "유입",
      text: `직접 방문이 전체 방문의 ${pct(direct.sessions, o.funnel.sessions).toFixed(0)}%입니다. 꼬리표 없이 나간 링크가 있는지 확인합니다.`,
    });
  }
  if (o.patterns.total >= 20) {
    const w = o.patterns.weekdays.indexOf(Math.max(...o.patterns.weekdays));
    const h = o.patterns.hours.indexOf(Math.max(...o.patterns.hours));
    out.push({
      tag: "패턴",
      text: `최근 90일 문의는 ${WEEKDAY[w]}요일, ${h}시대에 가장 많이 들어왔습니다.`,
    });
  }
  if (o.ga4.lastDate && o.ga4.lastDate < shiftYmd(kstToday(), -2)) {
    out.push({
      tag: "주의",
      text: `GA4 수집이 ${o.ga4.lastDate} 이후 멈춰 있습니다. GA4 지표는 그날까지의 값입니다.`,
    });
  }
  return out.slice(0, 5);
}
