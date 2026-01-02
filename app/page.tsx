'use client';

import Image from "next/image";
import { useSession } from "next-auth/react";
import { LoginSection } from "@/components/LoginSection";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  const { data: session } = useSession();

  const isAdmin = Boolean(
    session?.user && (session.user as { role?: string }).role === "admin",
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <Image
        src="https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2000&q=80"
        alt="Fútbol"
        fill
        priority
        className="object-cover object-center opacity-80"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/55 to-emerald-900/25" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-12 md:py-16">
        <header className="max-w-3xl space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Polla Partidos
          </p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">
            Queremos solo Verdes
          </h1>
        </header>

        <section className="flex flex-col gap-6 rounded-2xl bg-white/95 p-6 shadow-xl ring-1 ring-emerald-200/60 backdrop-blur">
          <LoginSection />
          {session?.user && (
            <Dashboard sessionUser={session.user} isAdmin={isAdmin} />
          )}
        </section>
      </div>
    </main>
  );
}
