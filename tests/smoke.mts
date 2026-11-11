// Browser smoke test for the live site (or any deployment): the key Arcade and portfolio flows.
//   pnpm smoke                                    # against production
//   pnpm smoke https://portfolio-xyz.vercel.app   # against a preview
// Needs Google Chrome; set CHROME_PATH if it isn't in the default macOS location.
// It plays real levels on the target site, so it shows up in that site's game stats (bots are filtered out).

import puppeteer, { type Page } from "puppeteer-core";
// The repo's .ts files load as CommonJS here, so take them as namespaces.
const { buildHootBoard } = (await import("../lib/games/hoot.ts")) as typeof import("../lib/games/hoot");
const { solveLanterns } = (await import("../lib/games/lantern.ts")) as typeof import("../lib/games/lantern");

const BASE = (process.argv[2] ?? "https://portfolio-gurudeep-naik.vercel.app").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const GAMES = ["hoot", "sudoku", "ludo", "sort", "arrows", "brain", "reflex", "lantern"];
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const results: { pass: boolean; name: string }[] = [];
const ok = (name: string, pass: unknown) => results.push({ pass: !!pass, name });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });

async function phone(opts: { width?: number; skipDemos?: boolean; random?: number } = {}): Promise<Page> {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: opts.width ?? 375, height: 812, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument("globalThis.__name = f => f"); // tsx helper used inside page.evaluate
  if (opts.random !== undefined) await page.evaluateOnNewDocument((r: number) => { Math.random = () => r; }, opts.random);
  if (opts.skipDemos !== false) {
    await page.evaluateOnNewDocument((games: string[]) => { try { for (const g of games) localStorage.setItem(`play.demoSeen.${g}`, "1"); } catch { /* fine */ } }, GAMES);
  }
  page.on("pageerror", e => ok(`no page errors (${(e as Error).message.slice(0, 80)})`, false));
  return page;
}
const text = (page: Page) => page.evaluate(() => document.body.innerText);
const clickButton = (page: Page, label: RegExp) =>
  page.evaluate(src => { const b = [...document.querySelectorAll("button, a")].find(e => new RegExp(src, "i").test((e.textContent ?? "").trim())) as HTMLElement | undefined; b?.click(); return !!b; }, label.source);
const widthOk = async (page: Page) => (await page.evaluate(() => document.documentElement.scrollWidth)) <= (page.viewport()?.width ?? 0);

async function openLevel(page: Page, game: string, level: number) {
  await page.goto(`${BASE}/play/${game}`, { waitUntil: "networkidle2" });
  await wait(700);
  await clickButton(page, new RegExp(`^Play level ${level}$`));
  await wait(400);
  const node = await page.$(`button[aria-label^="Level ${level},"]`);
  if (node) await node.click();
  await wait(900);
}

// ---------- Arcade hub ----------
{
  const page = await phone();
  await page.goto(`${BASE}/play`, { waitUntil: "networkidle2" });
  await wait(1000);
  const t = await text(page);
  ok("hub lists all 8 games", GAMES.every(g => t.includes({ hoot: "Hoot & Seek", sudoku: "Sudoku", ludo: "Ludo", sort: "Colour Sort", arrows: "Arrow Escape", brain: "Brain Score", reflex: "Reflex Test", lantern: "Lantern Night" }[g]!)));
  ok("hub has 4 tabs", (await page.$$('[role="tab"]')).length === 4);
  await page.click("#tab-today");
  await wait(400);
  ok("Daily Challenge tab lists 6 games", (await page.$$("#panel-today li")).length === 6);
  await page.click("#tab-progress");
  await wait(400);
  ok("Progress tab lists 8 games", (await page.$$("#panel-progress li")).length >= 8);
  ok("hub: no sideways scroll", await widthOk(page));
}

// ---------- Continue pill ----------
{
  const page = await phone();
  await page.evaluateOnNewDocument(() => {
    if (sessionStorage.getItem("smoke.seeded")) return;
    sessionStorage.setItem("smoke.seeded", "1");
    sessionStorage.setItem("play.last", JSON.stringify({ game: "sort", level: 3, at: Date.now() }));
    sessionStorage.setItem("play.levels", JSON.stringify({ sort: { 1: 3, 2: 2 } }));
  });
  await page.goto(`${BASE}/play`, { waitUntil: "networkidle2" });
  await wait(1400);
  ok("Continue pill offers Colour Sort level 3", /Colour Sort · Level 3/.test(await text(page)));
  if (process.env.SMOKE_SHOTS) await page.screenshot({ path: `${process.env.SMOKE_SHOTS}/continue.png` });
  await page.click('[aria-label="Continue playing"] a');
  await page.waitForFunction(() => location.pathname === "/play/sort", { timeout: 6000 }).catch(() => undefined);
  await wait(1500);
  ok("Continue opens that level straight away", /Level 3/.test(await text(page)) && (await page.$$('[aria-label^="Flask"]')).length > 0);
}

