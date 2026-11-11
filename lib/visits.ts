import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

/** What the edge middleware captures from a page request and posts to /api/visit. */
export interface VisitInput {
  path: string;
  query: string;
  referer: string | null;
  ua: string | null;
  mobile?: boolean | null; // Sec-CH-UA-Mobile client hint, when the browser sent one
  ip: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  browserId?: string | null; // from the vid cookie; absent where the cookie is not used
}

export interface Visit {
  id: number;
  at: string;
  path: string;
  ref_tag: string | null;
  source: string;
  referer: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  device: string;
  os: string;
  browser: string;
  is_bot: boolean;
  visitor: string;
  org: string | null;
  isp: string | null;
  hosting: boolean | null;
}

const BOT_UA =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegram|discord|slack|embedly|pinterest|curl|wget|python-requests|go-http-client|lighthouse|headless|pagespeed|gtmetrix|vercel-screenshot/i;

export function parseUa(ua: string | null, mobile: boolean | null = null): { device: string; os: string; browser: string; is_bot: boolean } {
  const s = ua ?? "";
  const is_bot = s === "" || BOT_UA.test(s);
  // Tablets only when the agent says so; an Android agent without "Mobile" is still far more
  // likely a phone (in-app browsers often drop the token). The client hint wins when present.
  const tablet = /ipad|tablet|kindle|silk|sm-t\d|nexus (7|9|10)|pixel tablet|lenovo tb/i.test(s);
  const phoneish = /mobi|iphone|ipod|android|windows phone/i.test(s);
  const device = mobile === true ? (tablet ? "tablet" : "phone") : tablet ? "tablet" : mobile === false ? "desktop" : phoneish ? "phone" : "desktop";
  const os = /iphone|ipad|ipod/i.test(s) ? "iOS"
    : /android/i.test(s) ? "Android"
    : /windows/i.test(s) ? "Windows"
    : /mac os x|macintosh/i.test(s) ? "macOS"
    : /cros/i.test(s) ? "ChromeOS"
    : /linux/i.test(s) ? "Linux"
    : "other";
  const browser = /linkedinapp/i.test(s) ? "LinkedIn app"
    : /edg\//i.test(s) ? "Edge"
    : /opr\/|opera/i.test(s) ? "Opera"
    : /samsungbrowser/i.test(s) ? "Samsung"
    : /firefox|fxios/i.test(s) ? "Firefox"
    : /chrome|crios/i.test(s) ? "Chrome"
    : /safari/i.test(s) ? "Safari"
    : "other";
  return { device, os, browser, is_bot };
}

/** Where the visitor came from, as a short label: "LinkedIn", "Gmail", "Google", a host, or "direct". */
export function sourceOf(referer: string | null): string {
  if (!referer) return "direct";
  let host: string;
  try {
    host = new URL(referer).hostname.replace(/^www\./, "");
  } catch {
    return "direct";
  }
  // The portfolio and the Arcade are one site to the visitor: moving between them is internal.
  if (host.endsWith("portfolio-gurudeep-naik.vercel.app") || host.endsWith("gurudeep-arcade.vercel.app")) return "internal";
  const known: [RegExp, string][] = [
    [/linkedin\.com|lnkd\.in/, "LinkedIn"],
    [/instagram\.com/, "Instagram"],
    [/facebook\.com|fb\.com|fb\.me/, "Facebook"],
    [/whatsapp\.com/, "WhatsApp"],
    [/youtube\.com|youtu\.be/, "YouTube"],
    [/reddit\.com/, "Reddit"],
    [/mail\.google\.com/, "Gmail"],
    [/google\./, "Google"],
    [/github\.com/, "GitHub"],
    [/t\.co$|twitter\.com|x\.com/, "X"],
    [/naukri\.com/, "Naukri"],
    [/wellfound\.com|angel\.co/, "Wellfound"],
    [/slack\.com/, "Slack"],
    [/outlook\.|office\.com|live\.com/, "Outlook"],
    [/bing\.com/, "Bing"],
    [/duckduckgo\.com/, "DuckDuckGo"],
  ];
  for (const [re, label] of known) if (re.test(host)) return label;
  return host;
}

export function refTagOf(query: string): string | null {
  const p = new URLSearchParams(query);
  return p.get("ref") ?? p.get("utm_campaign") ?? p.get("utm_source") ?? null;
}

function shortHash(value: string): string {
  return createHash("sha256").update(`${process.env.VISITS_SECRET ?? ""}:${value}`).digest("hex").slice(0, 8);
}

