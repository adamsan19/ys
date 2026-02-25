// functions/[[path]].js
// Cloudflare Pages Functions format with Output Minification

export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const p = url.pathname;

    if (p === "/" || p === "") return withCache(request, () => list(url, env, "1"));
    if (p === "/robots.txt") return robots();
    if (p === "/sitemap.xml") return sitemap(url, env);
    if (p === "/video-sitemap.xml") return videoSitemap(url, env);

    if (p.startsWith("/e/")) return withCache(request, () => detail(url, env));
    if (p.startsWith("/f/")) return withCache(request, () => search(url, env));
    if (p.startsWith("/page/")) return withCache(request, () => list(url, env));

    return next();
}

// AGGRESIF CACHE untuk pages.dev - PRIORITAS #1
async function withCache(req, fn) {
    const url = new URL(req.url);
    
    // ========== KONDISI BYPASS (minimalis) ==========
    // Hanya bypass jika benar-benar diperlukan
    const isDev = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const isStatic = url.pathname.match(/\.(css|js|jpg|png|ico|svg|woff2?)$/i);
    
    // JANGAN bypass untuk 'nocache' - tetap cache!
    // if (url.searchParams.has("nocache")) return fn(); // HAPUS INI
    
    if (isDev) return fn(); // Only bypass for local dev
    
    // ========== CACHE SUPER AGGRESIF ==========
    const cache = caches.default;
    
    // 1. COBA AMBIL DARI CACHE DULU
    let res = await cache.match(req);
    if (res) {
        // Return cache bahkan untuk dynamic content
        console.log(`⚡ CACHE HIT: ${url.pathname}`);
        return res;
    }
    
    // 2. EKSEKUSI FUNCTION
    console.log(`🔄 CACHE MISS: ${url.pathname}`);
    res = await fn();
    
    // 3. CACHE SEMUA RESPONSE (tanpa terkecuali)
    res = new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers(res.headers)
    });
    
    // CACHE HEADER SUPER LAMA
    // Static assets: cache 1 tahun
    if (isStatic) {
        res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } 
    // HTML/dynamic: cache 1 jam (tapi worker tetap serve sampai 24 jam)
    else {
        res.headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
    }
    
    // Force cache untuk semua method termasuk POST? 
    // Kalau GET saja sudah cukup untuk hemat request
    if (req.method === 'GET') {
        await cache.put(req, res.clone());
    }
    
    return res;
}
async function get(url, env, path) {
    try {
        const r = await env.ASSETS.fetch(new URL(path, url.origin));
        if (!r.ok) return null;
        const contentType = r.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) return null;
        return await r.json();
    } catch (e) {
        console.error(`Error fetching ${path}:`, e);
    }
    return null;
}