// ---------- Walkthroughs ----------
{
  const page = await phone({ skipDemos: false });
  await page.goto(`${BASE}/play/lantern`, { waitUntil: "networkidle2" });
  await wait(1200);
  ok("walkthrough opens on a first visit", await page.$("dialog.demo-sheet[open]"));
  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "networkidle2" });
  await wait(900);
  ok("walkthrough doesn't reopen", !(await page.$("dialog.demo-sheet[open]")));
}

// ---------- Hoot & Seek: clear a level, hint costs a star, challenge link replays the board ----------
let challenge = "";
{
  const page = await phone({ random: 0.5 });
  await openLevel(page, "hoot", 1);
  const board = buildHootBoard(Math.floor(0.5 * 2 ** 31), 5);
  await clickButton(page, /^Hint/);
  await wait(500);
  for (const [row, col] of board.solution.entries()) {
    const cell = row * 5 + col;
    const placed = await page.evaluate(c => document.querySelector(`[data-cell="${c}"]`)?.getAttribute("aria-label")?.includes("owl") ?? false, cell);
    if (!placed) { await page.evaluate(c => { const e = document.querySelector(`[data-cell="${c}"]`) as HTMLElement; e.click(); e.click(); }, cell); await wait(450); }
  }
  await page.waitForFunction(() => /cleared!/i.test(document.body.innerText), { timeout: 8000 }).catch(() => undefined);
  await wait(700);
  const stars = await page.evaluate(() => document.querySelector('[role="img"][aria-label$="of 3 stars"]')?.getAttribute("aria-label"));
  ok(`Hoot level 1 cleared with one hint: 2 stars (${stars})`, stars === "2 of 3 stars");
  await page.evaluate(() => { (navigator as Navigator & { share?: unknown }).share = undefined; (navigator.clipboard as unknown as { writeText: (t: string) => Promise<void> }).writeText = t => { (window as unknown as { __copied: string }).__copied = t; return Promise.resolve(); }; });
  await clickButton(page, /^Challenge a friend$/);
  await wait(400);
  challenge = ((await page.evaluate(() => (window as unknown as { __copied?: string }).__copied)) ?? "").replace(/^.*?(https?:\/\/)/, "$1");
  ok("challenge link made", challenge.includes("/play/hoot?challenge=1-"));
  await clickButton(page, /^Share$/);
  await wait(400);
  ok("guest Share asks for a name on the card", await page.$("#card-name"));
}
if (challenge) {
  const page = await phone({ random: 0.123 });
  await page.goto(challenge, { waitUntil: "networkidle2" });
  await wait(1800);
  ok("challenge link opens the level straight away", (await page.$$("[data-cell]")).length === 25);
}

// ---------- Lantern Night: hint marks one lantern, solver finishes ----------
{
  const page = await phone();
  await page.goto(`${BASE}/play/lantern?challenge=30-777`, { waitUntil: "networkidle2" });
  await wait(1500);
  await clickButton(page, /^Hint/);
  await wait(300);
  ok("Lantern hint marks exactly one lantern", (await page.$$('[aria-label*="hint: tap this one"]')).length === 1);
  const lit = await page.$$eval('[aria-label^="Lantern"]', bs => bs.map(b => b.getAttribute("aria-pressed") === "true"));
  for (const c of solveLanterns(lit, Math.round(Math.sqrt(lit.length)))!) {
    await page.evaluate(i => (document.querySelectorAll('[aria-label^="Lantern"]')[i] as HTMLElement).click(), c);
    await wait(150);
  }
  await page.waitForFunction(() => /cleared!/i.test(document.body.innerText), { timeout: 6000 }).catch(() => undefined);
  ok("Lantern board solved", /cleared!/i.test(await text(page)));
}

