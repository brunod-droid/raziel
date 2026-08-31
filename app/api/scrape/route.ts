import { NextResponse } from "next/server";
import { saveScrapedFacts } from "@/lib/kb";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TARGET_URL = process.env.SCRAPE_URL || "https://www.theograce.com";
// Pin a specific @sparticuz/chromium release so the remote binary matches the
// npm package version above. Update both together if you bump the dependency.
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar";

async function scrapeBanner(url: string): Promise<string> {
  // Imported lazily so the rest of the app doesn't pay for this on every cold start.
  const chromium = (await import("@sparticuz/chromium-min")).default;
  const puppeteer = (await import("puppeteer-core")).default;

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
    // Give client-side rendered banners (announcement bars injected after
    // hydration) a moment to appear, this is exactly the content a plain
    // fetch cannot see.
    await new Promise((r) => setTimeout(r, 2500));

    const candidates: string[] = await page.evaluate(() => {
      const promoPattern = /(\d{1,2}%\s*off|sale|code\s+[a-z0-9]{3,})/i;
      const found: string[] = [];
      document.querySelectorAll("body *").forEach((el) => {
        const text = (el as HTMLElement).innerText?.trim();
        if (
          text &&
          text.length > 0 &&
          text.length < 120 &&
          promoPattern.test(text) &&
          el.children.length === 0 // leaf nodes only, avoids grabbing whole page containers
        ) {
          found.push(text);
        }
      });
      return Array.from(new Set(found)).slice(0, 8);
    });

    return candidates.length > 0 ? candidates.join(" | ") : "No promo banner text detected on this pass.";
  } finally {
    await browser.close();
  }
}

async function runScrape() {
  try {
    const banner = await scrapeBanner(TARGET_URL);
    const result = await saveScrapedFacts({
      homepageBanner: banner,
      checkedAt: new Date().toISOString(),
      source: TARGET_URL,
    });
    return { ok: true, banner, kb: result.scrapedFacts };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function GET() {
  const result = await runScrape();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST() {
  const result = await runScrape();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
