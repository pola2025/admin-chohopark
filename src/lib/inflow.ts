/**
 * 유입 경로 분류 · 페이지 이름표 (방문자 통계 / Meta 광고 공용 SSoT)
 *
 * - 방문은 세션 첫 페이지의 referrer + UTM + 광고 클릭 ID 로 분류한다.
 * - 문의는 접수 때 저장된 referrer + landing_url(첫 유입 주소) 로 같은 함수를 태운다.
 * - Meta 광고 = utm_medium 에 paid/cpc + utm_source 가 ig·fb·an·msg 등 (소재 url_tags 규칙)
 */

export type ChannelKey =
  | "naver_search"
  | "naver_place"
  | "naver_blog"
  | "naver_cafe"
  | "naver_ad"
  | "google"
  | "meta_ad"
  | "instagram"
  | "facebook"
  | "threads"
  | "ai"
  | "kakao"
  | "bing"
  | "other_search"
  | "campaign"
  | "referral"
  | "direct";

export const CHANNELS: Record<
  ChannelKey,
  { label: string; color: string; paid?: boolean }
> = {
  naver_search: { label: "네이버 검색", color: "#03C75A" },
  naver_place: { label: "네이버 플레이스", color: "#22C55E" },
  naver_blog: { label: "네이버 블로그", color: "#86EFAC" },
  naver_cafe: { label: "네이버 카페", color: "#4ADE80" },
  naver_ad: { label: "네이버 파워링크", color: "#15803D", paid: true },
  google: { label: "구글", color: "#F59E0B" },
  meta_ad: { label: "Meta 광고", color: "#1877F2", paid: true },
  instagram: { label: "인스타그램 (광고 아님)", color: "#C084FC" },
  facebook: { label: "페이스북 (광고 아님)", color: "#93C5FD" },
  threads: { label: "스레드", color: "#F472B6" },
  ai: { label: "AI 검색 (ChatGPT 등)", color: "#0891B2" },
  kakao: { label: "카카오·다음", color: "#EAB308" },
  bing: { label: "빙", color: "#94A3B8" },
  other_search: { label: "기타 검색엔진", color: "#A3A3A3" },
  campaign: { label: "기타 꼬리표 링크", color: "#A78BFA" },
  referral: { label: "기타 사이트", color: "#CBD5E1" },
  direct: { label: "직접 방문", color: "#6B7280" },
};

export interface InflowSignal {
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  /** 네이버 검색광고 파라미터(NaPm·n_media) 존재 */
  naverAd?: boolean;
}

const META_SOURCES = /^(ig|fb|an|msg|instagram|facebook|meta|threads)$/;

function hostOf(referrer: string): string {
  const raw = referrer.trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("android-app://")) return raw.slice(14).split("/")[0];
  try {
    return new URL(raw).hostname;
  } catch {
    return raw.split("/")[0];
  }
}

export function classifyInflow(s: InflowSignal): ChannelKey {
  const src = (s.utmSource || "").trim().toLowerCase();
  const med = (s.utmMedium || "").trim().toLowerCase();
  const host = hostOf(s.referrer || "");
  const paid = /paid|cpc|ppc/.test(med);

  if (
    s.naverAd ||
    host === "ad.search.naver.com" ||
    (src.includes("naver") && paid)
  )
    return "naver_ad";
  if (paid && META_SOURCES.test(src)) return "meta_ad";
  if (
    src.includes("chatgpt") ||
    src.includes("perplexity") ||
    src.includes("openai")
  )
    return "ai";
  if (src === "ig" || src.includes("instagram")) return "instagram";
  if (src === "fb" || src.includes("facebook")) return "facebook";
  if (src.includes("threads")) return "threads"; // 스레드 프로필 짧은 링크(/th). 광고 집행분은 위에서 meta_ad
  if (src.includes("naver")) {
    if (/blog|블로그/.test(med)) return "naver_blog"; // 블로그 글 CTA 짧은 링크(/r/blog)
    return /place|플레이스/.test(med) ? "naver_place" : "naver_search";
  }
  if (src.includes("google")) return "google";
  if (src.includes("kakao") || src.includes("daum")) return "kakao";

  if (host) {
    if (/(^|\.)chorigol\.net$/.test(host)) return src ? "campaign" : "direct";
    if (
      host.includes("place.naver") ||
      host.includes("booking.naver") ||
      host.includes("map.naver")
    )
      return "naver_place";
    if (host.includes("blog.naver") || host.includes("naverblogwidget"))
      return "naver_blog";
    if (host.includes("cafe.naver")) return "naver_cafe";
    if (host.endsWith("naver.com") || host.startsWith("com.nhn.android"))
      return "naver_search";
    if (
      /chatgpt|openai|perplexity|gemini\.google|copilot|claude\.ai|notebook(lm)?\.google|wrtn/.test(
        host,
      )
    )
      return "ai";
    // 스레드 안드로이드 앱의 패키지 이름은 com.instagram.barcelona 라서 인스타그램보다 먼저 본다
    if (/(^|\.)threads\.(net|com)$|^com\.instagram\.barcelona$/.test(host))
      return "threads";
    if (host.includes("instagram")) return "instagram";
    if (
      host.includes("facebook") ||
      host === "fb.com" ||
      host.endsWith(".fb.com")
    )
      return "facebook";
    if (/(^|\.)google\.|googlequicksearchbox/.test(host)) return "google";
    if (host.includes("daum") || host.includes("kakao")) return "kakao";
    if (host.includes("bing")) return "bing";
    if (/yahoo|duckduckgo|zum\.com|nate\.com|baidu|yandex|ecosia/.test(host))
      return "other_search";
  }
  if (src) return "campaign";
  if (!host) return "direct";
  return "referral";
}