// ---------- Lantern Night daily: three boards, scored and checked by the server ----------
{
  const page = await phone();
  await page.goto(`${BASE}/play/lantern?daily=1`, { waitUntil: "networkidle2" });
  await wait(1500);
  let boards = 0;
  for (let b = 0; b < 3; b++) {
    const lit = await page.$$eval('[aria-label^="Lantern"]', bs => bs.map(x => x.getAttribute("aria-pressed") === "true"));
    if (!lit.length) break;
    for (const c of solveLanterns(lit, Math.round(Math.sqrt(lit.length)))!) {
      await page.evaluate(i => (document.querySelectorAll('[aria-label^="Lantern"]')[i] as HTMLElement).click(), c);
      await wait(160); // slower than the server's fastest-tap rule
    }
    boards++;
    await wait(1300);
  }
  await page.waitForFunction(() => /boards lit/i.test(document.body.innerText), { timeout: 10000 }).catch(() => undefined);
  const t = await text(page);
  ok(`Lantern daily: ${boards} boards solved, result shown`, boards === 3 && /All 3 boards lit/.test(t));
  ok("Lantern daily score counted by the server (on the board)", /This run isn't on the board/.test(t) === false && /\d+ taps/.test(t));
}

// ---------- Every game page loads and fits a 320 px phone ----------
{
  const page = await phone({ width: 320 });
  for (const g of GAMES) {
    await page.goto(`${BASE}/play/${g}`, { waitUntil: "networkidle2" });
    await wait(500);
    ok(`${g}: page loads and fits 320 px`, /How to play/.test(await text(page)) && (await widthOk(page)));
  }
}

// ---------- Portfolio ----------
{
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on("pageerror", e => ok(`no page errors (${(e as Error).message.slice(0, 80)})`, false));
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await wait(2200);
  ok("home stats end on the real value", (await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("dl dd span[aria-hidden]")].find(e => e.offsetParent !== null)?.textContent)) === "4 yrs");
  await page.evaluate(() => document.getElementById("experience")!.scrollIntoView({ behavior: "instant" }));
  await wait(700);
  ok("nav marks the section on screen", (await page.evaluate(() => document.querySelector(".nav-link[data-active]")?.textContent)) === "Experience");
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click('button[aria-label^="Switch to"]');
  await wait(1000);
  ok("theme switches", (await page.evaluate(() => document.documentElement.dataset.theme)) !== before);
  await page.evaluate(() => document.getElementById("work")!.scrollIntoView({ behavior: "instant" }));
  await wait(400);
  // The phone and desktop layouts both have project titles; click the one that's showing.
  await page.evaluate(() => ([...document.querySelectorAll<HTMLElement>("#work h3 a")].find(a => a.offsetParent !== null))!.click());
  await page.waitForFunction(() => location.pathname.startsWith("/projects/"), { timeout: 6000 }).catch(() => undefined);
  await wait(900);
  ok("project page opens from its card", (await page.evaluate(() => location.pathname)).startsWith("/projects/"));
  ok("architecture packets run", await page.evaluate(() => document.querySelectorAll(".flow-packet").length > 0));
  for (const path of ["/", "/projects/erp-sync-starter", "/privacy", "/writing", "/writing/building-the-arcade"]) {
    const ph = await phone();
    await ph.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
    await wait(800);
    ok(`${path}: fits a 375 px phone`, await widthOk(ph));
  }
}

// ---------- Phone layout: tab bar, swipe cards, accordions ----------
{
  const page = await phone();
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await wait(1000);
  ok("phone: bottom tab bar with 5 tabs", (await page.$$(".site-tabs a")).length === 5);
  ok("phone: profile card actions (Résumé, Email, LinkedIn, GitHub)", /Résumé[\s\S]*Email[\s\S]*LinkedIn[\s\S]*GitHub/.test(await page.$eval("main section", e => (e as HTMLElement).innerText)));
  ok("phone: projects as swipe cards", (await page.$$("#work-m article")).length === 3);
  await page.evaluate(() => document.getElementById("experience")!.scrollIntoView({ behavior: "instant" }));
  await wait(700);
  ok("phone: About tab active over Experience", (await page.$eval('.site-tabs a[aria-current]', e => e.textContent).catch(() => "")) === "About");
  const closed = await page.$$eval("#experience details.xp", ds => ds.filter(d => !(d as HTMLDetailsElement).open).length);
  ok("phone: experience accordion (first open, rest closed)", closed >= 1);
  await page.goto(`${BASE}/projects/erp-sync-starter`, { waitUntil: "networkidle2" });
  await wait(600);
  ok("phone: failure cases open on tap", (await page.$$("main details.xp")).length > 3);
  ok("phone: tab bar marks Work on a project page", (await page.$eval('.site-tabs a[aria-current]', e => e.textContent).catch(() => "")) === "Work");

  // Taps on the phone buttons are reported to /api/click (sendBeacon bodies aren't visible here, so count the calls).
  const clicks = await phone();
  let sent = 0;
  clicks.on("request", r => { if (r.url().endsWith("/api/click")) sent++; });
  await clicks.goto(BASE, { waitUntil: "networkidle2" });
  await wait(800);
  await clicks.evaluate(() => (document.querySelector('[data-track="phone-project-erp-sync-starter"]') as HTMLElement).click());
  await wait(1500);
  await clicks.evaluate(() => (document.querySelector('[data-track="phone-tab-writing"]') as HTMLElement).click());
  await wait(1500);
  ok(`phone taps are tracked (${sent} click reports for 2 taps)`, sent === 2);
}

// ---------- Live project demos linked from the project pages ----------
{
  const { projects } = (await import("../content/projects.ts")) as typeof import("../content/projects");
  for (const p of projects.filter(x => x.demo)) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const failedApi: string[] = [];
    page.on("response", r => { if (r.url().includes("/api/") && r.status() >= 400) failedApi.push(`${r.status()} ${new URL(r.url()).pathname}`); });
    const res = await page.goto(p.demo!, { waitUntil: "networkidle2", timeout: 60000 }).catch(() => null);
    await wait(2500);
    const title = await page.title().catch(() => "");
    ok(`${p.name} demo loads (${res?.status()} "${title.slice(0, 40)}")${failedApi.length ? ` api errors: ${failedApi.slice(0, 3).join(", ")}` : ""}`, res?.status() === 200 && title.length > 0 && !failedApi.length);
    await ctx.close();
  }
}

await browser.close();
const failed = results.filter(r => !r.pass);
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"} ${r.name}`);
console.log(`\n${results.length - failed.length} of ${results.length} passed against ${BASE}`);
process.exit(failed.length ? 1 : 0);
