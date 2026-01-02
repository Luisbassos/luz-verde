import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserRole } from "@/lib/roles";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }
  const role = await getUserRole(session.user.email);
  if (role !== "admin") {
    return NextResponse.json({ ok: false, error: "Solo admin" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const name = (body?.name as string | undefined)?.trim();
  if (!email || !name) {
    return NextResponse.json(
      { ok: false, error: "Faltan nombre y correo" },
      { status: 400 },
    );
  }

  const { error: pError } = await supabaseAdmin.from("participants").upsert(
    { email, name },
    { onConflict: "email" },
  );
  if (pError) {
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar participante" },
      { status: 500 },
    );
  }

  const { data: existingRole } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  // No pisar admin si ya existe
  const roleToSet = existingRole?.role === "admin" ? "admin" : "participant";

  await supabaseAdmin
    .from("user_roles")
    .upsert({ email, role: roleToSet }, { onConflict: "email" });

  return NextResponse.json({ ok: true });
}
