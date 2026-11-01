import { d1Batch } from "@/lib/d1-client";
import { kstBoundsUtc, shiftYmd } from "@/lib/api-guard";
import {
  deviceLabel,
  genderLabel,
  inquiryChannel,
  matchMetaCampaign,
  metaPlatformLabel,
  placementLabel,
  placementPlatform,
  regionLabel,
} from "@/lib/inflow";

/**
 * Meta 광고 유입 분석 — Meta 집계(meta_ads_*) 와 사이트 자체측정(visit_events)·실제 문의(inquiries) 를 캠페인 단위로 잇는다.
 * 모든 조회는 계정·기간 인덱스를 타고 LIMIT 을 둔다.
 */

const ACCOUNT = "639564975420619";
const OFFER_PATHS = ["/booking", "/workshop"];
const META_SRC = [
  "ig",
  "fb",
  "an",
  "msg",
  "instagram",
  "facebook",
  "meta",
  "threads",
];

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const str = (v: unknown) =>
  typeof v === "string" ? v : v == null ? "" : String(v);
const usd = (micros: unknown) => num(micros) / 1_000_000;
const rowsOf = (r: unknown): Row[] => {
  const x = r as { results?: Row[] } | undefined;
  return Array.isArray(x?.results) ? x!.results : [];
};

export interface MetaMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  landingPageViews: number;
  pixelLeads: number;
}
export interface MetaInflowCampaign extends MetaMetrics {
  id: string;
  name: string;
  status: string;
  effectiveStatus: string;
  objective: string;
  firstDate: string | null;
  lastDate: string | null;
  sessions: number;
  reached: number;
  inquiries: number;
  platforms: Array<{ label: string; sessions: number }>;
  products: Array<{ name: string; count: number }>;
}
export interface MetaInflow {
  range: { start: string; end: string; campaign: string };
  sync: {
    status: string;
    lastSuccessAt: string | null;
    stale: boolean;
    campaignsTracked: number;
    breakdownReady: boolean;
  };
  summary: MetaMetrics & {
    sessions: number;
    reached: number;
    inquiries: number;
    thruplays: number;
    p25: number;
    p50: number;
    p75: number;
    p100: number;
  };
  campaigns: MetaInflowCampaign[];
  /** 기간 안 날짜별 — 수집 시작일(또는 첫 기록)부터 기간 끝(오늘까지)을 빈 날 없이 채운다 */
  daily: Array<{
    date: string;
    spend: number;
    clicks: number;
    impressions: number;
    landingPageViews: number;
    pixelLeads: number;
    sessions: number;
    reached: number;
    inquiries: number;
  }>;
  ads: Array<{
    adId: string;
    name: string;
    campaignId: string;
    campaignName: string;
    spend: number;
    impressions: number;
    clicks: number;
    pixelLeads: number;
    thruplays: number;
    p25: number;
    p50: number;
    p75: number;
    p100: number;
    sessions: number;
  }>;
  placements: Array<{
    bucket: string;
    label: string;
    spend: number;
    impressions: number;
    clicks: number;
  }>;
  platforms: Array<{
    label: string;
    spend: number;
    clicks: number;
    sessions: number;
    inquiries: number;
  }>;
  age: Array<{
    bucket: string;
    spend: number;
    clicks: number;
    impressions: number;
  }>;
  gender: Array<{
    bucket: string;
    label: string;
    spend: number;
    clicks: number;
  }>;
  region: Array<{
    bucket: string;
    label: string;
    spend: number;
    clicks: number;
  }>;
  device: Array<{
    bucket: string;
    label: string;
    spend: number;
    clicks: number;
  }>;
  hours: number[];
  inquiries: Array<{
    id: number;
    createdAt: string;
    product: string;
    people: number;
    platform: string;
    campaignName: string;
  }>;
}

function toKst(utc: string): string {
  const t = Date.parse(utc.replace(" ", "T") + (utc.endsWith("Z") ? "" : "Z"));
  if (!Number.isFinite(t)) return utc;
  return new Date(t + 9 * 3600_000)
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
}

