import type { Metadata } from "next";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What this site records about visits and games, and how to have it removed.",
  alternates: { canonical: "/privacy" },
};

const SECTIONS: [string, string[]][] = [
  ["Games", [
    "Scores, levels played, finishes and shares are recorded so the games and leaderboards work.",
    "Putting a name on a leaderboard needs Google sign-in. A name you type for a leaderboard, a race or a Ludo table is shown publicly in that game.",
    "Without sign-in, your progress, stars and badges last only until you close the tab. Signed in, they are kept in your browser and your account.",
    "Live tables and races are deleted after one day.",
  ]],
  ["Signing in with Google", [
    "Signing in is optional. It saves your progress so it follows you to other devices.",
    ]],
  ["Services this site uses", [
    "Vercel hosts the site and provides Vercel Web Analytics. Neon stores the data above. ip-api.com looks up networks.",
  ]],
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-4 text-lg text-muted">What this site records, and how to have it removed.</p>
      {SECTIONS.map(([title, points]) => (
        <section key={title} className="mt-10">
          <h2 className="text-xl font-semibold">{title}</h2>
          <ul className="mt-3 space-y-2 text-muted">
            {points.map(p => <li key={p} className="flex gap-3"><span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" /><span>{p}</span></li>)}
          </ul>
        </section>
      ))}
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Removing your data</h2>
        <p className="mt-3 text-muted">
          Email <a className="text-accent hover:underline" href={`mailto:${site.email}`}>{site.email}</a> and your scores, names, account and progress will be deleted.
        </p>
      </section>
    </div>
  );
}
