// Reads the rate sources on the server side (GitHub Actions) and writes data/rates.json.
// Browsers cannot read these sites directly, so the app reads this file from its own origin.
// Usage: node scripts/fetch-rates.mjs            (plain HTTP pass)
//        node scripts/fetch-rates.mjs --browser fk,joy   (render with a headless browser)
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "data", "rates.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const URLS = {
  moci: "https://www.moci.gov.kw/MociSite/en/gold-prices/index.html",
  global: "https://data-asg.goldprice.org/dbXRates/KWD",
  globalUsd: "https://data-asg.goldprice.org/dbXRates/USD",
  fk: "https://fkjewellers.com/pages/gold-price-in-kuwait",
  joy: "https://www.joyalukkas.com/kw/goldrate"
};
const KARATS = [24, 22, 21, 18];
const args = process.argv.slice(2);
const browserList = args.includes("--browser") ? (args[args.indexOf("--browser") + 1] || "").split(",").filter(Boolean) : [];

const num = (s) => parseFloat(String(s).replace(/,/g, ""));
const okRate = (k, v) => v > (k / 24) * 15 && v < (k / 24) * 150; // KWD per gram, generous range
const toText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function http(url, accept) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: accept || "text/html,application/json;q=0.9,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(25000), redirect: "follow" });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}
let browserPromise = null;
async function rendered(url) {
  if (!browserPromise) browserPromise = import("playwright").then((pw) => pw.chromium.launch());
  const b = await browserPromise;
  const ctx = await b.newContext({ userAgent: UA, locale: "en-US" });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 50000 }).catch(() => {});
    await page.waitForTimeout(2500);
    return await page.content();
  } finally { await ctx.close(); }
}
const page = (name, url) => (browserList.includes(name) ? rendered(url) : http(url));

/* "24 karat 38.680 KD / gram", "24K Gold ... KWD 38.680" and similar */
function karatPrices(txt) {
  const out = {};
  for (const K of KARATS) {
    const re = new RegExp("\\b" + K + "\\s*(?:k|kt|karat|carat)\\b", "gi");
    let m;
    while ((m = re.exec(txt))) {
      const seg = txt.slice(m.index + m[0].length, m.index + m[0].length + 90);
      const nums = [...seg.matchAll(/(\d{1,3}(?:,\d{3})*\.\d{1,3})(?!\d)/g)].map((x) => num(x[1]));
      const exp = out[24] ? out[24] * K / 24 : 0;
      const v = exp ? nums.filter((n) => Math.abs(n / exp - 1) < 0.07).sort((a, b) => Math.abs(a / exp - 1) - Math.abs(b / exp - 1))[0] : nums.find((n) => okRate(K, n));
      if (v) { out[K] = v; break; }
    }
  }
  return out;
}
function complete(r) {
  const have = KARATS.filter((k) => r[k] > 0);
  if (!have.length) return null;
  const base = r[have[0]] * 24 / have[0];
  if (!(r[24] > 0)) r[24] = base;
  return r;
}
function isoDate(s) {
  s = s.trim(); let m;
  if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/))) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  if ((m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})[a-z]*\.?,?\s+(\d{4})/))) return `${m[3]}-${String(MON[m[2].toLowerCase()] || 0).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if ((m = s.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/))) return `${m[3]}-${String(MON[m[1].toLowerCase()] || 0).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}
