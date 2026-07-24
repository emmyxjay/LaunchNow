# LaunchNow

Daily news, told like a story. A static site generated from one data file per edition.

## How it works
- `content/editions/YYYY-MM-DD.json` — one edition = an array of story objects (the source of truth).
- `content/legacy/*.html` — pre-rendered pages from older editions, copied through so old posts never go offline.
- `assets/` — `style.css`, `site.js` (data-driven ticker, comments, subscribe, share), `config.js` (public Supabase keys).
- `node build.js` renders `public/`: the image-forward homepage, every story page, `/archive.html`, `/feed.xml`, `/sitemap.xml`, `/robots.txt`, per-article JSON-LD.

## Local
```bash
npm run build        # -> public/
npx serve public     # preview
```

## Deploy (Vercel + GitHub)
1. Push this repo to GitHub.
2. In Vercel, import the repo (or link it to the existing `launchnow` project). Vercel reads `vercel.json`:
   - Build command: `node build.js`
   - Output dir: `public`
3. Every push auto-deploys. A new edition = add `content/editions/<date>.json` and push.

To publish a brand-new day, the daily automation writes the new edition JSON, moves the previous day's rendered pages into `content/legacy/`, commits, and pushes — Vercel builds and ships.

## Backend
Supabase project `LaunchNow` (subscribers, comments, editions, stories, `launchnow` image bucket). Public anon keys live in `assets/config.js`; all writes are guarded by RLS.
