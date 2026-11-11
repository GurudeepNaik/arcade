import { ImageResponse } from "next/og";
import { cleanName } from "@/lib/games/names";
import { gameBySlug, type Game } from "@/lib/games/registry";

export const runtime = "edge";

// Share cards: a story size for Instagram and WhatsApp status, and a wide size for link previews.
// Every line on the card is built here from whole numbers and a cleaned name, never from free text.
const SIZES = { story: [1080, 1920], wide: [1200, 630] } as const;
const MAX_SCORE = 100_000;
const SITE = "gurudeep-arcade.vercel.app/play";

const int = (v: string | null, min: number, max: number): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** The score split into the number and its unit, so "68 pours" stays on one line with the number large. */
function scoreParts(game: Game, score: number): [string, string] {
  if (game.unit === "time") return [`${Math.floor(score / 60)}:${String(score % 60).padStart(2, "0")}`, ""];
  if (game.unit === "ms") return [String(score), "ms"];
  if (game.unit === "pours") return [String(score), score === 1 ? "pour" : "pours"];
  if (game.unit === "taps") return [String(score), score === 1 ? "tap" : "taps"];
  return [String(score), "points"];
}

// The day the result was made (sent by the page), so a cached card never shows the wrong date.
function dayLabel(v: string | null): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const d = new Date(`${v}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short" }).format(d);
}

function Owl({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 120 132">
      <path d="M34 22 24 4c10 2 22 6 27 12zM86 22 96 4c-10 2-22 6-27 12z" fill="#14866a" />
      <path d="M60 10c28 0 46 20 46 50 0 34-20 58-46 58s-46-24-46-58c0-30 18-50 46-50z" fill="#2fbf95" />
      <path d="M60 58c20 0 32 14 32 30 0 20-14 32-32 32S28 108 28 88c0-16 12-30 32-30z" fill="#fff4dc" />
      <circle cx="41" cy="50" r="20" fill="#ffffff" />
      <circle cx="79" cy="50" r="20" fill="#ffffff" />
      <path d="M30 54q11-13 22 0M68 54q11-13 22 0" fill="none" stroke="#1f3d3a" strokeWidth="5" strokeLinecap="round" />
      <path d="M60 58l-8 2c2 8 6 12 8 13 2-1 6-5 8-13z" fill="#ffb82e" />
    </svg>
  );
}

// Drawn, because the card font has no star characters.
function Stars({ count, size }: { count: number; size: number }) {
  return (
    <div style={{ display: "flex", gap: size * 0.18 }}>
      {[1, 2, 3].map(n => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24">
          <path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" fill={n <= count ? "#ffc53d" : "#e3eee9"} />
        </svg>
      ))}
    </div>
  );
}

function Pill({ children, s, colour }: { children: React.ReactNode; s: number; colour: string }) {
  return <div style={{ display: "flex", alignItems: "center", padding: `${10 * s}px ${24 * s}px`, borderRadius: 999, background: `${colour}1f`, color: colour, fontSize: 30 * s, fontWeight: 700 }}>{children}</div>;
}

/** "My week": the weekly recap card. Numbers only, each capped, so nothing on it is free text but the cleaned name. */
function weekCard(params: URLSearchParams): Response {
  const [width, height] = SIZES[params.get("size") === "story" ? "story" : "wide"];
  const story = height > width;
  const s = story ? 1.5 : 0.62;
  const name = cleanName(params.get("name"));
  const start = dayLabel(params.get("week"));
  const tiles: [string, number | null][] = [
    ["levels cleared", int(params.get("levels"), 0, 700)],
    ["stars earned", int(params.get("stars"), 0, 2100)],
    ["games played", int(params.get("plays"), 0, 10_000)],
    ["new bests", int(params.get("bests"), 0, 100)],
  ];
  const streak = int(params.get("streak"), 2, 3650);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #27b98f, #0c1f24)", fontFamily: "sans-serif", padding: 56 * s }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 * s, color: "#ffffff", fontSize: 34 * s, fontWeight: 800, letterSpacing: 1 }}>
          <Owl size={54 * s} />
          THE ARCADE
        </div>
        <div style={{ marginTop: 30 * s, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", background: "#ffffff", borderRadius: 44 * s, padding: `${44 * s}px ${40 * s}px` }}>
          <div style={{ fontSize: 56 * s, fontWeight: 800, color: "#1f3d3a" }}>{name ? `${name}'s week` : "My week"}</div>
          {start ? <div style={{ marginTop: 6 * s, fontSize: 30 * s, color: "#5d7a75" }}>{`Week of ${start}`}</div> : null}
          <div style={{ marginTop: 28 * s, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 20 * s, width: "100%" }}>
            {tiles.map(([label, value]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "45%", padding: `${22 * s}px 0`, borderRadius: 28 * s, background: "#eef8f3" }}>
                <div style={{ fontSize: 88 * s, fontWeight: 800, color: "#14866a", lineHeight: 1 }}>{String(value ?? 0)}</div>
                <div style={{ marginTop: 8 * s, fontSize: 28 * s, color: "#5d7a75" }}>{label}</div>
              </div>
            ))}
          </div>
          {streak ? <div style={{ display: "flex", marginTop: 24 * s }}><Pill s={s} colour="#d97706">{`${streak}-day streak`}</Pill></div> : null}
        </div>
        <div style={{ marginTop: 34 * s, fontSize: 44 * s, fontWeight: 800, color: "#ffffff", textAlign: "center" }}>Can you top my week?</div>
        <div style={{ marginTop: 12 * s, display: "flex", flexDirection: story ? "column" : "row", alignItems: "center", gap: story ? 2 * s : 10 * s, fontSize: 28 * s, color: "#ffffff", opacity: 0.92 }}>
          <div>Play free at</div>
          <div style={{ fontWeight: 700 }}>{SITE}</div>
        </div>
      </div>
    ),
    { width, height, headers: { "cache-control": "public, max-age=86400, immutable" } },
  );
}

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  if (params.get("kind") === "week") return weekCard(params);
  const game = gameBySlug(params.get("game"));
  if (!game) return new Response("Unknown game", { status: 400 });
  const [width, height] = SIZES[params.get("size") === "story" ? "story" : "wide"];
  const story = height > width;
  const name = cleanName(params.get("name"));
  const level = int(params.get("level"), 1, 100);
  const stars = int(params.get("stars"), 0, 3) ?? 0;
  const score = int(params.get("score"), 1, MAX_SCORE - 1);
  const better = int(params.get("better"), 1, 99); // "better than N% of players", only sent once a game has enough runs
  const streak = int(params.get("streak"), 2, 3650);
  const day = dayLabel(params.get("day"));

  let main: [string, string];
  let context: string;
  if (level !== null) {
    main = [`Level ${level}`, ""];
    context = `${name ? "cleared" : "Cleared"} on ${game.title}`;
  } else if (score !== null) {
    main = scoreParts(game, score);
    context = [game.title, game.daily ? `Daily challenge${day ? `, ${day}` : ""}` : day].filter(Boolean).join(" · ");
  } else {
    main = [game.title, ""];
    context = game.tagline;
  }
  const dare = level !== null ? (name ? `Can you get further than ${name}?` : "Can you get further?") : score !== null ? (name ? `Can you beat ${name}?` : "Can you beat this?") : "Play free";

  const s = story ? 1.5 : 0.62;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: `linear-gradient(160deg, ${game.colour}, ${game.deep})`, fontFamily: "sans-serif", padding: 56 * s }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 * s, color: "#ffffff", fontSize: 34 * s, fontWeight: 800, letterSpacing: 1 }}>
          <Owl size={54 * s} />
          THE ARCADE
        </div>
        <div style={{ marginTop: 30 * s, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", background: "#ffffff", borderRadius: 44 * s, padding: `${44 * s}px ${48 * s}px ${40 * s}px`, boxShadow: "0 30px 60px rgba(0,0,0,0.25)" }}>
          {name ? <div style={{ fontSize: 58 * s, fontWeight: 800, color: "#1f3d3a", maxWidth: "100%" }}>{name}</div> : null}
          <div style={{ marginTop: name ? 6 * s : 0, fontSize: 30 * s, color: "#5d7a75", textAlign: "center" }}>{context}</div>
          <div style={{ marginTop: 18 * s, display: "flex", alignItems: "baseline", gap: 16 * s, color: "#1f3d3a" }}>
            <div style={{ fontSize: (main[0].length > 7 ? 110 : 150) * s, fontWeight: 800, letterSpacing: -3 * s, lineHeight: 1 }}>{main[0]}</div>
            {main[1] ? <div style={{ fontSize: 50 * s, fontWeight: 700, color: game.deep }}>{main[1]}</div> : null}
          </div>
          {level !== null && stars > 0 ? <div style={{ display: "flex", marginTop: 18 * s }}><Stars count={stars} size={64 * s} /></div> : null}
          {(better || streak) ? (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 * s, marginTop: 24 * s }}>
              {better ? <Pill s={s} colour={game.deep}>Better than {better}% of players</Pill> : null}
              {streak ? <Pill s={s} colour="#d97706">{streak}-day streak</Pill> : null}
            </div>
          ) : null}
        </div>
        <div style={{ marginTop: 34 * s, fontSize: 44 * s, fontWeight: 800, color: "#ffffff", textAlign: "center", maxWidth: "100%" }}>{dare}</div>
        <div style={{ marginTop: 12 * s, display: "flex", flexDirection: story ? "column" : "row", alignItems: "center", gap: story ? 2 * s : 10 * s, fontSize: 28 * s, color: "#ffffff", opacity: 0.92 }}>
          <div>Play free at</div>
          <div style={{ fontWeight: 700 }}>{SITE}</div>
        </div>
      </div>
    ),
    { width, height, headers: { "cache-control": "public, max-age=86400, immutable" } },
  );
}
