import { ImageResponse } from "next/og";
import { LEVEL_COUNT } from "@/lib/games/levels";
import { games } from "@/lib/games/registry";

// The picture shown when /play is shared: the owl, the Arcade's name, and a chip per game in its colour.
export const alt = "The Arcade: puzzle and party games with daily leaderboards";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Owl({ size: s }: { size: number }) {
  return (
    <svg width={s} height={s * 1.1} viewBox="0 0 120 132">
      <path d="M34 22 24 4c10 2 22 6 27 12zM86 22 96 4c-10 2-22 6-27 12z" fill="#14866a" />
      <path d="M60 10c28 0 46 20 46 50 0 34-20 58-46 58s-46-24-46-58c0-30 18-50 46-50z" fill="#2fbf95" />
      <path d="M60 58c20 0 32 14 32 30 0 20-14 32-32 32S28 108 28 88c0-16 12-30 32-30z" fill="#fff4dc" />
      <circle cx="41" cy="50" r="20" fill="#ffffff" />
      <circle cx="79" cy="50" r="20" fill="#ffffff" />
      <circle cx="44" cy="52" r="8" fill="#1f3d3a" />
      <circle cx="76" cy="52" r="8" fill="#1f3d3a" />
      <path d="M60 58l-8 2c2 8 6 12 8 13 2-1 6-5 8-13z" fill="#ffb82e" />
    </svg>
  );
}

export default function ArcadeImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", gap: 56, padding: "0 80px", background: "linear-gradient(150deg, #1d4a4a, #0c1f24 70%)", color: "#ffffff", fontFamily: "sans-serif" }}>
        <Owl size={260} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>The Arcade</div>
          <div style={{ fontSize: 32, color: "#cde9e1", marginTop: 18 }}>{`${games.length} games · ${LEVEL_COUNT} levels each · daily leaderboards · live Ludo`}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 34 }}>
            {games.map(g => (
              <div key={g.slug} style={{ display: "flex", padding: "10px 18px", borderRadius: 999, background: g.colour, color: g.onColour, fontSize: 22, fontWeight: 700 }}>{g.title}</div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
