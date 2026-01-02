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
      const bestByOutcome: Record<
        string,
        {
          market: string;
          name: string;
          price: number;
        }
      > = {};

      (event.bookmakers || []).forEach((b: any) => {
        (b.markets || []).forEach((m: any) => {
          (m.outcomes || [])
            .filter((o: any) => o.price >= min && o.price <= max)
            .forEach((o: any) => {
              const key = o.name;
              const existing = bestByOutcome[key];
              if (!existing || o.price > existing.price) {
                bestByOutcome[key] = {
                  market: m.key,
                  name: o.name,
                  price: o.price,
                };
              }
            });
        });
      });

      const markets = Object.values(bestByOutcome).sort((a, b) => b.price - a.price);
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
  const sport = searchParams.get("sport") || "soccer_spain_la_liga";
  let minOdds = Number(searchParams.get("minOdds") ?? NaN);
  let maxOdds = Number(searchParams.get("maxOdds") ?? NaN);

  if (Number.isNaN(minOdds) || Number.isNaN(maxOdds)) {
    const { data: windowRow } = await supabaseAdmin
      .from("event_windows")
      .select("min_odds,max_odds")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .maybeSingle();
    minOdds = Number.isNaN(minOdds) ? windowRow?.min_odds ?? 1.45 : minOdds;
    maxOdds = Number.isNaN(maxOdds) ? windowRow?.max_odds ?? 3 : maxOdds;
  }

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