/** 쿼리 문자열에서 값 하나 (실패 시 빈 문자열) */
export function queryParam(
  query: string | null | undefined,
  key: string,
): string {
  if (!query) return "";
  try {
    return (
      new URLSearchParams(query.replace(/^[^?]*\?/, "").replace(/^\?/, "")).get(
        key,
      ) || ""
    );
  } catch {
    return "";
  }
}

/** 접수된 문의 → 유입 신호 (landing_url 의 꼬리표 + 저장된 referrer, 둘 다 없으면 사이트 분류 라벨) */
export function inquiryChannel(row: {
  referrer?: string | null;
  landing_url?: string | null;
  source_channel?: string | null;
}): { key: ChannelKey; utmSource: string; utmCampaign: string; utmId: string } {
  const url = row.landing_url || "";
  const q = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const utmSource = queryParam(q, "utm_source");
  const utmMedium = queryParam(q, "utm_medium");
  const utmCampaign = queryParam(q, "utm_campaign");
  const utmId = queryParam(q, "utm_id");
  const naverAd = !!(queryParam(q, "NaPm") || queryParam(q, "n_media"));
  let key = classifyInflow({
    referrer: row.referrer,
    utmSource,
    utmMedium,
    naverAd,
  });
  if (key === "direct" && !row.referrer && !utmSource)
    key = labelToChannel(row.source_channel);
  return { key, utmSource, utmCampaign, utmId };
}

/** 사이트가 접수 때 붙인 한국어 라벨 → 채널 (꼬리표·referrer 가 비어 있는 옛 접수용) */
function labelToChannel(label: string | null | undefined): ChannelKey {
  const v = (label || "").trim();
  if (!v || v === "직접") return "direct";
  if (v === "Meta 광고") return "meta_ad";
  if (v.includes("파워링크")) return "naver_ad";
  if (v.includes("플레이스")) return "naver_place";
  if (v.includes("블로그")) return "naver_blog";
  if (v.includes("카페")) return "naver_cafe";
  if (v.includes("네이버")) return "naver_search";
  if (v === "구글") return "google";
  if (v === "인스타그램") return "instagram";
  if (v === "페이스북") return "facebook";
  if (v === "스레드") return "threads";
  if (v.includes("카카오") || v.includes("다음")) return "kakao";
  if (v === "빙") return "bing";
  if (/chatgpt|perplexity|gemini/i.test(v)) return "ai";
  return "referral";
}

export const META_PLATFORM_LABELS: Record<string, string> = {
  ig: "인스타그램",
  instagram: "인스타그램",
  fb: "페이스북",
  facebook: "페이스북",
  an: "오디언스 네트워크",
  msg: "메신저",
  threads: "스레드",
};

export function metaPlatformLabel(utmSource: string): string {
  return META_PLATFORM_LABELS[utmSource.toLowerCase()] || utmSource || "기타";
}

/* ───────────── 페이지 이름표 ───────────── */

export type PageKind = "메뉴" | "안내글" | "소식" | "광고 랜딩" | "기타";

const MENU_LABELS: Record<string, string> = {
  "/": "홈",
  "/booking": "상품·요금",
  "/facilities": "시설",
  "/guide": "이용 안내",
  "/guide/rules": "이용 규칙",
  "/guide/refund": "환불 규정",
  "/location": "오시는 길",
  "/about": "초호 이야기",
  "/about/news": "소식 목록",
  "/privacy": "개인정보처리방침",
  "/terms": "이용약관",
};

