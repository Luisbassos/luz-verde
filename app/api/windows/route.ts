import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserRole } from "@/lib/roles";

type WindowRow = {
  id: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  min_odds?: number | null;
  max_odds?: number | null;
  status: string;
  created_at: string;
};

function computeStatus(window: WindowRow | null) {
  if (!window) return "sin_fecha";
  if (window.status === "finished") return "finished";
  if (window.status === "aborted") return "aborted";
  if (!window.is_active) return "aborted";
  return "open";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { ok: false, error: "No autenticado" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const listAll = searchParams.get("all") === "1";
  const role = await getUserRole(session.user.email);

  if (listAll) {
    const query = supabaseAdmin
      .from("event_windows")
      .select("id,start_date,end_date,is_active,status,min_odds,max_odds,created_at")
      .order("created_at", { ascending: false });
    // Para no admins, solo mostrar abiertas o finalizadas
    const { data, error } =
      role === "admin"
        ? await query
        : await query.in("status", ["open", "finished"]);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "No se pudo obtener las fechas" },
        { status: 500 },
      );
    }
    const windows = (data || []).map((w) => ({
      ...w,
      status: computeStatus(w),
    }));
    return NextResponse.json({ ok: true, windows });
  }

  const { data, error } = await supabaseAdmin
    .from("event_windows")
    .select("id,start_date,end_date,is_active,status,min_odds,max_odds,created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .returns<WindowRow[]>();

  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudo obtener la fecha" },
      { status: 500 },
    );
  }

  const window = data?.[0] ?? null;
  return NextResponse.json({
    ok: true,
    window,
    status: computeStatus(window),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { ok: false, error: "No autenticado" },
      { status: 401 },
    );
  }

  const role = await getUserRole(session.user.email);
  if (role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "Solo admin" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const start = body?.start_date as string;
  const end = body?.end_date as string;
  const status = body?.status as string | undefined;
  const min_odds = body?.min_odds as number | undefined;
  const max_odds = body?.max_odds as number | undefined;

  if (!start || !end) {
    return NextResponse.json(
      { ok: false, error: "Faltan fechas" },
      { status: 400 },
    );
  }

  const normalizedMin = typeof min_odds === "number" && !Number.isNaN(min_odds) ? min_odds : null;
  const normalizedMax = typeof max_odds === "number" && !Number.isNaN(max_odds) ? max_odds : null;

  // desactivar ventanas anteriores
  await supabaseAdmin.from("event_windows").update({ is_active: false }).eq("is_active", true);

  const { error } = await supabaseAdmin.from("event_windows").insert({
    start_date: start,
    end_date: end,
    is_active: true,
    status: status || "open",
    min_odds: normalizedMin,
    max_odds: normalizedMax,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar la fecha" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { ok: false, error: "No autenticado" },
      { status: 401 },
    );
  }
  const role = await getUserRole(session.user.email);
  if (role !== "admin") {
    return NextResponse.json(
      { ok: false, error: "Solo admin" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "Falta id de fecha" },
      { status: 400 },
    );
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("event_windows")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (existingError) {
    return NextResponse.json(
      { ok: false, error: "No se pudo leer la fecha" },
      { status: 500 },
    );
  }
  if (existing?.status === "finished") {
    return NextResponse.json(
      { ok: false, error: "No se puede abortar una fecha finalizada" },
      { status: 400 },
    );
  }

  const { error } = await supabaseAdmin
    .from("event_windows")
    .update({ is_active: false, status: "aborted" })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudo abortar la fecha" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
