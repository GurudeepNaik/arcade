import type { Metadata } from "next";
import { Hub } from "@/components/play/Hub";

const title = "The Arcade";
const description = "8 puzzle and party games with 100 levels each: Hoot & Seek, Sudoku, Lantern Night, Colour Sort, live Ludo with friends and more, with daily leaderboards.";

export const metadata: Metadata = { title, description, alternates: { canonical: "/play" }, openGraph: { title, description, url: "/play" } };

export default function PlayPage() {
  return <Hub />;
}
