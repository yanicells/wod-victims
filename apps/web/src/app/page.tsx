import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WOD Victims",
  description:
    "A names-first memorial map and timeline of documented victims of the Philippine drug war."
};

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">WOD Victims</p>
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-950">
        Named victims of the Philippine drug war
      </h1>
      <p className="text-lg leading-8 text-zinc-600">
        Web app scaffold. The map and timeline will read public-safe records from the
        Paalam parser-first pipeline once the first export exists.
      </p>
      <p className="text-sm text-zinc-500">
        Data lives in <code className="rounded bg-zinc-100 px-1.5 py-0.5">data/paalam/</code>.
        Pipeline commands run from the repo root.
      </p>
    </main>
  );
}
