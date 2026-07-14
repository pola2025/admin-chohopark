import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  saveBotDailyStats,
  getBotDailyStatsFromCache,
  type BotVisitRecord,
} from "@/lib/d1-analytics-cache";

// 인메모리 버퍼: 매 요청마다 D1에 쓰면 쓰기 비용이 커지므로
// 버퍼에 쌓아두고 일정 수량 도달 시 flush
const botBuffer: BotVisitRecord[] = [];
const humanBuffer: { date: string; timestamp: string }[] = [];
const FLUSH_THRESHOLD = 20; // 20건 쌓이면 flush
let lastFlush = Date.now();
const FLUSH_INTERVAL = 60_000; // 1분마다 flush

// 일별 카운터 (인메모리, flush 시 D1에 합산)
const dailyCounts: Record<
  string,
  {
    bot: number;
    human: number;
    categories: Record<string, number>;
    bots: Record<string, number>;
  }
> = {};

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function getDailyCounter(date: string) {
  if (!dailyCounts[date]) {
    dailyCounts[date] = { bot: 0, human: 0, categories: {}, bots: {} };
  }
  return dailyCounts[date];
}

async function flushBotBuffer() {
  if (botBuffer.length === 0 && humanBuffer.length === 0) return;

  // 봇 방문 개별 기록 저장
  const botsToSave = botBuffer.splice(0, botBuffer.length);
  humanBuffer.splice(0, humanBuffer.length);

  // 배치로 D1 저장 (봇만 - 일반 방문은 카운트만)
  if (botsToSave.length > 0) {
    try {
      const { saveBotVisitsBatch } = await import("@/lib/d1-analytics-cache");
      await saveBotVisitsBatch(botsToSave);
    } catch (error) {
      console.error("Failed to flush bot buffer:", error);
    }
  }

  // 일별 집계 저장
  for (const [date, counts] of Object.entries(dailyCounts)) {
    const total = counts.bot + counts.human;
    if (total === 0) continue;

    try {
      await saveBotDailyStats({
        date,
        total_visits: total,
        bot_visits: counts.bot,
        human_visits: counts.human,
        bot_percentage: total > 0 ? (counts.bot / total) * 100 : 0,
        categories: JSON.stringify(
          Object.entries(counts.categories)
            .sort((a, b) => b[1] - a[1])
            .map(([category, count]) => ({ category, count })),
        ),
        top_bots: JSON.stringify(
          Object.entries(counts.bots)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([name, count]) => ({ name, count })),
        ),
      });
    } catch (error) {
      console.error(`Failed to save bot daily stats for ${date}:`, error);
    }
  }

  lastFlush = Date.now();
}

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

// POST: 방문 기록 (미들웨어 내부 호출 전용)
export async function POST(request: NextRequest) {
  // 내부 호출 검증
  if (!INTERNAL_API_KEY) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }
  const internalKey = request.headers.get("x-internal-key") || "";
  if (
    internalKey.length !== INTERNAL_API_KEY.length ||
    !timingSafeEqual(Buffer.from(internalKey), Buffer.from(INTERNAL_API_KEY))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { isBot, botName, category, path, ip } = body;

    const now = new Date();
    const timestamp = now.toISOString();
    const date = timestamp.split("T")[0];
    const counter = getDailyCounter(date);

    if (isBot) {
      counter.bot++;
      counter.categories[category] = (counter.categories[category] || 0) + 1;
      counter.bots[botName] = (counter.bots[botName] || 0) + 1;

      botBuffer.push({
        timestamp,
        date,
        botName: botName || "Unknown",
        category: category || "기타",
        path: path || "/",
        ip: ip || "",
      });
    } else {
      counter.human++;
      humanBuffer.push({ date, timestamp });
    }

    // 버퍼가 임계치에 도달하거나 시간이 지나면 flush
    const shouldFlush =
      botBuffer.length >= FLUSH_THRESHOLD ||
      Date.now() - lastFlush >= FLUSH_INTERVAL;

    if (shouldFlush) {
      // 비동기로 flush (응답 차단 없음)
      flushBotBuffer().catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET: 봇 통계 조회 (chohopark admin 무인증 공개 — 미들웨어 미적용)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "7", 10);

  // D1에서 일별 집계 데이터 조회
  const dailyStats = await getBotDailyStatsFromCache(days);

  // 인메모리 오늘 데이터 합산
  const todayKey = getTodayKey();
  const todayCounter = dailyCounts[todayKey];
  const hasTodayInCache = dailyStats.some((s) => s.date === todayKey);

  // 전체 집계
  let totalVisits = 0;
  let botVisits = 0;
  let humanVisits = 0;
  const allCategories: Record<string, number> = {};
  const allBots: Record<string, number> = {};

  for (const stat of dailyStats) {
    totalVisits += stat.total_visits;
    botVisits += stat.bot_visits;
    humanVisits += stat.human_visits;

    try {
      const cats = JSON.parse(stat.categories) as Array<{
        category: string;
        count: number;
      }>;
      for (const cat of cats) {
        allCategories[cat.category] =
          (allCategories[cat.category] || 0) + cat.count;
      }
    } catch {
      /* ignore parse errors */
    }

    try {
      const bots = JSON.parse(stat.top_bots) as Array<{
        name: string;
        count: number;
      }>;
      for (const bot of bots) {
        allBots[bot.name] = (allBots[bot.name] || 0) + bot.count;
      }
    } catch {
      /* ignore parse errors */
    }
  }

  // 오늘 인메모리 데이터가 아직 D1에 없으면 합산
  if (todayCounter && !hasTodayInCache) {
    totalVisits += todayCounter.bot + todayCounter.human;
    botVisits += todayCounter.bot;
    humanVisits += todayCounter.human;

    for (const [cat, count] of Object.entries(todayCounter.categories)) {
      allCategories[cat] = (allCategories[cat] || 0) + count;
    }
    for (const [name, count] of Object.entries(todayCounter.bots)) {
      allBots[name] = (allBots[name] || 0) + count;
    }
  }

  const botPercentage = totalVisits > 0 ? (botVisits / totalVisits) * 100 : 0;

  // 카테고리별 분포
  const categories = Object.entries(allCategories)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      percentage: botVisits > 0 ? ((count / botVisits) * 100).toFixed(1) : "0",
    }));

  // 상위 봇
  const topBots = Object.entries(allBots)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // 일별 트렌드
  const dailyTrend = dailyStats
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({
      date: s.date,
      total: s.total_visits,
      bots: s.bot_visits,
      humans: s.human_visits,
      botRate: s.bot_percentage.toFixed(1),
    }));

  // 최근 봇 방문 (오늘 버퍼에서)
  const recentBots = botBuffer
    .slice(-20)
    .reverse()
    .map((b) => ({
      timestamp: b.timestamp,
      botName: b.botName,
      category: b.category,
      path: b.path,
    }));

  const trackingSince =
    dailyStats.length > 0 ? dailyStats[dailyStats.length - 1].date : todayKey;

  return NextResponse.json({
    period: `${days}일`,
    total_visits: totalVisits,
    bot_visits: botVisits,
    human_visits: humanVisits,
    bot_percentage: parseFloat(botPercentage.toFixed(1)),
    categories,
    top_bots: topBots,
    daily_trend: dailyTrend,
    recent_bots: recentBots,
    tracking_since: trackingSince,
    total_tracked: totalVisits,
  });
}
