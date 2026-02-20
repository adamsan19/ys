export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const p = url.pathname;

    if (p === "/robots.txt") return robots();
    if (p === "/sitemap.xml") return sitemap(url);
    if (p === "/video-sitemap.xml") return videoSitemap(url);
    
    if (p.startsWith("/e/")) return withCache(req, () => detail(url));
    if (p.startsWith("/f/")) return withCache(req, () => search(url));
    if (p.startsWith("/list/")) return withCache(req, () => list(url));

    return html("Home", `<h1>Video Database</h1><a href='/list/1'>Browse Videos</a>`);
  }
}

async function withCache(req, fn) {
  const cache = caches.default;
  let res = await cache.match(req);
  if (res) return res;
  res = await fn();
  res = new Response(res.body, res);
  res.headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  await cache.put(req, res.clone());
  return res;
}

async function get(url, path) {
  try {
    const r = await fetch(new URL(path, url.origin));
    if(r.ok) return r.json();
  } catch(e) {}
  return null;
}

const norm = t => (t||"").toLowerCase().replace(/[^a-z0-9]/g, "");
const p2 = t => !t?"__":t.length===1?t+"_":t.slice(0,2);

async function detail(url) {
  const id = url.pathname.split("/")[2];
  const lookup = await get(url, "/data/lookup_shard.json");
  if (!lookup || !lookup[id]) return notFound();
  
  const shardKey = lookup[id];
  const data = await get(url, `/data/detail/${shardKey}.json`);
  if (!data) return notFound();

  const v = data.find(x => x.f === id);
  if (!v) return notFound();

  const schema = {
    "@context":"https://schema.org", "@type":"VideoObject",
    "name": v.t, "thumbnailUrl": v.sp||v.si, "uploadDate": v.up,
    "embedUrl": v.pe, "duration": `PT${v.d||0}S`,
    "interactionStatistic": {"@type":"InteractionCounter", "userInteractionCount": v.vw||0}
  };

  return html(v.t, `
    <h1>${v.t}</h1>
    <img src="${v.sp||v.si}" width="480" loading="lazy" alt="${v.t}"><br>
    <iframe src="${v.pe}" width="560" height="315" frameborder="0" allowfullscreen loading="lazy"></iframe>
    <p>Views: ${v.vw} | Kategori: ${v.k}</p>
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
  `);
}

async function search(url) {
  const parts = url.pathname.split("/");
  const q = parts[2];
  const page = parseInt(parts[4]||"1");
  if (!q || q.length < 2) return html("Search", "Min 2 chars");

  const normQ = norm(q);
  const prefix = p2(normQ);
  const data = await get(url, `/data/index/${prefix}.json`);
  if (!data) return notFound();

  const res = data.filter(x => norm(x.t).includes(normQ));
  const slice = res.slice((page-1)*20, page*20);
  if (!slice.length) return html("Search", "No results");

  return html(`Search: ${q}`, 
    slice.map(v => `<a href="/e/${v.f}">${v.t}</a>`).join("<br>") +
    (res.length > page*20 ? `<br><a href="/f/${q}/page/${page+1}">Next</a>` : "")
  );
}

async function list(url) {
  const p = url.pathname.split("/")[2];
  const meta = await get(url, "/data/meta.json");
  if (!meta) return notFound();
  const data = await get(url, `/data/list/${p}.json`);
  if (!data) return notFound();

  const files = data.result?.files || [];
  return html(`List ${p}`, 
    files.map(v => `<a href="/e/${v.file_code}">${v.title}</a>`).join("<br>")
  );
}

async function sitemap(url) {
  const meta = await get(url, "/data/meta.json");
  let out=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  for(let i=1; i<=Math.ceil((meta?.total||0)/200); i++) out+=`<url><loc>${url.origin}/list/${i}</loc></url>`;
  return new Response(out+"</urlset>", {headers:{"content-type":"application/xml"}});
}

async function videoSitemap(url) {
  const lookup = await get(url, "/data/lookup_shard.json");
  let out=`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`;
  let c=0; for(let id in lookup){ if(c++>1000) break; out+=`<url><loc>${url.origin}/e/${id}</loc><video:video><video:title>${id}</video:title></video:video></url>`; }
  return new Response(out+"</urlset>", {headers:{"content-type":"application/xml"}});
}

function robots() { return new Response("User-agent: *\nAllow: /", {headers:{"content-type":"text/plain"}}); }
function html(t, b) { return new Response(`<!doctype html><html><head><title>${t}</title><meta charset="utf-8"><style>body{font-family:sans-serif;max-width:800px;margin:auto;padding:20px}a{display:block;color:#0366d6;padding:4px 0}</style></head><body>${b}</body></html>`, {headers:{"content-type":"text/html; charset=utf-8"}}); }
function notFound() { return new Response("404", {status:404}); }

