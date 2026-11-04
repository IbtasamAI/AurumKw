# Aurum KW (GitHub Pages edition)

Kuwait gold desk. Static site, no server and no Netlify.

## Deploy (5 minutes)
1. Upload everything in this folder to a GitHub repository (keep the hidden `.github` and `.nojekyll`).
2. Repo **Settings > Pages**: Source = "Deploy from a branch", Branch = `main`, folder `/ (root)`.
3. Repo **Settings > Actions > General > Workflow permissions**: choose **Read and write permissions** and save.
4. Open the **Actions** tab, pick **Update gold rates**, click **Run workflow** once. It then repeats about every 10 minutes.
5. Open the Pages address. The pill in the header says which source is live.

## How rates reach the page
The page itself reads each source straight from its link on every refresh (through a public CORS-friendly reader such as r.jina.ai, plus other free relays, all tried at the same time). The scheduled GitHub job below is a second, more reliable path that works even when those relays are down.

Browsers are not allowed to read MOCI, goldprice.org or the jewellers directly. So the workflow
`.github/workflows/rates.yml` runs `scripts/fetch-rates.mjs` on GitHub's servers, reads the four sources
and saves `data/rates.json`. The page reads that file from its own address. For MOCI and goldprice.org the
page also tries a live read from the browser.

Order of use: chosen source, then MOCI, then goldprice.org, then market spot. MOCI is the default.
If a source cannot be read the header pill says "(fallback)" and names what is shown.

Sources: MOCI (moci.gov.kw), goldprice.org, FK Jewellers (also gives the last 10 days), Joyalukkas Kuwait.
Pages that need JavaScript are retried in a headless browser automatically.

## Check it works
Actions tab > latest run > "Read the rate sources". Each source prints `OK` or `FAIL` with the reason.
`data/rates.json` shows what was saved. If one source fails, tell the developer the log line.

## Notes
- GitHub can delay scheduled runs by several minutes, and pauses them if the repo has no activity for 60 days.
- Optional: `extras/aurum-worker.js` is a Cloudflare Worker proxy. Paste its address in Settings for a faster MOCI read.
- Gold biscuit cursor: Theme menu > "Gold biscuit cursor" (desktop only, remembered).