const norm = (t) => (t || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
function h(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const p2 = (t) => {
    const n = norm(t).replace(/\s+/g, "");
    return !n ? "__" : n.length === 1 ? n + "_" : n.slice(0, 2);
};
const p3 = (t) => {
    const n = norm(t).replace(/\s+/g, "");
    return !n ? "___" : n.length === 1 ? n + "__" : n.length === 2 ? n + "_" : n.slice(0, 3);
};

const CONFIG = {
    name: "VideoStream",
    logo: "https://wsrv.nl/?url=https://videostream.pages.dev/images/apple-touch-icon.png",
    description: "Situs streaming video viral terbaru dan terlengkap 2024",
    foundingDate: "2024-01-01",
    socialMedia: [
        "https://www.facebook.com/videostream",
        "https://twitter.com/videostream",
        "https://www.instagram.com/videostream"
    ]
};

const IMG_ERR = "this.onerror=null;this.src='data:image/svg+xml,%3Csvg%20width=%22200%22%20height=%22200%22%20viewBox=%220%200%20100%20100%22%20xmlns=%22http://www.w3.org/2000/svg%22%3E%3Crect%20width=%22100%22%20height=%22100%22%20fill=%22%23FEF2F2%22/%3E%3Ctext%20x=%2250%22%20y=%2250%22%20text-anchor=%22middle%22%20dominant-baseline=%22middle%22%20fill=%22%23F87171%22%20style=%22font-family:sans-serif;font-size:10px;font-weight:bold%22%3EIMAGE%20ERROR%3C/text%3E%3C/svg%3E';";

async function detail(url, env) {
    const origin = url.origin;
    const id = url.pathname.split("/")[2];
    const lookup = await get(url, env, "/data/lookup_shard.json");
    if (!lookup || !lookup[id]) return notFound(url);

    const shardKey = lookup[id];
    const data = await get(url, env, `/data/detail/${shardKey}.json`);
    if (!data) return notFound(url);

    const v = data.find((x) => x.f === id);
    if (!v) return notFound(url);

    const titleWords = norm(v.t).split(" ").filter(w => w.length >= 3);
    const related = data
        .filter((x) => x.f !== id)
        .map((x) => {
            let score = 0;
            if (v.kt && x.kt && norm(v.kt) === norm(x.kt)) score += 20;
            const nt = norm(x.t);
            const matches = titleWords.filter((w) => nt.includes(w));
            score += matches.length * 10;
            if (matches.length >= 2) score += 30;
            return { ...x, _score: score };
        })
        .sort((a, b) => b._score - a._score || (parseInt(b.vw) || 0) - (parseInt(a.vw) || 0))
        .slice(0, 16);

    const publisherId = `${origin}/#organization`;
    const websiteId = `${origin}/#website`;
    const webpageId = origin + url.pathname;
    const videoId = origin + url.pathname + "#video";
    const articleId = origin + url.pathname + "#article";
    const breadcrumbId = origin + url.pathname + "#breadcrumb";

    const catName = v.kt || "Video";
    const catUrl = v.kt_url || `${origin}/f/video`;
    const durationISO = v.dr || "PT10M30S";
    const uploadDate = v.up || new Date().toISOString();
    const viewCount = parseInt(v.vw) || 0;

    const schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": publisherId,
                "name": CONFIG.name,
                "url": origin,
                "logo": { "@type": "ImageObject", "url": CONFIG.logo, "width": 180, "height": 180 },
                "sameAs": CONFIG.socialMedia,
                "foundingDate": CONFIG.foundingDate,
                "description": CONFIG.description
            },
            {
                "@type": "WebSite",
                "@id": websiteId,
                "url": origin,
                "name": CONFIG.name,
                "publisher": { "@id": publisherId },
                "inLanguage": "id-ID",
                "potentialAction": {
                    "@type": "SearchAction",
                    "target": { "@type": "EntryPoint", "urlTemplate": `${origin}/f/{search_term_string}` },
                    "query-input": "required name=search_term_string"
                }
            },
            {
                "@type": "WebPage",
                "@id": webpageId,
                "url": webpageId,
                "name": v.t_esc || h(v.t),
                "isPartOf": { "@id": websiteId },
                "description": v.ds_esc || v.ds || `Nonton streaming video ${v.t_esc || h(v.t)} kualitas HD gratis.`,
                "primaryImageOfPage": { "@type": "ImageObject", "url": v.sp || v.si, "width": 1280, "height": 720 },
                "breadcrumb": { "@id": breadcrumbId },
                "datePublished": uploadDate,
                "dateModified": uploadDate,
                "inLanguage": "id-ID"
            },
            {
                "@type": "VideoObject",
                "@id": videoId,
                "name": v.t_esc || h(v.t),
                "description": v.ds_esc || v.ds || `Tonton video ${v.t_esc || h(v.t)} terbaru.`,
                "thumbnailUrl": [v.sp || v.si],
                "uploadDate": uploadDate,
                "duration": durationISO,
                "contentUrl": v.pe,
                "embedUrl": v.pe,
                "interactionStatistic": [
                    { "@type": "InteractionCounter", "interactionType": { "@type": "WatchAction" }, "userInteractionCount": viewCount }
                ],
                "publisher": { "@id": publisherId }
            }
        ]
    };

    const breadcrumbsHtml = `
    <nav class="breadcrumbs" aria-label="Breadcrumb" itemscope itemtype="https://schema.org/BreadcrumbList">
        <a href="/" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">Beranda</span><meta itemprop="position" content="1"></a> / 
        <a href="${catUrl}" itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">${h(catName)}</span><meta itemprop="position" content="2"></a> / 
        <span itemprop="itemListElement" itemscope itemtype="https://schema.org/ListItem"><span itemprop="name">${h(v.t)}</span><meta itemprop="position" content="3"></span>
    </nav>`;

    const formatNumber = (num) => {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const duration = v.ln || (v.d ? `${Math.floor(v.d / 60)}:${(v.d % 60).toString().padStart(2, '0')}` : '10:30');

    const body = `
    ${breadcrumbsHtml}
    <div class="player-section">
        <div class="video-wrapper" id="videoContainer">
            <img src="${v.sp || v.si}" alt="${h(v.t)}" class="video-placeholder" id="mainThumbnail" width="1280" height="720" onerror="${IMG_ERR}">
            <button class="play-overlay" id="playTrigger" aria-label="Putar Video" data-video-url="${v.pe}">
                <div class="play-btn-large"><svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
            </button>
            <div id="playerFrameContainer" style="display:none; width:100%; height:100%;"></div>
        </div>
        <div class="video-info">
            <h1 class="video-title">${v.t_esc}</h1>
            <div class="video-meta">
                <span class="badge">${duration}</span>
                <span class="badge">${v.vw_fmt} views</span>
                <span class="badge">${v.up_fmt}</span>
            </div>
            <div class="video-description">
                <p><strong>${v.t_esc}</strong> - ${v.ds_esc || `Streaming video viral terbaru ${v.t_esc}.`}</p>
                <p>${v.tags ? v.tags.map(t => '#' + t.replace(/\s+/g, '')).join(' ') : '#VideoViral #HD'}</p>
            </div>
            <div class="btn-group">
                <a href="${v.dl || '#'}" class="btn btn-primary" download>Download</a>
                <button class="btn btn-outline" onclick="copyVideoUrl()">Copy Link</button>
                <button class="btn btn-outline" onclick="shareVideo()">Share</button>
            </div>
        </div>
    </div>
    <section>
        <h2 class="section-title">Video Terkait</h2>
        <div class="video-grid">
            ${related.map((rv) => `
                <div class="video-card">
                    <a href="/e/${rv.f}" class="video-card-link">
                        <div class="card-thumb">
                            <img src="${rv.si || rv.sp}" alt="${h(rv.t)}" loading="lazy" onerror="${IMG_ERR}">
                            <span class="card-duration">${rv.ln || '10:30'}</span>
                        </div>
                        <div class="card-content">
                            <h3 class="card-title">${h(rv.t)}</h3>
                            <div class="card-stats">${formatNumber(rv.vw)} views</div>
                        </div>
                    </a>
                </div>
            `).join("")}
        </div>
    </section>`;

    return render(v.t, body, schema, url, { description: v.ds_esc || v.t, image: v.sp || v.si });
}

