// Aurum KW rate proxy for Cloudflare Workers (free plan).
// Usage from the app: https://YOUR-WORKER.workers.dev/?u=<encoded url>
const ALLOWED = [
  "https://moci.gov.kw/MociSite/en/gold-prices/index.html",
  "https://data-asg.goldprice.org/dbXRates/KWD",
  "https://data-asg.goldprice.org/dbXRates/USD",
  "https://data-asg.goldprice.org/GetData/USD-XAU/1"
];
const ALLOWED_PREFIX = ["https://stooq.com/q/d/l/", "https://query1.finance.yahoo.com/v8/finance/chart/"];
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET", "access-control-allow-headers": "*" };

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const target = new URL(request.url).searchParams.get("u");
    if (!target || !(ALLOWED.includes(target) || ALLOWED_PREFIX.some((p) => target.startsWith(p)))) {
      return new Response("Not allowed", { status: 400, headers: CORS });
    }
    try {
      const up = await fetch(target, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; AurumKW)", accept: "application/json, text/html, text/csv, */*", referer: "https://goldprice.org/" },
        cf: { cacheTtl: 20, cacheEverything: true }
      });
      const h = new Headers(CORS);
      h.set("content-type", up.headers.get("content-type") || "text/plain; charset=utf-8");
      h.set("cache-control", "public, max-age=20");
      return new Response(up.body, { status: up.status, headers: h });
    } catch (e) {
      return new Response("Upstream error", { status: 502, headers: CORS });
    }
  }
};
