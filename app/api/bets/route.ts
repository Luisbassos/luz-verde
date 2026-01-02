import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserRole } from "@/lib/roles";

type BetStatus = "pending" | "in_game" | "ok" | "nok" | "no_show";

type WindowRow = {
  id: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

async function getWindow(windowId?: string, includeInactive = false): Promise<WindowRow | null> {
  let query = supabaseAdmin
    .from("event_windows")
    .select("id,start_date,end_date,is_active")
    .order("created_at", { ascending: false });

  if (windowId) {
    query = query.eq("id", windowId);
  } else if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  if (!windowId) {
    query = query.limit(1);
  }

  const { data, error } = windowId ? await query.maybeSingle() : await query.limit(1).maybeSingle();
  if (error || !data) return null;
  return data as WindowRow;
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) return null;
  const [, mime, base64] = match;
  return { mime, buffer: Buffer.from(base64, "base64") };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const windowIdParam = new URL(req.url).searchParams.get("window_id");
  const window = await getWindow(windowIdParam || undefined, Boolean(windowIdParam));
  if (!window) {
    return NextResponse.json({ ok: true, window: null, bets: [], participants: [] });
  }

  const { data: participants, error: participantsError } = await supabaseAdmin
    .from("participants")
    .select("id,name,email")
    .order("name", { ascending: true });

  if (participantsError) {
    return NextResponse.json({ ok: false, error: "Error cargando participantes" }, { status: 500 });
  }

  const { data: bets, error: betsError } = await supabaseAdmin
    .from("bets")
    .select("id,participant_id,bet_image_url,bet_link,odds,status,notes,window_id")
    .eq("window_id", window.id);

  if (betsError) {
    return NextResponse.json({ ok: false, error: "Error cargando apuestas" }, { status: 500 });
  }

  const signedBets = await Promise.all(
    (bets || []).map(async (bet) => {
      if (!bet.bet_image_url) return bet;
      if (bet.bet_image_url.startsWith("http")) return bet;
      const { data: signed } = await supabaseAdmin.storage
        .from("bets")
        .createSignedUrl(bet.bet_image_url, 60 * 60);
      return { ...bet, bet_image_url: signed?.signedUrl || bet.bet_image_url };
    }),
  );

  const role = await getUserRole(session.user.email);
  return NextResponse.json({
    ok: true,
    role,
    window_id: window.id,
    window,
    participants,
    bets: signedBets,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const betLink = body?.bet_link as string | null;
  const betImageUrl = body?.bet_image_url as string | null; // puede venir como path previo
  const betImageData = body?.bet_image_data as string | null;
  const odds = body?.odds as number | null;
  const status = body?.status as BetStatus | undefined;
  const targetParticipantId = body?.participant_id as string | null;
  const windowId = body?.window_id as string | null;

  const role = await getUserRole(session.user.email);
  const hasEvidence = Boolean(betLink || betImageUrl || betImageData);
  const hasStatusUpdate = typeof status === "string";

  if (!hasEvidence) {
    if (role !== "admin" || !hasStatusUpdate) {
      return NextResponse.json(
        { ok: false, error: "Debes enviar imagen o link" },
        { status: 400 },
      );
    }
  }

  const window = await getWindow(windowId || undefined, role === "admin");
  if (!window) {
    return NextResponse.json(
      { ok: false, error: role === "admin" ? "No se encontró la ventana" : "No hay ventana abierta" },
      { status: 400 },
    );
  }

  // resolve participant
  let participantId = targetParticipantId;
  if (!participantId) {
    const { data: me, error: meError } = await supabaseAdmin
      .from("participants")
      .select("id")
      .eq("email", session.user.email.toLowerCase())
      .maybeSingle();
    if (meError || !me) {
      return NextResponse.json(
        { ok: false, error: "No estás registrado como participante" },
        { status: 400 },
      );
    }
    participantId = me.id as string;
  }

  if (role !== "admin" && targetParticipantId && targetParticipantId !== participantId) {
    return NextResponse.json(
      { ok: false, error: "No puedes editar apuestas de otros" },
      { status: 403 },
    );
  }

  const statusToUse: BetStatus =
    role === "admin" && status ? status : "in_game";

  let finalImagePath = betImageUrl || null;
  if (betImageData) {
    const parsed = parseDataUrl(betImageData);
    if (!parsed) {
      return NextResponse.json(
        { ok: false, error: "Imagen inválida" },
        { status: 400 },
      );
    }
    const filePath = `bets/${window.id}/${participantId}/${randomUUID()}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("bets")
      .upload(filePath, parsed.buffer, { contentType: parsed.mime, upsert: true });
    if (uploadError) {
      return NextResponse.json(
        { ok: false, error: "No se pudo subir la imagen" },
        { status: 500 },
      );
    }
    finalImagePath = filePath;
  }

  const { error } = await supabaseAdmin.from("bets").upsert(
    {
      participant_id: participantId,
      window_id: window.id,
      bet_link: betLink,
      bet_image_url: finalImagePath,
      odds,
      status: statusToUse,
    },
    { onConflict: "window_id,participant_id" },
  );

  if (error) {
    return NextResponse.json(
      { ok: false, error: "No se pudo guardar la apuesta" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
