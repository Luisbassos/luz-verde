import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { randomUUID } from "node:crypto";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserRole } from "@/lib/roles";

type WindowRow = {
  id: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

async function getOpenWindow(windowId?: string): Promise<WindowRow | null> {
  const query = supabaseAdmin
    .from("event_windows")
    .select("id,start_date,end_date,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  const { data, error } = windowId
    ? await query.eq("id", windowId).maybeSingle()
    : await query.maybeSingle();

  if (error || !data) return null;
  return data as WindowRow;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) return null;
  const [, mime, base64] = match;
  return { mime, buffer: Buffer.from(base64, "base64") };
}

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
  const imageData = body?.image_data as string | null; // data URL base64
  const windowId = body?.window_id as string | null;
  if (!imageData) {
    return NextResponse.json({ ok: false, error: "Falta imagen de cartilla" }, { status: 400 });
  }

  const window = await getOpenWindow(windowId || undefined);
  if (!window) {
    return NextResponse.json({ ok: false, error: "No hay ventana abierta" }, { status: 400 });
  }

  const parsed = parseDataUrl(imageData);
  if (!parsed) {
    return NextResponse.json({ ok: false, error: "Imagen inválida" }, { status: 400 });
  }

  const filePath = `admin_tickets/${window.id}/${randomUUID()}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("bets")
    .upload(filePath, parsed.buffer, { contentType: parsed.mime, upsert: true });
  if (uploadError) {
    return NextResponse.json(
      { ok: false, error: "No se pudo subir la imagen" },
      { status: 500 },
    );
  }

  const { error: ticketError } = await supabaseAdmin.from("admin_tickets").insert({
    window_id: window.id,
    image_url: filePath,
  });
  if (ticketError) {
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar la cartilla" },
      { status: 500 },
    );
  }

  // Marcar no_show a quienes no tengan apuesta
  const { data: participants, error: participantsError } = await supabaseAdmin
    .from("participants")
    .select("id");
  if (!participantsError && participants) {
    const { data: bets } = await supabaseAdmin
      .from("bets")
      .select("participant_id")
      .eq("window_id", window.id);
    const hasBet = new Set((bets || []).map((b) => b.participant_id as string));
    const missing = participants
      .map((p) => p.id as string)
      .filter((id) => !hasBet.has(id));
    if (missing.length > 0) {
      await supabaseAdmin.from("bets").upsert(
        missing.map((participantId) => ({
          participant_id: participantId,
          window_id: window.id,
          status: "no_show",
        })),
        { onConflict: "window_id,participant_id" },
      );
    }
  }

  // Finalizar ventana
  const { error: windowUpdateError } = await supabaseAdmin
    .from("event_windows")
    .update({ is_active: false, status: "finished" })
    .eq("id", window.id);
  if (windowUpdateError) {
    return NextResponse.json(
      { ok: false, error: "No se pudo finalizar la ventana" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, image_url: filePath });
}
