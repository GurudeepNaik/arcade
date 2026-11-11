import { weeklyChampion } from "@/lib/games/champion";

export const runtime = "nodejs";
export const revalidate = 300; // a champion changes slowly; five minutes of caching keeps the home page cheap

export async function GET(): Promise<Response> {
  try {
    return Response.json({ champion: await weeklyChampion() });
  } catch (err) {
    console.error("champion not loaded", err);
    return Response.json({ champion: null });
  }
}
