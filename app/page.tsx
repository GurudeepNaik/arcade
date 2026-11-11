import { redirect } from "next/navigation";

// The Arcade lives under /play, so its links, share cards and installed app keep the same paths as before the split.
export default function Home() {
  redirect("/play");
}
