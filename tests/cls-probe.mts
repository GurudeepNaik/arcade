// Layout shift on the Arcade page for a returning player (saved progress + a last-played level).
import puppeteer from "puppeteer-core";
const BASE = (process.argv[2] ?? "https://portfolio-gurudeep-naik.vercel.app").replace(/\/$/, "");
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
for (const returning of [false, true]) {
  const page = await (await browser.createBrowserContext()).newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluateOnNewDocument((returning: boolean) => {
    (window as any).__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) { (window as any).__cls += e.value; ((window as any).__src ??= []).push(e.value.toFixed(3) + " " + (e.sources ?? []).map((s: any) => s.node ? (s.node.nodeName + "." + String(s.node.className).slice(0, 50) + " moved " + Math.round(s.currentRect.y - s.previousRect.y) + "px") : "?").join(" | ")); } }).observe({ type: "layout-shift", buffered: true });
    if (returning) {
      sessionStorage.setItem("play.last", JSON.stringify({ game: "sort", level: 3, at: Date.now() }));
      sessionStorage.setItem("play.levels", JSON.stringify({ sort: { 1: 3, 2: 2 } }));
    }
  }, returning);
  await page.goto(`${BASE}/play`, { waitUntil: "networkidle2" });
  await new Promise(r => setTimeout(r, 2500));
  const r = await page.evaluate(() => ({ cls: (window as any).__cls as number, card: /continue/i.test(document.body.innerText), src: (window as any).__src ?? [] }));
  console.log(`${returning ? "returning" : "first visit"}: layout shift ${r.cls.toFixed(3)}, continue card ${r.card}`);
  for (const line of r.src) console.log("   ", line);
}
await browser.close();
