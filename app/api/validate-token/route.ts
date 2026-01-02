import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getClientIp, rateLimit } from "@/lib/rateLimit";

async function isValidToken(token: string) {
  const { data, error } = await supabaseAdmin
    .from("access_tokens")
    .select("is_active, expires_at")
    .eq("token", token)
    .single();

  if (error || !data) return false;
  const now = new Date();
  return data.is_active && new Date(data.expires_at) >= now;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = rateLimit(`validate:${ip}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Rate limit" },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      },
    );
  }

  const { token } = await req.json().catch(() => ({}));
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Token requerido" },
      { status: 400 },
    );
  }

  const ok = await isValidToken(token);
  if (!ok) return NextResponse.json({ ok: false }, { status: 403 });

  return NextResponse.json({ ok: true });
}
