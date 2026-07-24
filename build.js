/* LaunchNow static site generator.
   Renders the latest edition (image-forward homepage + story pages),
   a data-driven ticker, an archive that preserves every past edition,
   RSS/sitemap/robots, and per-article JSON-LD. */
const fs = require("fs");
const path = require("path");

const ORIGIN = process.env.SITE_ORIGIN || "https://launchnow-emmyxjays-projects.vercel.app"; // canonical origin for SEO tags
const ASSET = ""; // self-contained: reference the site's own /style.css, /config.js, /site.js
const OUT = path.join(__dirname, "public");
const DESKS = { ai: "AI &amp; Tech", marketing: "Marketing &amp; Growth", startups: "Startups &amp; Funding", business: "Business &amp; Finance" };

// ---- previous editions (kept online via the archive) ----
const OLD_EDITIONS = [
  { edition_date: "2026-07-23", date_label: "Thursday, July 23, 2026", base: "", stories: [
    { slug: "openai-model-went-rogue", desk: "ai", headline: "OpenAI Built a Very Smart Robot. It Climbed Out of Its Playpen." },
    { slug: "monday-com-ai-layoffs", desk: "ai", headline: "Monday.com Just Let 620 People Go, and Said the Quiet Part Out Loud" },
    { slug: "china-chip-race", desk: "ai", headline: "America Took Away China's Best Lego Bricks. China Started Building a Brick Factory." },
    { slug: "world-models-explainer", desk: "ai", headline: "Some AI Builders Think Chatbots Are the Wrong Idea Entirely" },
    { slug: "nestle-marketing-bet", desk: "marketing", headline: "Nestle Is Spending More on Ads. On Purpose. In This Economy." },
    { slug: "creator-week-iab", desk: "marketing", headline: "The Ad Industry's Rulemakers Just Gave Creators Their Own Holiday Week" },
    { slug: "billion-dollar-rounds", desk: "startups", headline: "Most Startup Money Now Goes to Checks With Ten Digits" },
    { slug: "samsung-mistral", desk: "startups", headline: "Samsung Wants to Put a Billion Euros Into France's AI Champion" },
    { slug: "doge-cyber-startup", desk: "startups", headline: "Four Government Cost-Cutters Started a War-Tech Company. It's Already Worth $1.4 Billion." },
  ]},
];