/* table rows first, then "date + several prices" text lines */
function historyFrom(html) {
  const rows = [];
  const trs = [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  let order = null;
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => toText(c[1]));
    if (cells.length < 2) continue;
    const hdr = cells.map((c) => (c.match(/\b(24|22|21|18)\b/) || [])[1]).map((x) => (x ? +x : null));
    if (hdr.filter(Boolean).length >= 2 && !isoDate(cells[0])) { order = hdr; continue; }
    const d = isoDate(cells[0]); if (!d) continue;
    const vals = cells.slice(1).map((c) => { const m = c.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?/); return m ? num(m[0]) : NaN; });
    const r = {};
    vals.forEach((v, i) => { const k = order ? order[i + 1] : KARATS[i]; if (k && okRate(k, v)) r[k] = v; });
    if (r[24] || r[22] || r[21] || r[18]) rows.push({ d, r: complete(r) });
  }
  if (rows.length < 2) {
    const txt = toText(html), re = /(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4}|[A-Za-z]{3,9}\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})((?:\s*(?:KWD|KD)?\s*\d{1,3}(?:,\d{3})*\.\d{1,3}){1,5})/gi;
    let m; while ((m = re.exec(txt))) {
      const d = isoDate(m[1]); if (!d) continue;
      const vs = [...m[2].matchAll(/\d{1,3}(?:,\d{3})*\.\d{1,3}/g)].map((x) => num(x[0])), r = {};
      vs.forEach((v, i) => { if (okRate(KARATS[i], v)) r[KARATS[i]] = v; });
      if (r[24]) rows.push({ d, r: complete(r) });
    }
  }
  const seen = new Set(), outRows = [];
  rows.sort((a, b) => (a.d < b.d ? 1 : -1)).forEach((x) => { if (!seen.has(x.d)) { seen.add(x.d); outRows.push(x); } });
  return outRows.slice(0, 10);
}

const parsers = {
  async moci() {
    const html = await page("moci", URLS.moci), txt = toText(html), r = karatPrices(txt);
    const oz = (txt.match(/gold[^0-9]{0,40}(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*\**\s*KD\s*\/\s*ounce/i) || [])[1];
    const dd = (txt.match(/Prices of\s+([A-Za-z]+\s+\d{1,2}\/\d{1,2}\/\d{4})/i) || [])[1];
    if (!complete(r) || !(r[24] > 20)) throw new Error("MOCI: no karat prices found");
    return { rates: r, oz: oz ? num(oz) : undefined, updated: dd };
  },
  async global() {
    for (const [curr, u] of [["KWD", URLS.global], ["USD", URLS.globalUsd]]) {
      try {
        const j = JSON.parse(await http(u, "application/json")), it = j.items && j.items[0];
        if (it && +it.xauPrice > 100) return { curr, xau: +it.xauPrice, pc: it.pcXau != null ? +it.pcXau : 0 };
      } catch (e) { /* try the next feed */ }
    }
    throw new Error("goldprice.org: no price");
  },
  async fk() {
    const html = await page("fk", URLS.fk), txt = toText(html), history = historyFrom(html);
    let r = karatPrices(txt);
    if (!complete(r) && history[0]) r = { ...history[0].r };
    if (!complete(r)) throw new Error("FK: no karat prices found");
    return { rates: r, history, updated: history[0] ? history[0].d : undefined };
  },
  async joy() {
    const html = await page("joy", URLS.joy), r = karatPrices(toText(html));
    if (!complete(r)) throw new Error("Joyalukkas: no karat prices found (page may need the browser pass)");
    return { rates: r };
  }
};

let prev = { sources: {} };
try { prev = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { /* first run */ }
const next = { generated: Date.now(), sources: { ...(prev.sources || {}) } };
const wanted = browserList.length ? browserList : Object.keys(parsers);
const failed = [];
for (const name of wanted) {
  try {
    const d = await parsers[name]();
    next.sources[name] = { ok: true, t: Date.now(), ...d };
    console.log(`OK   ${name}`, JSON.stringify(d.rates || { xau: d.xau, curr: d.curr }));
  } catch (e) {
    failed.push(name);
    next.sources[name] = { ...(prev.sources && prev.sources[name] ? prev.sources[name] : {}), ok: false, err: String(e.message || e).slice(0, 160) };
    console.log(`FAIL ${name}: ${e.message}`);
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(next, null, 1));
if (browserPromise) { try { (await browserPromise).close(); } catch (e) { /* ignore */ } }
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `failed=${failed.filter((n) => n !== "global").join(",")}\n`);
process.exit(0);
