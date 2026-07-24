# LaunchNow — Product Requirements & Build Spec (CLAUDE.md)

> **Purpose of this file.** This is the single handoff document for building
> LaunchNow to production. It describes what the product *is*, what already
> exists, what is broken or missing, and the exact phase-by-phase steps to get
> from "well-designed static page" to "real automated daily news platform."
> Anyone (human or AI builder) should be able to pick this up and build without
> guessing. Save this at the repo root as `CLAUDE.md`.

**Owner:** Jeffrey (jeffrey@launchout.co)
**Status of this doc:** v2 — 2026-07-24. Phase 0–1 built & deployed; daily automation (Phase 6) wired to Jeffrey's Morning Briefing. See §11.
**Live URL (current):** https://launchnow-emmyxjays-projects.vercel.app
**Vercel project:** `launchnow` (team: Emmyxjay's projects / `team_lV2fujzROk1AIIyg1uaXGZuw`)
**Supabase project used today:** `PromptEnhancer` / ref `vclwzxjcnndvkvthezzj` (shared — see Phase 1, this must change)

---

## 1. Product vision (the one-liner)

**LaunchNow is a daily news publication that explains the day's most important
stories — in AI & Tech, Marketing & Growth, and Startups & Funding — in plain
English, told like a story, in ~2-minute reads.** Tagline: *"Today's news, told
like a story."* The promise to the reader: five minutes at breakfast, no jargon,
no doomscrolling, every story linking back to its original reporting.

The differentiator is **voice and format**, not breaking-news speed. Each story
is a narrative explainer with:
- A plain-English headline (often a metaphor — e.g. *"OpenAI Built a Very Smart Robot. It Climbed Out of Its Playpen."*)
- A "dek" (subhead summary)
- A short story-mode body with a defined term callout, a pull quote, and a "story in four facts" data box
- A **"Why it matters to you"** box
- A **source line** linking to the grown-up version (e.g. The Washington Post)

---

## 2. What exists RIGHT NOW (audited, factual)

### 2.1 Live and working
- **Homepage** (`/index.html`) with a masthead, section nav (AI & Tech / Marketing & Growth / Startups & Funding), a news ticker, hero + stack layout, a "Latest" row, and a "Today, by desk" three-column band.
- **9 published story pages** under `/stories/*.html`, each fully styled with byline, hero illustration, story body, term/pull-quote/data-box components, "Why it matters," source link, "Read next" related cards, and a comments section.
- **Design system** — `/style.css` + `/site.js`, Playfair Display headlines, reading-progress bar, share widgets, ticker. It looks like a real publication.
- **Hero illustrations** — AI-generated `.webp` images served from Supabase storage (`launchnow` bucket on the PromptEnhancer project).
- **Deployed on Vercel**, production target, Node 24.x.

### 2.2 The 9 current stories (the "July 23 edition")
1. OpenAI model escaped its sandbox / Hugging Face (AI & Tech — lead)
2. Monday.com AI layoffs — 620 people (AI & Tech)
3. China chip race / US export rules (AI & Tech)
4. World models explainer (AI & Tech)
5. Nestlé increasing ad spend (Marketing & Growth)
6. IAB Global Creator Week (Marketing & Growth)
7. Billion-dollar VC rounds / Crunchbase data (Startups & Funding)
8. Samsung–Mistral €1B investment (Startups & Funding)
9. DOGE-alumni war-tech startup / $1.4B (Startups & Funding)

### 2.3 Backend that exists
- Supabase table `launchnow_comments` (2 test rows, RLS enabled) — **living inside the unrelated `PromptEnhancer` project.**
- Supabase storage bucket `launchnow` holding the story illustrations.

---

## 3. What is BROKEN or MISSING (the gap list)

This is the heart of the audit. Everything below is confirmed from the live site
and backend.

| # | Gap | Evidence | Severity |
|---|-----|----------|----------|
| G1 | **No automation.** Homepage still dated "Thursday, July 23" on July 24. No Vercel cron, no Supabase edge functions. Every "daily" edition is manual. | `list_edge_functions` → empty; date is stale | 🔴 Critical |
| G2 | **Newsletter signup is fake.** Subscribe form `action="#"` + `onsubmit="return false"`. Emails go nowhere. No subscriber table. | Homepage + story page HTML | 🔴 Critical |
| G3 | **Comments half-built & mis-homed.** Form + "Loading comments…" wired to `launchnow_comments`, but that table lives in the *PromptEnhancer* project, not its own. Only 2 test rows. | Supabase audit | 🟠 High |
| G4 | **RSS feed broken.** Every page `<head>` links `/feed.xml`; the file does not return valid readable feed content. | Fetch of `/feed.xml` fails | 🟠 High |
| G5 | **Zero SEO.** Every page served with `x-robots-tag: noindex`. No `robots.txt`, no `sitemap.xml`. Search engines told to skip it. | Response headers; `/robots.txt` + `/sitemap.xml` → 404 | 🟠 High |
| G6 | **No custom domain.** Only auto-generated `*.vercel.app` URLs. | Vercel project domains | 🟡 Medium |
| G7 | **No archive.** Once a new edition replaces the homepage, past days are unreachable. `/archive.html` → 404. | Fetch → 404 | 🟡 Medium |
| G8 | **No analytics.** No visibility into traffic, reads, or subscriber conversion. | No analytics tags found | 🟡 Medium |
| G9 | **No content pipeline / source of truth.** Stories appear hand-authored as HTML. No CMS, data file, or generation step that separates content from template. | Static `.html` per story | 🟠 High (blocks G1) |

---

## 4. Scope decision: what is "published" vs "to be created NOW"

### 4.1 Already meant-to-be-published (keep, don't rebuild)
- The 9 July-23 stories and their pages ✅
- The homepage layout, `style.css`, `site.js`, ticker, share, progress bar ✅
- The brand: name, wordmark, tagline, three desks, story-mode voice ✅
- The illustration style (AI-generated webp per story) ✅

### 4.2 To be created NOW (this build)
The rest of this document. In priority order the must-haves are:
1. **A content pipeline** so a new edition is *data*, not hand-edited HTML (G9) — this unblocks automation.
2. **Daily automation** that produces and deploys a fresh edition (G1).
3. **Working email capture** with a real subscriber store (G2).
4. **Its own backend project** + fixed comments (G3).
5. **RSS + SEO + archive** so it's a discoverable, browsable publication (G4, G5, G7).
6. **Custom domain + analytics** (G6, G8).

---

## 5. Target architecture (where we're going)

```
                 ┌───────────────────────────────────────────┐
                 │  Content source of truth                    │
                 │  /content/editions/YYYY-MM-DD.json          │
                 │  (one edition = array of story objects)     │
                 └───────────────┬─────────────────────────────┘
                                 │  build step (SSG)
                                 ▼
   ┌──────────────┐      ┌──────────────────┐      ┌──────────────────┐
   │ Daily cron   │────► │  Generation job  │────► │  Vercel deploy    │
   │ (Vercel Cron │      │  (edge function/ │      │  static pages +   │
   │  or GH Action│      │  script: pull    │      │  /feed.xml        │
   │  06:00 local)│      │  news → write    │      │  /sitemap.xml     │
   └──────────────┘      │  edition JSON)   │      │  /archive.html    │
                         └──────────────────┘      └───────┬──────────┘
                                                           │
   Reader ──► Static site ──► email form ──► ┌─────────────▼───────────┐
                              comments  ────►│  Supabase: LaunchNow proj │
                                             │  subscribers, comments    │
                                             └───────────────────────────┘
```

**Stack recommendation (confirm in Phase 0):**
- **Framework:** migrate the current raw HTML into a lightweight SSG so content = data. Recommend **Next.js (App Router) on Vercel** or **Astro**. Astro is the lighter fit for a content site; Next.js is fine if you want richer interactivity. *Decision needed — see Open Questions.*
- **Backend:** a **dedicated Supabase project** named `LaunchNow` (subscribers + comments + storage). Stop sharing PromptEnhancer.
- **Scheduling:** **Vercel Cron** (simplest given you're already on Vercel) or a GitHub Action.
- **Email delivery (later):** Resend, Buttondown, or Kit (Jeffrey already uses Kit).

---

## 6. Data model (Supabase — new `LaunchNow` project)

```sql
-- subscribers
create table public.subscribers (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  status       text not null default 'active',   -- active | unsubscribed | bounced
  source       text,                              -- homepage | story-slug | etc
  confirmed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- comments (migrate the 2 existing rows out of PromptEnhancer)
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  story_slug text not null,
  author     text not null,
  body       text not null,
  approved   boolean not null default false,      -- moderation on by default
  created_at timestamptz not null default now()
);
create index on public.comments (story_slug, created_at);

-- editions (optional but recommended: the source of truth in DB form)
create table public.editions (
  id           uuid primary key default gen_random_uuid(),
  edition_date date not null unique,
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);

create table public.stories (
  id          uuid primary key default gen_random_uuid(),
  edition_id  uuid references public.editions(id) on delete cascade,
  slug        text not null unique,
  desk        text not null,                       -- ai | marketing | startups
  is_lead     boolean not null default false,
  headline    text not null,
  dek         text not null,
  body_html   text not null,
  why_matters text not null,
  facts       jsonb,                               -- "story in four facts"
  source_name text,
  source_url  text,
  image_url   text,
  read_min    int default 2,
  created_at  timestamptz not null default now()
);
```

**RLS:** public `insert` allowed on `subscribers` (email only) and `comments`
(with `approved=false`); public `select` on `comments where approved=true` and on
published `stories`. Service role only for the generation job.

---

## 7. THE PHASED BUILD PLAN (step by step, phase by phase)

Each phase lists **tasks**, **acceptance criteria (AC)**, and **definition of
done (DoD)**. Do phases in order — later phases depend on earlier ones. Phase 0
and 1 are the foundation; do not skip them to chase automation.

---

### PHASE 0 — Foundation & decisions (½ day)
Lock the ground truth before writing code.

**Tasks**
1. Create a Git repo for LaunchNow (if not already) and pull the current deployed source into it so the 9 stories, `style.css`, `site.js` are version-controlled.
2. Decide the SSG framework (Astro vs Next.js) — see Open Questions §9.
3. Confirm morning publish time & timezone (assume **06:00 America/Chicago** unless told otherwise — Jeffrey's local time).
4. Choose the email tool (Resend / Buttondown / Kit).
5. Buy/choose the custom domain (assume `launchnow.co` or similar — confirm).

**AC / DoD**
- Repo exists, current site builds & deploys from it, framework + domain + email tool + publish time are written down at the top of this file.

---

### PHASE 1 — Dedicated backend (½ day)
Stop borrowing the PromptEnhancer project.

**Tasks**
1. Create a **new Supabase project `LaunchNow`.**
2. Run the schema in §6 (subscribers, comments, editions, stories).
3. Create a `launchnow` **storage bucket** in the new project; migrate the existing story illustrations over.
4. **Migrate the 2 existing `launchnow_comments` rows** into the new `comments` table, then remove the table from PromptEnhancer.
5. Set RLS policies per §6.
6. Put the new project's URL + anon key in Vercel env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

**AC / DoD**
- LaunchNow has its own Supabase project; nothing on the site reads/writes PromptEnhancer anymore; images resolve from the new bucket.

---

### PHASE 2 — Content pipeline / templatize (1–2 days) *(unblocks automation)*
Turn hand-authored HTML into data + one template. **This is the highest-leverage step.**

**Tasks**
1. Define the **edition JSON schema** (mirrors the `stories` fields in §6). One file per day: `/content/editions/2026-07-23.json`.
2. **Back-fill** the existing 9 stories into `2026-07-23.json` (parse the live pages into structured data).
3. Build **one story template** and **one homepage template** that render from edition data (hero/stack/latest/by-desk are all derived from the story list + `is_lead`/`desk` flags).
4. Verify the generated site is byte-for-byte close to today's design (same CSS/JS).

**AC / DoD**
- Deleting all `/stories/*.html` and regenerating from `2026-07-23.json` reproduces the current site. Content is now data.

---

### PHASE 3 — Email capture that works (½–1 day) — fixes G2
**Tasks**
1. Replace the dead form (`action="#"`, `onsubmit=return false`) with a real submit to a serverless endpoint (`/api/subscribe`) that inserts into `subscribers` (dedupe on email, capture `source`).
2. Add success/error UI states + basic honeypot/anti-spam.
3. (If double opt-in) send a confirmation email via the chosen tool; set `confirmed_at`.
4. Wire the same endpoint to the email provider's list (Kit/Resend/Buttondown) so subscribers land where sends happen.

**AC / DoD**
- Submitting an email stores a row and returns success; duplicate emails don't error; a test subscriber appears in both Supabase and the email tool.

---

### PHASE 4 — Comments, finished (½ day) — fixes G3
**Tasks**
1. Point the comment form + "Loading comments…" loader at the new `comments` table.
2. Read: `select where story_slug = ? and approved = true order by created_at`.
3. Write: insert with `approved=false`; show "awaiting moderation" state.
4. Add a minimal moderation path (a protected admin view or a Supabase dashboard workflow) to flip `approved=true`.
5. Basic rate-limit / spam protection on insert.

**AC / DoD**
- A visitor can post a comment (held for moderation); approved comments render on the correct story; nothing writes to PromptEnhancer.

---

### PHASE 5 — RSS, SEO, archive (1 day) — fixes G4, G5, G7
**Tasks**
1. **RSS:** generate a valid `/feed.xml` from the latest N editions (title, link, dek, pubDate, guid). Validate against a feed validator.
2. **SEO:**
   - Remove the blanket `x-robots-tag: noindex` for production (keep it on preview deployments only).
   - Generate `/sitemap.xml` (homepage + all story URLs + archive).
   - Add `/robots.txt` pointing to the sitemap.
   - Confirm per-page canonical, OG tags, and `og:image` (already present on stories — verify on all).
3. **Archive:** generate `/archive.html` (or `/archive/`) listing past editions by date, each linking to a dated edition page (`/editions/2026-07-23`). Keep old editions permanently reachable.

**AC / DoD**
- `/feed.xml` validates; Google can index production; `/sitemap.xml` and `/robots.txt` return 200; `/archive` lists every past edition and each is reachable.

---

### PHASE 6 — Daily automation (2–3 days) — fixes G1, the marquee feature
**Tasks**
1. Build the **generation job** (Vercel Cron endpoint or GitHub Action) that runs each morning at the confirmed time and:
   a. Pulls candidate stories across the three desks (news API / curated sources — define source list).
   b. Drafts each story in the LaunchNow voice (headline metaphor, dek, story body, term box, pull quote, four-facts, why-it-matters, source link). *This is where an AI writing step lives — reuse the house voice.*
   c. Generates or selects the hero illustration → uploads to the `launchnow` bucket.
   d. Writes `/content/editions/YYYY-MM-DD.json` (and/or inserts into `editions`+`stories`).
   e. Updates the "today" date, ticker, and homepage.
   f. Triggers a Vercel deploy.
2. Add a **human-in-the-loop review gate** (recommended): job produces a *draft* edition; Jeffrey approves before it goes live (a preview URL + one-click publish). Prevents a bad or false story auto-publishing.
3. Add the **morning email send**: once published, send the edition to subscribers via the email tool.
4. Logging + failure alerts (if the job fails, notify — don't silently skip a day).

**AC / DoD**
- At the scheduled time a fresh, correctly-dated edition is generated, (optionally) approved, deployed, and emailed — with no manual HTML editing. A failure pings Jeffrey instead of publishing yesterday again.

---

### PHASE 7 — Domain, analytics, polish (½–1 day) — fixes G6, G8
**Tasks**
1. Attach the **custom domain** in Vercel; set canonical/OG URLs to it; 301 the `.vercel.app` where sensible.
2. Add **privacy-friendly analytics** (Vercel Web Analytics or Plausible): pageviews, top stories, subscribe conversion.
3. Add basic **open-graph share images** check across all pages; confirm the share widget uses the real domain.
4. Accessibility & performance pass (alt text is present via `onerror` fallback — verify; Lighthouse ≥ 90).

**AC / DoD**
- Site lives on the custom domain, analytics reports traffic + conversions, Lighthouse passes, shares render correct cards.

---

### PHASE 8 — Launch checklist (½ day)
- [ ] Production is indexable; preview deploys are not.
- [ ] `/feed.xml`, `/sitemap.xml`, `/robots.txt`, `/archive` all live.
- [ ] Subscribe stores + syncs to email tool; a real test send lands in an inbox.
- [ ] Comments post, moderate, and render on the right story.
- [ ] Daily job runs, review gate works, failure alerting works.
- [ ] Custom domain + analytics live.
- [ ] Backup/rollback: a bad edition can be rolled back via Vercel instant rollback.
- [ ] This `CLAUDE.md` updated to reflect final framework, domain, and cron settings.

---

## 8. Dependency order (so nothing is skipped)

```
Phase 0 (decisions)
   └─► Phase 1 (own backend)
          └─► Phase 2 (content = data)   ◄── unblocks everything below
                 ├─► Phase 3 (email capture)
                 ├─► Phase 4 (comments)
                 ├─► Phase 5 (RSS/SEO/archive)
                 └─► Phase 6 (daily automation)  ◄── needs Phase 2 + Phase 1
                        └─► Phase 7 (domain/analytics)
                               └─► Phase 8 (launch)
```

**Do NOT** attempt Phase 6 (automation) before Phase 2 (content pipeline) —
automating hand-edited HTML is the trap that keeps this a manual project.

---

## 9. Open questions / decisions needed from Jeffrey

1. **Framework:** Astro (lightest for a content site, recommended) or Next.js (if you want more app-like features later)?
2. **Publish time & timezone** for the daily edition (assumed 06:00 America/Chicago).
3. **Auto-publish vs review gate:** fully automated each morning, or AI drafts → you approve → publish? (Strongly recommend the review gate for a news product — one hallucinated fact is a credibility hit.)
4. **Email tool:** Resend, Buttondown, or Kit (you already use Kit)?
5. **Custom domain:** what's the domain? (`launchnow.co`?)
6. **News sourcing:** which sources/API feed the three desks, and do we keep the "links to original reporting" promise (yes, recommended)?
7. **Editorial guardrails:** every story must cite a real, linkable primary source; no story ships without one.

---

## 10. Guardrails & house rules (for whoever/whatever builds each edition)

- **Every story links to a real primary source.** No source, no publish.
- **Voice:** plain-English, story-mode, metaphor headline, ~2-min read, "why it matters to you," defined-term box where jargon appears. Match the existing 9 stories.
- **Accuracy over speed.** This is explainer journalism, not a breaking-news wire. A review gate protects the brand.
- **Illustrations are labeled** "Illustration: LaunchNow · AI-generated" (already the pattern — keep it).
- **Accessibility:** real `alt` text on every hero image; keyboard-navigable nav, form, and comments.

---

*End of spec. Update the header block and §9 answers as decisions are made, then
work top-to-bottom through Phases 0→8.*

---

## 11. Daily automation: Morning Briefing → LaunchNow (BUILT 2026-07-24)

The daily edition is now sourced from **Jeffrey's Morning Briefing** — the existing
scheduled task (`trig_01MXLnHhm2wFK9GNnhJn8YpA`, fires 13:00 UTC / 9:00 a.m. ET)
that runs the `morning` skill and produces a news roundup in four sections:
**AI & Tech, Marketing & Growth, Startups & Funding, Business & Finance** (top 3
items each, headlines linked to source). Three map onto LaunchNow's original desks;
the fourth is now its own desk.

### Decisions locked (Jeffrey, 2026-07-24)
1. **Publishing mode: fully automatic.** No human review gate — the edition builds and deploys to production each morning. (Trade-off accepted: a wrong/hallucinated story could go live unreviewed. Guardrails below mitigate; Vercel instant-rollback is the recovery path.)
2. **Fourth desk added: "Business & Finance"** (`desk = 'business'`), alongside ai/marketing/startups. Homepage nav + "by desk" band now carry four columns.
3. **Story depth: full story-mode explainer** — the writer opens each source article and writes the complete ~2-min narrative (metaphor headline, dek, body, defined-term box, pull quote, four-facts/table, "why it matters", source line) + an AI illustration. Matches the original 9 stories.
4. **Build now:** the pipeline is live as a scheduled task.

### The pipeline (as built)
Scheduled task **"LaunchNow Daily Edition"** (`trig_01Db1BBqxaPsdSQ3PERSQjNi`,
cron `20 13 * * *` UTC = 9:20 a.m. ET, 20 min after the Briefing). Each run, one
agent session:
1. **Gathers** the day's top news across the 4 desks (top 3 each) via web/Firecrawl — the same roundup the Morning Briefing uses — each item with a real primary source.
2. **Reads** each source article, then **writes** it as a full LaunchNow story-mode explainer (accuracy over speed; verbatim quotes only).
3. **Illustrates** each story (16:9), uploading to the `launchnow` Supabase bucket (or a hosted URL); labels "Illustration: LaunchNow · AI-generated".
4. **Builds** the site — homepage (hero/stack/latest/4-desk band, dated today ET) + story pages — reusing the current `style.css`, `config.js`, `site.js` verbatim.
5. **Deploys** to Vercel project `launchnow` (production).
6. **Persists** an `editions` + `stories` rows into Supabase (archive/source-of-truth).

### Guardrails (hard rules in the task)
- Every published story must cite a real, working source URL — unsourced items are dropped.
- If fewer than **6** solid, sourced stories are assembled, the run **does not deploy** — yesterday's edition stays live and Jeffrey is alerted.
- After deploy, the homepage + ≥2 story URLs are checked for HTTP 200; an incomplete deploy triggers one full redeploy, else an alert.
- `style.css` / `site.js` / `config.js` kept byte-identical to current production.
- Completion notification (push + email) reports what published, per desk, with URLs.

### Known limitations / recommended hardening
- **Fully-auto has no editorial safety net.** If credibility ever takes a hit, switch to a review-gate (task produces a preview deploy + Jeffrey one-tap promotes). This is a small change to the task prompt (target `preview`, then a separate promote step).
- **Durability:** the task self-generates and deploys via `deploy_to_vercel` each run. The more robust long-term home is this repo on **GitHub + Vercel Git/Cron**, so deploys are diff-based and reviewable in PRs. Requires connecting a GitHub remote (not yet done).
- **Image upload** to the new bucket may need the service-role key; until then the task may fall back to hosted image URLs (pages hide a missing image gracefully).
- **Morning email send** to subscribers (Phase 6.3) is not yet wired — add once an email tool (Kit/Resend) is connected.

### To change it later
- Edit the task prompt/schedule with the scheduled-task tools (it's `trig_01Db1BBqxaPsdSQ3PERSQjNi`). To pause publishing, disable that task. To move the publish time, change its cron (UTC).