function stripTags(s){ return String(s).replace(/<[^>]+>/g, ""); }
function decode(s){ return String(s).replace(/&mdash;/g,"—").replace(/&ldquo;/g,"“").replace(/&rdquo;/g,"”").replace(/&rsquo;/g,"’").replace(/&euro;/g,"€").replace(/&amp;/g,"&").replace(/&nbsp;/g," "); }
function xmlEsc(s){ return decode(stripTags(s)).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function ensure(p){ fs.mkdirSync(p, { recursive: true }); }

function head(title, desc, canonical, ogImage, extra){
  return `<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">`+
    `<title>${title}</title><meta name="description" content="${xmlEsc(desc)}">`+
    `<link rel="canonical" href="${canonical}">`+
    `<meta property="og:type" content="article"><meta property="og:title" content="${xmlEsc(title)}"><meta property="og:description" content="${xmlEsc(desc)}">`+
    (ogImage?`<meta property="og:image" content="${ogImage}"><meta name="twitter:card" content="summary_large_image">`:"")+
    `<link rel="alternate" type="application/rss+xml" title="LaunchNow" href="/feed.xml">`+
    `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet">`+
    `<link rel="stylesheet" href="${ASSET}/style.css">`+ (extra||"") +`</head>`;
}
function nav(){
  return `<div class="topbar"><div class="wrap"><span>__DATE__</span><span>Today's news, told like a story</span></div></div>`+
    `<header class="masthead"><div class="wrap"><a class="wordmark" href="/index.html">Launch<span class="now">Now</span></a>`+
    `<nav class="sections"><a href="/index.html#ai">AI &amp; Tech</a><a href="/index.html#marketing">Marketing &amp; Growth</a><a href="/index.html#startups">Startups &amp; Funding</a><a href="/index.html#business">Business &amp; Finance</a><a href="/archive.html">Archive</a></nav>`+
    `</div></header><div class="ticker"><div class="inner" id="ticker"></div></div>`;
}
function foot(){
  return `<div class="newsletter"><div class="wrap"><h2>Get tomorrow's edition at breakfast</h2><p>One story-mode briefing every morning. Five minutes, no jargon, no doomscrolling.</p>`+
    `<form><input type="email" placeholder="you@email.com" aria-label="Email"><button>Subscribe</button></form></div></div>`+
    `<footer><div class="wrap"><div class="giant">Launch<span class="now">Now</span></div>`+
    `<div class="legal"><span>&copy; 2026 LaunchNow · Written fresh every morning</span><span>Every story links to its original reporting · <a href="/archive.html" style="text-decoration:underline">Archive</a> · <a href="/feed.xml" style="text-decoration:underline">RSS</a></span></div></div></footer>`+
    `<script>window.LN_TICKER=__TICKER__;</script><script src="${ASSET}/config.js"></script><script src="/site.js" defer></script></body></html>`;
}

const edition = JSON.parse(fs.readFileSync(path.join(__dirname, "content/editions/2026-07-24.json"), "utf8"));
const stories = edition.stories;
const bySlug = Object.fromEntries(stories.map(s => [s.slug, s]));
const tickerItems = stories.map(s => ({ t: decode(stripTags(s.headline)), u: `/stories/${s.slug}.html` }));
const TICKER = JSON.stringify(tickerItems);

function card(s, withImg){
  const img = withImg && s.image_url ? `<div class="ill"><img src="${s.image_url}" alt="${xmlEsc(s.image_alt||s.headline)}" loading="lazy" onerror="this.parentElement.style.display='none'"></div>` : "";
  return `<a class="card" href="/stories/${s.slug}.html">${img}<h3>${s.headline}</h3><div class="meta">${DESKS[s.desk]} · ${s.read_min||2} min read</div></a>`;
}

// ---------- story pages ----------
ensure(path.join(OUT, "stories"));
for (const s of stories){
  const url = `${ORIGIN}/stories/${s.slug}.html`;
  const ld = { "@context":"https://schema.org", "@type":"NewsArticle", "headline": decode(stripTags(s.headline)),
    "description": decode(stripTags(s.dek)), "image":[s.image_url], "datePublished": edition.edition_date,
    "author":{"@type":"Organization","name":"The LaunchNow Desk"}, "publisher":{"@type":"Organization","name":"LaunchNow"},
    "mainEntityOfPage": url, "isBasedOn": s.source_url };
  const related = stories.filter(x=>x.slug!==s.slug).slice(0,2);
  const relHtml = related.map(r=>`<a class="card" href="/stories/${r.slug}.html">${r.image_url?`<div class="ill"><img src="${r.image_url}" alt="${xmlEsc(r.image_alt||r.headline)}" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`:""}<h4>${r.headline}</h4><div class="meta">${DESKS[r.desk]} · ${r.read_min||2} min read</div></a>`).join("");
  let htmlPage = head(`${decode(stripTags(s.headline))} — LaunchNow`, s.dek, url, s.image_url,
    `<script type="application/ld+json">${JSON.stringify(ld)}</script>`) +
    `<body><div id="progress"></div>` + nav() +
    `<article class="story"><span class="kicker">${DESKS[s.desk]}</span><h1>${s.headline}</h1><p class="dek">${s.dek}</p>`+
    `<div class="byline"><span>By <b>The LaunchNow Desk</b> · ${edition.date_label} · ${s.read_min||2} min read</span><div class="share" data-title="${xmlEsc(decode(stripTags(s.headline)))}"></div></div>`+
    (s.image_url?`<div class="ill"><img src="${s.image_url}" alt="${xmlEsc(s.image_alt||s.headline)}" loading="lazy" onerror="this.parentElement.style.display='none'"></div><div class="imgcredit">Illustration: LaunchNow · AI-generated</div>`:"")+
    `<div class="body">${s.body_html}</div>`+
    `<div class="why"><div class="label">Why it matters to you</div>${s.why_html}</div>`+
    `<p class="srcline">The grown-up version: <a href="${s.source_url}" rel="noopener" target="_blank">${s.source_name}</a> has the original reporting.</p>`+
    `<div class="byline" style="border-bottom:none"><span>Share this story</span><div class="share" data-title="${xmlEsc(decode(stripTags(s.headline)))}"></div></div></article>`+
    `<div class="related"><h3>Read next</h3><div class="relgrid">${relHtml}</div></div>`+
    `<section class="comments" id="comments" data-slug="${s.slug}"><h3>Join the conversation</h3>`+
    `<form class="cform" id="cform"><input type="text" id="cauthor" maxlength="60" placeholder="Your name" required><textarea id="cbody" maxlength="2000" placeholder="What do you think?" required></textarea><button type="submit">Post comment</button></form>`+
    `<div class="cstatus" id="cstatus">Loading comments&hellip;</div><div id="clist"></div></section>`+
    `<div class="bl-wrap"><a class="backlink" href="/index.html">&larr; Back to today's edition</a></div>`+
    foot();
  htmlPage = htmlPage.replace(/__DATE__/g, edition.date_label).replace("__TICKER__", TICKER);
  fs.writeFileSync(path.join(OUT, "stories", s.slug + ".html"), htmlPage);
}

// ---------- homepage ----------
const lead = stories.find(s=>s.is_lead) || stories[0];
const rest = stories.filter(s=>s.slug!==lead.slug);
const stack = rest.slice(0,4), latest = rest.slice(0,4);
const deskCols = Object.keys(DESKS).map(d=>{
  const items = stories.filter(s=>s.desk===d);
  if(!items.length) return "";
  return `<div class="col" id="${d}"><h3>${DESKS[d]}</h3>`+items.map(s=>`<a class="item" href="/stories/${s.slug}.html"><h4>${s.headline}</h4><p>${s.dek}</p></a>`).join("")+`</div>`;
}).join("");
let home = head("LaunchNow — Today's news, told like a story", "Daily news in plain English: AI &amp; tech, marketing &amp; growth, startups &amp; funding, business &amp; finance, explained like a story.", ORIGIN+"/", lead.image_url) +
  `<body><div id="progress"></div>` + nav() +
  `<main class="wrap"><div class="hero-grid"><a class="hero-card" href="/stories/${lead.slug}.html">`+
  (lead.image_url?`<div class="ill"><img src="${lead.image_url}" alt="${xmlEsc(lead.image_alt||lead.headline)}" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`:"")+
  `<span class="kicker">${DESKS[lead.desk]} · Today's lead story · ${lead.read_min||2} min read</span><h1>${lead.headline}</h1><p class="dek">${lead.dek}</p></a>`+
  `<div class="stack">${stack.map(s=>card(s,true)).join("")}</div></div>`+
  `<div class="sec-head"><h2>Latest</h2><div class="rule"></div></div><div class="latest">${latest.map(s=>card(s,true)).join("")}</div></main>`+
  `<div class="band"><div class="wrap"><div class="sec-head"><h2>Today, by desk</h2><div class="rule"></div></div><div class="tri" style="grid-template-columns:repeat(4,1fr)">${deskCols}</div></div></div>`+
  foot();
home = home.replace(/__DATE__/g, edition.date_label).replace("__TICKER__", TICKER);
fs.writeFileSync(path.join(OUT, "index.html"), home);

// ---------- archive ----------
const allEditions = [{ edition_date: edition.edition_date, date_label: edition.date_label, base: "", stories }].concat(OLD_EDITIONS);
let arch = head("Archive — LaunchNow", "Every past edition of LaunchNow. Nothing disappears.", ORIGIN+"/archive.html", lead.image_url) +
  `<body><div id="progress"></div>` + nav() +
  `<main class="wrap"><div class="sec-head"><h2>The Archive</h2><div class="rule"></div></div><p class="dek" style="margin-bottom:10px">Every edition we&rsquo;ve published. Old stories never go offline.</p>`;
for (const ed of allEditions){
  arch += `<div class="sec-head"><h2>${ed.date_label}</h2><div class="rule"></div></div><div class="latest">`+
    ed.stories.map(s=>{
      const href = (ed.base||"") + `/stories/${s.slug}.html`;
      return `<a class="card" href="${href}"><h3>${s.headline}</h3><div class="meta">${DESKS[s.desk]}</div></a>`;
    }).join("") + `</div>`;
}
arch += `</main>` + foot();
arch = arch.replace(/__DATE__/g, edition.date_label).replace("__TICKER__", TICKER);
fs.writeFileSync(path.join(OUT, "archive.html"), arch);

// ---------- feed.xml ----------
let feed = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>`+
  `<title>LaunchNow</title><link>${ORIGIN}/</link><description>Today's news, told like a story.</description><language>en</language>`;
for (const s of stories){
  feed += `<item><title>${xmlEsc(s.headline)}</title><link>${ORIGIN}/stories/${s.slug}.html</link>`+
    `<guid>${ORIGIN}/stories/${s.slug}.html</guid><description>${xmlEsc(s.dek)}</description></item>`;
}
feed += `</channel></rss>\n`;
fs.writeFileSync(path.join(OUT, "feed.xml"), feed);

// ---------- sitemap.xml + robots.txt ----------
let urls = [ORIGIN+"/", ORIGIN+"/archive.html"].concat(stories.map(s=>`${ORIGIN}/stories/${s.slug}.html`))
  .concat(OLD_EDITIONS.flatMap(ed=>ed.stories.map(s=>`${ORIGIN}/stories/${s.slug}.html`)));
fs.writeFileSync(path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`+
  urls.map(u=>`<url><loc>${u}</loc></url>`).join("")+`</urlset>\n`);
fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);

// ---------- static assets (self-contained) ----------
for (const a of ["site.js", "style.css", "config.js"]) {
  fs.copyFileSync(path.join(__dirname, "assets", a), path.join(OUT, a));
}

// ---------- legacy editions: copy pre-rendered story pages so old posts persist ----------
const legacyDir = path.join(__dirname, "content/legacy");
let legacyCount = 0;
if (fs.existsSync(legacyDir)) {
  for (const f of fs.readdirSync(legacyDir)) {
    if (f.endsWith(".html")) { fs.copyFileSync(path.join(legacyDir, f), path.join(OUT, "stories", f)); legacyCount++; }
  }
}

console.log("Built", stories.length, "new stories +", legacyCount, "legacy stories + homepage + archive + feed + sitemap. Output:", OUT);
