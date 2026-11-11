"use client";

import { useEffect, useState } from "react";
import { installWay, onInstallChange, promptInstall, registerArcadeWorker, startInstallWatch, type InstallWay } from "@/lib/games/install";

let started = false;

/** Mounted once in the Arcade layout: registers the service worker and keeps the install prompt for later. */
export function ArcadeAppSetup() {
  useEffect(() => {
    if (started) return;
    started = true;
    startInstallWatch();
    registerArcadeWorker();
  }, []);
  return null;
}

/** "Install app" where the browser supports it, "Add to Home Screen" steps on iPhone, nothing once installed. */
export function InstallApp({ className = "" }: { className?: string }) {
  return <InstallButton className={className} />;
}

/** The same, inside a "Get the app" card: placed below the games, so it never pushes content down as it appears. */
export function InstallCard({ className = "" }: { className?: string }) {
  const [way, setWay] = useState<InstallWay>("none");
  useEffect(() => {
    setWay(installWay());
    return onInstallChange(() => setWay(installWay()));
  }, []);
  if (way === "none" || way === "installed") return null;
  return (
    <section aria-labelledby="get-app-title" className={`play-rise arcade-panel p-4 sm:p-5 ${className}`}>
      <h2 id="get-app-title" className="arcade-title text-xl">Get the app</h2>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Open The Arcade from your home screen, full screen and even offline.</p>
      <InstallButton className="mt-3" />
    </section>
  );
}

function InstallButton({ className = "" }: { className?: string }) {
  const [way, setWay] = useState<InstallWay>("none");
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    setWay(installWay());
    return onInstallChange(() => setWay(installWay()));
  }, []);

  if (way === "none" || way === "installed") return null;

  if (way === "ios") {
    return (
      <div className={className}>
        <button type="button" aria-expanded={steps} aria-controls="ios-install-steps" onClick={() => setSteps(s => !s)} className="install-btn">
          <DownloadIcon /> Add to Home Screen
        </button>
        {steps && (
          <ol id="ios-install-steps" className="play-rise mt-2 list-decimal space-y-1 rounded-2xl bg-[var(--well)] py-2.5 pe-3 ps-8 text-sm">
            <li>Tap the Share button <ShareGlyph /> in Safari&apos;s toolbar.</li>
            <li>Choose <strong>Add to Home Screen</strong>.</li>
            <li>Tap <strong>Add</strong>. The Arcade opens full screen, like an app.</li>
          </ol>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <button type="button" onClick={() => void promptInstall()} className="install-btn">
        <DownloadIcon /> Install app
      </button>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14" />
    </svg>
  );
}

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Share" className="inline size-4 align-[-2px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5v11M8 7.5l4-4 4 4M6.5 11H5.5v9h13v-9h-1" />
    </svg>
  );
}