export function safeDecode(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** 슬러그 → 읽을 수 있는 문장 (하이픈 → 띄어쓰기, 99000원 → 99,000원) */
export function humanizeSlug(slug: string): string {
  return slug
    .replace(/-?\d{4}-\d{2}-\d{2}-homepage$/, "")
    .replace(/-homepage$/, "")
    .replace(/-/g, " ")
    .replace(/(\d{4,})(?=원|평|명)/g, (n) => Number(n).toLocaleString("ko-KR"))
    .replace(/\bbbq\b/gi, "BBQ")
    .trim();
}

export interface PageLabel {
  label: string;
  kind: PageKind;
  /** 같은 주제 글을 한 줄로 묶을 때의 열쇠 */
  topic: string;
  decodedPath: string;
  newsSlug?: string;
}

export function pageLabel(
  rawPath: string,
  postTitles: Record<string, string> = {},
): PageLabel {
  const decodedPath = safeDecode(rawPath || "/").replace(/\/+$/, "") || "/";
  const menu = MENU_LABELS[decodedPath];
  if (menu) return { label: menu, kind: "메뉴", topic: menu, decodedPath };
  if (decodedPath === "/workshop")
    return {
      label: "단체워크샵 견적 (광고 랜딩)",
      kind: "광고 랜딩",
      topic: "단체워크샵 견적",
      decodedPath,
    };
  const news = decodedPath.match(/^\/about\/news\/(.+)$/);
  if (news) {
    const slug = news[1];
    const topic = humanizeSlug(slug);
    return {
      label: postTitles[slug] || topic,
      kind: "소식",
      topic: `소식 · ${topic}`,
      decodedPath,
      newsSlug: slug,
    };
  }
  const guide = decodedPath.match(/^\/guide\/(.+)$/);
  if (guide) {
    const label = humanizeSlug(guide[1]);
    return { label, kind: "안내글", topic: label, decodedPath };
  }
  if (decodedPath.startsWith("/contract"))
    return { label: "약정서", kind: "기타", topic: "약정서", decodedPath };
  return { label: decodedPath, kind: "기타", topic: decodedPath, decodedPath };
}

/* ───────────── Meta 광고 캠페인·분해 이름표 ───────────── */

/** 사이트 꼬리표(utm_id 또는 utm_campaign) → Meta 캠페인. utm_campaign 은 앞 6자리(YYMMDD)로 이름과 맞춘다 */
export function matchMetaCampaign(
  key: string,
  byId: Map<string, string>,
  fallbackLabel = "",
): { id: string | null; name: string } {
  if (/^\d{8,}$/.test(key) && byId.has(key))
    return { id: key, name: byId.get(key)! };
  const code = key.match(/^(\d{6})_/)?.[1];
  if (code)
    for (const [id, name] of byId)
      if (name.startsWith(code)) return { id, name };
  // 수집 전인 새 캠페인은 이름을 모르므로 사이트 꼬리표(utm_campaign)를 대신 보여 준다
  return {
    id: /^\d{8,}$/.test(key) ? key : null,
    name: fallbackLabel || key || "(캠페인 꼬리표 없음)",
  };
}

const PLATFORM_KO: Record<string, string> = {
  instagram: "인스타그램",
  facebook: "페이스북",
  audience_network: "오디언스 네트워크",
  messenger: "메신저",
  threads: "스레드",
};
const POSITION_KO: Record<string, string> = {
  instagram_reels: "릴스",
  instagram_stories: "스토리",
  instagram_explore: "탐색",
  instagram_explore_grid_home: "탐색 홈",
  instagram_profile_feed: "프로필 피드",
  facebook_reels: "릴스",
  facebook_reels_overlay: "릴스 오버레이",
  facebook_stories: "스토리",
  feed: "피드",
  video_feeds: "동영상 피드",
  marketplace: "마켓플레이스",
  search: "검색",
  instream_video: "인스트림 동영상",
  an_classic: "네이티브·배너",
  rewarded_video: "보상형 동영상",
  messenger_inbox: "받은편지함",
  messenger_stories: "스토리",
  threads_feed: "피드",
};
export function placementLabel(bucket: string): string {
  const [platform, position = ""] = bucket.split(":");
  return `${PLATFORM_KO[platform] || platform} ${POSITION_KO[position] || position.replace(/_/g, " ")}`.trim();
}
export function placementPlatform(bucket: string): string {
  return PLATFORM_KO[bucket.split(":")[0]] || bucket.split(":")[0];
}

const REGION_KO: Record<string, string> = {
  Seoul: "서울",
  "Gyeonggi-do": "경기",
  Incheon: "인천",
  Busan: "부산",
  Daegu: "대구",
  Daejeon: "대전",
  Gwangju: "광주",
  Ulsan: "울산",
  Sejong: "세종",
  "Gangwon-do": "강원",
  "Chungcheongbuk-do": "충북",
  "Chungcheongnam-do": "충남",
  "Jeollabuk-do": "전북",
  "Jeollanam-do": "전남",
  "Gyeongsangbuk-do": "경북",
  "Gyeongsangnam-do": "경남",
  "Jeju-do": "제주",
  Unknown: "알 수 없음",
};
export function regionLabel(bucket: string): string {
  return REGION_KO[bucket] || bucket;
}
const GENDER_KO: Record<string, string> = {
  male: "남성",
  female: "여성",
  unknown: "알 수 없음",
};
export function genderLabel(bucket: string): string {
  return GENDER_KO[bucket] || bucket;
}
const DEVICE_KO: Record<string, string> = {
  mobile_app: "모바일 앱",
  mobile_web: "모바일 웹",
  desktop: "데스크톱",
};
export function deviceLabel(bucket: string): string {
  return DEVICE_KO[bucket] || bucket;
}
