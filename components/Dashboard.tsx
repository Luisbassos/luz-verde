"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type DashboardProps = {
  sessionUser: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  isAdmin: boolean;
};

type Participant = { id: string; name: string; email?: string | null };
type Bet = {
  id: string;
  participant_id: string;
  bet_image_url?: string | null;
  bet_link?: string | null;
  odds?: number | null;
  status: "pending" | "in_game" | "ok" | "nok" | "no_show";
};

type OddsCard = {
  label: string;
  sport: string;
  min: number;
  max: number;
  start: string;
  end: string;
  odds: Array<{
    id: string;
    commence: string;
    home: string;
    away: string;
    markets: Array<{ market: string; name: string; price: number }>;
  }>;
  status: "idle" | "loading" | "error" | "ok";
  error?: string;
};

const statusOptions: Array<{ value: Bet["status"]; label: string }> = [
  { value: "pending", label: "En espera" },
  { value: "in_game", label: "Registrada" },
  { value: "ok", label: "OK" },
  { value: "nok", label: "NOK" },
  { value: "no_show", label: "No presentada" },
];

const statusLabels: Record<Bet["status"], string> = {
  pending: "En espera",
  in_game: "Registrada",
  ok: "OK",
  nok: "NOK",
  no_show: "No presentada",
};

const statusBadge: Record<
  Bet["status"],
  { icon: string; label: string; className: string }
