import type { GameSlug } from "@/lib/games/registry";

// Soft-shaded covers as inline SVG: sharp at any size and a few kilobytes in total.
const PAINT: Record<string, [string, string]> = {
  mint: ["#7ee8c6", "#27b98f"], gold: ["#ffdc7a", "#ffb82e"], rose: ["#ffb3c8", "#ff7aa2"], sky: ["#9fe0ff", "#3fb8f0"],
  coral: ["#ffada6", "#ff6b63"], lime: ["#d4f58c", "#a4dd3a"], tang: ["#ffc08f", "#ff9142"], snow: ["#ffffff", "#eaf3ee"], pine: ["#3aa98b", "#14866a"],
};

function Defs() {
  return (
    <defs>
      {Object.entries(PAINT).map(([name, [a, b]]) => (
        <linearGradient key={name} id={`p-${name}`} x1=".15" y1="0" x2=".7" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
      ))}
      <radialGradient id="p-floor" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#1f3d3a" stopOpacity=".3" /><stop offset="1" stopColor="#1f3d3a" stopOpacity="0" /></radialGradient>
      <radialGradient id="p-glow" cx=".5" cy=".42" r=".65"><stop offset="0" stopColor="#ffffff" stopOpacity=".85" /><stop offset="1" stopColor="#ffffff" stopOpacity="0" /></radialGradient>
    </defs>
  );
}

