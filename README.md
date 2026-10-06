# theo grace Holiday Concierge Console

Real, deployable version of the reply assistant prototype. Claude runs server side, the
knowledge base lives in a real shared database, agents and team leads log in with separate
passcodes, and a scheduled job scans the live site with a headless browser so JS-rendered
banners (like the Labor Day sale bar) are actually seen.

**Multi-site**: the knowledge base has one shared "common" section (product facts and
process rules that don't change) plus a separate entry per site (theo grace, MYKA, and
any future storefront), each with its own voice, promo codes, extra facts, and live site
check. Team leads manage all of this from the Knowledge Base page, including adding a
brand new site with the "+ Add site" button, no code changes needed.

**Single-use coupons**: separate from the reusable promo codes (WELCOME15 and friends),
each site can also have a pool of unique one-time codes. A team lead pastes a batch of
codes into the Knowledge Base page, and any agent can click "Claim a single-use code" in
the Reply Assistant to get one that's guaranteed never handed out to two customers, it's
marked used the instant it's claimed.

## 1. Push to GitHub

```
cd theo-grace-console
git init
git add .
git commit -m "Initial commit"
gh repo create theo-grace-console --private --source=. --push
```

(or create the repo on github.com and follow its "push an existing repo" instructions)

## 2. Deploy to Vercel

1. Go to vercel.com, "Add New Project", import the GitHub repo you just created.
2. Before the first deploy, add the environment variables from `.env.example` under
   Project Settings, Environment Variables:
   - `ANTHROPIC_API_KEY`, from console.anthropic.com
   - `AGENT_PASSCODE`, `LEAD_PASSCODE`, pick anything, share with your team
   - `SESSION_SECRET`, any long random string
3. Deploy.

## 3. Set up the shared knowledge base table in Supabase

You're using your existing Supabase project for this instead of adding a separate
database.

1. In your Supabase project, go to the SQL Editor, New query, paste the contents of
   `supabase.sql` from this repo, and run it. This creates the `kv_store` table (holds
   the shared knowledge base), the `coupon_pool` table plus a `claim_coupon` function
   (handles the single-use coupon pool, safely even if two agents claim at the same
   moment), and `kb_review_queue` (holds knowledge submissions that need a human decision,
   see section 6 below). If you already ran an older version of this file, just run the
   whole updated file again, `create table if not exists` won't touch what's already
   there.
2. In Supabase, go to Settings, API. Copy the **Project URL** and the **service_role**
   secret key (not the anon/public one, the service_role key is what lets the server
   read and write on behalf of the whole team, and it must never be exposed to the
   browser, which is why it's only used in server-side API routes here).
3. In Vercel, Project Settings, Environment Variables, add:
   - `SUPABASE_URL`, the Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`, the service_role key
4. Redeploy once after adding these.

## 4. Set up Browserless (runs the headless browser for you)

The scraper needs a real browser to see JS-rendered content, like an announcement bar
that appears after the page loads. Running Chromium directly inside a Vercel function
turned out to be unreliable (a well known "missing shared library" failure across many
Vercel + Chromium projects, not specific to this app). Browserless runs the browser on
its own infrastructure instead, and this app just connects to it.

1. Go to browserless.io, sign up for the free plan (1,000 units/month, no credit card
   needed to start, one scan a day uses only a handful of units).
2. Once signed up, copy your API token from their dashboard.
3. In Vercel, Project Settings, Environment Variables, add `BROWSERLESS_API_KEY` with
   that token.
4. Redeploy.

## 5. What the scraper does and its limits

`/api/scrape` connects to Browserless, loads the site like a real browser, waits for it
to finish rendering, then scans the page for anything that looks like a promo (a
percentage off, the word "sale", or "code XXXX"). The result is saved to the knowledge
base as `scrapedFacts.homepageBanner`, and the reply assistant is told to trust it over
the hand typed promo codes if the two disagree.

It's wired into `vercel.json` to run once a day via Vercel Cron (`"0 7 * * *"`, 7am UTC),
which is the maximum frequency allowed on the free Hobby plan. If you upgrade to Pro
later, you can change it to something like `"0 */6 * * *"` for a scan every 6 hours.

The heuristic that finds the banner text is generic on purpose (it looks for patterns
like "15% off" or "code XYZ" in short leaf elements), since it doesn't know the site's
exact CSS classes. Team leads can hit "Refresh now" on the Knowledge Base page to trigger
it manually and sanity check what it finds before trusting it.

## 6. Adding knowledge without editing code

The Knowledge Base page has an "Add knowledge" box. A team lead pastes any new info there
(a policy, a product detail, anything) and it's checked against everything already
recorded, using Claude:

- If it's clear and doesn't conflict with anything, it's added automatically to the right
  site (or to Common if it applies everywhere).
- If it's ambiguous, or it contradicts something already there, it's sent to a new page,
  **To Validate** (`/review`), instead of silently overwriting anything. From there a team
  lead sees the raw submission, why it was flagged, what it conflicts with if anything,
  and can approve it (editing the target site or wording first if needed) or reject it.

This is meant to be the ongoing way the knowledge base grows day to day, no code changes
or redeploys needed for new facts.

## 7. Internal questions, not just customer replies

`/ask` is a second, simpler screen: same knowledge base and site-restricted web search as
the Reply Assistant, but for the team's own questions rather than drafting a customer
reply. Useful for "what's our policy on X" type questions without needing a customer
message to paste in.

## Exporting the whole knowledge base

On the Knowledge Base page (team lead login), the **Export everything** section has two buttons:

- **Download Excel**: one workbook with a tab for Common Facts, Common Rules, the assistant's
  writing and tone rules, Sites (with the live promo banner), Site Facts, Site Promo Codes,
  Site Rules, and anything still waiting in To Validate.
- **Download JSON**: the same content as a single JSON file, for developers.

It exports the live version, so anything added through the Add knowledge box, agent notes, or
direct edits on that page is included. The single-use coupon pool is deliberately not exported.
The same files are also available directly at `/api/kb/export?format=xlsx` and
`/api/kb/export?format=json` while logged in as a team lead.

## 8. Roles

Two passcodes, two access levels:
- **Agent passcode**: can use the Reply Assistant and Ask a Question.
- **Lead passcode**: can also edit the Knowledge Base (`/knowledge`), use the "Add
  knowledge" box, resolve the To Validate queue (`/review`), and manage the coupon pool.

This is intentionally simple (no user accounts, just two shared passcodes) to get the team
using it fast. If you later want individual logins or an audit trail of who changed what,
that's a natural next step, ask and we can add it.

## 9. Local development

```
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Note: the shared knowledge base needs real Supabase credentials to work, even locally,
so run `supabase.sql` in your Supabase project first (see step 3 above), then fill in
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
