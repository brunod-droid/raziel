# theo grace Holiday Concierge Console

Real, deployable version of the reply assistant prototype. Claude runs server side, the
knowledge base lives in a real shared database, agents and team leads log in with separate
passcodes, and a scheduled job scans the live site with a headless browser so JS-rendered
banners (like the Labor Day sale bar) are actually seen.

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

## 3. Attach a Redis database (the shared storage)

Vercel KV is being retired in favor of Redis from the Vercel Marketplace. In the Vercel
dashboard, open your project, go to the Storage tab, "Create Database" or "Browse
Marketplace", and add a Redis integration (Upstash is the usual provider). Connect it to
this project. This automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`, the code reads either) to your
environment, no manual copy-pasting needed. Redeploy once after connecting it.

## 4. The scraper, what it does and its limits

`/api/scrape` uses `puppeteer-core` with `@sparticuz/chromium-min` to load the site like a
real browser, wait for it to finish rendering, then scan the page for anything that looks
like a promo (a percentage off, the word "sale", or "code XXXX"). The result is saved to
the knowledge base as `scrapedFacts.homepageBanner`, and the reply assistant is told to
trust it over the hand typed promo codes if the two disagree.

It's wired into `vercel.json` to run every 6 hours via Vercel Cron. Two things to know:

- **Vercel Cron minimum interval depends on your plan.** The Hobby plan only allows
  daily crons. If you're on Hobby, change the schedule in `vercel.json` to `"0 6 * * *"`
  (once a day) or upgrade to Pro for more frequent runs.
- **The chromium binary version must match the npm package version.** `package.json`
  pins `@sparticuz/chromium-min` and `app/api/scrape/route.ts` points to a matching
  release URL. If you bump one, bump the other, see the comment in that file.
- **The heuristic that finds the banner text is generic on purpose** (it looks for
  patterns like "15% off" or "code XYZ" in short leaf elements), since it doesn't know
  the site's exact CSS classes. Team leads can also hit "Refresh now" on the Knowledge
  Base page to trigger it manually and sanity check what it finds before trusting it.

## 5. Roles

Two passcodes, two access levels:
- **Agent passcode**: can use the Reply Assistant.
- **Lead passcode**: can also edit the Knowledge Base (`/knowledge`), including promo
  codes, process rules, and brand facts.

This is intentionally simple (no user accounts, just two shared passcodes) to get the team
using it fast. If you later want individual logins or an audit trail of who changed what,
that's a natural next step, ask and we can add it.

## 6. Local development

```
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Note: the shared knowledge base needs real Redis credentials to work, even locally, so
connect the Redis integration in the Vercel dashboard first and pull the env vars with
`vercel env pull .env.local`, or point `KV_REST_API_URL`/`KV_REST_API_TOKEN` (or the
`UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` equivalents) at any Upstash Redis
instance for local testing.
