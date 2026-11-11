const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const FACES: [number, string][] = [[1, "translateZ(var(--half))"], [6, "rotateY(180deg) translateZ(var(--half))"], [2, "rotateY(90deg) translateZ(var(--half))"], [5, "rotateY(-90deg) translateZ(var(--half))"], [3, "rotateX(90deg) translateZ(var(--half))"], [4, "rotateX(-90deg) translateZ(var(--half))"]];
const SHOW: Record<number, [number, number]> = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };

/** A real cube: `spins` adds full turns, so each roll tumbles before settling on `value`. */
export function Dice({ value, spins }: { value: number; spins: number }) {
  const [x, y] = SHOW[value]!;
  return (
    <span className="block size-16 [--half:2rem] [perspective:420px]">
      <span className="dice relative block size-full" style={{ transform: `rotateX(${x + spins * 720}deg) rotateY(${y + spins * 360}deg)` }}>
        {FACES.map(([face, transform]) => (
          <span key={face} className="dice-face" style={{ transform }}>
            {Array.from({ length: 9 }, (_, i) => <span key={i} className={PIPS[face]!.includes(i) ? "dice-pip" : undefined} />)}
          </span>
        ))}
      </span>
    </span>
  );
}
