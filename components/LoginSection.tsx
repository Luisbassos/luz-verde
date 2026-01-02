"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function LoginSection() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p className="text-slate-600">Cargando sesión...</p>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="text-sm text-slate-800">
          Sesión iniciada: <span className="font-semibold">{session.user.email}</span>
        </div>
        <button
          onClick={() => signOut()}
          className="rounded-md border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn("google")}
      className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
    >
      Entrar con Google
    </button>
  );
}