/** Short id for an IP and OS pair; the address itself is not stored. Changes when the IP changes. */
export function networkId(ip: string | null, ua: string | null): string {
  return shortHash(`${ip ?? ""}:${parseUa(ua).os}`);
}

/** The id shown in the log: per browser when the vid cookie is in use, otherwise per network. */
export function visitorId(browserId: string | null | undefined, ip: string | null, ua: string | null): string {
  return browserId ? shortHash(browserId) : networkId(ip, ua);
}

function isPrivateIp(ip: string): boolean {
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip);
}

type Sql = ReturnType<typeof neon>;

// Fixed SQL, no user input. Data centres and Cloudflare are not people browsing, even when the
// browser string looks like Chrome. Cato Networks is the owner's work VPN. ?bots=1 still shows these rows.
const EXCLUDED_NETWORK = "(hosting is true or coalesce(org, '') || ' ' || coalesce(isp, '') ~* 'cloudflare|cato networks')";
// The owner reset the log here. Earlier rows stay in the database but are never shown.
const SINCE_LOG_START = "at >= '2026-11-06T09:58:08Z'";
export const HUMAN_VISIT = `(${SINCE_LOG_START} and not is_bot and not ${EXCLUDED_NETWORK})`;
const HUMAN_CLICK = `(${SINCE_LOG_START} and not is_bot and visitor not in (select visitor from portfolio.visits where ${EXCLUDED_NETWORK}))`;

function db(): Sql | null {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  return url ? neon(url) : null;
}

let schemaReady: Promise<void> | null = null;

/** A ready connection for other tables in the portfolio schema, or null when no database is set. */
export async function connect(): Promise<Sql | null> {
  const sql = db();
  if (sql) await ensureSchema(sql);
  return sql;
}

function ensureSchema(sql: Sql): Promise<void> {
  schemaReady ??= (async () => {
    await sql`create schema if not exists portfolio`;
    await sql`create table if not exists portfolio.visits (
      id bigserial primary key,
      at timestamptz not null default now(),
      path text not null,
      query text,
      ref_tag text,
      source text not null,
      referer text,
      city text, region text, country text,
      device text not null, os text not null, browser text not null,
      is_bot boolean not null default false,
      visitor text not null,
      org text, isp text, hosting boolean
    )`;
    await sql`create index if not exists visits_at on portfolio.visits (at desc)`;
    await sql`create table if not exists portfolio.networks (
      visitor text primary key,
      org text, isp text, hosting boolean,
      looked_up_at timestamptz not null default now()
    )`;
    await sql`create table if not exists portfolio.clicks (
      id bigserial primary key,
      at timestamptz not null default now(),
      name text not null,
      href text,
      path text not null,
      text text,
      visitor text not null,
      is_bot boolean not null default false
    )`;
    await sql`create index if not exists clicks_at on portfolio.clicks (at desc)`;
    await sql`create table if not exists portfolio.scores (
      id bigserial primary key,
      at timestamptz not null default now(),
      day date not null default (now() at time zone 'Asia/Kolkata')::date,
      game text not null,
      run text not null unique,
      score integer not null,
      name text,
      visitor text not null,
      network text not null
    )`;
    await sql`create table if not exists portfolio.ludo_rooms (
      code text primary key,
      room jsonb not null,
      version integer not null default 1,
      network text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
    await sql`create table if not exists portfolio.game_events (
      id bigserial primary key,
      at timestamptz not null default now(),
      game text not null,
      kind text not null,
      level integer,
      visitor text not null
    )`;
    await sql`create index if not exists game_events_game on portfolio.game_events (game, kind)`;
    await sql`create table if not exists portfolio.players (
      sub text primary key,
      email text not null,
      name text not null,
      picture text not null default '',
      progress jsonb not null,
      visitors text[] not null default '{}',
      created_at timestamptz not null default now(),
      seen_at timestamptz not null default now()
    )`;
    await sql`alter table portfolio.scores add column if not exists player text`;
    await sql`alter table portfolio.players add column if not exists friend_code text unique`;
    await sql`alter table portfolio.players add column if not exists nickname text`;
    await sql`create unique index if not exists players_nickname on portfolio.players (lower(nickname))`;
    await sql`create table if not exists portfolio.friends (
      a text not null,
      b text not null,
      at timestamptz not null default now(),
      primary key (a, b)
    )`;
    await sql`create index if not exists scores_player on portfolio.scores (game, day, player)`;
    await sql`create table if not exists portfolio.push_subs (
      endpoint text primary key,
      player text not null,
      keys jsonb not null,
      created_at timestamptz not null default now(),
      last_sent date
    )`;
    await sql`create index if not exists scores_game_score on portfolio.scores (game, score)`;
    await sql`create index if not exists scores_game_day on portfolio.scores (game, day)`;
    await sql`create index if not exists scores_network_at on portfolio.scores (network, at desc)`;
  })().catch(err => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

/** Who owns the visitor's network (a company or an ISP), cached per network id, because one browser moves between networks. ip-api.com free tier. */
async function lookupNetwork(sql: Sql, ip: string | null, network: string): Promise<{ org: string | null; isp: string | null; hosting: boolean | null }> {
  const none = { org: null, isp: null, hosting: null };
  if (!ip || isPrivateIp(ip)) return none;
  const cached = (await sql`select org, isp, hosting from portfolio.networks where visitor = ${network}`) as { org: string | null; isp: string | null; hosting: boolean | null }[];
  if (cached[0]) return cached[0];
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,org,isp,hosting`, { signal: AbortSignal.timeout(2500) });
    const data = (await res.json()) as { status: string; org?: string; isp?: string; hosting?: boolean };
    if (data.status !== "success") return none;
    const row = { org: data.org || null, isp: data.isp || null, hosting: data.hosting ?? null };
    await sql`insert into portfolio.networks (visitor, org, isp, hosting) values (${network}, ${row.org}, ${row.isp}, ${row.hosting}) on conflict (visitor) do nothing`;
    return row;
  } catch {
    return none;
  }
}

