export type PipMood = "idle" | "cheer" | "think" | "oops";

/** Pip, the Arcade's owl. Soft shading only, and every mood has its own eyes and body motion. */
export function Pip({ mood = "idle", className }: { mood?: PipMood; className?: string }) {
  const body = mood === "cheer" ? "pip-cheer pip-flap" : mood === "oops" ? "pip-shake" : "pip-sway";
  return (
    <svg viewBox="0 0 120 132" aria-hidden className={className}>
      <defs>
        <radialGradient id="pip-body" cx=".38" cy=".28" r=".85"><stop offset="0" stopColor="#6fe0bd" /><stop offset=".6" stopColor="#2fbf95" /><stop offset="1" stopColor="#14866a" /></radialGradient>
        <radialGradient id="pip-belly" cx=".5" cy=".3" r=".8"><stop offset="0" stopColor="#fffdf6" /><stop offset="1" stopColor="#ffe6b8" /></radialGradient>
        <radialGradient id="pip-eye" cx=".4" cy=".35" r=".75"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e4efe9" /></radialGradient>
        <linearGradient id="pip-beak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffcb52" /><stop offset="1" stopColor="#f08a12" /></linearGradient>
        <radialGradient id="pip-floor" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#1f3d3a" stopOpacity=".28" /><stop offset="1" stopColor="#1f3d3a" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="60" cy="124" rx="40" ry="7" fill="url(#pip-floor)" />
      <g className={body}>
        <path className="pip-wing-l" d="M21 62c-13 8-16 30-6 42 8-2 16-14 17-26z" fill="#14866a" />
        <path className="pip-wing-r" d="M99 62c13 8 16 30 6 42-8-2-16-14-17-26z" fill="#14866a" />
        <path d="M34 22 24 4c10 2 22 6 27 12zM86 22 96 4c-10 2-22 6-27 12z" fill="#14866a" />
        <path d="M60 10c28 0 46 20 46 50 0 34-20 58-46 58s-46-24-46-58c0-30 18-50 46-50z" fill="url(#pip-body)" />
        <path d="M60 58c20 0 32 14 32 30 0 20-14 32-32 32S28 108 28 88c0-16 12-30 32-30z" fill="url(#pip-belly)" />
        {[[46, 82], [60, 86], [74, 82], [53, 98], [67, 98]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x! - 6} ${y}q6 7 12 0`} fill="none" stroke="#f2bd70" strokeWidth="2.6" strokeLinecap="round" />)}
        <circle cx="41" cy="50" r="20" fill="url(#pip-eye)" />
        <circle cx="79" cy="50" r="20" fill="url(#pip-eye)" />
        {mood === "cheer" ? (
          <g fill="none" stroke="#1f3d3a" strokeWidth="5" strokeLinecap="round"><path d="M30 54q11-13 22 0" /><path d="M68 54q11-13 22 0" /></g>
        ) : (
          <g className="pip-blink">
            <circle cx={mood === "think" ? 45 : 43} cy={mood === "think" ? 45 : 51} r="10.5" fill="#1f3d3a" />
            <circle cx={mood === "think" ? 83 : 77} cy={mood === "think" ? 45 : 51} r="10.5" fill="#1f3d3a" />
            <circle cx={mood === "think" ? 48 : 46} cy={mood === "think" ? 41 : 47} r="3.6" fill="#fff" />
            <circle cx={mood === "think" ? 86 : 80} cy={mood === "think" ? 41 : 47} r="3.6" fill="#fff" />
          </g>
        )}
        {mood === "oops" && <g fill="none" stroke="#14866a" strokeWidth="4" strokeLinecap="round"><path d="M26 28l20 7" /><path d="M94 28l-20 7" /></g>}
        <path d="M60 58l-8 2c2 8 6 12 8 13 2-1 6-5 8-13z" fill="url(#pip-beak)" />
        <path d="M46 118c-2 4-8 4-10 2M74 118c2 4 8 4 10 2" fill="none" stroke="#f08a12" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
