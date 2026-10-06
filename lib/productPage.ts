// Fetches a product page and extracts readable text. Deliberately simple (a
// plain fetch, not Browserless) because the Description, Instructions, and
// Product Details tabs on a theo grace family PDP are server-rendered and
// show up in the raw HTML. This will NOT reliably capture things that only
// render after JavaScript runs, such as the live subtotal as an agent
// changes options, or the Shipping & Returns tab content. For those, the
// Browserless-based scraper used for the homepage banner would be needed.

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

export async function fetchProductPageText(url: string, maxChars = 6000): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ConciergeBot/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`Product page returned ${res.status}`);
  }
  const html = await res.text();
  const text = stripHtml(html);
  return text.length > maxChars ? text.slice(0, maxChars) + "\n[...truncated]" : text;
}
