// Netlify Function: lets the dashboard read the MOCI gold page and the Kuwait bid/ask page.
// Runs at /.netlify/functions/gold-proxy?u=<encoded page url>
const ALLOWED = [
  "https://moci.gov.kw/en/market-prices/gold/",
  "https://goldpricez.com/kw/21k/gram"
];

exports.handler = async (event) => {
  const target = event.queryStringParameters && event.queryStringParameters.u;
  if (!target || !ALLOWED.includes(target)) {
    return { statusCode: 400, headers: { "access-control-allow-origin": "*" }, body: "Not allowed" };
  }
  try {
    const upstream = await fetch(target, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; AurumKW)" }
    });
    const text = await upstream.text();
    return {
      statusCode: upstream.status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=30",
        "access-control-allow-origin": "*"
      },
      body: text
    };
  } catch (e) {
    return { statusCode: 502, headers: { "access-control-allow-origin": "*" }, body: "Upstream error" };
  }
};
