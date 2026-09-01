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

## 3. Set up the shared knowledge base table in Supabase

You're using your existing Supabase project for this instead of adding a separate
database.

1. In your Supabase project, go to the SQL Editor, New query, paste the contents of
   `supabase.sql` from this repo, and run it. This creates one small table, `kv_store`,
   used to hold the shared knowledge base.
2. In Supabase, go to Settings, API. Copy the **Project URL** and the **service_role**
   secret key (not the anon/public one, the service_role key is what lets the server
   read and write on behalf of the whole team, and it must never be exposed to the
   browser, which is why it's only used in server-side API routes here).
3. In Vercel, Project Settings, Environment Variables, add:
   - `SUPABASE_URL`, the Project URL
   - `SUPABASE_SERVICE_ROLE_KEY`, the service_role key
4. Redeploy once after adding these.

## 4. The scraper, what it does and its limits

`/api/scrape` uses `puppeteer-core` with `@sparticuz/chromium` to load the site like a
real browser, wait for it to finish rendering, then scan the page for anything that looks
like a promo (a percentage off, the word "sale", or "code XXXX"). The result is saved to
the knowledge base as `scrapedFacts.homepageBanner`, and the reply assistant is told to
trust it over the hand typed promo codes if the two disagree.

It's wired into `vercel.json` to run every 6 hours via Vercel Cron. Two things to know:

- **Vercel Cron minimum interval depends on your plan.** `vercel.json` is set to run
  once a day (`"0 7 * * *"`, 7am UTC), which works on the free Hobby plan. If you
  upgrade to Pro later, you can change it to something like `"0 */6 * * *"` for a scan
  every 6 hours instead.
- **The full `@sparticuz/chromium` package is used on purpose, not the smaller `-min`
  variant.** The full package bundles the browser binary and its system libraries
  (things like `libnss3.so`) inside the npm package itself, so there's nothing to
  download at runtime and no version mismatch between a local package and a remote
  file. It's a bigger install (roughly 70MB), but well within Vercel's function size
  limit and much more reliable.
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

Note: the shared knowledge base needs real Supabase credentials to work, even locally,
so run `supabase.sql` in your Supabase project first (see step 3 above), then fill in
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
