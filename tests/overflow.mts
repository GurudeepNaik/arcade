// Lists elements that stick out past the right edge of a phone screen: tsx tests/overflow.mts [path] [width]
import puppeteer from "puppeteer-core";
const path = process.argv[2] ?? "/";
const width = Number(process.argv[3] ?? 375);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage();
await page.setViewport({ width, height: 812, isMobile: true, hasTouch: true });
await page.goto(`https://portfolio-gurudeep-naik.vercel.app${path}`, { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 1500));
console.log("scrollWidth", await page.evaluate(() => document.documentElement.scrollWidth));
console.log(JSON.stringify(await page.evaluate(vw => {
  const out: string[] = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 0.5 && r.width > 0 && !el.closest(".site-tabs")) {
      let p = el.parentElement, clipped = false;
      while (p) { const o = getComputedStyle(p).overflowX; if (o !== "visible") { clipped = true; break; } p = p.parentElement; }
      if (!clipped) out.push(`${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 70)} right=${Math.round(r.right)}`);
    }
  }
  return out.slice(0, 10);
}, width), null, 1));
await browser.close();
