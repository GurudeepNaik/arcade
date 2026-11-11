"use client";

import { BASE, BASE_CELLS, cellOf, COLOUR_NAMES, FINISHED, HOME_CELLS, isSafeTrack, TRACK_CELLS, type Colour, type LudoState } from "@/lib/games/ludo";

export const FILLS = ["#ff6b63", "#27b98f", "#ffb82e", "#3fa9f0"];
const LIGHT = ["#ffada6", "#7ee8c6", "#ffdc7a", "#9fd8ff"];
const TRACK = "var(--ludo-track)";
const SEAM = "var(--ludo-seam)";
const baseSpot = (i: number) => `color-mix(in srgb, ${FILLS[i]} 24%, var(--ludo-track))`;
const INK = "#1f3d3a";


export interface MovingToken { colour: Colour; token: number; progress: number }

function Star({ r, c }: { r: number; c: number }) {
  return <path transform={`translate(${c + 0.5} ${r + 0.5}) scale(.034)`} d="M0-10l2.9 6 6.6.9-4.8 4.6 1.2 6.5L0 5l-5.9 3 1.2-6.5-4.8-4.6 6.6-.9z" style={{ fill: "var(--ink)" }} opacity=".45" />;
}

const Board = () => (
  <>
    <defs>
      {FILLS.map((fill, i) => (
        <radialGradient key={fill} id={`token-${i}`} cx=".36" cy=".3" r=".8"><stop offset="0" stopColor={LIGHT[i]} /><stop offset="1" stopColor={fill} /></radialGradient>
      ))}
    </defs>
    <rect width="15" height="15" rx=".5" fill={SEAM} />
    {[[0, 0], [0, 9], [9, 9], [9, 0]].map(([r, c], i) => (
      <g key={i}>
        <rect x={c! + 0.06} y={r! + 0.06} width="5.88" height="5.88" rx=".7" fill={`url(#token-${i})`} />
        <rect x={c! + 0.9} y={r! + 0.9} width="4.2" height="4.2" rx=".6" fill={TRACK} />
      </g>
    ))}
    {BASE_CELLS.flatMap((cells, i) => cells.map(([r, c], t) => <circle key={`${i}${t}`} cx={c + 0.5} cy={r + 0.5} r=".56" style={{ fill: baseSpot(i) }} />))}
    {TRACK_CELLS.map(([r, c], i) => {
      const start = [0, 13, 26, 39].indexOf(i);
      return (
        <g key={i}>
          <rect x={c + 0.04} y={r + 0.04} width=".92" height=".92" rx=".2" fill={start >= 0 ? FILLS[start] : TRACK} />
          {isSafeTrack(i) && <Star r={r} c={c} />}
        </g>
      );
    })}
    {HOME_CELLS.flatMap((cells, i) => cells.map(([r, c]) => <rect key={`${i}${r}${c}`} x={c + 0.04} y={r + 0.04} width=".92" height=".92" rx=".2" fill={FILLS[i]} />))}
    <path d="M6 6L7.5 7.5 6 9z" fill={FILLS[0]} /><path d="M6 6h3L7.5 7.5z" fill={FILLS[1]} /><path d="M9 6v3L7.5 7.5z" fill={FILLS[2]} /><path d="M6 9h3L7.5 7.5z" fill={FILLS[3]} />
  </>
);

function Token({ colour, x, y, scale, active, step, label, onPick }: { colour: Colour; x: number; y: number; scale: number; active: boolean; step: number; label: string; onPick?: () => void }) {
  return (
    <g className="ludo-token" style={{ transform: `translate(${x}px, ${y}px) scale(${scale})` }}>
      {active && <circle r=".6" fill="none" stroke={FILLS[colour]} strokeWidth=".1" className="game-glow art-idle" />}
      <g role={onPick ? "button" : undefined} tabIndex={onPick ? 0 : undefined} aria-label={label} onClick={onPick} onKeyDown={onPick ? e => (e.key === "Enter" || e.key === " ") && onPick() : undefined} style={{ cursor: onPick ? "pointer" : undefined }}>
        <circle r=".95" fill="transparent" />
        <ellipse cy=".32" rx=".34" ry=".12" fill={INK} opacity=".22" />
        <g key={step} className={step >= 0 ? "ludo-hop" : undefined}>
          <path d="M-.29.3C-.29.03-.13-.03-.1-.16h.2C.13-.03.29.03.29.3z" fill={`url(#token-${colour})`} />
          <circle cy="-.26" r=".22" fill={`url(#token-${colour})`} />
          <ellipse cx="-.08" cy="-.34" rx=".07" ry=".05" fill="#fff" opacity=".85" />
        </g>
      </g>
    </g>
  );
}

/** The board with every token on it. `human` is whose tokens can be picked, from `choices`. */
export function LudoTable({ state, moving, human, choices, roll, onPick }: { state: LudoState; moving: MovingToken | null; human: Colour | null; choices: number[]; roll: number; onPick: (token: number, roll: number) => void }) {
  const seen = new Map<string, number>();
  const tokens = state.players.flatMap(colour => [0, 1, 2, 3].map(token => {
    const progress = moving?.colour === colour && moving.token === token ? moving.progress : state.tokens[colour]![token]!;
    const [r, c] = cellOf(colour, token, progress);
    const key = `${r},${c}`;
    const stack = seen.get(key) ?? 0;
    seen.set(key, stack + 1);
    return { colour, token, progress, r, c, stack };
  }));
  return (
    <div className="arcade-panel overflow-hidden p-2">
      <svg viewBox="0 0 15 15" className="block w-full touch-manipulation" role="group" aria-label="Ludo board">
        <Board />
        {tokens.sort((a, b) => a.r - b.r).map(t => {
          const pickable = t.colour === human && choices.includes(t.token);
          const shift = t.progress === BASE || t.progress >= FINISHED ? 0 : t.stack * 0.2;
          return (
            <Token
              key={`${t.colour}${t.token}`}
              colour={t.colour}
              x={t.c + 0.5 + shift}
              y={t.r + 0.5 - shift * 0.5}
              scale={t.progress >= FINISHED ? 0.72 : 1}
              active={pickable}
              step={t.progress}
              label={`${COLOUR_NAMES[t.colour]} token ${t.token + 1}`}
              onPick={pickable ? () => onPick(t.token, roll) : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}