async function search(url, env) {
    const parts = url.pathname.split("/");
    let rawQ = parts[2] || url.searchParams.get("q") || "";
    rawQ = decodeURIComponent(rawQ).replace(/-/g, " ").trim();
    if (rawQ.length < 2) return render("Search", '<p>Minimal 2 karakter</p>', null, url);

    const keywords = norm(rawQ).split(/\s+/);
    const prefixes = [...new Set(keywords.slice(0, 3).map(p2))];
    const datasets = await Promise.all(prefixes.map(p => get(url, env, `/data/index/${p}.json`)));
    
    let results = [];
    const seen = new Set();
    for (const d of datasets) {
        if (!d) continue;
        for (const item of d) {
            if (seen.has(item.f)) continue;
            if (keywords.some(k => norm(item.t).includes(k))) {
                seen.add(item.f);
                results.push(item);
            }
        }
    }

    const body = `<div class="player-section" style="padding:1rem">
        <h1 class="video-title">Hasil: "${h(rawQ)}"</h1>
        <div class="video-grid">${results.slice(0, 40).map(v => `
            <div class="video-card">
                <a href="/e/${v.f}" class="video-card-link">
                    <div class="card-thumb"><img src="${v.si || v.sp}" alt="${h(v.t)}"></div>
                    <div class="card-content"><h3 class="card-title">${h(v.t)}</h3></div>
                </a>
            </div>`).join("")}</div>
    </div>`;
    return render(`Cari: ${h(rawQ)}`, body, null, url);
}