const Backdrop = ({ from, to }: { from: string; to: string }) => (
  <>
    <linearGradient id={`b-${from.slice(1)}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient>
    <rect width="480" height="320" fill={`url(#b-${from.slice(1)})`} />
    <rect width="480" height="320" fill="url(#p-glow)" />
  </>
);

/** A plump tile: a soft drop shadow, the body, and a highlight along the top. */
function Tile({ x, y, s = 60, paint, r = 14 }: { x: number; y: number; s?: number; paint: string; r?: number }) {
  return (
    <g>
      <rect x={x} y={y + 5} width={s} height={s} rx={r} fill="#1f3d3a" opacity=".16" />
      <rect x={x} y={y} width={s} height={s} rx={r} fill={`url(#p-${paint})`} />
      <rect x={x + s * 0.12} y={y + s * 0.09} width={s * 0.76} height={s * 0.16} rx={s * 0.08} fill="#fff" opacity=".42" />
    </g>
  );
}

const Floor = ({ cx, cy, rx }: { cx: number; cy: number; rx: number }) => <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.2} fill="url(#p-floor)" />;

function Owl({ x, y, s = 1, cls }: { x: number; y: number; s?: number; cls?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={cls}>
        <Floor cx={0} cy={54} rx={42} />
        <path d="M-28-34-38-54c11 2 22 7 26 13zM28-34 38-54c-11 2-22 7-26 13z" fill="#14866a" />
        <path d="M0-48c28 0 44 20 44 48S26 54 0 54-44 28-44 0s16-48 44-48z" fill="url(#p-mint)" />
        <path d="M0-2c19 0 30 13 30 28S17 52 0 52-30 41-30 26-19-2 0-2z" fill="#fff4dc" />
        <circle cx="-19" cy="-12" r="18" fill="#fff" /><circle cx="19" cy="-12" r="18" fill="#fff" />
        <circle cx="-17" cy="-11" r="10" fill="#1f3d3a" /><circle cx="17" cy="-11" r="10" fill="#1f3d3a" />
        <circle cx="-14" cy="-15" r="3.4" fill="#fff" /><circle cx="20" cy="-15" r="3.4" fill="#fff" />
        <path d="M0-4-8-2C-6 6-2 10 0 11 2 10 6 6 8-2z" fill="url(#p-gold)" />
      </g>
    </g>
  );
}

function Hoot() {
  const colours = ["mint", "mint", "gold", "gold", "rose", "sky", "mint", "gold", "rose", "rose", "sky", "sky", "tang", "rose", "lime", "sky", "tang", "tang", "lime", "lime"];
  return (
    <>
      <Backdrop from="#d9f7ea" to="#fff0cf" />
      <g transform="rotate(-6 200 170)">
        <rect x="52" y="26" width="306" height="266" rx="34" fill="#1f3d3a" opacity=".14" transform="translate(0 10)" />
        <rect x="52" y="26" width="306" height="266" rx="34" fill="#fffdf6" />
        {colours.map((paint, i) => <Tile key={i} x={68 + (i % 5) * 56} y={42 + Math.floor(i / 5) * 60} s={52} paint={paint} />)}
        {[[1, 2], [3, 0], [4, 3]].map(([c, r]) => (
          <path key={`${c}${r}`} d={`M${82 + c! * 56} ${56 + r! * 60}l24 24m0-24-24 24`} stroke="#fff" strokeWidth="8" strokeLinecap="round" />
        ))}
      </g>
      <Owl x={132} y={108} s={0.62} />
      <Owl x={392} y={196} s={1.42} cls="art-idle" />
      <path d="M430 44l6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2z" fill="url(#p-gold)" className="art-bob" />
      <circle cx="372" cy="58" r="8" fill="url(#p-rose)" className="art-bob" /><circle cx="456" cy="120" r="6" fill="url(#p-sky)" />
    </>
  );
}

function Sudoku() {
  const digits = ["5", "3", "", "6", "", "9", "", "8", "1"];
  return (
    <>
      <Backdrop from="#ffe9b5" to="#ffc978" />
      <g transform="rotate(-6 210 164)" className="art-bob">
        <rect x="78" y="34" width="262" height="262" rx="36" fill="#7a4d00" opacity=".18" transform="translate(0 11)" />
        <rect x="78" y="34" width="262" height="262" rx="36" fill="#fffdf6" />
        {digits.map((d, i) => {
          const x = 94 + (i % 3) * 79, y = 50 + Math.floor(i / 3) * 79;
          return (
            <g key={i}>
              <rect x={x} y={y} width="72" height="72" rx="18" fill={i === 4 ? "url(#p-mint)" : i === 7 ? "url(#p-rose)" : "#fff3d8"} />
              {d && <text x={x + 36} y={y + 53} textAnchor="middle" fontSize="50" fontWeight="700" fill={i === 7 ? "#fff" : "#7a4d00"} fontFamily="var(--font-display), sans-serif">{d}</text>}
            </g>
          );
        })}
      </g>
      <g transform="rotate(26 398 170)" className="art-idle">
        <Floor cx={398} cy={298} rx={40} />
        <rect x="376" y="70" width="44" height="170" rx="10" fill="url(#p-coral)" />
        <rect x="376" y="70" width="14" height="170" fill="#fff" opacity=".22" />
        <rect x="376" y="46" width="44" height="34" rx="12" fill="url(#p-rose)" />
        <path d="M376 238h44l-22 50z" fill="#ffe6c2" /><path d="M389 268h18l-9 20z" fill="#5a3d1e" />
      </g>
      <Owl x={64} y={250} s={0.72} />
    </>
  );
}

function Pawn({ x, y, paint, s = 1, cls }: { x: number; y: number; paint: string; s?: number; cls?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={cls}>
        <Floor cx={0} cy={58} rx={38} />
        <path d="M-30 56c0-26 15-32 18-48h24c3 16 18 22 18 48z" fill={`url(#p-${paint})`} />
        <circle cy="-12" r="26" fill={`url(#p-${paint})`} />
        <ellipse cx="-9" cy="-22" rx="9" ry="6" fill="#fff" opacity=".7" />
      </g>
    </g>
  );
}

function Dice({ x, y, s, cls }: { x: number; y: number; s: number; cls?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(-13)`}>
      <g className={cls}>
        <rect x={-s / 2} y={-s / 2 + 8} width={s} height={s} rx={s * 0.24} fill="#1f3d3a" opacity=".2" />
        <rect x={-s / 2} y={-s / 2} width={s} height={s} rx={s * 0.24} fill="url(#p-snow)" />
        {[[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]].map(([a, b]) => <circle key={`${a}${b}`} cx={a! * s * 0.26} cy={b! * s * 0.26} r={s * 0.095} fill="#1f3d3a" />)}
      </g>
    </g>
  );
}

function Ludo() {
  return (
    <>
      <Backdrop from="#ffd9cf" to="#ffb3a3" />
      <rect x="26" y="24" width="428" height="272" rx="38" fill="#a13a2d" opacity=".16" transform="translate(0 10)" />
      <rect x="26" y="24" width="428" height="272" rx="38" fill="#fffdf6" />
      <rect x="42" y="40" width="146" height="100" rx="26" fill="url(#p-coral)" /><rect x="292" y="40" width="146" height="100" rx="26" fill="url(#p-mint)" />
      <rect x="292" y="180" width="146" height="100" rx="26" fill="url(#p-gold)" /><rect x="42" y="180" width="146" height="100" rx="26" fill="url(#p-sky)" />
      {[0, 1, 2].map(c => [0, 1, 2, 3].map(r => <rect key={`${c}${r}`} x={200 + c * 28} y={42 + r * 30 + (r > 1 ? 118 : 0)} width="24" height="26" rx="7" fill={c === 1 ? "#ffd27a" : "#f1ebdc"} />))}
      <path d="M240 160l-34-28h68z" fill="url(#p-mint)" /><path d="M240 160l34-28v56z" fill="url(#p-gold)" /><path d="M240 160l34 28h-68z" fill="url(#p-sky)" /><path d="M240 160l-34 28v-56z" fill="url(#p-coral)" />
      <Pawn x={112} y={74} paint="coral" s={0.8} cls="art-idle" />
      <Pawn x={112} y={216} paint="sky" s={0.8} />
      <Pawn x={366} y={214} paint="gold" s={0.8} />
      <Dice x={366} y={92} s={92} cls="art-bob" />
    </>
  );
}

function Flask({ x, tilt = 0, layers, cls }: { x: number; tilt?: number; layers: string[]; cls?: string }) {
  return (
    <g transform={`rotate(${tilt} ${x} 180)`}>
      <g className={cls}>
        <Floor cx={x} cy={292} rx={46} />
        <clipPath id={`f${x}`}><path d={`M${x - 38} 50v188a38 38 0 0 0 76 0V50z`} /></clipPath>
        <path d={`M${x - 38} 50v188a38 38 0 0 0 76 0V50z`} fill="#fff" opacity=".6" />
        <g clipPath={`url(#f${x})`}>
          {layers.map((paint, i) => <rect key={i} x={x - 40} y={226 - i * 54} width="80" height="58" fill={`url(#p-${paint})`} />)}
          <rect x={x - 28} y="56" width="12" height="200" rx="6" fill="#fff" opacity=".5" />
        </g>
        <rect x={x - 46} y="36" width="92" height="20" rx="10" fill="#fff" />
      </g>
    </g>
  );
}

function Sort() {
  return (
    <>
      <Backdrop from="#cdeeff" to="#a8e6e0" />
      <Flask x={106} tilt={-7} layers={["rose", "gold", "rose"]} />
      <Flask x={240} layers={["mint", "mint", "mint", "mint"]} cls="art-idle" />
      <Flask x={374} tilt={7} layers={["gold", "tang"]} />
      {[[176, 98, 9], [304, 76, 12], [48, 60, 7], [436, 104, 8], [306, 124, 6]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#fff" opacity=".85" className="art-bob" />)}
    </>
  );
}

function Arrow({ x, y, turn, paint, s = 74, cls }: { x: number; y: number; turn: number; paint: string; s?: number; cls?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={cls}>
        <Tile x={-s / 2} y={-s / 2} s={s} paint={paint} r={s * 0.27} />
        <path d="M0-23 21 2H9v21H-9V2h-12z" fill="#fff" stroke="#fff" strokeWidth="5" strokeLinejoin="round" transform={`rotate(${turn}) scale(${s / 74})`} />
      </g>
    </g>
  );
}

function Arrows() {
  return (
    <>
      <Backdrop from="#ffe3c7" to="#ffc28f" />
      <path d="M312 166h170" stroke="#fff" strokeWidth="9" strokeDasharray="1 22" strokeLinecap="round" opacity=".8" />
      <Arrow x={72} y={76} turn={180} paint="mint" /><Arrow x={156} y={76} turn={90} paint="gold" /><Arrow x={240} y={76} turn={0} paint="sky" />
      <Arrow x={72} y={162} turn={0} paint="coral" /><Arrow x={156} y={162} turn={270} paint="sky" /><Arrow x={240} y={162} turn={90} paint="rose" />
      <Arrow x={72} y={248} turn={90} paint="gold" /><Arrow x={156} y={248} turn={0} paint="mint" /><Arrow x={240} y={248} turn={270} paint="coral" />
      <Arrow x={352} y={162} turn={90} paint="sky" cls="art-idle" />
      <Arrow x={392} y={52} turn={42} paint="lime" s={62} cls="art-bob" />
    </>
  );
}

function Brain() {
  return (
    <>
      <Backdrop from="#ffe0ea" to="#ffc2d4" />
      <Floor cx={240} cy={292} rx={130} />
      <g className="art-idle">
        <path d="M150 100c-14-44 54-74 88-46 36-30 104-4 92 44 44 14 46 76 10 94 12 40-34 76-76 56-22 22-74 22-92-4-46 16-92-22-74-68-36-20-26-74 14-82z" fill="url(#p-rose)" />
        <ellipse cx="186" cy="76" rx="42" ry="18" fill="#fff" opacity=".4" transform="rotate(-18 186 76)" />
        <path d="M240 66v190M176 118c26 0 34 20 28 40M304 118c-26 0-34 20-28 40" fill="none" stroke="#e8648f" strokeWidth="7" strokeLinecap="round" opacity=".6" />
        <circle cx="198" cy="156" r="30" fill="#fff" /><circle cx="282" cy="156" r="30" fill="#fff" />
        <circle cx="203" cy="158" r="14" fill="#1f3d3a" /><circle cx="287" cy="158" r="14" fill="#1f3d3a" />
        <circle cx="208" cy="152" r="5" fill="#fff" /><circle cx="292" cy="152" r="5" fill="#fff" />
        <path d="M216 214q24 22 48 0" fill="none" stroke="#1f3d3a" strokeWidth="7" strokeLinecap="round" />
      </g>
      <Tile x={38} y={40} s={64} paint="gold" /><text x="70" y="86" textAnchor="middle" fontSize="38" fontWeight="700" fill="#fff" fontFamily="var(--font-display), sans-serif">?</text>
      <Tile x={384} y={216} s={60} paint="sky" /><text x="414" y="259" textAnchor="middle" fontSize="36" fontWeight="700" fill="#fff" fontFamily="var(--font-display), sans-serif">7</text>
      <circle cx="412" cy="70" r="16" fill="url(#p-mint)" className="art-bob" />
    </>
  );
}

function Reflex() {
  return (
    <>
      <Backdrop from="#ecfbc4" to="#c4ee7d" />
      <Floor cx={240} cy={300} rx={120} />
      {[132, 96, 60].map((r, i) => <circle key={r} cx="240" cy="160" r={r} fill={i % 2 ? "#fff" : "url(#p-coral)"} />)}
      <path d="M268 18 156 180h66l-30 122 124-172h-72z" fill="#7a5a00" opacity=".18" transform="translate(6 8)" />
      <path d="M268 18 156 180h66l-30 122 124-172h-72z" fill="url(#p-gold)" className="art-idle" />
      <g transform="translate(404 76)" className="art-bob">
        <circle r="46" fill="url(#p-snow)" /><rect x="-7" y="-62" width="14" height="16" rx="5" fill="url(#p-sky)" />
        <path d="M0 0V-28M0 0l20 12" fill="none" stroke="#1f3d3a" strokeWidth="6" strokeLinecap="round" />
      </g>
      {[[34, 92, 62], [18, 160, 40], [40, 228, 56]].map(([x, y, w]) => <path key={y} d={`M${x} ${y}h${w}`} stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity=".85" />)}
    </>
  );
}

/** A paper lantern: lit ones glow gold, unlit ones are dusky violet. */
function Lantern({ x, y, lit, s = 1, cls }: { x: number; y: number; lit: boolean; s?: number; cls?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={cls}>
        {lit && <circle cx="0" cy="4" r="46" fill="#ffd36b" opacity=".35" />}
        <rect x="-14" y="-40" width="28" height="9" rx="3" fill="#5a4a8a" />
        <path d="M-26-30h52c8 14 8 54 0 68h-52c-8-14-8-54 0-68z" fill={lit ? "url(#p-gold)" : "#8f7bf0"} />
        <path d="M-12-30c-5 18-5 50 0 68M12-30c5 18 5 50 0 68" fill="none" stroke={lit ? "#e59a00" : "#6a54d6"} strokeWidth="3" opacity=".7" />
        <rect x="-14" y="38" width="28" height="9" rx="3" fill="#5a4a8a" />
        <path d="M-18-26c6-3 12-3 14 0" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity=".55" />
      </g>
    </g>
  );
}

function LanternNight() {
  const grid: [number, number, boolean][] = [[150, 92, true], [240, 92, false], [330, 92, true], [150, 202, false], [240, 202, true], [330, 202, true]];
  return (
    <>
      <Backdrop from="#3b2f7a" to="#1d2a52" />
      {[[60, 50, 3], [420, 40, 4], [400, 260, 3], [80, 250, 2], [250, 30, 2]].map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="#fff" opacity=".8" className="art-bob" />)}
      <path d="M90 52h300M90 162h300" stroke="#c9b8ff" strokeWidth="3" opacity=".5" />
      {grid.map(([x, y, lit], i) => <Lantern key={i} x={x} y={y} lit={lit} s={0.95} cls={i === 4 ? "art-idle" : undefined} />)}
    </>
  );
}

const SCENES: Record<GameSlug, () => React.ReactElement> = { hoot: Hoot, sudoku: Sudoku, ludo: Ludo, sort: Sort, arrows: Arrows, brain: Brain, reflex: Reflex, lantern: LanternNight };

export function GameArt({ slug, className }: { slug: GameSlug; className?: string }) {
  const Scene = SCENES[slug];
  return (
    <svg viewBox="0 0 480 320" preserveAspectRatio="xMidYMid slice" aria-hidden className={className}>
      <Defs />
      <Scene />
    </svg>
  );
}
