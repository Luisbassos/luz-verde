import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type CacheRow = {
  cache_key: string;
  payload: any;
  fetched_at: string;
};

function filterOdds(data: any[], min: number, max: number) {
  return (data || [])
    .map((event) => {
      const markets = (event.bookmakers?.[0]?.markets || [])
        .flatMap((m: any) =>
          (m.outcomes || [])
            .filter((o: any) => o.price >= min && o.price <= max)
            .map((o: any) => ({
              market: m.key,
              name: o.name,
              price: o.price,
            })),
        );
      return {
        id: event.id,
        sport: event.sport_key,
        commence: event.commence_time,
        home: event.home_team,
        away: event.away_team,
        markets,
      };
    })
    .filter((e) => e.markets.length > 0);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport") || "soccer_uefa_champs_league";
  const minOdds = Number(searchParams.get("minOdds") ?? 1.45);
  const maxOdds = Number(searchParams.get("maxOdds") ?? 3);

  const startParam = searchParams.get("start_date");
  const endParam = searchParams.get("end_date");
  const startDate = startParam ? new Date(startParam) : new Date();
  const endDate = endParam
    ? new Date(endParam)
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // default 7 días

  const cacheKey = sport; // cacheamos payload completo por deporte; filtramos por rango en memoria
  const now = Date.now();

  // Try cache in Supabase
  const { data: cachedRows } = await supabaseAdmin
    .from("odds_cache")
    .select("cache_key,payload,fetched_at")
    .eq("cache_key", cacheKey)
    .limit(1)
    .returns<CacheRow[]>();

  const cached = cachedRows?.[0];
  if (cached) {
    const fetchedAt = new Date(cached.fetched_at).getTime();
    if (now - fetchedAt < CACHE_TTL_MS) {
      const filteredByDate = (cached.payload || []).filter((event: any) => {
        const commence = new Date(event.commence_time);
        return commence >= startDate && commence <= endDate;
      });
      return NextResponse.json(
        {
          ok: true,
          cached: true,
          sport,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          odds: filterOdds(filteredByDate, minOdds, maxOdds),
          raw_events: filteredByDate, // se devuelve para uso futuro (fechas/mercados completos)
          fetched_at: cached.fetched_at,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "Falta ODDS_API_KEY" },
      { status: 500 },
    );
  }

  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?regions=eu&markets=h2h,spreads&oddsFormat=decimal&apiKey=${apiKey}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: "Odds API error" },
      { status: res.status },
    );
  }

  const data = await res.json();
  const filteredByDate = (data || []).filter((event: any) => {
    const commence = new Date(event.commence_time);
    return commence >= startDate && commence <= endDate;
  });
  const odds = filterOdds(filteredByDate, minOdds, maxOdds);

  await supabaseAdmin
    .from("odds_cache")
    .upsert({
      cache_key: cacheKey,
      payload: data,
      fetched_at: new Date().toISOString(),
    });

  return NextResponse.json(
    {
      ok: true,
      cached: false,
      sport,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      odds,
      raw_events: filteredByDate,
      fetched_at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