async function list(url, env, pageParam) {
    const page = parseInt(pageParam || url.pathname.split("/")[2] || "1");
    const meta = await get(url, env, "/data/meta.json");
    const data = await get(url, env, `/data/list/${page}.json`);
    if (!data) return notFound(url);

    const files = data.result?.files || [];
    const body = `<div class="player-section" style="padding:1rem">
        <h1 class="video-title">Video Terbaru - Hal ${page}</h1>
        <div class="video-grid">${files.map(v => `
            <div class="video-card">
                <a href="/e/${v.file_code}" class="video-card-link">
                    <div class="card-thumb"><img src="${v.single_img}" alt="${h(v.title)}"></div>
                    <div class="card-content"><h3 class="card-title">${h(v.title)}</h3></div>
                </a>
            </div>`).join("")}</div>
        <div class="pagination">
            ${page > 1 ? `<a href="${page === 2 ? '/' : '/page/' + (page - 1)}" class="pagination-link">Prev</a>` : ''}
            <span class="pagination-current">Hal ${page}</span>
            <a href="/page/${page + 1}" class="pagination-link">Next</a>
        </div>
    </div>`;
    return render(`Daftar Video - Hal ${page}`, body, null, url);
}

async function sitemap(url, env) {
    const meta = await get(url, env, "/data/meta.json");
    let out = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    const total = meta?.total || 0;
    for (let i = 1; i <= Math.min(50, Math.ceil(total / 200)); i++) {
        out += `<url><loc>${url.origin}${i === 1 ? '' : '/page/' + i}</loc></url>`;
    }
    return new Response(out + "</urlset>", { headers: { "content-type": "application/xml" } });
}

function robots() {
    return new Response("User-agent: *\nAllow: /", { headers: { "content-type": "text/plain" } });
}

