/**
 * 접수내역 화면 실측 스크린샷.
 * 로그인 → 목록 → 상세 카드 → 히트맵 날짜 필터 순으로 눌러 보고 저장한다.
 * 사용: ADMIN_PASSWORD=... SHOT_DIR=... node scripts/shot-inquiries.mjs [baseUrl]
 */
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "https://admin.chorigol.net";
const OUT = process.env.SHOT_DIR || ".";
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1400 });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2" });
  await page.type('input[type="password"]', process.env.ADMIN_PASSWORD ?? "");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);

  await page.goto(`${BASE}/dashboard/inquiries`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 3500));
  await page.screenshot({ path: `${OUT}/live_inquiries_list.png` });

  const rows = await page.$$("section button.flex.w-full");
  if (rows.length) {
    await rows[0].click();
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: `${OUT}/live_inquiries_detail.png` });
  }
  console.log("행 개수:", rows.length);

  // 히트맵에서 수요 상위 첫 칸을 눌러 필터가 걸리는지
  const chips = await page.$$("section button.rounded-full");
  if (chips.length) {
    await chips[0].click();
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: `${OUT}/live_inquiries_filtered.png` });
  }

  const text = await page.evaluate(() => document.body.innerText.slice(0, 700));
  console.log("--- 화면 텍스트 ---\n" + text);
} finally {
  await browser.close();
}
