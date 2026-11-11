import type { GameSlug } from "@/lib/games/registry";

// Short walkthroughs, one per game. Each step is a picture of a tiny board, a caption, and where the finger taps.
// Pictures are plain markup (no game logic), drawn to match the real game's look.

export interface DemoStep { caption: string; view: React.ReactNode; tap?: { x: number; y: number; kind?: "tap" | "double" } }

const PAD = 6; // % of the stage around a board

/** Centre of a cell in an n×n board, as % of the stage. */
const at = (n: number, row: number, col: number, top = PAD, height = 100 - 2 * PAD) => ({
  x: PAD + ((col + 0.5) * (100 - 2 * PAD)) / n,
  y: top + ((row + 0.5) * height) / n,
});

function Board({ n, children, className = "", top = PAD }: { n: number; children: React.ReactNode; className?: string; top?: number }) {
  return (
    <div className={`demo-board absolute grid ${className}`} style={{ inset: `${top}% ${PAD}% ${PAD}%`, gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}

// ---------- Hoot & Seek ----------
const HOOT_REGIONS = [0, 0, 1, 1, 0, 0, 1, 1, 2, 2, 3, 1, 2, 3, 3, 3];
const HOOT_PAINT = ["#7ee8c6", "#ffdc7a", "#9fe0ff", "#ffb3c8"];
const HOOT_SOLUTION = [1, 7, 8, 14]; // one owl per row, column and colour, none touching
const HOOT_TOP = 13; // room above the board for the lives
const hootAt = (r: number, c: number) => at(4, r, c, HOOT_TOP, 100 - HOOT_TOP - PAD);

function HootScene({ owls = [], crosses = [], dim = [], wrong, lives = 3 }: { owls?: number[]; crosses?: number[]; dim?: number[]; wrong?: number; lives?: number }) {
  return (
    <>
      <Board n={4} className="gap-1" top={HOOT_TOP}>
        {HOOT_REGIONS.map((region, i) => (
          <span key={i} className={`demo-cell grid place-items-center text-3xl font-black ${wrong === i ? "demo-shake" : ""}`} style={{ background: HOOT_PAINT[region], opacity: dim.includes(i) ? 0.45 : 1 }}>
            {owls.includes(i) ? <span className="demo-pop">🦉</span> : crosses.includes(i) ? <span className="text-black/45">✕</span> : wrong === i ? <span className="demo-pop">🦉</span> : null}
          </span>
        ))}
      </Board>
      <span className="absolute right-[6%] top-[2.5%] text-sm leading-none" aria-hidden>{"❤️".repeat(lives)}{"🤍".repeat(3 - lives)}</span>
    </>
  );
}

const hoot: DemoStep[] = [
  { caption: "Find one owl in every row, every column and every colour.", view: <HootScene /> },
  { caption: "Tap once to cross out a square that can't hold an owl.", view: <HootScene crosses={[0]} />, tap: hootAt(0, 0) },
  { caption: "Double-tap to place an owl.", view: <HootScene owls={[1]} crosses={[0]} />, tap: { ...hootAt(0, 1), kind: "double" } },
  { caption: "Owls can't touch, not even at the corners, so the squares around it are out.", view: <HootScene owls={[1]} crosses={[0]} dim={[0, 2, 3, 4, 5, 6, 9, 13]} /> },
  { caption: "A wrong owl costs one of your 3 lives. Use logic, never guess.", view: <HootScene owls={[1]} crosses={[0]} wrong={9} lives={2} />, tap: { ...hootAt(2, 1), kind: "double" } },
  { caption: "Fill every row, column and colour to clear the board.", view: <HootScene owls={HOOT_SOLUTION} lives={2} /> },
];

// ---------- Sudoku (a 4×4 picture of the 9×9 rules) ----------
const SUDOKU_GIVEN = [1, 0, 0, 4, 0, 4, 1, 0, 0, 1, 0, 3, 4, 0, 0, 1];
function SudokuScene({ selected, place, wrong, notes }: { selected?: number; place?: [number, number]; wrong?: [number, number]; notes?: number }) {
  const peers = (i: number) => selected !== undefined && (Math.floor(i / 4) === Math.floor(selected / 4) || i % 4 === selected % 4 || (Math.floor(i / 8) === Math.floor(selected / 8) && Math.floor((i % 4) / 2) === Math.floor((selected % 4) / 2)));
  return (
    <>
      <div className="demo-board absolute grid gap-1" style={{ left: `${PAD}%`, right: `${PAD}%`, top: `${PAD}%`, height: "66%", gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        {SUDOKU_GIVEN.map((v, i) => {
          const value = place?.[0] === i ? place[1] : wrong?.[0] === i ? wrong[1] : v;
          return (
            <span key={i} className={`demo-cell grid place-items-center text-xl font-black ${i === selected ? "ring-4 ring-[var(--g)]" : ""} ${wrong?.[0] === i ? "text-[var(--bad)] demo-shake" : v ? "" : "text-[var(--g-deep,var(--g))]"}`}
              style={{ background: i === selected ? "color-mix(in srgb, var(--g) 30%, var(--tile))" : peers(i) ? "color-mix(in srgb, var(--g) 18%, var(--tile))" : "var(--tile)", borderRight: i % 4 === 1 ? "3px solid var(--well-2)" : undefined, borderBottom: Math.floor(i / 4) === 1 ? "3px solid var(--well-2)" : undefined }}>
              {notes === i ? <span className="grid grid-cols-2 text-[10px] font-semibold leading-tight text-[var(--ink-soft)]"><span>2</span><span>3</span></span> : value || ""}
            </span>
          );
        })}
      </div>
      <div className="absolute grid grid-cols-4 gap-1.5" style={{ left: `${PAD}%`, right: `${PAD}%`, top: "77%", height: "17%" }}>
        {[1, 2, 3, 4].map(d => <span key={d} className="demo-key grid place-items-center text-lg font-black">{d}</span>)}
      </div>
    </>
  );
}
const keyAt = (d: number) => ({ x: PAD + ((d - 0.5) * (100 - 2 * PAD)) / 4, y: 85.5 });
const sudokuCell = (r: number, c: number) => at(4, r, c, PAD, 66);
const sudoku: DemoStep[] = [
  { caption: "Every row, column and box holds each number once. The real board is 9 by 9.", view: <SudokuScene /> },
  { caption: "Tap an empty square. Its row, column and box light up.", view: <SudokuScene selected={1} />, tap: sudokuCell(0, 1) },
  { caption: "Then tap a number to place it.", view: <SudokuScene selected={1} place={[1, 2]} />, tap: keyAt(2) },
  { caption: "A number that clashes turns red, so you can fix it.", view: <SudokuScene selected={2} place={[1, 2]} wrong={[2, 4]} />, tap: keyAt(4) },
  { caption: "Turn on Notes to pencil in the numbers a square could be.", view: <SudokuScene selected={2} notes={2} /> },
];

// ---------- Ludo ----------
function LudoScene({ dice, red, blue, home = 0 }: { dice?: number; red?: number | "base"; blue?: number | "home"; home?: number }) {
  const squares = 6;
  const sq = (i: number) => ({ left: `${8 + i * 13}%`, top: "44%" });
  return (
    <>
      <span className="absolute grid place-items-center rounded-2xl text-xs font-bold text-white" style={{ left: "6%", top: "10%", width: "26%", height: "26%", background: "#ff6b63" }}>
        {red === "base" && <span className="demo-token" style={{ background: "#d43f3a", width: "34%" }} />}
        <span className="absolute bottom-1">base</span>
      </span>
      {Array.from({ length: squares }, (_, i) => <span key={i} className="demo-cell absolute" style={{ ...sq(i), width: "11%", height: "12%", background: i === 0 ? "#ffb3ae" : "var(--tile)" }} />)}
      <span className="absolute grid place-items-center text-xs font-bold" style={{ left: "84%", top: "38%", width: "12%", height: "24%", background: "conic-gradient(#ff6b63 0 25%, #4aa8f2 0 50%, #ffc23d 0 75%, #2fcbb0 0)", clipPath: "polygon(0 0, 100% 50%, 0 100%)" }} />
      <span className="absolute text-center text-[11px] font-semibold text-[var(--ink-soft)]" style={{ left: "78%", top: "64%", width: "22%" }}>centre {home > 0 ? `(${home}/4)` : ""}</span>
      {typeof red === "number" && <span className="demo-token absolute transition-all duration-500" style={{ ...sq(red), marginLeft: "2%", marginTop: "1%", background: "#d43f3a" }} />}
      {typeof blue === "number" && <span className={`demo-token absolute ${blue === red ? "demo-shake" : ""}`} style={{ ...sq(blue), marginLeft: "4%", marginTop: "3%", background: "#1b86c4" }} />}
      {blue === "home" && <span className="absolute text-xs font-bold text-[#1b86c4]" style={{ left: "40%", top: "14%" }}>Blue sent home!</span>}
      {dice !== undefined && <span className="demo-dice absolute grid place-items-center text-2xl font-black" style={{ left: "40%", top: "68%", width: "20%", height: "20%" }}>{dice}</span>}
    </>
  );
}
const ludo: DemoStep[] = [
  { caption: "Race your four tokens from your base to the centre.", view: <LudoScene red="base" blue={4} /> },
  { caption: "Roll a 6 to bring a token out of your base.", view: <LudoScene dice={6} red={0} blue={4} />, tap: { x: 50, y: 78 } },
  { caption: "Roll again, then tap a token to move it that many squares.", view: <LudoScene dice={4} red={4} blue={4} />, tap: { x: 14, y: 50 } },
  { caption: "Land on a rival to send it back to its base.", view: <LudoScene dice={4} red={4} blue="home" /> },
  { caption: "Get all four tokens to the centre first to win. Invite friends for a live table.", view: <LudoScene red={5} home={1} /> },
];

// ---------- Colour Sort ----------
const LIQ = { r: "#ff6b63", b: "#4aa8f2" } as const;
function SortScene({ flasks, lifted, sealed = [] }: { flasks: ("r" | "b")[][]; lifted?: number; sealed?: number[] }) {
  return (
    <div className="absolute inset-x-[8%] bottom-[10%] top-[14%] grid grid-cols-3 items-end gap-[8%]">
      {flasks.map((layers, i) => (
        <span key={i} className="relative mx-auto h-full w-[70%] transition-transform duration-300" style={{ transform: lifted === i ? "translateY(-12%)" : undefined }}>
          {sealed.includes(i) && <span className="absolute inset-x-[15%] -top-[5%] h-[7%] rounded-md bg-[var(--gold)]" />}
          <span className="demo-flask absolute inset-0 flex flex-col-reverse overflow-hidden p-[6%]">
            {layers.map((c, j) => <span key={j} className="demo-liquid" style={{ height: "31%", background: LIQ[c], borderRadius: j === 0 ? "0 0 999px 999px" : undefined }} />)}
          </span>
        </span>
      ))}
    </div>
  );
}
const flaskAt = (i: number) => ({ x: 8 + (i + 0.5) * (84 / 3), y: 55 });
const sort: DemoStep[] = [
  { caption: "Pour until every flask holds a single colour.", view: <SortScene flasks={[["r", "r", "b"], ["b", "b", "r"], []]} /> },
  { caption: "Tap a flask to pick it up.", view: <SortScene flasks={[["r", "r", "b"], ["b", "b", "r"], []]} lifted={0} />, tap: flaskAt(0) },
  { caption: "Tap another flask to pour the top colour into it.", view: <SortScene flasks={[["r", "r"], ["b", "b", "r"], ["b"]]} />, tap: flaskAt(2) },
  { caption: "You can pour only onto the same colour, or into an empty flask.", view: <SortScene flasks={[["r", "r", "r"], ["b", "b"], ["b"]]} sealed={[0]} />, tap: flaskAt(0) },
  { caption: "One colour per flask and you're done. Fewer pours, more stars.", view: <SortScene flasks={[["r", "r", "r"], [], ["b", "b", "b"]]} sealed={[0, 2]} />, tap: flaskAt(2) },
];

// ---------- Arrow Escape ----------
type Dir = "up" | "down" | "left" | "right";
const TURN: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };
function ArrowScene({ arrows, crash, flying }: { arrows: (Dir | null)[]; crash?: number; flying?: number }) {
  return (
    <Board n={3} className="gap-1.5">
      {arrows.map((d, i) => (
        <span key={i} className="demo-cell grid place-items-center" style={{ background: "var(--tile)" }}>
          {d && (
            <span className={`demo-arrow grid size-[80%] place-items-center ${crash === i ? "demo-shake" : ""} ${flying === i ? "demo-fly" : ""}`} style={{ "--turn": `${TURN[d]}deg` } as React.CSSProperties}>
              <svg viewBox="0 0 24 24" className="size-[60%]" style={{ transform: `rotate(${TURN[d]}deg)` }}><path d="M12 3l8 9h-5v9H9v-9H4z" fill="#fff" /></svg>
            </span>
          )}
        </span>
      ))}
    </Board>
  );
}
const ARROWS: (Dir | null)[] = ["right", "down", null, "up", "left", "right", null, "up", "left"];
const arrows: DemoStep[] = [
  { caption: "Each arrow flies off the board the way it points.", view: <ArrowScene arrows={ARROWS} /> },
  { caption: "Tap an arrow whose path is clear.", view: <ArrowScene arrows={ARROWS} flying={5} />, tap: at(3, 1, 2) },
  { caption: "If something is in the way, it crashes: 5 extra seconds.", view: <ArrowScene arrows={ARROWS.map((d, i) => (i === 5 ? null : d))} crash={4} />, tap: at(3, 1, 1) },
  { caption: "Find the right order and clear every board as fast as you can.", view: <div className="demo-cell absolute inset-[6%] grid place-items-center text-center text-2xl font-black" style={{ background: "var(--tile)" }}><span className="demo-pop">Board clear!<span className="mt-1 block text-base font-semibold text-[var(--ink-soft)]">0:42 · no crashes</span></span></div> },
];

// ---------- Brain Score ----------
function BrainScene({ picked, timer = 100 }: { picked?: number; timer?: number }) {
  const options = [10, 12, 16, 14];
  return (
    <div className="absolute inset-[6%] flex flex-col gap-3">
      <span className="h-2 overflow-hidden rounded-full bg-[var(--well)]"><span className="block h-full rounded-full bg-[var(--g)] transition-all duration-700" style={{ width: `${timer}%` }} /></span>
      <span className="demo-cell grid flex-1 place-items-center text-3xl font-black" style={{ background: "var(--tile)" }}>2, 4, 8, ?</span>
      <span className="grid grid-cols-2 gap-2">
        {options.map(o => <span key={o} className="demo-key grid h-14 place-items-center text-xl font-black" style={picked === o ? { background: o === 16 ? "var(--good)" : "var(--bad)", color: "#fff" } : undefined}>{o}</span>)}
      </span>
    </div>
  );
}
const brain: DemoStep[] = [
  { caption: "12 puzzles: number patterns, shape grids, rotations and logic.", view: <BrainScene /> },
  { caption: "Spot the rule (each number doubles) and tap the answer.", view: <BrainScene picked={16} timer={70} />, tap: { x: 28, y: 92 } },
  { caption: "Right and quick scores the most. The bar shows your time.", view: <BrainScene picked={16} timer={45} /> },
  { caption: "Puzzles get harder as you go. It's a fun score, not a real IQ test.", view: <BrainScene timer={100} /> },
];

// ---------- Reflex Test ----------
function ReflexScene({ state, text }: { state: "wait" | "go" | "early" | "result"; text: string }) {
  const bg = state === "wait" ? "#ff6b63" : state === "go" ? "#2fcbb0" : state === "early" ? "#ffb82e" : "var(--well)";
  return <div className="demo-cell absolute inset-[6%] grid place-items-center text-center text-2xl font-black" style={{ background: bg, color: state === "result" ? "var(--ink)" : "#fff" }}>{text}</div>;
}
const reflex: DemoStep[] = [
  { caption: "Wait while the panel is red.", view: <ReflexScene state="wait" text="Wait…" /> },
  { caption: "Tap the moment it turns green.", view: <ReflexScene state="go" text="Tap!" />, tap: { x: 50, y: 74 } },
  { caption: "Your reaction time shows in milliseconds.", view: <ReflexScene state="result" text="243 ms" /> },
  { caption: "Tapping too early doesn't count.", view: <ReflexScene state="early" text="Too soon!" />, tap: { x: 50, y: 74 } },
  { caption: "Five rounds. Your average is your score.", view: <ReflexScene state="result" text="Average 251 ms" /> },
];

// ---------- Lantern Night ----------
function LanternScene({ lit, hint }: { lit: boolean[]; hint?: number }) {
  return (
    <Board n={3} className="gap-2">
      {lit.map((on, i) => (
        <span key={i} className={`lantern grid place-items-center rounded-[22%] ${on ? "lantern-on" : ""} ${hint === i ? "lantern-hint" : ""}`}>
          <svg viewBox="0 0 40 48" aria-hidden className="h-[70%]">
            <rect x="13" y="2" width="14" height="5" rx="2" className="lantern-cap" />
            <path d="M8 8h24c4 7 4 26 0 33H8c-4-7-4-26 0-33z" className="lantern-body" />
            <rect x="13" y="41" width="14" height="5" rx="2" className="lantern-cap" />
          </svg>
        </span>
      ))}
    </Board>
  );
}
const L = (s: string) => [...s].map(ch => ch === "1");
const lantern: DemoStep[] = [
  { caption: "Light every lantern on the board.", view: <LanternScene lit={L("101000101")} /> },
  { caption: "A tap flips that lantern and the ones above, below and beside it.", view: <LanternScene lit={L("111111111")} />, tap: at(3, 1, 1) },
  { caption: "Every lantern lit: level cleared.", view: <LanternScene lit={L("111111111")} /> },
  { caption: "Stuck? A hint lights up the next lantern to tap. Each hint costs a star.", view: <LanternScene lit={L("010111010")} hint={0} /> },
  { caption: "Par is the fewest taps possible. Match it for three stars.", view: <LanternScene lit={L("111111111")} /> },
];

export const DEMOS: Record<GameSlug, DemoStep[]> = { hoot, sudoku, ludo, sort, arrows, brain, reflex, lantern };
