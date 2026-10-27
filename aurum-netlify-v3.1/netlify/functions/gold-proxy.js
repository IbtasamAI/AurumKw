// Netlify Function: lets the dashboard read the MOCI gold page, the Kuwait bid/ask page
// and the goldprice.org rate feed without browser cross-origin limits.
// Runs at /.netlify/functions/gold-proxy?u=<encoded url>
const ALLOWED = [
  "https://moci.gov.kw/en/market-prices/gold/",
  "https://goldpricez.com/kw/21k/gram",
  "https://data-asg.goldprice.org/dbXRates/KWD",
  "https://data-asg.goldprice.org/dbXRates/USD"
];

exports.handler = async (event) => {
  const target = event.queryStringParameters && event.queryStringParameters.u;
  if (!target || !ALLOWED.includes(target)) {
    return { statusCode: 400, headers: { "access-control-allow-origin": "*" }, body: "Not allowed" };
  }
  try {
    const upstream = await fetch(target, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; AurumKW)",
        "accept": "application/json, text/html;q=0.9, */*;q=0.8",
        "referer": "https://goldprice.org/"
      }
    });
    const text = await upstream.text();
    const json = target.indexOf("goldprice.org") > -1;
    return {
      statusCode: upstream.status,
      headers: {
        "content-type": json ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
        "cache-control": "public, max-age=20",
        "access-control-allow-origin": "*"
      },
      body: text
    };
  } catch (e) {
    return { statusCode: 502, headers: { "access-control-allow-origin": "*" }, body: "Upstream error" };
  }
};