> = {
  pending: {
    icon: "⏳",
    label: "En espera",
    className: "bg-slate-50 text-slate-600 border-slate-200",
  },
  in_game: {
    icon: "📝",
    label: "Registrada",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  ok: {
    icon: "✅",
    label: "OK",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  nok: {
    icon: "❌",
    label: "NOK",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  no_show: {
    icon: "⚠️",
    label: "No presentada",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

const windowStatusLabels: Record<string, string> = {
  open: "En juego",
  aborted: "Desactivada",
  sin_fecha: "Sin fecha",
  closed: "Cerrada",
  upcoming: "Próxima",
  finished: "Finalizada",
};

export function Dashboard({ sessionUser, isAdmin }: DashboardProps) {
  const displayName = sessionUser.name || "Participante";
  const today = new Date();
  const sevenDays = new Date();
  sevenDays.setDate(today.getDate() + 7);

  const startDate = today.toISOString().slice(0, 10);
  const endDate = sevenDays.toISOString().slice(0, 10);

  const [windowInfo, setWindowInfo] = useState<{
    start_date?: string;
    end_date?: string;
    id?: string;
    status?: string;
    min_odds?: number | null;
    max_odds?: number | null;
  } | null>({
    start_date: startDate,
    end_date: endDate,
    min_odds: 1.45,
    max_odds: 3,
  });
  const [savingWindow, setSavingWindow] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);
  const [windowSuccess, setWindowSuccess] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const [oddsCards, setOddsCards] = useState<OddsCard[]>([
    {
      label: "La Liga (ESP)",
      sport: "soccer_spain_la_liga",
      min: 1.45,
      max: 3,
      start: startDate,
      end: endDate,
      odds: [],
      status: "idle",
    },
    {
      label: "Premier League (ENG)",
      sport: "soccer_epl",
      min: 1.45,
      max: 3,
      start: startDate,
      end: endDate,
      odds: [],
      status: "idle",
    },
    {
      label: "NFL",
      sport: "americanfootball_nfl",
      min: 1.45,
      max: 3,
      start: startDate,
      end: endDate,
      odds: [],
      status: "idle",
    },
    {
      label: "NBA",
      sport: "basketball_nba",
      min: 1.45,
      max: 3,
      start: startDate,
      end: endDate,
      odds: [],
      status: "idle",
    },
    {
      label: "Bundesliga (GER)",
      sport: "soccer_germany_bundesliga",
      min: 1.45,
      max: 3,
      start: startDate,
      end: endDate,
      odds: [],
      status: "idle",
    },
  ]);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [bets, setBets] = useState<Record<string, Bet>>({});
  const [betsLoading, setBetsLoading] = useState(false);
  const [betsError, setBetsError] = useState<string | null>(null);
  const [savingBet, setSavingBet] = useState(false);
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});
  const [adminTicketData, setAdminTicketData] = useState<string>("");
  const [savingTicket, setSavingTicket] = useState(false);
  const [ticketMessage, setTicketMessage] = useState<string | null>(null);

  const [myBetLink, setMyBetLink] = useState("");
  const [myBetImage, setMyBetImage] = useState("");
  const [myBetImageData, setMyBetImageData] = useState("");
  const [myOdds, setMyOdds] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const windowIsOpen = windowInfo?.status === "open";
  const [allWindows, setAllWindows] = useState<
    Array<{
      id: string;
      start_date: string;
      end_date: string;
      status: string;
    }>
  >([]);
  const [windowsLoaded, setWindowsLoaded] = useState(false);
  const [newParticipantEmail, setNewParticipantEmail] = useState("");
  const [newParticipantName, setNewParticipantName] = useState("");
  const [savingParticipant, setSavingParticipant] = useState(false);
  const [participantMessage, setParticipantMessage] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryWindows, setSummaryWindows] = useState<
    Array<{
      id: string;
      label: string;
      status: string;
      betMap: Record<string, Bet | undefined>;
    }>
  >([]);
  const [summaryTotalWindows, setSummaryTotalWindows] = useState(0);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const handlePasteImage = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === "string") {
            setMyBetImageData(result);
            setMyBetImage(file.name);
            setFormMessage("Imagen pegada desde portapapeles");
          }
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const parseDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  };

  const formatRange = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const startStr = parseDate(start).toISOString().split("T")[0];
    const endStr = parseDate(end).toISOString().split("T")[0];
    return `${startStr} a ${endStr}`;
  };

  const formatWindowStatus = (status?: string) =>
    windowStatusLabels[status || "open"] || status || "En juego";

  const myParticipant = useMemo(() => {
    const email = sessionUser.email?.toLowerCase();
    if (!email) return null;
    return participants.find((p) => p.email?.toLowerCase() === email) || null;
  }, [participants, sessionUser.email]);

  const roleLabel = isAdmin ? "Admin" : "Participante";

  const renderStatusBadge = (status: Bet["status"]) => {
    const cfg = statusBadge[status];
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${cfg.className}`}
      >
        <span aria-hidden>{cfg.icon}</span>
        <span>{cfg.label}</span>
      </span>
    );
  };

  const renderStatusOrEmpty = (bet?: Bet | null) => {
    const status = bet?.status ?? "pending";
    const badge = renderStatusBadge(status);
    const showPopup = status !== "pending" && status !== "no_show";
    const hasDetails = bet && (bet.odds || bet.bet_link || bet.bet_image_url);
    if (!showPopup || !hasDetails) return badge;

    return (
      <div className="group relative inline-block">
        {badge}
        <div className="pointer-events-none absolute left-1/2 z-10 hidden w-64 -translate-x-1/2 translate-y-2 rounded-md border border-slate-200 bg-white p-3 text-left text-xs text-slate-700 shadow-lg group-hover:block">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Detalles apuesta
          </p>
          {bet?.odds && <p className="text-sm text-slate-800">Cuota: {bet.odds}</p>}
          {bet?.bet_link && (
            <p className="mt-1 text-xs">
              Link:{" "}
              <a className="text-emerald-700 underline" href={bet.bet_link} target="_blank" rel="noreferrer">
                Ver
              </a>
            </p>
          )}
          {bet?.bet_image_url && (
            <div className="mt-2 overflow-hidden rounded border border-slate-200">
              <img src={bet.bet_image_url} alt="Apuesta" className="max-h-28 w-full object-contain" />
            </div>
          )}
        </div>
      </div>
    );
  };

  const participantPercent = (participantId: string) => {
    if (summaryTotalWindows === 0) return 0;
    let okCount = 0;
    summaryWindows.forEach((w) => {
      const bet = w.betMap[participantId];
      if (bet?.status === "ok") {
        okCount += 1;
      }
    });
    return Math.round((okCount / summaryTotalWindows) * 100);
  };

  const fetchWindow = async () => {
    const res = await fetch("/api/windows");
    if (res.ok) {
      const data = await res.json();
      if (data.window) {
        setWindowInfo({
          start_date: data.window.start_date,
          end_date: data.window.end_date,
          id: data.window.id,
          status: data.status,
          min_odds: data.window.min_odds,
          max_odds: data.window.max_odds,
        });
        setOddsCards((prev) =>
          prev.map((c) => ({
            ...c,
            start: data.window.start_date,
            end: data.window.end_date,
            min: data.window.min_odds ?? c.min,
            max: data.window.max_odds ?? c.max,
            status: "idle",
          })),
        );
      } else {
        setWindowInfo({
          start_date: startDate,
          end_date: endDate,
          min_odds: 1.45,
          max_odds: 3,
        });
      }
    }
  };

  useEffect(() => {
    void fetchWindow();
  }, []);

  useEffect(() => {
    const loadOdds = async (index: number) => {
      setOddsCards((prev) =>
        prev.map((card, i) =>
          i === index ? { ...card, status: "loading", error: undefined } : card,
        ),
      );
      const card = oddsCards[index];
      const params = new URLSearchParams({
        sport: card.sport,
        minOdds: String(card.min),
        maxOdds: String(card.max),
        start_date: windowInfo?.start_date || card.start,
        end_date: windowInfo?.end_date || card.end,
      });
      const res = await fetch(`/api/odds?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setOddsCards((prev) =>
          prev.map((c, i) =>
            i === index
              ? {
                  ...c,
                  status: "error",
                  error: err.error || "Error al cargar cuotas",
                }
              : c,
          ),
        );
        return;
      }
      const data = await res.json();
      setOddsCards((prev) =>
        prev.map((c, i) =>
          i === index
            ? { ...c, status: "ok", odds: data.odds || [], sport: data.sport }
            : c,
        ),
      );
    };
    oddsCards.forEach((_, idx) => {
      void loadOdds(idx);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowInfo?.start_date, windowInfo?.end_date, windowInfo?.min_odds, windowInfo?.max_odds]);

  const fetchAllWindows = async () => {
    if (!isAdmin) return;
    const res = await fetch("/api/windows?all=1");
    if (res.ok) {
      const data = await res.json();
      const mapped =
        (data.windows as Array<any>)?.map((w) => ({
          id: w.id,
          start_date: w.start_date,
          end_date: w.end_date,
          status: w.status,
        })) || [];
      setAllWindows(mapped);
      setWindowsLoaded(true);
      if (!selectedWindowId) {
        const preferred = mapped.find((w) => w.status === "open" || w.status === "finished");
        if (preferred) setSelectedWindowId(preferred.id);
      }
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const resWin = await fetch("/api/windows?all=1");
      if (!resWin.ok) {
        setSummaryLoading(false);
        return;
      }
      const dataWin = await resWin.json();
      const activeOrFinished = (dataWin.windows as Array<any>).filter(
        (w) => w.status === "open" || w.status === "finished",
      );

      const summary: Array<{
        id: string;
        label: string;
        status: string;
        betMap: Record<string, Bet | undefined>;
      }> = [];
      setSummaryTotalWindows(activeOrFinished.length);
      const participantsMap: Record<string, Participant> = {};

      for (const w of activeOrFinished) {
        const resBets = await fetch(`/api/bets?window_id=${w.id}`);
        if (!resBets.ok) continue;
        const dataBets = await resBets.json();
        const betMap: Record<string, Bet | undefined> = {};
        (dataBets.bets as Bet[] | undefined)?.forEach((b) => {
          betMap[b.participant_id] = b;
        });
        (dataBets.participants as Participant[] | undefined)?.forEach((p) => {
          participantsMap[p.id] = p;
        });
        summary.push({
          id: w.id,
          label: formatRange(w.start_date, w.end_date) || "",
          status: w.status,
          betMap,
        });
      }
      setSummaryWindows(summary);
      const newParticipants = Object.values(participantsMap);
      const sameLength = newParticipants.length === participants.length;
      const sameIds =
        sameLength &&
        newParticipants.every((p) =>
          participants.some((prev) => prev.id === p.id && prev.name === p.name && prev.email === p.email),
        );
      if (!sameIds) {
        setParticipants(newParticipants);
      }
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchBets = async () => {
    setBetsLoading(true);
    setBetsError(null);
    const params = new URLSearchParams();
    if (selectedWindowId) {
      params.append("window_id", selectedWindowId);
    } else if (windowInfo?.id) {
      params.append("window_id", windowInfo.id);
    }
    const res = await fetch(`/api/bets?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      setBetsError("No se pudo cargar apuestas");
      setBetsLoading(false);
      return;
    }
    const data = await res.json();
    setParticipants(data.participants || []);
    const map: Record<string, Bet> = {};
    (data.bets as Bet[] | undefined)?.forEach((b) => {
      map[b.participant_id] = b;
    });
    setBets(map);
    // prefill my form
    const mine = myParticipant ? map[myParticipant.id] : null;
    if (mine) {
      setMyBetLink(mine.bet_link || "");
      setMyBetImage(mine.bet_image_url || "");
      setMyOdds(mine.odds ? String(mine.odds) : "");
    }
    setBetsLoading(false);
  };

  useEffect(() => {
    void fetchBets();
    void loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowInfo?.id, selectedWindowId]);

  useEffect(() => {
    if (isAdmin && !windowsLoaded) {
      void fetchAllWindows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, windowsLoaded]);

  const handleSaveBet = async () => {
    setFormMessage(null);
    if (!windowIsOpen) {
      setFormMessage("No puedes guardar: fecha no abierta");
      return;
    }
    if (!myBetLink && !myBetImageData) {
      setFormMessage("Debe incluir imagen o link");
      return;
    }
    setSavingBet(true);
    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bet_link: myBetLink || null,
        bet_image_url: myBetImage || null,
        bet_image_data: myBetImageData || null,
        odds: myOdds ? Number(myOdds) : null,
        window_id: windowInfo?.id,
      }),
    });
    setSavingBet(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setFormMessage(err.error || "No se pudo guardar la apuesta");
      return;
    }
    setFormMessage("Apuesta guardada");
    void fetchBets();
    void loadSummary();
  };

  const handleStatusChange = async (participantId: string, status: Bet["status"]) => {
    setSavingStatus((prev) => ({ ...prev, [participantId]: true }));
    const bet = bets[participantId];
    const res = await fetch("/api/bets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        window_id: windowInfo?.id,
        bet_link: bet?.bet_link || null,
        bet_image_url: bet?.bet_image_url || null,
        odds: bet?.odds || null,
        status,
      }),
    });
    setSavingStatus((prev) => ({ ...prev, [participantId]: false }));
    if (res.ok) {
      void fetchBets();
      void loadSummary();
    }
  };

  const saveWindow = async () => {
    if (!windowInfo?.start_date || !windowInfo?.end_date) return;
    setSavingWindow(true);
    setWindowError(null);
    setWindowSuccess(null);
    const minOdds = windowInfo.min_odds ?? null;
    const maxOdds = windowInfo.max_odds ?? null;
    const res = await fetch("/api/windows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start_date: windowInfo.start_date,
        end_date: windowInfo.end_date,
        min_odds: minOdds,
        max_odds: maxOdds,
      }),
    });
    setSavingWindow(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setWindowError(err.error || "No se pudo guardar la fecha");
      return;
    }
    setWindowSuccess("Fecha guardada");
    await fetchWindow();
    await fetchAllWindows();
    await fetchBets();
  };

  const handleAdminTicket = async () => {
    if (!adminTicketData) return;
    setSavingTicket(true);
    setTicketMessage(null);
    const res = await fetch("/api/admin-ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_data: adminTicketData, window_id: windowInfo?.id }),
    });
    setSavingTicket(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setTicketMessage(err.error || "No se pudo guardar cartilla");
      return;
    }
    setTicketMessage("Cartilla guardada y no_presentadas marcadas");
    setAdminTicketData("");
    await fetchAllWindows();
    await fetchWindow();
    await fetchBets();
    await loadSummary();
  };

  const myBetStatus = myParticipant ? bets[myParticipant.id]?.status : undefined;
  const myBet = myParticipant ? bets[myParticipant.id] : null;

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            Polla Partidos
          </p>
          <h2 className="text-lg font-semibold text-slate-900">Dashboard</h2>
          {windowInfo?.start_date && windowInfo?.end_date && (
            <p className="text-xs text-slate-500">
              Fecha: {formatRange(windowInfo.start_date, windowInfo.end_date)} · Estado: {formatWindowStatus(windowInfo.status)}
            </p>
          )}
          {!windowInfo && (
            <p className="text-xs text-red-600">Sin fecha configurada</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 justify-end">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {collapsed ? "Expandir" : "Colapsar"}
          </button>
          {isAdmin && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
              Admin
            </span>
          )}
          <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">
                  {displayName}
                </div>
                <div className="text-xs text-slate-500">
                  {sessionUser.email} · {roleLabel}
                </div>
                {myBetStatus && (
                <div className="mt-1 text-xs font-semibold text-emerald-700">
                  Mi estado: {renderStatusBadge(myBetStatus)}
                </div>
              )}
            </div>
            {sessionUser.image ? (
              <Image
                src={sessionUser.image}
                alt={displayName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-emerald-100"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </header>
      {!collapsed && (
        <div className="px-6 py-5 space-y-6">
          <p className="text-sm text-slate-700">
            Sube tu apuesta para la fecha en juego. Si el admin sube la cartilla y no enviaste nada, quedarás como
            <span className="font-semibold"> Aweonao</span>.
          </p>

              {summaryWindows.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Participantes por fecha (en juego y finalizadas)
                    </p>
        {summaryLoading && (
          <span className="text-xs font-semibold text-emerald-600">Actualizando...</span>
        )}
      </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Participante</th>
                          <th className="px-3 py-3 font-semibold text-center">% OK</th>
                          {summaryWindows.map((w) => (
                            <th key={w.id} className="px-3 py-3 font-semibold text-center">
                              <div className="text-slate-800">{w.label || "Fecha"}</div>
                              <div className="text-[11px] text-slate-500">
                                {formatWindowStatus(w.status)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
                      <tbody>
                        {participants.map((p, idx) => (
                          <tr
                            key={p.id}
                            className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                          >
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                              {p.name}
                            </td>
                            <td className="px-3 py-3 text-center text-xs text-slate-800">
                              {participantPercent(p.id)}%
                            </td>
                            {summaryWindows.map((w) => {
                              const bet = w.betMap[p.id];
                              return (
                                <td
                                  key={`${w.id}-${p.id}`}
                                  className="px-3 py-3 text-center text-xs text-slate-800"
                                >
                                  {renderStatusOrEmpty(bet)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

          {/* Mi apuesta */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Mi apuesta
                </p>
                {windowInfo && (
                  <p className="text-[11px] text-slate-500">
                    Cuota mínima: {windowInfo.min_odds ?? "-"} · máxima: {windowInfo.max_odds ?? "-"}
                  </p>
                )}
              </div>
              {!windowIsOpen && (
                <span className="text-xs font-semibold text-red-600">
                  No puedes guardar: fecha no abierta
                </span>
              )}
              {formMessage && (
                <span className="text-xs font-semibold text-emerald-700">{formMessage}</span>
              )}
            </div>
            {myBet && (myBet.bet_image_url || myBet.bet_link || myBet.odds) ? (
              <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Tu apuesta guardada
                </p>
                <div className="mt-2 space-y-2">
                  {myBet.bet_image_url && (
                    <div>
                      <p className="text-xs text-slate-600">Imagen</p>
                      <div className="mt-1 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                        <img
                          src={myBet.bet_image_url}
                          alt="Apuesta"
                          className="max-h-48 w-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                  {myBet.bet_link && (
                    <p className="text-sm text-emerald-700">
                      Link:{" "}
                      <a href={myBet.bet_link} target="_blank" rel="noreferrer" className="underline">
                        {myBet.bet_link}
                      </a>
                    </p>
                  )}
                  {myBet.odds && (
                    <p className="text-sm text-slate-800">Factor/Cuota: {myBet.odds}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    Si necesitas corregir, contacta al admin.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="text-sm text-slate-800">
                    Imagen (sube o pega)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          setMyBetImage("");
                          setMyBetImageData("");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => {
                          const result = reader.result;
                          if (typeof result === "string") {
                            setMyBetImageData(result);
                            setMyBetImage(file.name);
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                    <div
                      onPaste={handlePasteImage}
                      tabIndex={0}
                      className="mt-2 rounded-md border border-dashed border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      role="button"
                    >
                      Pega aquí (Ctrl/Cmd+V) una imagen desde tu portapapeles
                    </div>
                    {myBetImage && (
                      <p className="mt-1 text-xs text-slate-600">Imagen lista para enviar</p>
                    )}
                  </div>
                  <label className="text-sm text-slate-800">
                    Link
                    <input
                      type="url"
                      value={myBetLink}
                      onChange={(e) => setMyBetLink(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      placeholder="https://..."
                    />
                  </label>
                  <label className="text-sm text-slate-800">
                    Factor/cuota
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={myOdds}
                      onChange={(e) => setMyOdds(e.target.value)}
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                      placeholder="1.80"
                    />
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleSaveBet}
                    disabled={savingBet || !windowIsOpen}
                    className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {savingBet ? "Guardando..." : "Guardar apuesta"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Odds cards */}
          <div className="grid gap-4 md:grid-cols-2">
            {oddsCards.map((card) => (
              <div
                key={card.label}
                className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {card.label}
                    </p>
                    <p className="text-sm text-slate-600">
                      {card.sport} · cuotas {card.min} - {card.max}
                    </p>
                    {windowInfo?.start_date && windowInfo?.end_date && (
                      <p className="text-xs text-slate-500">
                        En juego: {formatRange(windowInfo.start_date, windowInfo.end_date)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      card.status === "loading"
                        ? "text-amber-600"
                        : card.status === "ok"
                          ? "text-emerald-600"
                          : card.status === "error"
                            ? "text-red-600"
                            : "text-slate-500"
                    }`}
                  >
                    {card.status === "loading"
                      ? "Cargando..."
                      : card.status === "ok"
                        ? "Actualizado"
                        : card.status === "error"
                          ? "Error"
                          : "Listo"}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {card.status === "error" && (
                    <p className="text-xs text-red-600">{card.error}</p>
                  )}
                  {card.status === "ok" && card.odds.length === 0 && (
                    <p className="text-xs text-slate-600">Sin cuotas en este rango.</p>
                  )}
                  {card.status === "ok" &&
                    card.odds.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {ev.home} vs {ev.away}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {ev.markets.slice(0, 3).map((m, idx) => (
                            <span
                              key={`${m.market}-${idx}`}
                              className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800"
                            >
                              {m.name}: {m.price}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Gestionar fecha
                  </p>
                  <p className="text-sm text-emerald-800">
                    Define inicio y término, guarda, y luego sube la cartilla completa.
                  </p>
                </div>
                {windowSuccess && (
                  <span className="text-xs font-semibold text-emerald-700">
                    {windowSuccess}
                  </span>
                )}
              </div>
              {windowInfo?.id ? (
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="text-sm text-emerald-900">
                    Inicio
                    <p className="mt-1 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm">
                      {windowInfo.start_date}
                    </p>
                  </div>
                  <div className="text-sm text-emerald-900">
                    Término
                    <p className="mt-1 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm">
                      {windowInfo.end_date}
                    </p>
                  </div>
                  <div className="text-sm text-emerald-900">
                    Cuota mínima
                    <p className="mt-1 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm">
                      {windowInfo.min_odds ?? "-"}
                    </p>
                  </div>
                  <div className="text-sm text-emerald-900">
                    Cuota máxima
                    <p className="mt-1 rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm">
                      {windowInfo.max_odds ?? "-"}
                    </p>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled
                      className="inline-flex w-full items-center justify-center rounded-md bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
                    >
                      Fecha en juego
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-5">
                  <label className="text-sm text-emerald-900">
                    Inicio
                    <input
                      type="date"
                      value={windowInfo?.start_date || ""}
                      onChange={(e) =>
                        setWindowInfo((prev) => ({ ...prev, start_date: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm text-emerald-900">
                    Término
                    <input
                      type="date"
                      value={windowInfo?.end_date || ""}
                      onChange={(e) =>
                        setWindowInfo((prev) => ({ ...prev, end_date: e.target.value }))
                      }
                      className="mt-1 w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="text-sm text-emerald-900">
                    Cuota mínima
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={windowInfo?.min_odds ?? ""}
                      onChange={(e) =>
                        setWindowInfo((prev) => ({
                          ...prev,
                          min_odds: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
                      placeholder="1.45"
                    />
                  </label>
                  <label className="text-sm text-emerald-900">
                    Cuota máxima
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={windowInfo?.max_odds ?? ""}
                      onChange={(e) =>
                        setWindowInfo((prev) => ({
                          ...prev,
                          max_odds: e.target.value ? Number(e.target.value) : null,
                        }))
                      }
                      className="mt-1 w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
                      placeholder="3.00"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={saveWindow}
                      disabled={savingWindow}
                      className="inline-flex w-full items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                    >
                      {savingWindow ? "Guardando..." : "Guardar fecha"}
                    </button>
                  </div>
                </div>
              )}
              {windowError && <p className="text-sm text-red-600">{windowError}</p>}

              <div className="grid gap-3 md:grid-cols-3 items-end">
                <div className="text-sm text-emerald-900 md:col-span-2">
                  Cartilla completa (sube imagen)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        setAdminTicketData("");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = reader.result;
                        if (typeof result === "string") {
                          setAdminTicketData(result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="mt-1 w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-xs text-emerald-800">
                    Usa la ventana abierta. Marcará no_show a quienes no subieron apuesta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAdminTicket}
                  disabled={savingTicket || !adminTicketData}
                  className="inline-flex w-full items-center justify-center rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60"
                >
                  {savingTicket ? "Guardando..." : "Subir cartilla"}
                </button>
              </div>
              {ticketMessage && (
                <p className="text-sm text-emerald-700">{ticketMessage}</p>
              )}

              <div className="mt-2 rounded-md border border-emerald-200 bg-white px-3 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Fechas configuradas
                  </p>
                  <span className="text-xs text-emerald-700">
                    {allWindows.length} en total
                  </span>
                </div>
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full border-collapse text-xs">
                    <thead className="bg-emerald-100 text-emerald-800">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold">Rango</th>
                        <th className="px-2 py-2 text-left font-semibold">Estado</th>
                        <th className="px-2 py-2 text-left font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allWindows.map((w) => (
                        <tr key={w.id} className="border-b border-emerald-100">
                          <td className="px-2 py-2 text-slate-800">
                            {formatRange(w.start_date, w.end_date)}
                          </td>
                          <td className="px-2 py-2 text-slate-700">
                          {formatWindowStatus(w.status)}
                        </td>
                          <td className="px-2 py-2">
                            {w.status !== "finished" && w.status !== "aborted" ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  await fetch(`/api/windows?id=${w.id}`, { method: "DELETE" });
                                  await fetchAllWindows();
                                  await fetchBets();
                                }}
                                className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 transition hover:bg-red-100"
                              >
                                Abortar
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {allWindows.length === 0 && (
                        <tr>
                          <td className="px-2 py-2 text-slate-600" colSpan={3}>
                            No hay fechas configuradas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Nuevo participante
                  </p>
                  <p className="text-xs text-slate-500">
                    Agrega correo y nombre; se crea en participantes y queda habilitado.
                  </p>
                </div>
                {participantMessage && (
                  <span className="text-xs font-semibold text-emerald-700">
                    {participantMessage}
                  </span>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-800">
                  Correo
                  <input
                    type="email"
                    value={newParticipantEmail}
                    onChange={(e) => setNewParticipantEmail(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="correo@ejemplo.com"
                  />
                </label>
                <label className="text-sm text-slate-800">
                  Nombre
                  <input
                    type="text"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Nombre"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    setParticipantMessage(null);
                    if (!newParticipantEmail || !newParticipantName) {
                      setParticipantMessage("Completa nombre y correo");
                      return;
                    }
                    setSavingParticipant(true);
                    const res = await fetch("/api/participants", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: newParticipantEmail,
                        name: newParticipantName,
                      }),
                    });
                    setSavingParticipant(false);
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      setParticipantMessage(err.error || "Error al crear participante");
                      return;
                    }
                    setParticipantMessage("Participante agregado");
                    setNewParticipantEmail("");
                    setNewParticipantName("");
                    await fetchBets();
                  }}
                  disabled={savingParticipant}
                  className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
                >
                  {savingParticipant ? "Guardando..." : "Agregar"}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Apuestas por participante
                </p>
                {windowInfo?.start_date && windowInfo?.end_date && (
                  <p className="text-xs text-slate-500">
                    Fecha en juego: {formatRange(windowInfo.start_date, windowInfo.end_date)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isAdmin && (
                  <select
                    value={selectedWindowId || ""}
                    onChange={(e) => setSelectedWindowId(e.target.value || null)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Ventana activa</option>
                    {allWindows.map((w) => (
                      <option key={w.id} value={w.id}>
                        {formatRange(w.start_date, w.end_date)} · {formatWindowStatus(w.status)}
                      </option>
                    ))}
                  </select>
                )}
                {betsLoading && (
                  <span className="text-xs font-semibold text-emerald-600">
                    Cargando...
                  </span>
                )}
              </div>
            </div>
            {betsError && <p className="mt-2 text-sm text-red-600">{betsError}</p>}
            <div className="mt-3 overflow-x-auto rounded-md border border-slate-200 bg-white">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Participante</th>
                    <th className="px-3 py-3 font-semibold">Estado</th>
                    <th className="px-3 py-3 font-semibold">Cuota</th>
                    <th className="px-3 py-3 font-semibold">Link</th>
                    <th className="px-3 py-3 font-semibold">Imagen</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p, idx) => {
                    const bet = bets[p.id];
                    const saving = savingStatus[p.id];
                    return (
                      <tr
                        key={p.id}
                        className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {p.name}
                        </td>
                        <td className="px-3 py-3">
                          {isAdmin ? (
                            <select
                              value={bet?.status || ""}
                              onChange={(e) =>
                                handleStatusChange(p.id, e.target.value as Bet["status"])
                              }
                              disabled={saving}
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900"
                            >
                              {!bet && (
                                <option value="" disabled>
                                  Sin apuesta
                                </option>
                              )}
                              {statusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="text-sm text-slate-800">
                              {renderStatusOrEmpty(bet)}
                            </div>
                          )}
                    </td>
                        <td className="px-3 py-3 text-sm text-slate-800">
                          {bet?.odds ?? "-"}
                        </td>
                        <td className="px-3 py-3 text-sm text-emerald-700">
                          {bet?.bet_link ? (
                            <a
                              href={bet.bet_link}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              Ver
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm text-emerald-700">
                          {bet?.bet_image_url ? (
                            <a
                              href={bet.bet_image_url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              Imagen
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