// THE MINIFIED RENDER FUNCTION
function render(t, b, schema, url, meta = {}) {
    const siteTitle = `${t} - ${CONFIG.name}`;
    const description = meta.description || CONFIG.description;
    const image = meta.image || CONFIG.logo;

    const style = `
        :root{--bg:#0a0a0c;--fg:#eee;--card:#151518;--p:#f97316;--border:#27272a;--radius:8px}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg);line-height:1.5;font-size:14px}
        .container{max-width:1000px;margin:0 auto;padding:0 12px}
        header{position:sticky;top:0;z-index:100;background:rgba(10,10,12,0.8);backdrop-filter:blur(8px);border-bottom:1px solid var(--border);height:50px;display:flex;align-items:center}
        .header-content{display:flex;justify-content:space-between;width:100%;align-items:center}
        .logo{display:flex;align-items:center;gap:8px;text-decoration:none;color:#fff;font-weight:700;font-size:18px}
        .logo svg{color:var(--p);width:20px;height:20px}
        .actions{display:flex;gap:8px}
        .icon-btn{background:none;border:none;color:#fff;cursor:pointer;padding:6px;display:flex}
        .player-section{background:var(--card);border-radius:var(--radius);border:1px solid var(--border);overflow:hidden;margin:12px 0}
        .video-wrapper{position:relative;aspect-ratio:16/9;background:#000}
        .video-placeholder{width:100%;height:100%;object-fit:contain}
        .play-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);cursor:pointer;border:0}
        .play-btn-large{width:60px;height:60px;background:var(--p);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.5)}
        .video-info{padding:12px}
        .video-title{font-size:18px;font-weight:700;margin-bottom:8px}
        .video-meta{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
        .badge{background:#27272a;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}
        .video-description{padding:10px;background:#1e1e21;border-radius:6px;border-left:3px solid var(--p);font-size:13px;margin-bottom:12px}
        .btn-group{display:flex;gap:8px;flex-wrap:wrap}
        .btn{padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;text-decoration:none;font-size:13px;display:inline-flex;align-items:center;gap:6px}
        .btn-primary{background:var(--p);color:#fff}
        .btn-outline{border:1px solid var(--border);color:#eee}
        .video-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
        .video-card{background:var(--card);border-radius:var(--radius);border:1px solid var(--border);overflow:hidden;transition:0.2s}
        .video-card:hover{border-color:var(--p);transform:translateY(-2px)}
        .video-card-link{text-decoration:none;color:inherit}
        .card-thumb{position:relative;aspect-ratio:16/9;background:#222}
        .card-thumb img{width:100%;height:100%;object-fit:cover}
        .card-duration{position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.8);font-size:10px;padding:1px 4px;border-radius:2px}
        .card-content{padding:8px}
        .card-title{font-size:13px;font-weight:600;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;height:34px;line-height:1.3}
        .pagination{display:flex;justify-content:center;align-items:center;gap:12px;margin:24px 0}
        .pagination-link{padding:6px 16px;background:#27272a;text-decoration:none;color:#fff;border-radius:6px}
        footer{padding:24px 0;text-align:center;color:#71717a;font-size:12px;border-top:1px solid var(--border)}
        .modal{position:fixed;inset:0;background:rgba(0,0,0,0.8);display:none;align-items:center;justify-content:center;z-index:1000}
        .modal.active{display:flex}
        .modal-content{background:var(--card);padding:20px;border-radius:12px;width:90%;max-width:400px;position:relative}
        .search-input{width:100%;padding:10px;margin:12px 0;background:#0a0a0c;border:1px solid var(--border);color:#fff;border-radius:6px}
        @media(max-width:480px){.video-grid{grid-template-columns:repeat(2,1fr)}}
    `;

    const script = `
        document.getElementById('playTrigger')?.addEventListener('click', function(){
            const u = this.getAttribute('data-video-url');
            this.style.display='none';
            document.getElementById('mainThumbnail').style.display='none';
            const f = document.getElementById('playerFrameContainer');
            f.style.display='block';
            f.innerHTML='<iframe src="'+u+'" frameborder="0" allow="autoplay;fullscreen" style="width:100%;height:100%"></iframe>';
        });
        document.getElementById('searchBtn')?.addEventListener('click',()=>document.getElementById('searchModal').classList.add('active'));
        document.getElementById('closeSearch')?.addEventListener('click',()=>document.getElementById('searchModal').classList.remove('active'));
        function copyVideoUrl(){
            const t = document.createElement('textarea'); t.value=window.location.href; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
        }
        function shareVideo(){
            if(navigator.share) navigator.share({title:document.title,url:window.location.href});
        }
    `;

    // LOGIKA MINIFIKASI OUTPUT
    const html = `<!doctype html><html lang="id"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${siteTitle}</title>
    <meta name="description" content="${description}">
    <link rel="canonical" href="${url.href}">
    <meta property="og:title" content="${siteTitle}"><meta property="og:image" content="${image}">
    ${schema ? `<script type="application/ld+json">${JSON.stringify(schema)}</script>` : ""}
    <style>${style}</style></head><body>
    <header><div class="container header-content">
        <a href="/" class="logo"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>${CONFIG.name}</a>
        <div class="actions">
            <button class="icon-btn" id="searchBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
        </div>
    </div></header>
    <main class="container">${b}</main>
    <div class="modal" id="searchModal"><div class="modal-content">
        <h3>Cari Video</h3>
        <form onsubmit="event.preventDefault();let v=this.q.value.trim().replace(/\\s+/g,'-');if(v)window.location.href='/f/'+encodeURIComponent(v)">
            <input type="search" name="q" class="search-input" placeholder="Ketik kata kunci..." autofocus>
            <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center">Cari</button>
            <button type="button" id="closeSearch" class="btn btn-outline" style="width:100%;margin-top:8px;justify-content:center">Batal</button>
        </form>
    </div></div>
    <footer><div class="container">&copy; 2024 ${CONFIG.name}.</div></footer>
    <script>${script}</script></body></html>`;

    // Regex-based minification for final string
    const minified = html
        .replace(/>\s+</g, '><')  // Remove space between tags
        .replace(/\s{2,}/g, ' ')  // Collapse multiple spaces
        .replace(/\n/g, '');      // Remove newlines

    return new Response(minified, { headers: { "content-type": "text/html;charset=utf-8" } });
}

function notFound(url) {
    return new Response("404 Not Found", { status: 404 });
}