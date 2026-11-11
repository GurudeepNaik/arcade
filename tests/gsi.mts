// Google sign-in button renders on the Arcade's own address (the origin must be allowed in the OAuth client).
import puppeteer from "puppeteer-core";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const page = await browser.newPage();
const errors: string[] = [];
page.on("console", m => { if (m.type() === "error" && /gsi|origin|client/i.test(m.text())) errors.push(m.text().slice(0, 160)); });
await page.evaluateOnNewDocument(() => { try { localStorage.setItem("play.demoSeen.hoot", "1"); } catch {} });
await page.goto("https://gurudeep-arcade.vercel.app/play", { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 3000));
const frames = page.frames().filter(f => f.url().includes("accounts.google.com/gsi/button")).length;
console.log(`${frames === 1 && !errors.length ? "PASS" : "FAIL"} Google button on the Arcade (${frames} button, ${errors.length} origin errors) ${errors.join(" | ")}`);
await browser.close();