export async function recordVisit(v: VisitInput): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  await ensureSchema(sql);
  const ua = parseUa(v.ua, v.mobile ?? null);
  const visitor = visitorId(v.browserId, v.ip, v.ua);
  const net = ua.is_bot ? { org: null, isp: null, hosting: null } : await lookupNetwork(sql, v.ip, networkId(v.ip, v.ua));
  await sql`insert into portfolio.visits
    (path, query, ref_tag, source, referer, city, region, country, device, os, browser, is_bot, visitor, org, isp, hosting)
    values (${v.path}, ${v.query || null}, ${refTagOf(v.query)}, ${sourceOf(v.referer)}, ${v.referer}, ${v.city}, ${v.region}, ${v.country},
            ${ua.device}, ${ua.os}, ${ua.browser}, ${ua.is_bot}, ${visitor}, ${net.org}, ${net.isp}, ${net.hosting})`;
  return true;
}

export interface ClickInput {
  name: string;
  href: string | null;
  path: string;
  text: string | null;
  ip: string | null;
  ua: string | null;
  browserId: string | null;
}

export interface Click {
  id: number;
  at: string;
  name: string;
  href: string | null;
  path: string;
  text: string | null;
  visitor: string;
}

/** A click on an outbound link, the résumé, or anything marked data-track. Sent by components/Beacon. */
export async function recordClick(c: ClickInput): Promise<boolean> {
  const sql = db();
  if (!sql) return false;
  await ensureSchema(sql);
  const ua = parseUa(c.ua);
  await sql`insert into portfolio.clicks (name, href, path, text, visitor, is_bot)
    values (${c.name}, ${c.href}, ${c.path}, ${c.text}, ${visitorId(c.browserId, c.ip, c.ua)}, ${ua.is_bot})`;
  return true;
}

/** Visitors seen only on data-centre or excluded networks, as a fixed SQL list for other tables to leave out. */
export const EXCLUDED_VISITORS = `select visitor from portfolio.visits where ${EXCLUDED_NETWORK}`;

export async function listClicks(limit: number): Promise<Click[]> {
  const sql = db();
  if (!sql) return [];
  await ensureSchema(sql);
  return (await sql`select id, at, name, href, path, text, visitor from portfolio.clicks
    where ${sql.unsafe(HUMAN_CLICK)} order by at desc limit ${limit}`) as Click[];
}

export interface Digest {
  day: string; // the IST calendar day covered, YYYY-MM-DD
  visits: Visit[];
  clicks: Click[];
  visitors: number;
  resumeOpens: number;
}

