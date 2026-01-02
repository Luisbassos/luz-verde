"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export function LoginSection() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const deniedEmail = searchParams.get("denied");

  if (status === "loading") {
    return <p className="text-slate-600">Cargando sesión...</p>;
  }

  const deniedBox =
    !session?.user && deniedEmail ? (
      <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        El correo <span className="font-semibold">{deniedEmail}</span> no tiene permiso para ingresar. Contacta al admin.
      </div>
    ) : null;

  if (session?.user) {
    return (
      <>
        {deniedBox}
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
      </>
    );
  }

  return (
    <>
      {deniedBox}
      <button
        onClick={() => signIn("google")}
        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
      >
        Entrar con Google
      </button>
    </>
  );
}