export async function loadMetaInflow(
  start: string,
  end: string,
  campaign: string | null,
): Promise<MetaInflow> {
  const b = kstBoundsUtc(start, end);
  const cf = campaign ? " AND campaign_id=?" : "";
  const cp = campaign ? [campaign] : [];
  const metaWhere = `lower(e.utm_medium) IN ('paid_social','paid','cpc','ppc') AND lower(e.utm_source) IN (${META_SRC.map(() => "?").join(",")})`;
  const firstTouch = `WITH f AS (SELECT session_id, MIN(created_at) m FROM visit_events WHERE created_at>=? AND created_at<? AND event_type='page_view' AND is_bot=0 GROUP BY session_id)`;
  const uidExpr =
    "CASE WHEN instr(e.query,'utm_id=')>0 THEN substr(e.query, instr(e.query,'utm_id=')+7, 24) ELSE '' END";
  const adExpr =
    "CASE WHEN instr(e.query,'ad_id=')>0 THEN substr(e.query, instr(e.query,'ad_id=')+6, 24) ELSE '' END";

  const base = await d1Batch([
    /* 0 */ {
      sql: "SELECT status, last_success_at, scope_json, available_since FROM meta_ads_sync WHERE account_id=? LIMIT 1",
      params: [ACCOUNT],
    },
    // runaway-ok: 안쪽 합계는 캠페인 수(최대 100)로 묶이고 바깥에 LIMIT 101
    /* 1 */ {
      sql: `SELECT c.campaign_id, c.name, c.status, c.effective_status, c.objective, d.sp, d.imp, d.clk, d.lpv, d.leads, d.d0, d.d1
        FROM meta_ads_campaigns c LEFT JOIN (SELECT campaign_id, SUM(spend_micros) sp, SUM(impressions) imp, SUM(link_clicks) clk, SUM(landing_page_views) lpv, SUM(website_leads) leads, MIN(date) d0, MAX(date) d1
          FROM meta_ads_daily WHERE account_id=? AND date>=? AND date<=? AND (spend_micros>0 OR impressions>0) GROUP BY campaign_id) d ON d.campaign_id=c.campaign_id
        WHERE c.account_id=? ORDER BY c.campaign_id DESC LIMIT 101`,
      params: [ACCOUNT, start, end, ACCOUNT],
    },
    /* 2 */ {
      sql: `SELECT date, SUM(spend_micros) sp, SUM(impressions) imp, SUM(link_clicks) clk, SUM(landing_page_views) lpv, SUM(website_leads) leads FROM meta_ads_daily WHERE account_id=? AND date>=? AND date<=?${cf} GROUP BY date ORDER BY date LIMIT 400`,
      params: [ACCOUNT, start, end, ...cp],
    },
    /* 3 */ {
      sql: `${firstTouch} SELECT lower(e.utm_source) src, e.utm_campaign camp, ${uidExpr} uid, ${adExpr} adid, substr(datetime(e.created_at,'+9 hours'),1,10) d, COUNT(DISTINCT e.session_id) n
        FROM visit_events e JOIN f ON e.session_id=f.session_id AND e.created_at=f.m
        WHERE e.event_type='page_view' AND e.is_bot=0 AND ${metaWhere}
        GROUP BY 1,2,3,4,5 LIMIT 5000`,
      params: [b.isoFrom, b.isoTo, ...META_SRC],
    },
    /* 4 */ {
      sql: `${firstTouch}, m AS (SELECT e.session_id sid, e.utm_campaign camp, ${uidExpr} uid, substr(datetime(e.created_at,'+9 hours'),1,10) d FROM visit_events e JOIN f ON e.session_id=f.session_id AND e.created_at=f.m WHERE e.event_type='page_view' AND e.is_bot=0 AND ${metaWhere})
        SELECT m.camp camp, m.uid uid, m.d d, COUNT(DISTINCT m.sid) reach FROM m JOIN visit_events v ON v.session_id=m.sid
        WHERE v.is_bot=0 AND v.created_at>=? AND v.created_at<? AND ((v.event_type='page_view' AND v.path IN (${OFFER_PATHS.map(() => "?").join(",")})) OR v.event_type IN ('quote_open','lead'))
        GROUP BY 1,2,3 LIMIT 5000`,
      params: [
        b.isoFrom,
        b.isoTo,
        ...META_SRC,
        b.isoFrom,
        b.isoTo,
        ...OFFER_PATHS,
      ],
    },
    /* 5 */ {
      sql: `SELECT id, created_at, product_name, people_count, source_channel, referrer, landing_url FROM inquiries
        WHERE created_at>=? AND created_at<? AND (instr(landing_url,'paid')>0 OR source_channel IN ('Meta 광고','인스타그램','페이스북'))
        ORDER BY created_at DESC LIMIT 500`,
      params: [b.sqlFrom, b.sqlTo],
    },
  ]);
  const r = base.map(rowsOf);

  // 분해·소재 표는 수집기 확장 뒤에 생긴다. 없으면 빈 값으로 둔다.
  let ads: Row[] = [];
  let breakdowns: Row[] = [];
  let breakdownReady = true;
  try {
    const extra = await d1Batch([
      {
        sql: `SELECT ad_id, MAX(ad_name) name, MAX(campaign_id) campaign_id, SUM(spend_micros) sp, SUM(impressions) imp, SUM(link_clicks) clk, SUM(website_leads) leads,
          SUM(thruplays) tp, SUM(video_p25) p25, SUM(video_p50) p50, SUM(video_p75) p75, SUM(video_p100) p100
          FROM meta_ads_ad_daily WHERE account_id=? AND date>=? AND date<=?${cf} GROUP BY ad_id ORDER BY sp DESC LIMIT 50`,
        params: [ACCOUNT, start, end, ...cp],
      },
      {
        sql: `SELECT dimension, bucket, SUM(spend_micros) sp, SUM(impressions) imp, SUM(link_clicks) clk FROM meta_ads_breakdown_daily
          WHERE account_id=? AND dimension IN ('placement','age','gender','region','device','hour') AND date>=? AND date<=?${cf} GROUP BY dimension, bucket LIMIT 600`,
        params: [ACCOUNT, start, end, ...cp],
      },
    ]);
    ads = rowsOf(extra[0]);
    breakdowns = rowsOf(extra[1]);
  } catch {
    breakdownReady = false;
  }

  const sync = r[0][0] || {};
  const byId = new Map(r[1].map((c) => [str(c.campaign_id), str(c.name)]));
  const keyOf = (uid: string, camp: string) => {
    const u = uid.split("&")[0];
    return matchMetaCampaign(/^\d{8,}$/.test(u) ? u : camp, byId, camp);
  };

  /* 사이트 도착 (세션 첫 유입이 Meta 광고) */
  const site = new Map<
    string,
    {
      name: string;
      sessions: number;
      platforms: Map<string, number>;
      reached: number;
      inquiries: number;
      products: Map<string, number>;
    }
  >();
  const siteOf = (m: { id: string | null; name: string }) => {
    const k = m.id || m.name;
    let v = site.get(k);
    if (!v)
      site.set(
        k,
        (v = {
          name: m.name,
          sessions: 0,
          platforms: new Map(),
          reached: 0,
          inquiries: 0,
          products: new Map(),
        }),
      );
    return v;
  };
  const sessionsByDate = new Map<string, number>();
  const sessionsByAd = new Map<string, number>();
  const sessionsByPlatform = new Map<string, number>();
  for (const x of r[3]) {
    const m = keyOf(str(x.uid), str(x.camp));
    if (campaign && m.id !== campaign) continue;
    const n = num(x.n);
    const s = siteOf(m);
    s.sessions += n;
    const pl = metaPlatformLabel(str(x.src));
    s.platforms.set(pl, (s.platforms.get(pl) || 0) + n);
    sessionsByPlatform.set(pl, (sessionsByPlatform.get(pl) || 0) + n);
    sessionsByDate.set(str(x.d), (sessionsByDate.get(str(x.d)) || 0) + n);
    const ad = str(x.adid).split("&")[0];
    if (/^\d{8,}$/.test(ad))
      sessionsByAd.set(ad, (sessionsByAd.get(ad) || 0) + n);
  }
  const reachedByDate = new Map<string, number>();
  for (const x of r[4]) {
    const m = keyOf(str(x.uid), str(x.camp));
    if (campaign && m.id !== campaign) continue;
    siteOf(m).reached += num(x.reach);
    reachedByDate.set(
      str(x.d),
      (reachedByDate.get(str(x.d)) || 0) + num(x.reach),
    );
  }

  /* 실제 문의 */
  const inquiries: MetaInflow["inquiries"] = [];
  const inquiriesByPlatform = new Map<string, number>();
  const inquiriesByDate = new Map<string, number>();
  for (const x of r[5]) {
    const ch = inquiryChannel({
      referrer: str(x.referrer),
      landing_url: str(x.landing_url),
      source_channel: str(x.source_channel),
    });
    if (ch.key !== "meta_ad") continue;
    const m = keyOf(ch.utmId, ch.utmCampaign);
    if (campaign && m.id !== campaign) continue;
    const s = siteOf(m);
    s.inquiries += 1;
    const product = str(x.product_name) || "미선택";
    s.products.set(product, (s.products.get(product) || 0) + 1);
    const platform = ch.utmSource
      ? metaPlatformLabel(ch.utmSource)
      : "알 수 없음";
    inquiriesByPlatform.set(
      platform,
      (inquiriesByPlatform.get(platform) || 0) + 1,
    );
    const createdAt = toKst(str(x.created_at));
    const day = createdAt.slice(0, 10);
    inquiriesByDate.set(day, (inquiriesByDate.get(day) || 0) + 1);
    inquiries.push({
      id: num(x.id),
      createdAt,
      product,
      people: num(x.people_count),
      platform,
      campaignName: m.name,
    });
  }

  /* 캠페인 카드 — 기간 안에 집행했거나 사이트 도착이 있는 캠페인만 */
  const campaigns: MetaInflowCampaign[] = [];
  for (const c of r[1]) {
    const id = str(c.campaign_id);
    if (campaign && id !== campaign) continue;
    const s = site.get(id);
    if (!num(c.imp) && !num(c.sp) && !s) continue;
    campaigns.push({
      id,
      name: str(c.name),
      status: str(c.status),
      effectiveStatus: str(c.effective_status),
      objective: str(c.objective),
      firstDate: str(c.d0) || null,
      lastDate: str(c.d1) || null,
      spend: usd(c.sp),
      impressions: num(c.imp),
      clicks: num(c.clk),
      landingPageViews: num(c.lpv),
      pixelLeads: num(c.leads),
      sessions: s?.sessions || 0,
      reached: s?.reached || 0,
      inquiries: s?.inquiries || 0,
      platforms: [...(s?.platforms || [])]
        .map(([label, sessions]) => ({ label, sessions }))
        .sort((a, b) => b.sessions - a.sessions),
      products: [...(s?.products || [])]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    });
    site.delete(id);
  }
  // Meta 수집 대상에 없는 꼬리표(옛 캠페인 등)도 사이트 도착이 있으면 카드로 남긴다
  for (const [key, s] of site) {
    campaigns.push({
      id: key,
      name: s.name,
      status: "UNKNOWN",
      effectiveStatus: "UNKNOWN",
      objective: "",
      firstDate: null,
      lastDate: null,
      spend: 0,
      impressions: 0,
      clicks: 0,
      landingPageViews: 0,
      pixelLeads: 0,
      sessions: s.sessions,
      reached: s.reached,
      inquiries: s.inquiries,
      platforms: [...s.platforms].map(([label, sessions]) => ({
        label,
        sessions,
      })),
      products: [...s.products].map(([name, count]) => ({ name, count })),
    });
  }
  campaigns.sort(
    (a, b) =>
      (b.lastDate || "").localeCompare(a.lastDate || "") || b.spend - a.spend,
  );

  const sumOf = (k: keyof MetaInflowCampaign) =>
    campaigns.reduce(
      (a, c) => a + (typeof c[k] === "number" ? (c[k] as number) : 0),
      0,
    );

  /* 소재 */
  const adCountByCampaign = new Map<string, number>();
  for (const a of ads)
    adCountByCampaign.set(
      str(a.campaign_id),
      (adCountByCampaign.get(str(a.campaign_id)) || 0) + 1,
    );
  const adList: MetaInflow["ads"] = ads.map((a) => {
    const adId = str(a.ad_id);
    const cid = str(a.campaign_id);
    // 옛 소재는 주소에 ad_id 가 없다 → 캠페인에 소재가 하나뿐이면 캠페인 도착을 그 소재로 본다
    const sessions =
      sessionsByAd.get(adId) ??
      (adCountByCampaign.get(cid) === 1
        ? campaigns.find((c) => c.id === cid)?.sessions || 0
        : 0);
    return {
      adId,
      name: str(a.name),
      campaignId: cid,
      campaignName: byId.get(cid) || cid,
      spend: usd(a.sp),
      impressions: num(a.imp),
      clicks: num(a.clk),
      pixelLeads: num(a.leads),
      thruplays: num(a.tp),
      p25: num(a.p25),
      p50: num(a.p50),
      p75: num(a.p75),
      p100: num(a.p100),
      sessions,
    };
  });

  /* 분해 */
  const dim = (d: string) => breakdowns.filter((x) => str(x.dimension) === d);
  const placements = dim("placement")
    .map((x) => ({
      bucket: str(x.bucket),
      label: placementLabel(str(x.bucket)),
      spend: usd(x.sp),
      impressions: num(x.imp),
      clicks: num(x.clk),
    }))
    .sort((a, b) => b.spend - a.spend);
  const platformSpend = new Map<string, { spend: number; clicks: number }>();
  for (const p of placements) {
    const k = placementPlatform(p.bucket);
    const v = platformSpend.get(k) || { spend: 0, clicks: 0 };
    v.spend += p.spend;
    v.clicks += p.clicks;
    platformSpend.set(k, v);
  }
  const platformKeys = new Set([
    ...platformSpend.keys(),
    ...sessionsByPlatform.keys(),
    ...inquiriesByPlatform.keys(),
  ]);
  const platforms = [...platformKeys]
    .map((label) => ({
      label,
      spend: platformSpend.get(label)?.spend || 0,
      clicks: platformSpend.get(label)?.clicks || 0,
      sessions: sessionsByPlatform.get(label) || 0,
      inquiries: inquiriesByPlatform.get(label) || 0,
    }))
    .sort((a, b) => b.spend - a.spend || b.sessions - a.sessions);
  const simple = (d: string, label: (b: string) => string) =>
    dim(d)
      .map((x) => ({
        bucket: str(x.bucket),
        label: label(str(x.bucket)),
        spend: usd(x.sp),
        clicks: num(x.clk),
      }))
      .sort((a, b) => b.clicks - a.clicks);
  const hours = Array.from({ length: 24 }, () => 0);
  for (const x of dim("hour")) {
    const h = Number(str(x.bucket));
    if (h >= 0 && h < 24) hours[h] += num(x.clk);
  }

  const lastSuccessAt = str(sync.last_success_at) || null;
  let tracked = 0;
  try {
    tracked = (JSON.parse(str(sync.scope_json) || "[]") as unknown[]).length;
  } catch {
    tracked = 0;
  }
  /* 날짜별 — Meta 집계 + 사이트 도착·견적 화면·문의 */
  const byDate = new Map<string, MetaInflow["daily"][number]>();
  const dayOf = (date: string) => {
    let v = byDate.get(date);
    if (!v)
      byDate.set(
        date,
        (v = {
          date,
          spend: 0,
          clicks: 0,
          impressions: 0,
          landingPageViews: 0,
          pixelLeads: 0,
          sessions: 0,
          reached: 0,
          inquiries: 0,
        }),
      );
    return v;
  };
  for (const x of r[2]) {
    const v = dayOf(str(x.date));
    v.spend = usd(x.sp);
    v.clicks = num(x.clk);
    v.impressions = num(x.imp);
    v.landingPageViews = num(x.lpv);
    v.pixelLeads = num(x.leads);
  }
  for (const [d, n] of sessionsByDate) dayOf(d).sessions = n;
  for (const [d, n] of reachedByDate) dayOf(d).reached = n;
  for (const [d, n] of inquiriesByDate) dayOf(d).inquiries = n;
  // 집행이 없던 날도 목록에 0으로 남긴다. 수집 시작 전 날짜는 집행 여부를 모르므로 채우지 않는다.
  if (byDate.size > 0) {
    const since = str(sync.available_since);
    const from = since > start ? since : start;
    const today = new Date(Date.now() + 9 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const until = end < today ? end : today;
    for (let d = from, i = 0; d <= until && i < 400; d = shiftYmd(d, 1), i++)
      dayOf(d);
  }
  const daily = [...byDate.values()]
    .filter((x) => x.date >= start && x.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    range: { start, end, campaign: campaign || "all" },
    sync: {
      status: str(sync.status) || "NOT_COLLECTED",
      lastSuccessAt,
      stale:
        !lastSuccessAt || Date.now() - Date.parse(lastSuccessAt) > 2 * 3600_000,
      campaignsTracked: tracked,
      breakdownReady,
    },
    summary: {
      spend: sumOf("spend"),
      impressions: sumOf("impressions"),
      clicks: sumOf("clicks"),
      landingPageViews: sumOf("landingPageViews"),
      pixelLeads: sumOf("pixelLeads"),
      sessions: sumOf("sessions"),
      reached: sumOf("reached"),
      inquiries: sumOf("inquiries"),
      thruplays: adList.reduce((a, x) => a + x.thruplays, 0),
      p25: adList.reduce((a, x) => a + x.p25, 0),
      p50: adList.reduce((a, x) => a + x.p50, 0),
      p75: adList.reduce((a, x) => a + x.p75, 0),
      p100: adList.reduce((a, x) => a + x.p100, 0),
    },
    campaigns,
    daily,
    ads: adList,
    placements,
    platforms,
    age: dim("age")
      .map((x) => ({
        bucket: str(x.bucket),
        spend: usd(x.sp),
        clicks: num(x.clk),
        impressions: num(x.imp),
      }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket)),
    gender: simple("gender", genderLabel),
    region: simple("region", regionLabel).slice(0, 10),
    device: simple("device", deviceLabel),
    hours,
    inquiries: inquiries.slice(0, 50),
  };
}
