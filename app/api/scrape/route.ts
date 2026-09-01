import { NextRequest, NextResponse } from "next/server";
import { getKnowledgeBase, saveScrapedFactsForSite } from "@/lib/kb";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function scrapeBanner(url: string): Promise<string> {
  const puppeteer = (await import("puppeteer-core")).default;

  const apiKey = process.env.BROWSERLESS_API_KEY;
  if (!apiKey) {
    throw new Error("BROWSERLESS_API_KEY is not configured");
  }

  // Connects to a browser running on Browserless's infrastructure instead of
  // launching Chromium locally inside the Vercel function. This sidesteps the
  // whole class of "missing shared library" failures that come from trying
  // to run a full browser binary inside a serverless function.
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://production-sfo.browserless.io?token=${apiKey}`,
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

    if (candidates.length === 0) {
      return "No promo banner text detected on this pass.";
    }
    // Prefer the fragment that actually names a usable code, that's the one
    // an agent needs, over generic teasers like "SALE" or "Sign up & Save".
    const withCode = candidates.filter((c) => /code\s*:?\s*[a-z0-9]{3,}/i.test(c));
    const pool = withCode.length > 0 ? withCode : candidates;
    // Among the useful candidates, the longest one is usually the full banner
    // sentence rather than a short repeated nav fragment.
    const best = pool.reduce((a, b) => (b.length > a.length ? b : a));
    return best;
  } finally {
    await browser.close();
  }
}

async function runScrape(siteId?: string) {
  try {
    const kb = await getKnowledgeBase();
    const site = kb.sites.find((s) => s.id === siteId) || kb.sites[0];
    const url = `https://www.${site.domains[0]}`;
    const banner = await scrapeBanner(url);
    const result = await saveScrapedFactsForSite(site.id, {
      homepageBanner: banner,
      checkedAt: new Date().toISOString(),
      source: url,
    });
    const updated = result.sites.find((s) => s.id === site.id);
    return { ok: true, siteId: site.id, banner, scrapedFacts: updated?.scrapedFacts };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

// GET, no site specified, used by the daily Vercel Cron: scrapes every site
// in the knowledge base in turn, one request per site.
export async function GET() {
  const kb = await getKnowledgeBase();
  const results = [];
  for (const site of kb.sites) {
    results.push(await runScrape(site.id));
  }
  const ok = results.every((r) => r.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 500 });
}

// POST { siteId }, used by the manual "Refresh now" button for a single site.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await runScrape(body.siteId);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
