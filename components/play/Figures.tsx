import type { Block, Cell, Shape } from "@/lib/games/brain";

const SLOTS: Record<number, [number, number][]> = {
  1: [[30, 30]],
  2: [[18, 30], [42, 30]],
  3: [[30, 17], [17, 42], [43, 42]],
};

function Mark({ shape, x, y, r }: { shape: Shape; x: number; y: number; r: number }) {
  if (shape === "circle") return <circle cx={x} cy={y} r={r} />;
  if (shape === "square") return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={1.5} />;
  return <path d={`M${x} ${y - r}L${x + r} ${y + r}L${x - r} ${y + r}Z`} strokeLinejoin="round" />;
}

const fillWords = { solid: "solid", soft: "pale", outline: "outlined" };

export function cellLabel(cell: Cell): string {
  return `${cell.count} ${fillWords[cell.fill]} ${cell.shape}${cell.count > 1 ? "s" : ""}`;
}

export function CellFigure({ cell }: { cell: Cell }) {
  const r = cell.count === 1 ? 16 : 10;
  return (
    <svg viewBox="0 0 60 60" role="img" aria-label={cellLabel(cell)} className="block size-full">
      <g fill={cell.fill === "outline" ? "none" : "currentColor"} fillOpacity={cell.fill === "soft" ? 0.32 : 1} stroke="currentColor" strokeWidth={3} strokeLinejoin="round">
        {SLOTS[cell.count]!.map(([x, y]) => <Mark key={`${x}-${y}`} shape={cell.shape} x={x} y={y} r={r} />)}
      </g>
    </svg>
  );
}

export function BlockFigure({ blocks, label }: { blocks: Block[]; label: string }) {
  const width = Math.max(...blocks.map(b => b[0])) + 1;
  const height = Math.max(...blocks.map(b => b[1])) + 1;
  const size = Math.max(width, height);
  const offsetX = (size - width) / 2, offsetY = (size - height) / 2;
  return (
    <svg viewBox={`-0.15 -0.15 ${size + 0.3} ${size + 0.3}`} role="img" aria-label={label} className="block size-full">
      {blocks.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + offsetX + 0.04} y={y + offsetY + 0.04} width={0.92} height={0.92} rx={0.14} className="g-fill" />
      ))}
    </svg>
  );
}
