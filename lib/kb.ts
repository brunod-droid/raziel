import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

// Created lazily, on first real use, rather than at import time. This avoids
// crashing the Next.js build (which imports this module to collect page
// data) before SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are configured.
function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured");
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

const TABLE = "kv_store";

async function kvGet<T>(key: string): Promise<T | null> {
  const { data, error } = await getClient().from(TABLE).select("value").eq("key", key).maybeSingle();
  if (error || !data) return null;
  return data.value as T;
}

async function kvSet(key: string, value: unknown): Promise<void> {
  const { error } = await getClient().from(TABLE).upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Supabase write failed: ${error.message}`);
}

export type PromoCode = {
  code: string;
  discount: string;
  condition: string;
  expiry: string;
};

export type ProcessRule = {
  category: string;
  rule: string;
};

export type ScrapedFacts = {
  homepageBanner: string;
  checkedAt: string | null;
  source: string | null;
};

// Shared across every site, the parts of the process that don't change
// depending on which brand or storefront the message came from.
export type CommonKB = {
  facts: string[];
  rules: ProcessRule[];
};

// One storefront. Each site has its own voice, its own promos, its own
// domain, and can add facts or rules on top of the common trunk.
export type SiteKB = {
  id: string;
  name: string;
  domains: string[];
  voice: string;
  facts: string[];
  promoCodes: PromoCode[];
  rules: ProcessRule[];
  scrapedFacts: ScrapedFacts;
};

export type KnowledgeBase = {
  common: CommonKB;
  sites: SiteKB[];
};

const EMPTY_SCRAPED: ScrapedFacts = {
  homepageBanner: "Not scraped yet, run /api/scrape or wait for the next scheduled run.",
  checkedAt: null,
  source: null,
};

export const DEFAULT_KB: KnowledgeBase = {
  common: {
    facts: [
      "Every piece is handcrafted by skilled artisans in sterling silver, gold vermeil or solid gold, and hand finished, never mass produced.",
      "Engraving is complimentary on every piece, so a name, date or message can be added at no extra cost.",
      "Ring resizing is free but limited to the sizes already listed on that ring's product page, a ring cannot be resized beyond its largest listed size. If the customer needs a larger size than what is offered, suggest a similar style that lists a wider size range instead.",
      "Every order carries a 2 year warranty, with a 5 year extended protection plan available.",
      "Returns are accepted within 100 days on unused items. Personalized pieces can be exchanged for another piece once the original is returned, a price difference may apply.",
      "Diamonds used are lab grown, sourced consciously.",
      "Shipping is free.",
      "Klarna allows customers to pay in 4 installments.",
      "The brand has earned more than 70,000 Trustpilot reviews.",
      "The TG Circle is the brand loyalty program, members earn rewards toward future pieces.",
      "A coupon cannot be applied to an order once it has already been processed, it cannot be applied retroactively. It can still be used on the customer's next order as long as it remains valid.",
      "Store credit is applied in the dedicated Store Credit field at checkout, not in the Coupon Code field, the two are separate and a store credit code will not work if entered as a coupon.",
      "When a customer wants no engraving at all rather than blank text, they can enter three dashes as a placeholder in the engraving field at checkout, then reply to their order confirmation email to confirm no engraving is wanted, so production notes it correctly.",
      "Each personalized piece has a maximum number of beads, charms or characters it can hold, tied to its design. Before promising an addition, check the specific product's stated limit rather than assuming any amount can be added.",
      "Adding a bead, charm or similar addition to an already ordered piece is typically sent to the production team for approval, the customer is notified once it is processed, usually within 24 to 48 hours.",
      "Chains are also sold as a standalone piece under Cable Chain Necklace, available in sterling silver, gold vermeil and solid gold, in several lengths. This is what to search the catalog for when a customer needs a longer or replacement chain for a piece they already own.",
    ],
    rules: [
      { category: "Presale, product or customization question", rule: "Answer the material, sizing, engraving or customization question precisely, this is the largest single category of presale messages. If something isn't possible, such as a stone color swap, say so honestly and offer two or three alternative pieces that do fit what they wanted. If the customer wants no engraving at all rather than blank text, tell them to enter three dashes as a placeholder in the engraving field, then reply to their confirmation email to confirm no engraving, real agents use this exact workaround." },
      { category: "Presale, adding a bead or charm", rule: "Confirm the addition is possible and link to the matching bead or charm product for that specific piece. Every piece has a maximum number of beads or characters, mention it if the customer's request is near or over that limit. If they are adding to an order already placed, tell them it goes to the production team for approval, with a notification usually within 24 to 48 hours." },
      { category: "Presale, coupon or promo code", rule: "If a coupon was meant for an order that has already been processed, explain kindly that it cannot be applied retroactively, but it can be used on their next order while it remains valid. For a first time shopper without a code, use this site's evergreen welcome code, or the current live sitewide sale code if one is active. If a customer reports a coupon or newsletter discount not working, ask for a screenshot of the code and the error before troubleshooting further." },
      { category: "Presale, sizing", rule: "Resizing is free but limited to the sizes already listed on that specific product page, never promise a size beyond what is listed. If the customer needs something larger or smaller than what is offered, suggest a similar style with a wider size range." },
      { category: "Presale, store credit", rule: "Store credit is applied in the separate Store Credit field at checkout, not the Coupon Code field, mention this clearly since it is a common point of confusion. State the store credit amount and how to apply it." },
      { category: "Presale, ETA or shipping before ordering", rule: "Each piece is handcrafted to order, so delivery time depends on the item and the shipping method chosen at checkout, the estimated delivery date shown there is the most accurate answer. If asked for an express shipping cost and you have it, state it plainly rather than sending the customer to look it up." },
      { category: "Presale, item currently out of stock", rule: "Share the restocking estimate if known. If the customer has already signed up for a restock notification, reassure them they will be notified automatically, and invite them to reply once they receive it so the order can be completed smoothly." },
      { category: "Presale, ready to order or gifting moment", rule: "Once a customer signals they are about to place an order, a warm one line reminder about this site's current live offer fits naturally here, this is the authentic house pattern. If it is clearly a gift, a short line about the meaning of giving something personal is welcome." },
      { category: "Order status, calm", rule: "Reassure with the tracking information available and a realistic timeframe. If the delay is under three days, no incentive is needed, warmth is enough. If it is over three days, the site's loyalty points program can be offered as a small thank you for patience." },
      { category: "Order status, delayed or upset", rule: "Open with a genuine apology, especially if the piece was meant for a holiday moment. Give one clear next step. Offer this site's service recovery code. Mention the care team is personally handling it. Keep it sincere, not transactional." },
      { category: "Damaged or defective", rule: "Lead entirely with empathy, this may be a gift for someone they love. No selling language. Walk through the 100 day return and replacement path clearly, note the 2 year warranty for peace of mind, and offer this site's service recovery code as a gesture, not a trade." },
      { category: "General support", rule: "Solve the sizing, engraving or resizing question fully first. For a chain length or replacement question, point to the standalone Cable Chain Necklace, available in the same metal as the customer's piece, rather than asking the customer to describe technical chain details. Only after the question is resolved, a single soft mention of the loyalty program or a related collection is appropriate, one sentence, never more." },
    ],
  },
  sites: [
    {
      id: "theograce",
      name: "theo grace",
      domains: ["theograce.com", "theograce.co.uk"],
      voice:
        "Elegant, warm, refined, emotional and family oriented. theo grace is a premium personalized jewelry house, the original personalized jewelry brand since 2006, previously known as MYKA. It connects personalization to family joy, gifting and meaningful relationships. Nicky Hilton curates several signature collections for the brand (Made to Treasure, Take a Bow, Charmed, and her personal Favorites) and is part of the brand story, so she can be named naturally when a collection or gifting recommendation calls for it, but never in a damaged item or delivery complaint reply.",
      facts: [
        "The Heritage Multiple Name Necklace with Diamonds already offers a 2 Names plus 1 Diamond configuration in its own product options, where the diamond sits between the two names by design. A request for two words placed closer together with a diamond separating them is exactly what this configuration already does, this is not a special customization, it is a standard selectable option on the product page.",
        "For the Russian Rings Necklace, a ring cannot be added to an already purchased piece, the customer needs to purchase a new necklace to get more rings. The compensation approach differs depending on whether the customer bought the Future Engraving option on their original order, the exact process for each case is pending confirmation from the team lead, see the related process rule.",
        "theo grace was previously known as MYKA. For customers in Ireland, the site is still MYKA.com under the MYKA name, that is a separate site entry in this tool, not an error to correct.",
      ],
      promoCodes: [
        { code: "WELCOME15", discount: "15% off first order", condition: "New subscribers, part of Subscribe and Save, confirmed in real order history, evergreen small print link in the top bar", expiry: "Ongoing" },
        { code: "LDAY15", discount: "Extra 15% off sitewide", condition: "Current live sale banner: Labor Day Sale, Extra 15% Off with Code LDAY15, applies to all customers not just new ones", expiry: "Time limited, check the scraped homepage banner below for the current live code" },
        { code: "TG CIRCLE", discount: "Rewards points toward a future piece", condition: "Enrollment in the TG Circle loyalty program, any customer", expiry: "Ongoing" },
        { code: "GRACENOTE", discount: "15% off the next piece", condition: "Service recovery only, used for a damaged piece or a meaningful delay", expiry: "Single use, valid 30 days" },
        { code: "HILTONFAVES", discount: "No discount, a styling nudge", condition: "Point toward Nicky Hilton's Favorites or her named collections when a gift occasion or personal style question comes up", expiry: "Ongoing" },
      ],
      rules: [
        { category: "Russian Rings Necklace, adding a ring", rule: "A ring cannot be added to a Russian Rings Necklace the customer already owns, they need to purchase a new necklace to add more rings. Whether a significant compensation coupon is offered depends on whether the customer's original order included the Future Engraving option, that changes the process. The exact steps for each case are still pending from the team lead, so for now explain clearly that a new piece is needed, stay warm and non committal on the exact compensation, and add a clarifying_questions entry asking the agent to confirm whether the customer's original order included Future Engraving before finalizing the offer." },
      ],
      scrapedFacts: { ...EMPTY_SCRAPED },
    },
    {
      id: "myka",
      name: "MYKA",
      domains: ["myka.com"],
      voice:
        "Elegant, warm, refined, emotional and family oriented, the same house as theo grace under its original name. MYKA is the brand name still used for Irish customers, it is not a rename in progress and not a mistake, it is simply this market's storefront. Connects personalization to family joy, gifting and meaningful relationships.",
      facts: [
        "MYKA is the original name of the same company now known as theo grace elsewhere. Do not explain this as an old or discontinued name to an Irish customer, MYKA.com is their correct, current site.",
      ],
      promoCodes: [],
      rules: [],
      scrapedFacts: { ...EMPTY_SCRAPED },
    },
  ],
};

const KB_KEY = "theo-grace:knowledge-base-v2";

function mergeSite(s: Partial<SiteKB> | undefined, fallback: SiteKB): SiteKB {
  if (!s) return fallback;
  return {
    id: s.id ?? fallback.id,
    name: s.name ?? fallback.name,
    domains: Array.isArray(s.domains) && s.domains.length > 0 ? s.domains : fallback.domains,
    voice: s.voice ?? fallback.voice,
    facts: Array.isArray(s.facts) ? s.facts : fallback.facts,
    promoCodes: Array.isArray(s.promoCodes) ? s.promoCodes : fallback.promoCodes,
    rules: Array.isArray(s.rules) ? s.rules : fallback.rules,
    scrapedFacts: {
      homepageBanner: s.scrapedFacts?.homepageBanner ?? fallback.scrapedFacts.homepageBanner,
      checkedAt: s.scrapedFacts?.checkedAt ?? fallback.scrapedFacts.checkedAt,
      source: s.scrapedFacts?.source ?? fallback.scrapedFacts.source,
    },
  };
}

function mergeWithDefaults(stored: Partial<KnowledgeBase> | null): KnowledgeBase {
  if (!stored) return DEFAULT_KB;
  const common: CommonKB = {
    facts: Array.isArray(stored.common?.facts) && stored.common!.facts.length > 0 ? stored.common!.facts : DEFAULT_KB.common.facts,
    rules: Array.isArray(stored.common?.rules) && stored.common!.rules.length > 0 ? stored.common!.rules : DEFAULT_KB.common.rules,
  };
  // Start from whatever sites are stored (so a newly added site survives a
  // merge), and backfill known defaults (theograce, myka) if they're missing
  // fields, without dropping any custom site the team has since added.
  const storedSites = Array.isArray(stored.sites) ? stored.sites : [];
  const byId = new Map(storedSites.map((s) => [s.id, s]));
  const sites: SiteKB[] = [];
  for (const def of DEFAULT_KB.sites) {
    sites.push(mergeSite(byId.get(def.id), def));
    byId.delete(def.id);
  }
  for (const [, extra] of byId) {
    sites.push(mergeSite(extra, { ...extra, scrapedFacts: { ...EMPTY_SCRAPED } } as SiteKB));
  }
  return { common, sites: sites.length > 0 ? sites : DEFAULT_KB.sites };
}

export async function getKnowledgeBase(): Promise<KnowledgeBase> {
  try {
    const stored = await kvGet<KnowledgeBase>(KB_KEY);
    return mergeWithDefaults(stored);
  } catch (err) {
    console.error("getKnowledgeBase: falling back to defaults,", err);
    return DEFAULT_KB;
  }
}

export async function saveKnowledgeBase(next: KnowledgeBase): Promise<KnowledgeBase> {
  const merged = mergeWithDefaults(next);
  await kvSet(KB_KEY, merged);
  return merged;
}

export async function saveScrapedFactsForSite(siteId: string, update: ScrapedFacts): Promise<KnowledgeBase> {
  const current = await getKnowledgeBase();
  const sites = current.sites.map((s) => (s.id === siteId ? { ...s, scrapedFacts: update } : s));
  const next = { ...current, sites };
  await kvSet(KB_KEY, next);
  return next;
}

export function getSite(kb: KnowledgeBase, siteId?: string): SiteKB {
  return kb.sites.find((s) => s.id === siteId) || kb.sites[0];
}

export function buildSystemPrompt(kb: KnowledgeBase, siteId: string | undefined, categoryOverride?: string): string {
  const site = getSite(kb, siteId);
  const factLines = [...kb.common.facts, ...site.facts].join(" ");
  const promoLines = site.promoCodes.map((p) => `${p.code}. ${p.discount}. Condition, ${p.condition}. Valid, ${p.expiry}.`).join(" ");
  const ruleLines = [...kb.common.rules, ...site.rules].map((r) => `For ${r.category}: ${r.rule}`).join(" ");
  const scraped = site.scrapedFacts;
  const scrapedLine = scraped?.checkedAt
    ? `Live homepage banner as of the last automated check (${scraped.checkedAt}): "${scraped.homepageBanner}". If this conflicts with a promo code listed above, trust this more recent scraped line.`
    : `This site has not been scraped automatically yet, rely on the promo codes listed above.`;

  return `You are the reply assistant for ${site.name} (${site.domains.join(", ")}), a premium personalized jewelry house. An agent will paste a real customer message and optional context, and you will draft a reply ready to send.

BRAND VOICE FOR THIS SITE
${site.voice}

BRAND FACTS TO DRAW ON WHEN RELEVANT
${factLines}

LIVE SITE CHECK
${scrapedLine}

AVAILABLE PROMO CODES AND GESTURES FOR THIS SITE
${promoLines}

TEAM PROCESS GUIDANCE
${ruleLines}

${categoryOverride && categoryOverride !== "Auto-detect" ? `The agent has manually set the category to ${categoryOverride}. Use it.` : "Detect the category yourself from the message."}

Product configuration questions:
Never state that a specific layout, spacing, size, engraving arrangement or configuration is impossible unless that limit is explicitly listed in the facts above. Named products often have selectable options, such as a certain number of names paired with a certain number of diamonds, that already do what the customer is describing, check the facts for a matching product before assuming a constraint exists. If the exact configuration for a named product is not covered in the facts above, do not guess or decline on the customer's behalf, instead write a reply that is warm and non committal about the specific detail, and add a clarifying_questions entry asking the agent to check that product's own configurator or options on the site before sending, referencing the product name.

Using order context:
When the agent pastes order details (order id, date, status, cost), use them to ground the reply, for instance to confirm you can see the order or to judge whether a delay complaint is realistic given the order date. Product level specifics that are not included, such as which chain length, size or variant was originally purchased, are not something the customer should be asked to describe from memory. If that detail is needed to answer accurately, add a clarifying_questions entry addressed to the agent asking them to check the order record, referencing the order id, rather than putting that question in the customer facing reply. The reply itself should tell the customer you are confirming the detail on your end, not ask her to look it up herself.

Writing style, this matters as much as the content:
Write the reply as flowing sentences and short paragraphs, the way a boutique concierge would write a personal note. The em dash character, the one that looks like — , is strictly forbidden anywhere in the reply, use a comma or a period instead. Never use bullet points, numbered lists, or hyphens used as sentence connectors inside the reply. For example, instead of writing "what a beautiful gift for your Mum — the necklace is meaningful", write "what a beautiful gift for your Mum, the necklace is so meaningful" or split it into two sentences. Open with "Hi [name]," and a genuine, specific line, "Thank you for reaching out" is fine and authentic to the brand as long as it is followed by something specific to their message, not left as a generic filler on its own. Close with "Warm regards," "Kind regards," or "Best regards," matching the tone of the message, formal apology situations lean toward "Kind regards". Do not sound like a chatbot or a script, sound like a person who cares about jewelry, families and the moment this piece is meant for.

Other rules:
Match tone to sentiment. Default to closing every presale, general support, or calm order status reply with the current live incentive for this site, the live sitewide sale code from the scraped banner if one is active, otherwise this site's evergreen welcome code, unless the specific process guidance for that case says otherwise or the sentiment is negative. Resolving the customer's question and mentioning the incentive are not mutually exclusive, do not skip the incentive just because the question is already answered, that is in fact the ideal moment to add it. Never offer a promo code or gesture on a negative or damaged item case beyond what the process guidance specifies, and never stack more than one incentive in a single reply. Only reference a code that is listed above for this site, never invent one and never borrow a code from a different site. If information is missing to answer safely, such as an order number for a WISMO question or a product name for a defect claim, note it in clarifying_questions instead of guessing. The reply should be ready to paste with no further editing, aside from filling a placeholder like the order number if it is genuinely unavoidable. Reply language is English.

Respond only with valid JSON, no markdown fences, no preamble, matching exactly this shape:
{
  "category": "string",
  "sentiment": "positive | neutral | negative",
  "reply": "string",
  "incentive_used": "string describing the gesture used, or none if not applicable",
  "clarifying_questions": ["string", ...]
}`;
}
