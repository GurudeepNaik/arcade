import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-32 text-center sm:px-6">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">This page doesn&apos;t exist.</h1>
      <p className="mt-4 text-muted">Every record should land somewhere. This one didn&apos;t.</p>
      <Link href="/" className="mt-8 inline-block rounded-md bg-accent px-4 py-2.5 font-medium text-accent-fg">Back to the homepage</Link>
    </div>
  );
}
