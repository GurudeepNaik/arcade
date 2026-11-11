const COLOURS = ["#27b98f", "#ffb82e", "#ff7aa2", "#3fb8f0", "#ff6b63", "#a4dd3a"];
const COUNT = 44;

/** One shower of paper. Positions come from the index, so server and browser render the same thing. */
export function Confetti() {
  return (
    <div aria-hidden className="confetti">
      {Array.from({ length: COUNT }, (_, i) => (
        <i
          key={i}
          style={{
            "--x": `${(i * 37) % 100}%`,
            "--w": `${7 + (i % 4) * 2}px`,
            "--c": COLOURS[i % COLOURS.length],
            "--t": `${1700 + (i % 7) * 180}ms`,
            "--d": `${(i % 9) * 70}ms`,
            "--drift": `${((i % 5) - 2) * 34}px`,
            "--spin": `${(i % 2 ? 1 : -1) * (360 + (i % 6) * 120)}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