/** Everything that happened on the previous IST calendar day (or today so far, when asked). */
export async function digestForYesterday(today = false): Promise<Digest | null> {
  const sql = db();
  if (!sql) return null;
  await ensureSchema(sql);
  const back = today ? 0 : 1;
  const [w] = (await sql`select
      ((date_trunc('day', now() at time zone 'Asia/Kolkata') - make_interval(days => ${back})) at time zone 'Asia/Kolkata') as from_at,
      ((date_trunc('day', now() at time zone 'Asia/Kolkata') - make_interval(days => ${back}) + interval '1 day') at time zone 'Asia/Kolkata') as to_at,
      to_char(date_trunc('day', now() at time zone 'Asia/Kolkata') - make_interval(days => ${back}), 'YYYY-MM-DD') as day`) as { from_at: string; to_at: string; day: string }[];
  if (!w) return null;
  const visits = (await sql`select id, at, path, ref_tag, source, referer, city, region, country, device, os, browser, is_bot, visitor, org, isp, hosting
    from portfolio.visits where ${sql.unsafe(HUMAN_VISIT)} and at >= ${w.from_at} and at < ${w.to_at} order by at`) as Visit[];
  const clicks = (await sql`select id, at, name, href, path, text, visitor from portfolio.clicks
    where ${sql.unsafe(HUMAN_CLICK)} and at >= ${w.from_at} and at < ${w.to_at} order by at`) as Click[];
  return {
    day: w.day,
    visits,
    clicks,
    visitors: new Set(visits.map(v => v.visitor)).size,
    resumeOpens: visits.filter(v => v.path.startsWith("/resume/")).length,
  };
}

export interface VisitSummary {
  today: number;
  week: number;
  month: number;
  visitors30: number;
  resume30: number;
}

export async function listVisits(opts: { limit: number; bots: boolean }): Promise<{ visits: Visit[]; summary: VisitSummary } | null> {
  const sql = db();
  if (!sql) return null;
  await ensureSchema(sql);
  const visits = (await sql`select id, at, path, ref_tag, source, referer, city, region, country, device, os, browser, is_bot, visitor, org, isp, hosting
    from portfolio.visits where ${sql.unsafe(SINCE_LOG_START)} and (${opts.bots} or ${sql.unsafe(HUMAN_VISIT)}) order by at desc limit ${opts.limit}`) as Visit[];
  const [s] = (await sql`select
      count(*) filter (where at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata') as today,
      count(*) filter (where at >= now() - interval '7 days') as week,
      count(*) filter (where at >= now() - interval '30 days') as month,
      count(distinct visitor) filter (where at >= now() - interval '30 days') as visitors30,
      count(*) filter (where at >= now() - interval '30 days' and path like '/resume/%') as resume30
    from portfolio.visits where ${sql.unsafe(HUMAN_VISIT)}`) as Record<string, string | number>[];
  const n = (x: string | number | undefined) => Number(x ?? 0);
  return { visits, summary: { today: n(s?.today), week: n(s?.week), month: n(s?.month), visitors30: n(s?.visitors30), resume30: n(s?.resume30) } };
}

export interface UniqueVisitor {
  visitor: string;
  visits: number;
  pages: number;
  first_at: string;
  last_at: string;
  ref_tag: string | null;
  name: string | null; // what they typed for a game leaderboard
  email: string | null; // when they signed in with Google
  source: string; // how they arrived the first time
  city: string | null;
  region: string | null;
  country: string | null;
  org: string | null;
  isp: string | null;
  hosting: boolean | null;
  device: string;
  os: string;
  browser: string;
}

/** One row per visitor id, most recent first. Location, network and device come from their latest visit. */
export async function listUniqueVisitors(opts: { limit: number; bots: boolean }): Promise<UniqueVisitor[]> {
  const sql = db();
  if (!sql) return [];
  await ensureSchema(sql);
  return (await sql`with shown as (
      select * from portfolio.visits where ${sql.unsafe(SINCE_LOG_START)} and (${opts.bots} or ${sql.unsafe(HUMAN_VISIT)})
    ), latest as (
      select distinct on (visitor) visitor, city, region, country, org, isp, hosting, device, os, browser
      from shown order by visitor, at desc
    ), totals as (
      select visitor, count(*)::int as visits, count(distinct path)::int as pages, min(at) as first_at, max(at) as last_at,
        (array_agg(ref_tag order by at desc) filter (where ref_tag is not null))[1] as ref_tag,
        (array_agg(source order by at))[1] as source
      from shown group by visitor
    )
    select totals.*,
      coalesce((select p.name from portfolio.players p where totals.visitor = any(p.visitors) limit 1),
        (select name from portfolio.scores s where s.visitor = totals.visitor and s.name is not null order by s.at desc limit 1)) as name,
      (select p.email from portfolio.players p where totals.visitor = any(p.visitors) limit 1) as email, latest.city, latest.region, latest.country, latest.org, latest.isp, latest.hosting, latest.device, latest.os, latest.browser
    from totals join latest using (visitor) order by last_at desc limit ${opts.limit}`) as UniqueVisitor[];
}
