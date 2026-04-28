/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import { auctionApi } from "@/lib/auctionApi"
import { auctionEngineApi, auctionPoolApi } from "@/lib/auctionEngineApi"
import { biddingApi } from "@/lib/biddingApi"
import { hammerApi, participantApi } from "@/lib/hammerApi"
import { squadApi } from "@/lib/squadApi"
import { authApi } from "@/lib/auth"
import { fantasyApi } from "@/lib/fantasyApi"
import { tradeApi, TradeResponse } from "@/lib/tradeApi"
import { useAuctionRoomStore } from "@/store/auctionRoomStore"
import { Player } from "@/types/player"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export const Route = createFileRoute("/auction/$auctionId/")({
  component: AuctionRoomPage,
})

const MIN_SQUAD_SIZE = 15
const MAX_SQUAD_SIZE = 30

const TEAM_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
  "#14b8a6", "#84cc16",
]

// ─── HELPERS ─────────────────────────────────────────────────────────────

function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`
  return `₹${amount.toLocaleString()}`
}

function normaliseSpecialism(raw?: string): string {
  const s = (raw ?? "").toUpperCase().replace(/[\s_-]/g, "")
  if (s.includes("ALLROUND") || s === "AR") return "ALLROUNDER"
  if (s.includes("WICKET") || s === "WK") return "WICKETKEEPER"
  if (s.includes("BOWL") || s === "BWL") return "BOWLER"
  if (s.includes("BAT")) return "BATSMAN"
  return ""
}

function specialismStyle(sp?: string) {
  switch (normaliseSpecialism(sp)) {
    case "BATSMAN":     return { bg: "bg-sky-100",    text: "text-sky-700",    border: "border-sky-200",    dot: "bg-sky-400",    bar: "#38bdf8" }
    case "BOWLER":      return { bg: "bg-rose-100",   text: "text-rose-700",   border: "border-rose-200",   dot: "bg-rose-400",   bar: "#fb7185" }
    case "ALLROUNDER":  return { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-400", bar: "#a78bfa" }
    case "WICKETKEEPER":return { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200",  dot: "bg-amber-400",  bar: "#fbbf24" }
    default:            return { bg: "bg-slate-100",  text: "text-slate-600",  border: "border-slate-200",  dot: "bg-slate-400",  bar: "#94a3b8" }
  }
}

// ─── MOBILE CSS ───────────────────────────────────────────────────────────

const mobileCSS = `
  .ar-mobile-bar    { display: none; }
  .ar-budget-mobile  { display: none; }
  .ar-budget-desktop { display: block; }

  @media (max-width: 640px) {
    .ar-header { padding: 0 14px !important; height: 50px !important; }
    .ar-title  { font-size: 14px !important; }
    .ar-status-chip  { display: none !important; }
    .ar-header-right { display: none !important; }
    .ar-squads-col   { display: none !important; }

    .ar-root { height: auto !important; overflow-y: auto !important; min-height: 100vh; }
    .ar-body { flex-direction: column !important; overflow-y: visible !important; overflow-x: hidden !important; height: auto !important; }
    .ar-left-col { overflow-y: visible !important; overflow-x: hidden !important; flex: none !important; height: auto !important; }
    .ar-bid-history-card { flex: none !important; min-height: 300px !important; max-height: 400px !important; }
    .ar-bid-list { overflow-y: auto !important; flex: 1 !important; max-height: 350px !important; }

    .ar-mobile-bar {
      display: flex !important;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      height: 42px;
      background: #f3efe6;
      border-bottom: 1px solid #e8e0d0;
      gap: 8px;
      flex-shrink: 0;
    }
    .ar-mobile-bar-left  { display: flex; align-items: center; gap: 6px; }
    .ar-mobile-bar-right { display: flex; align-items: center; gap: 6px; }

    .ar-body { flex-direction: column !important; overflow-y: hidden !important; overflow-x: hidden !important; }
    .ar-left-col { overflow-y: auto !important; overflow-x: hidden !important; }
    .ar-left-inner    { flex-direction: column !important; }
    .ar-upcoming-wrap { width: 100% !important; margin-top: 8px; }

    .ar-ctrl-col {
      width: 100% !important;
      order: -1 !important;
      border-right: none !important;
      border-bottom: 1px solid #e8e0d0;
      padding: 12px !important;
      flex-direction: column !important;
      gap: 8px !important;
      overflow: visible !important;
    }
    .ar-ctrl-primary { display: flex !important; flex-direction: row !important; gap: 8px !important; }
    .ar-ctrl-primary > button { flex: 1 !important; min-width: 0 !important; font-size: 12px !important; }

    .ar-squads-col { width: 100% !important; border-top: 1px solid #e8e0d0; }

    .ar-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }

    .ar-hero h2 { font-size: 1.2rem !important; }
    .ar-ctrl-col .bg-stone-50 { max-width: 100% !important; overflow-x: hidden !important; }

    .ar-mob-back-btn {
      display: flex; align-items: center; gap: 4px;
      padding: 5px 10px; border-radius: 8px;
      border: 1px solid #e8e0d0; background: white;
      font-size: 11px; font-weight: 700; color: #6b5e4e;
      cursor: pointer; white-space: nowrap;
      font-family: 'DM Sans', sans-serif;
    }

    .ar-mobile-bar button {
      padding: 5px 10px !important;
      border-radius: 8px !important;
      font-size: 11px !important;
      line-height: 1.4 !important;
      min-height: unset !important;
      height: auto !important;
      white-space: nowrap;
    }

    .ar-budget-mobile  { display: block !important; }
    .ar-budget-desktop { display: none !important; }
  }

  @media (min-width: 641px) and (max-width: 900px) {
    .ar-ctrl-col   { width: 200px !important; }
    .ar-squads-col { width: 180px !important; }
    .ar-header     { padding: 0 16px !important; }
  }
`

// ─── WALLET MAP HOOK ──────────────────────────────────────────────────────

type SquadForWallet = { participantId?: string }

function useWalletMap(auctionId: string, squads: SquadForWallet[] | undefined) {
  const participantIds = useMemo(
    () => (squads ?? []).map(s => s.participantId).filter(Boolean).sort().join(","),
    [squads]
  )
  return useQuery({
    queryKey: ["allWallets", auctionId, participantIds],
    queryFn: async () => {
      const results = await Promise.all(
        (squads ?? [])
          .filter(s => !!s.participantId)
          .map(s =>
            biddingApi.getWallet(s.participantId!, auctionId)
              .then(w => [s.participantId!, w.balance] as [string, number])
              .catch(() => [s.participantId!, null] as [string, null])
          )
      )
      return Object.fromEntries(results) as Record<string, number | null>
    },
    enabled: !!squads && squads.length > 0,
    refetchInterval: 12000,
    staleTime: 10000,
    placeholderData: (prev) => prev,
  })
}

// ─── TIMER RING ───────────────────────────────────────────────────────────

function TimerRing({ seconds, total, biddingOpen, paused }: {
  seconds: number; total: number; biddingOpen: boolean; paused?: boolean
}) {
  const pct = total > 0 ? seconds / total : 0
  const r = 22
  const circ = 2 * Math.PI * r
  const color = paused ? "#94a3b8" : biddingOpen ? "#10b981" : seconds <= 5 ? "#ef4444" : seconds <= 10 ? "#f59e0b" : "#6366f1"
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="56" height="56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth="3.5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {paused
          ? <span className="text-base text-slate-400">⏸</span>
          : biddingOpen
            ? (<><span className="text-[10px] font-black text-emerald-500 tracking-wider">LIVE</span><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mt-0.5" /></>)
            : seconds > 0
              ? (<><span className="text-lg font-black tabular-nums leading-none" style={{ color }}>{seconds}</span><span className="text-[9px] text-slate-400 font-semibold tracking-widest">SEC</span></>)
              : <span className="text-slate-300 text-xs">—</span>}
      </div>
    </div>
  )
}

// ─── PLAYER HERO CARD ─────────────────────────────────────────────────────

function PlayerHeroCard({ player, seconds, total, biddingOpen, paused, battingStyle, bowlingStyle }: {
  player: Player; seconds: number; total: number; biddingOpen: boolean; paused?: boolean
  battingStyle?: string; bowlingStyle?: string
}) {
  const st = specialismStyle(player.specialism)

  const { data: career } = useQuery({
    queryKey: ["iplCareer", player.id],
    queryFn: () => fantasyApi.career(player.id),
    staleTime: 300000,
    enabled: !!player.id,
  })

  const hasCareer = career && career.matchesPlayed > 0
  const sp = normaliseSpecialism(player.specialism)

  const careerStats = hasCareer ? (() => {
    if (sp === "BOWLER") return [
      { label: "MATCHES", value: career.matchesPlayed,              color: "text-sky-300" },
      { label: "WICKETS", value: career.totalWickets,               color: "text-rose-300" },
      { label: "ECONOMY", value: career.bowlingEconomy.toFixed(1),  color: "text-amber-300" },
    ]
    if (sp === "ALLROUNDER") return [
      { label: "MATCHES", value: career.matchesPlayed, color: "text-sky-300" },
      { label: "RUNS",    value: career.totalRuns,     color: "text-violet-300" },
      { label: "WICKETS", value: career.totalWickets,  color: "text-rose-300" },
    ]
    if (sp === "WICKETKEEPER") return [
      { label: "MATCHES",    value: career.matchesPlayed,                          color: "text-sky-300" },
      { label: "RUNS",       value: career.totalRuns,                              color: "text-violet-300" },
      { label: "DISMISSALS", value: career.totalCatches + career.totalStumpings,   color: "text-amber-300" },
    ]
    return [
      { label: "MATCHES", value: career.matchesPlayed,          color: "text-sky-300" },
      { label: "RUNS",    value: career.totalRuns,               color: "text-violet-300" },
      { label: "SR",      value: career.strikeRate.toFixed(1),   color: "text-emerald-300" },
    ]
  })() : null

  return (
    <div className="ar-hero rounded-xl overflow-hidden border border-stone-200 shadow-sm h-full flex flex-col"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)" }}>
      <div className="px-5 pt-5 pb-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black tracking-tight truncate text-white">{player.name}</h2>
            {player.country && (
              <p className="text-stone-300 text-sm mt-1">
                🌍 {player.country}{player.age ? ` · Age ${player.age}` : ""}
              </p>
            )}
            <div className="flex gap-2 mt-2 flex-wrap">
              {player.specialism && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${st.bg} ${st.text} ${st.border}`}>
                  {player.specialism}
                </span>
              )}
              {player.iplTeam && (
                <span className="text-xs px-2.5 py-1 rounded-full font-bold border bg-white/10 text-stone-300 border-white/10">
                  {player.iplTeam}
                </span>
              )}
            </div>
          </div>
          <TimerRing seconds={seconds} total={total} biddingOpen={biddingOpen} paused={paused} />
        </div>

        {(battingStyle || bowlingStyle || player.basePrice) && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {battingStyle && (
              <div className="bg-white/5 rounded-xl px-2.5 py-2">
                <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-widest mb-0.5">Bat</p>
                <p className="text-xs font-semibold text-white leading-tight">{battingStyle}</p>
              </div>
            )}
            {bowlingStyle && (
              <div className="bg-white/5 rounded-xl px-2.5 py-2">
                <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-widest mb-0.5">Bowl</p>
                <p className="text-xs font-semibold text-white leading-tight">{bowlingStyle}</p>
              </div>
            )}
            {player.basePrice && (
              <div className="bg-white/5 rounded-xl px-2.5 py-2">
                <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-widest mb-0.5">Base</p>
                <p className="text-xs font-black text-amber-400">{fmt(Number(player.basePrice))}</p>
              </div>
            )}
          </div>
        )}

        {hasCareer && (
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {[
              { label: "4s",   value: career.totalFours,    cls: "text-white" },
              { label: "6s",   value: career.totalSixes,    cls: "text-white" },
              { label: "HS",   value: career.highScore,     cls: "text-emerald-400" },
              { label: "FPts", value: career.fantasyPoints, cls: "text-amber-400" },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-white/5 rounded-xl px-2 py-1.5 text-center">
                <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-widest">{label}</p>
                <p className={`text-xs font-black tabular-nums ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 grid grid-cols-3 divide-x divide-white/10 mt-auto">
        {careerStats
          ? careerStats.map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center py-3.5">
              <span className={`text-xl font-black tabular-nums ${color}`}>{value}</span>
              <span className="text-[10px] text-stone-400 font-semibold tracking-widest">{label}</span>
            </div>
          ))
          : [
            { label: "TEST", value: player.testCaps ?? 0, color: "text-sky-300" },
            { label: "ODI",  value: player.odiCaps ?? 0,  color: "text-violet-300" },
            { label: "T20",  value: player.t20Caps ?? 0,  color: "text-amber-300" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`flex flex-col items-center py-3.5 ${value > 0 ? "opacity-100" : "opacity-35"}`}>
              <span className={`text-xl font-black tabular-nums ${value > 0 ? color : "text-slate-500"}`}>
                {value > 0 ? value : "—"}
              </span>
              <span className="text-[10px] text-stone-400 font-semibold tracking-widest">{label}</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ─── UPCOMING PLAYERS PANEL ───────────────────────────────────────────────

function UpcomingPlayers({ upcomingPlayers, currentPlayerId }: {
  upcomingPlayers: Player[]; currentPlayerId?: string
}) {
  const needsFallback = upcomingPlayers.length === 0
  const { data: allPlayers } = useQuery({
    queryKey: ["players", { getAll: true }],
    queryFn: () => import("@/lib/playerApi").then(m => m.playerApi.list({ getAll: true })),
    refetchInterval: 8000,
    staleTime: 0,
    enabled: needsFallback,
    placeholderData: (prev) => prev,
  })
  const display = needsFallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (allPlayers ?? [] as Player[]).filter((p: any) => !p.auctioned && p.id !== currentPlayerId)
        .sort((a: Player, b: Player) => Number(b.basePrice) - Number(a.basePrice)).slice(0, 5)
    : upcomingPlayers.filter(p => p.id !== currentPlayerId).slice(0, 5)
  if (display.length === 0) return null
  return (
    <div className="rounded-xl border border-stone-200 bg-white shrink-0">
      <div className="px-4 pt-3.5 pb-2 border-b border-stone-100">
        <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Up Next</span>
      </div>
      <div className="divide-y divide-stone-50 overflow-y-auto">
        {display.map((p: Player, i: number) => {
          const st = specialismStyle(p.specialism)
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors">
              <span className="text-[11px] font-semibold text-stone-300 w-4 shrink-0">{i + 1}</span>
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${st.dot}`} />
              <span className="text-sm font-semibold text-stone-700 flex-1 truncate">{p.name}</span>
              <span className="text-xs font-black text-amber-600 tabular-nums shrink-0">{fmt(Number(p.basePrice))}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── RADIAL CHART ─────────────────────────────────────────────────────────

function RadialChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null
  const r = 30; const circ = 2 * Math.PI * r; let offset = 0
  const arcs = segments.map(seg => {
    const pct = seg.value / total; const dash = pct * circ; const gap = circ - dash
    const arc = { ...seg, dash, gap, offset }; offset += dash; return arc
  })
  return (
    <div className="flex items-center gap-2">
      <svg width="52" height="52" viewBox="0 0 80 80" className="shrink-0 -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
        {arcs.map((arc, i) => (
          <circle key={i} cx="40" cy="40" r={r} fill="none" stroke={arc.color} strokeWidth="10"
            strokeDasharray={`${arc.dash} ${arc.gap}`} strokeDashoffset={-arc.offset}
            style={{ transition: "stroke-dasharray 0.6s ease" }} />
        ))}
      </svg>
      <div className="flex flex-col gap-1 min-w-0">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-[9px] font-semibold text-stone-500 truncate">{seg.label}</span>
            <span className="text-[9px] font-black text-stone-600 ml-auto tabular-nums">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── BID HISTORY TABLE ────────────────────────────────────────────────────

function BidHistoryTable({ auctionId, mobileBudgetSlot }: {
  auctionId: string
  mobileBudgetSlot?: React.ReactNode
}) {
  const { data: allSquads } = useQuery({
    queryKey: ["allSquads", auctionId],
    queryFn: () => squadApi.allSquads(auctionId),
    refetchInterval: 8000,
    staleTime: 0,
    placeholderData: (prev) => prev,
  })
  const { data: allPlayersData } = useQuery({
    queryKey: ["players", { getAll: true }],
    queryFn: () => import("@/lib/playerApi").then(m => m.playerApi.list({ getAll: true })),
    refetchInterval: 3000,
    staleTime: 0,
    placeholderData: (prev) => prev,
  })

  type SquadPlayer = { id: string; name: string; specialism?: string; soldPrice?: number }
  type Squad      = { id?: string; name: string; participantId?: string; players?: SquadPlayer[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type RawPlayer  = { id: string; auctioned?: boolean; sold?: boolean; [key: string]: any }

  const allSales: { playerName: string; squadName: string; specialism?: string; soldPrice: number }[] = []
  ;(allSquads as Squad[] ?? []).forEach((sq: Squad) => {
    (sq.players ?? []).forEach((p: SquadPlayer) => {
      if (p.soldPrice != null && p.soldPrice > 0)
        allSales.push({ playerName: p.name, squadName: sq.name, specialism: p.specialism, soldPrice: p.soldPrice })
    })
  })
  allSales.reverse()

  const allPlayers   = (allPlayersData as RawPlayer[] | undefined) ?? []
  const totalPlayers = allPlayers.length
  const soldPlayerIds = new Set((allSquads as Squad[] ?? []).flatMap(sq => (sq.players ?? []).map(p => p.id)))
  const soldCount      = soldPlayerIds.size
  const unsoldCount    = allPlayers.filter(p => p.auctioned === true && !soldPlayerIds.has(p.id)).length
  const remainingCount = Math.max(0, totalPlayers - soldCount - unsoldCount)

  const SPEC_COLORS: Record<string, string> = {
    BATSMAN: "#38bdf8", BOWLER: "#fb7185", ALLROUNDER: "#a78bfa", WICKETKEEPER: "#fbbf24",
  }

  const specialismCount: Record<string, number> = {}
  allSales.forEach(s => {
    const sp = normaliseSpecialism(s.specialism) || "Unknown"
    specialismCount[sp] = (specialismCount[sp] ?? 0) + 1
  })
  const radialSegments = Object.entries(specialismCount).map(([label, value]) => ({
    label, value, color: SPEC_COLORS[label] ?? "#94a3b8",
  }))

  const statCards = [
    { label: "Sold",      val: soldCount,      sub: `of ${totalPlayers}`, pct: soldCount / Math.max(totalPlayers, 1),      cls: "border-emerald-200 bg-emerald-50", txt: "text-emerald-600", bar: "bg-emerald-400", lbl: "text-emerald-400" },
    { label: "Unsold",    val: unsoldCount,    sub: `of ${totalPlayers}`, pct: unsoldCount / Math.max(totalPlayers, 1),    cls: "border-red-200 bg-red-50",         txt: "text-red-500",     bar: "bg-red-400",     lbl: "text-red-400" },
    { label: "Remaining", val: remainingCount, sub: `of ${totalPlayers}`, pct: remainingCount / Math.max(totalPlayers, 1), cls: "border-stone-200 bg-stone-50",     txt: "text-stone-700",   bar: "bg-stone-400",   lbl: "text-stone-400" },
  ]

  return (
    <div className="flex flex-col gap-2 h-full min-h-0 overflow-hidden">

      {/* ── Stat grid ── */}
      <div className="ar-stat-grid grid grid-cols-4 gap-2 shrink-0">
        {statCards.map(({ label, val, sub, pct, cls, txt, bar, lbl }) => (
          <div key={label} className={`rounded-lg border px-3 py-2 ${cls}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${lbl}`}>{label}</p>
            <p className={`text-lg font-black tabular-nums leading-tight ${txt}`}>{val}</p>
            <p className={`text-[9px] font-semibold ${lbl}`}>{sub}</p>
            {totalPlayers > 0 && (
              <div className="mt-1 h-0.5 rounded-full bg-white/60 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${Math.min(pct * 100, 100)}%` }} />
              </div>
            )}
          </div>
        ))}
        {radialSegments.length > 0 ? (
          <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
            <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-widest mb-1">By Role</p>
            <RadialChart segments={radialSegments} />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-2 flex items-center justify-center">
            <p className="text-[10px] text-stone-400 italic">No sales yet</p>
          </div>
        )}
      </div>

      {mobileBudgetSlot}

      {/* ── Bid History ── */}
      <div className="rounded-xl border border-stone-200 bg-white flex flex-col flex-1 min-h-0">
        <div className="px-4 pt-3.5 pb-2 border-b border-stone-100 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Bid History</span>
          {soldCount > 0 && <span className="text-[10px] font-semibold text-stone-400">{soldCount} sold</span>}
        </div>
        {allSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <span className="text-2xl opacity-30">🏏</span>
            <p className="text-xs text-stone-300 italic">No players sold yet</p>
          </div>
        ) : (
          <div className="ar-bid-list divide-y divide-stone-50 overflow-y-auto flex-1">
            {allSales.map((s, i) => {
              const color = SPEC_COLORS[normaliseSpecialism(s.specialism)] ?? "#94a3b8"
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 transition-colors">
                  <div className="w-1 h-8 rounded-full shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-stone-700 truncate">{s.playerName}</p>
                    <p className="text-[10px] text-stone-400 truncate">→ {s.squadName}</p>
                  </div>
                  <span className="text-xs font-black text-emerald-600 tabular-nums shrink-0">{fmt(s.soldPrice)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SQUAD CARD ───────────────────────────────────────────────────────────

function SquadCard({ squad, isMe, expanded, onToggle, remainingBudget }: {
  squad: { id?: string; name: string; participantId?: string; players?: { id: string; name: string; specialism?: string; soldPrice?: number }[] }
  isMe: boolean; expanded: boolean; onToggle: () => void; remainingBudget?: number | null
}) {
  const players = squad.players ?? []
  const spent = players.reduce((s, p) => s + (p.soldPrice ?? 0), 0)
  return (
    <div onClick={onToggle}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer ${
        isMe
          ? "border-emerald-300 bg-emerald-50 shadow-[0_2px_12px_rgba(16,185,129,0.15)]"
          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
      }`}>
      <div className="px-3.5 py-3 flex items-center justify-between gap-2 bg-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isMe ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className={`font-bold text-sm truncate ${isMe ? "text-emerald-700" : "text-slate-700"}`}>{squad.name}</span>
          {isMe && <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full shrink-0">YOU</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold tabular-nums ${players.length >= MAX_SQUAD_SIZE ? "text-red-500" : isMe ? "text-emerald-600" : "text-slate-400"}`}>
            {players.length}/{MAX_SQUAD_SIZE}
          </span>
          {players.length >= MAX_SQUAD_SIZE && (
            <span className="text-[9px] font-black bg-red-100 text-red-500 border border-red-200 px-1.5 py-0.5 rounded-full shrink-0">FULL</span>
          )}
          <svg className={`w-3 h-3 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <div className="px-3.5 pb-2.5 flex items-center justify-between gap-2">
        <span className="text-[11px] text-stone-400">
          Spent: <span className={`font-semibold ${isMe ? "text-emerald-600" : "text-slate-600"}`}>{fmt(spent)}</span>
        </span>
        {remainingBudget != null && (
          <span className="text-[11px] text-stone-400">
            Left: <span className={`font-semibold tabular-nums ${
              remainingBudget < 10_000_000 ? "text-red-500" : remainingBudget < 50_000_000 ? "text-amber-500" : "text-indigo-600"
            }`}>{fmt(remainingBudget)}</span>
          </span>
        )}
      </div>
      {expanded && (
        <div className="border-t border-stone-100">
          {players.length === 0
            ? <p className="text-center py-3 text-xs text-stone-400 italic">No players yet</p>
            : <div className="divide-y divide-stone-50 max-h-48 overflow-y-auto">
              {players.map(p => {
                const st = specialismStyle(p.specialism)
                return (
                  <div key={p.id} className="flex items-center justify-between px-3.5 py-2 hover:bg-stone-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-stone-700 truncate">{p.name}</p>
                      {p.specialism && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${st.bg} ${st.text} ${st.border}`}>
                          {p.specialism}
                        </span>
                      )}
                    </div>
                    {p.soldPrice != null && (
                      <span className="text-[11px] font-black text-emerald-600 tabular-nums ml-2">{fmt(p.soldPrice)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          }
        </div>
      )}
    </div>
  )
}

// ─── UNSOLD CONFIRM MODAL ─────────────────────────────────────────────────

function UnsoldConfirmModal({ open, playerName, basePrice, onConfirm, onCancel }: {
  open: boolean; playerName: string; basePrice: number; onConfirm: () => void; onCancel: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center">
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm"
        style={{ animation: "unsoldFadeIn 0.18s ease" }} onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-3xl overflow-hidden shadow-2xl"
        style={{
          animation: "unsoldSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)",
          background: "linear-gradient(160deg, #1c1917 0%, #292524 60%, #1c1917 100%)",
          border: "1px solid rgba(251,191,36,0.25)",
        }}>
        <div style={{ height: "3px", background: "linear-gradient(90deg, transparent, #f59e0b, #ef4444, #f59e0b, transparent)" }} />
        <div className="px-7 pt-8 pb-7 text-center">
          <div className="relative inline-flex items-center justify-center mb-5">
            <div className="absolute w-20 h-20 rounded-full" style={{ background: "radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)", animation: "unsoldPulse 2s ease-in-out infinite" }} />
            <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-4xl"
              style={{ background: "linear-gradient(135deg, #292524, #3a3330)", border: "1px solid rgba(239,68,68,0.3)" }}>🏏</div>
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-400 mb-2">Going Unsold</p>
          <h2 className="text-2xl font-black text-white leading-tight mb-1">{playerName}</h2>
          <p className="text-sm text-stone-400">Base price: <span className="font-black text-amber-400">{fmt(basePrice)}</span></p>
          <p className="text-xs text-stone-500 mt-3 leading-relaxed">
            No bids placed. Marking as <span className="text-red-400 font-bold">unsold</span> and moving to the next player.
          </p>
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08))" }} />
            <span className="text-[10px] text-stone-600 font-semibold tracking-widest">CONFIRM?</span>
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.08), transparent)" }} />
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "#a8a29e", border: "1px solid rgba(255,255,255,0.08)" }}>
              ← Cancel
            </button>
            <button onClick={onConfirm} className="flex-1 py-3 rounded-2xl text-sm font-black text-white transition-all"
              style={{ background: "linear-gradient(135deg, #dc2626, #b91c1c)", border: "1px solid rgba(239,68,68,0.4)", boxShadow: "0 4px 20px rgba(239,68,68,0.35)" }}>
              Mark Unsold →
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes unsoldFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes unsoldSlideUp { from { opacity: 0; transform: translateY(24px) scale(0.94) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes unsoldPulse   { 0%,100% { transform: scale(1); opacity: 0.7 } 50% { transform: scale(1.2); opacity: 1 } }
      `}</style>
    </div>
  )
}

// ─── HAMMER DIALOG ────────────────────────────────────────────────────────

function ManualHammerDialog({ open, onOpenChange, currentPlayer, participants, participantsLoading, allSquads, onHammer, isPending }: {
  open: boolean; onOpenChange: (v: boolean) => void; currentPlayer: Player | null
  participants: { id: string; name: string; walletBalance?: number }[] | undefined
  participantsLoading: boolean
  allSquads: { participantId?: string; players?: unknown[] }[] | undefined
  onHammer: (data: { participantId: string; finalAmount: number }) => void
  isPending: boolean
}) {
  const selectedParticipantId = useAuctionRoomStore(s => s.hammerParticipantId)
  const setSelectedParticipantId = useAuctionRoomStore(s => s.setHammerParticipantId)
  const amount = useAuctionRoomStore(s => s.hammerAmount)
  const setAmount = useAuctionRoomStore(s => s.setHammerAmount)
  const rawInput = useAuctionRoomStore(s => s.hammerRawInput)
  const setRawInput = useAuctionRoomStore(s => s.setHammerRawInput)
  const inputError = useAuctionRoomStore(s => s.hammerInputError)
  const setInputError = useAuctionRoomStore(s => s.setHammerInputError)

  useEffect(() => {
    if (open) { setSelectedParticipantId(""); setAmount(null); setRawInput(""); setInputError("") }
  }, [open])

  const handleRawInput = (val: string) => {
    setRawInput(val); setInputError("")
    if (!val.trim()) { setAmount(null); return }
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) setAmount(Math.round(num * 10_000_000))
    else { setAmount(null); setInputError("Enter a valid number") }
  }
  const handleQuickAmount = (value: number) => {
    setAmount(value); setRawInput(String(value / 10_000_000)); setInputError("")
  }

  const basePrice = Number(currentPlayer?.basePrice ?? 0)
  const belowBase = Number(amount) > 0 && Number(amount) < basePrice
  const selectedSquad = (allSquads ?? []).find(s => s.participantId === selectedParticipantId)
  const selectedSquadFull = (selectedSquad?.players?.length ?? 0) >= MAX_SQUAD_SIZE
  const canSubmit = !isPending && !!currentPlayer && Number(amount) > 0 && !belowBase && !!selectedParticipantId && !inputError && !selectedSquadFull

  const QUICK_AMOUNTS = [
    { label: "50L",  value: 5_000_000   }, { label: "1Cr",  value: 10_000_000  },
    { label: "2Cr",  value: 20_000_000  }, { label: "5Cr",  value: 50_000_000  },
    { label: "10Cr", value: 100_000_000 }, { label: "15Cr", value: 150_000_000 },
    { label: "20Cr", value: 200_000_000 }, { label: "25Cr", value: 250_000_000 },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[calc(100vw-32px)] bg-white border-stone-200 text-stone-800 shadow-2xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-black">🔨 Hammer</DialogTitle>
            <div className="text-right mr-6">
              <p className="font-bold text-stone-700 text-sm">{currentPlayer?.name ?? "—"}</p>
              <p className="text-xs text-slate-400">Base: <span className="font-bold text-amber-600">{fmt(basePrice)}</span></p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Quick select */}
          <div>
            <p className="text-xs font-semibold text-stone-400 mb-2 uppercase tracking-wider">Quick Select</p>
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_AMOUNTS.map(({ label, value }) => (
                <button key={label} onClick={() => handleQuickAmount(value)}
                  className={`py-2 w-full rounded-xl text-xs font-black transition-all border whitespace-nowrap ${
                    Number(amount) === value
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                      : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700"
                  }`}>
                  ₹{label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom amount + participant — stacked on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <div>
              <p className="text-xs font-semibold text-stone-400 mb-1.5 uppercase tracking-wider">Custom Amount (Crore)</p>
              <div className="relative">
                <Input placeholder="e.g. 0.25 or 1.5" value={rawInput} onChange={e => handleRawInput(e.target.value)}
                  className={`bg-stone-50 pr-10 ${inputError ? "border-red-300 focus-visible:ring-red-300" : "border-stone-200"}`} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-stone-400">Cr</span>
              </div>
              <div className="mt-1.5 min-h-5">
                {inputError
                  ? <p className="text-xs text-red-500 font-medium">{inputError}</p>
                  : Number(amount) > 0
                    ? <p className="text-sm font-black text-amber-500">= {fmt(Number(amount))}</p>
                    : <p className="text-xs text-stone-300">0.25 Cr = ₹25L</p>}
                {belowBase && <p className="text-xs text-red-500 font-semibold mt-0.5">⚠️ Below base price</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-400 mb-1.5 uppercase tracking-wider">Participant</p>
              {participantsLoading
                ? <p className="text-xs text-stone-400 italic">Loading…</p>
                : (participants ?? []).length === 0
                  ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center">
                      <p className="text-xs text-slate-400">No participants yet.</p>
                    </div>
                  : <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                      <SelectTrigger className="bg-stone-50 border-stone-200 w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {(participants ?? []).map(p => {
                          const sq = (allSquads ?? []).find(s => s.participantId === p.id)
                          const full = (sq?.players?.length ?? 0) >= MAX_SQUAD_SIZE
                          return (
                            <SelectItem key={p.id} value={p.id} disabled={full}>
                              <div className="flex items-center justify-between gap-3 w-full">
                                <span className={`font-semibold ${full ? "text-slate-300" : ""}`}>{p.name}</span>
                                {full
                                  ? <span className="text-[9px] font-black text-red-400 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">FULL</span>
                                  : p.walletBalance != null
                                    ? <span className="text-xs text-slate-400">{fmt(p.walletBalance)}</span>
                                    : null}
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
              }
              {selectedSquadFull && (
                <p className="text-xs text-red-500 font-semibold mt-1">⚠️ Squad full ({MAX_SQUAD_SIZE}/{MAX_SQUAD_SIZE})</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black" disabled={!canSubmit}
              onClick={() => onHammer({ participantId: selectedParticipantId, finalAmount: Number(amount) })}>
              {isPending ? "Hammering…" : "🔨 Hammer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── ADD PARTICIPANT DIALOG ───────────────────────────────────────────────

function AddParticipantDialog({ open, onOpenChange, auctionId, onAdded }: {
  open: boolean; onOpenChange: (v: boolean) => void; auctionId: string; onAdded: () => void
}) {
  const search = useAuctionRoomStore(s => s.addSearch);         const setSearch      = useAuctionRoomStore(s => s.setAddSearch)
  const newName = useAuctionRoomStore(s => s.addNewName);       const setNewName     = useAuctionRoomStore(s => s.setAddNewName)
  const showNewForm = useAuctionRoomStore(s => s.addShowNewForm); const setShowNewForm = useAuctionRoomStore(s => s.setAddShowNewForm)
  useEffect(() => { if (open) { setSearch(""); setNewName(""); setShowNewForm(false) } }, [open])

  const { data: allParticipants, isLoading } = useQuery({
    queryKey: ["allParticipants"],
    queryFn: () => participantApi.getAll(),
    enabled: open,
    staleTime: 30000,
  })
  const { data: auctionSquads } = useQuery({
    queryKey: ["allSquads", auctionId],
    queryFn: () => import("@/lib/squadApi").then(m => m.squadApi.allSquads(auctionId)),
    enabled: open,
    staleTime: 0,
    placeholderData: (prev) => prev,
  })
  const alreadyInAuction = new Set((auctionSquads ?? []).map((s: { participantId?: string }) => s.participantId).filter(Boolean))
  const filtered = (allParticipants ?? []).filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  const addMutation = useMutation({
    mutationFn: (data: { participantId?: string; newParticipantName?: string }) => participantApi.addToAuction(auctionId, data),
    onSuccess: () => { onAdded(); onOpenChange(false) },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border-stone-200 text-slate-800 shadow-2xl">
        <DialogHeader><DialogTitle className="text-lg font-black">＋ Add Participant</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-1">
          <div>
            <p className="text-xs font-semibold text-stone-400 mb-1.5 uppercase tracking-wider">Search Existing</p>
            <Input placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} className="bg-slate-50 border-slate-200" />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-lg border border-stone-100 divide-y divide-stone-50">
            {isLoading
              ? <p className="text-xs text-slate-400 italic text-center py-4">Loading…</p>
              : filtered.length === 0
                ? <p className="text-xs text-slate-400 italic text-center py-4">No participants found</p>
                : filtered.map(p => {
                  const inAuction = alreadyInAuction.has(p.id)
                  return (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-stone-50">
                      <span className="text-sm font-semibold text-stone-700">{p.name}</span>
                      {inAuction
                        ? <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">In auction</span>
                        : <button disabled={addMutation.isPending} onClick={() => addMutation.mutate({ participantId: p.id })}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all disabled:opacity-40">
                            Add →
                          </button>}
                    </div>
                  )
                })
            }
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-stone-200" />
            <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">or create new</span>
            <div className="flex-1 border-t border-stone-200" />
          </div>
          {!showNewForm
            ? <button onClick={() => setShowNewForm(true)} className="w-full py-2.5 rounded-lg border-2 border-dashed border-emerald-300 text-emerald-700 text-sm font-bold hover:bg-emerald-50 transition-all">
                ＋ Create New Participant
              </button>
            : <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">New Participant</p>
                <Input autoFocus placeholder="e.g. Rohit Sharma" value={newName} onChange={e => setNewName(e.target.value)} className="bg-white border-emerald-200" />
                <p className="text-[11px] text-emerald-600">Squad named <span className="font-bold">"{newName || "…"}"</span> will be auto-created with ₹100Cr budget.</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setShowNewForm(false); setNewName("") }} className="flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">Cancel</button>
                  <button disabled={!newName.trim() || addMutation.isPending} onClick={() => addMutation.mutate({ newParticipantName: newName.trim() })}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black disabled:opacity-40 transition-all">
                    {addMutation.isPending ? "Creating…" : "Create & Add"}
                  </button>
                </div>
              </div>
          }
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── BUDGET OVERVIEW ──────────────────────────────────────────────────────

function BudgetOverview({ allSquads, walletMap, expandedSquad, setExpandedSquad }: {
  allSquads: { id?: string; name: string; participantId?: string; players?: { id: string; name: string; specialism?: string; soldPrice?: number }[] }[] | undefined
  walletMap: Record<string, number | null> | undefined
  expandedSquad: string | null
  setExpandedSquad: (id: string | null) => void
}) {
  const rows = (allSquads ?? []).map((s, i) => {
    const spent     = (s.players ?? []).reduce((acc, p) => acc + (p.soldPrice ?? 0), 0)
    const remaining = s.participantId ? (walletMap?.[s.participantId] ?? null) : null
    const total     = remaining != null ? spent + remaining : spent
    const key       = s.id ?? s.name
    return {
      key, name: s.name, spent,
      remaining: remaining ?? 0,
      total: total || 1_000_000_000,
      players: s.players ?? [],
      color: TEAM_COLORS[i % TEAM_COLORS.length],
    }
  }).sort((a, b) => b.spent - a.spent)

  if (rows.length === 0) return null

  return (
    <div className="ar-budget rounded-xl border border-stone-200 bg-white shrink-0 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Teams</p>
        <span className="text-[10px] text-stone-300 font-semibold">
          {rows.length} teams · {rows.reduce((a, r) => a + r.players.length, 0)} players
        </span>
      </div>
      <div className="divide-y divide-slate-50">
        {rows.map((row, i) => {
          const spentPct   = Math.min((row.spent / row.total) * 100, 100)
          const remainPct  = Math.min((row.remaining / row.total) * 100, 100)
          const isTopSpender = i === 0 && row.spent > 0
          const isExpanded   = expandedSquad === row.key
          return (
            <div key={row.key}>
              <button className="w-full text-left px-4 py-2.5 hover:bg-stone-50 transition-colors"
                onClick={() => setExpandedSquad(isExpanded ? null : row.key)}>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                    <span className="text-xs font-bold text-stone-700 truncate">{row.name}</span>
                    {isTopSpender && (
                      <span className="text-[8px] font-black bg-amber-100 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">TOP</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold text-stone-400 tabular-nums">{row.players.length}/{MAX_SQUAD_SIZE}</span>
                    <span className="text-[10px] font-black tabular-nums" style={{ color: row.color }}>
                      {row.spent > 0 ? fmt(row.spent) : "—"}
                    </span>
                    <span className="text-[9px] text-slate-300">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${spentPct}%`, background: row.color, opacity: 0.9 }} />
                  <div className="h-full transition-all duration-700"             style={{ width: `${remainPct}%`, background: row.color, opacity: 0.15 }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] text-slate-300">spent</span>
                  <span className="text-[9px] font-semibold" style={{ color: row.color, opacity: 0.7 }}>
                    {row.remaining > 0 ? `${fmt(row.remaining)} left` : "—"}
                  </span>
                </div>
              </button>
              {isExpanded && (
                <div className="bg-stone-50 border-t border-stone-100 px-4 py-2 space-y-1 max-h-48 overflow-y-auto">
                  {row.players.length === 0
                    ? <p className="text-xs text-slate-300 italic py-1">No players yet</p>
                    : row.players.map(p => {
                      const st = specialismStyle(p.specialism)
                      const spLabel = normaliseSpecialism(p.specialism)
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 py-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${st.bg} ${st.text} ${st.border} shrink-0`}>
                              {spLabel === "WICKETKEEPER" ? "WK" : spLabel === "ALLROUNDER" ? "AR" : spLabel === "BOWLER" ? "BWL" : "BAT"}
                            </span>
                            <span className="text-xs text-stone-600 font-semibold truncate">{p.name}</span>
                          </div>
                          <span className="text-[10px] font-black tabular-nums text-stone-500 shrink-0">
                            {p.soldPrice ? fmt(p.soldPrice) : "—"}
                          </span>
                        </div>
                      )
                    })
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── ADD PARTICIPANT NAV BUTTON ───────────────────────────────────────────

function AddParticipantNavButton({ auctionId }: { auctionId: string }) {
  const queryClient = useQueryClient()
  const setShowAddParticipant = useAuctionRoomStore(s => s.setShowAddParticipant)
  const showAddParticipant    = useAuctionRoomStore(s => s.showAddParticipant)
  return (
    <>
      <button onClick={() => setShowAddParticipant(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 transition-all">
        ＋ Add Participant
      </button>
      <AddParticipantDialog open={showAddParticipant} onOpenChange={setShowAddParticipant} auctionId={auctionId}
        onAdded={() => {
          queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
          queryClient.invalidateQueries({ queryKey: ["participants", auctionId] })
        }} />
    </>
  )
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────

function AdminPanel({ auctionId, onEnd }: { auctionId: string; onEnd: () => void }) {
  const queryClient = useQueryClient()
  const confirmEnd        = useAuctionRoomStore(s => s.confirmEnd);        const setConfirmEnd        = useAuctionRoomStore(s => s.setConfirmEnd)
  const showManualHammer  = useAuctionRoomStore(s => s.showManualHammer);  const setShowManualHammer  = useAuctionRoomStore(s => s.setShowManualHammer)
  const expandedSquad     = useAuctionRoomStore(s => s.expandedSquad);     const setExpandedSquad     = useAuctionRoomStore(s => s.setExpandedSquad)
  const showUnsoldConfirm = useAuctionRoomStore(s => s.showUnsoldConfirm); const setShowUnsoldConfirm = useAuctionRoomStore(s => s.setShowUnsoldConfirm)

  const { data: engineState } = useQuery({
    queryKey: ["engineState", auctionId],
    queryFn: () => auctionEngineApi.state(auctionId),
    refetchInterval: 2500,
    staleTime: 2000,
  })
  const currentPlayer     = engineState?.currentPlayer ?? null
  const poolExhausted     = engineState?.poolExhausted ?? false
  const biddingOpen       = engineState?.biddingOpen ?? false
  const analysisSeconds   = engineState?.analysisSeconds ?? 0
  const analysisTotalSecs = engineState?.analysisTotalSecs ?? 0

  const { data: allSquads } = useQuery({
    queryKey: ["allSquads", auctionId],
    queryFn: () => squadApi.allSquads(auctionId),
    refetchInterval: 8000,
    staleTime: 0,
    placeholderData: (prev) => prev,
  })
  const { data: participants, isLoading: participantsLoading } = useQuery({
    queryKey: ["participants", auctionId],
    queryFn: () => hammerApi.getParticipants(auctionId),
    refetchInterval: 10000,
    staleTime: 8000,
  })
  const { data: walletMap } = useWalletMap(auctionId, allSquads)
  const squadsForEndCheck = (allSquads ?? []) as {
    name: string
    participantId?: string
    players?: unknown[]
  }[]
  const squadsBelowMin = squadsForEndCheck.filter(
    (s) => (s.players?.length ?? 0) < MIN_SQUAD_SIZE,
  )
  const squadsBelowMinBudgetExhausted = squadsBelowMin.filter((s) => {
    if (!s.participantId) return false
    const remaining = walletMap?.[s.participantId]
    return remaining != null && remaining <= 0
  })
  const squadsBelowMinWithBudgetLeft = squadsBelowMin.filter((s) => {
    if (!s.participantId) return true
    const remaining = walletMap?.[s.participantId]
    return remaining == null || remaining > 0
  })
  const canEndAuction = squadsBelowMinWithBudgetLeft.length === 0

  const endAuction = useMutation({
    mutationFn: () => auctionApi.end(auctionId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["auction", auctionId] }); onEnd() },
  })
  const activatePool = useMutation({
    mutationFn: (poolType: string) => auctionPoolApi.activatePool(auctionId, poolType),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] }),
  })
  const nextPlayer = useMutation({
    mutationFn: () => auctionEngineApi.nextPlayer(auctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["players", { getAll: true }] })
    },
  })
  const startUnsoldRound = useMutation({
    mutationFn: () => auctionEngineApi.startUnsoldRound(auctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["players", { getAll: true }] })
    },
  })

  const orderedPools = [...(engineState?.pools ?? [])]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
  const allowedRoundPools = orderedPools.slice(0, 2)
  const activePoolType = engineState?.activePool ?? null
  const auctionRound = engineState?.auctionRound ?? 1
  const activePool = orderedPools.find(
    p =>
      allowedRoundPools.some(ap => ap.id === p.id) &&
      p.status === "ACTIVE",
  )
  const nextActivatablePool = allowedRoundPools.find(
    p =>
      p.poolType !== activePoolType &&
      (p.status === "PENDING" || p.status === "PAUSED"),
  )
  const canStartRound2 = poolExhausted && !currentPlayer && auctionRound < 2
  const canProceedToNextPlayer = Boolean(
    currentPlayer ||
    activePool ||
    nextActivatablePool,
  ) || canStartRound2
  const noMoreRounds = poolExhausted && !currentPlayer && auctionRound >= 2 && !nextActivatablePool
  const isStartingUnsoldRound = startUnsoldRound.isPending
  const getRoundLabel = (pool?: { id: string } | null) => {
    if (!pool) return null
    const idx = allowedRoundPools.findIndex(p => p.id === pool.id)
    return idx >= 0 ? idx + 1 : null
  }

  const doNextPlayer = async () => {
    if (!canProceedToNextPlayer) return

    // Backend requires explicit unsold-round start before queueing round 2 players.
    if (canStartRound2) {
      await startUnsoldRound.mutateAsync()
    }

    // Round-aware flow:
    // - Keep using currently active pool when present
    // - Otherwise move only into round 1/2 pools (unsold round as round 2)
    if (!activePool && nextActivatablePool) {
      await activatePool.mutateAsync(nextActivatablePool.poolType)
    }
    nextPlayer.mutate()
  }
  const handleNextPlayer = async () => {
    if (currentPlayer && !biddingOpen) { setShowUnsoldConfirm(true); return }
    await doNextPlayer()
  }
  const nextPlayerBusy = nextPlayer.isPending || activatePool.isPending || startUnsoldRound.isPending

  const manualHammer = useMutation({
    mutationFn: (data: { participantId: string; finalAmount: number }) =>
      hammerApi.manualHammer({ playerId: currentPlayer!.id, auctionId, ...data } as Parameters<typeof hammerApi.manualHammer>[0]),
    onSuccess: () => {
      setShowManualHammer(false)
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["participants", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["players", { getAll: true }] })
      queryClient.invalidateQueries({ queryKey: ["allWallets", auctionId] })
    },
  })

  return (
    <div className="ar-body flex-1 flex gap-0 overflow-hidden min-h-0 bg-[#f5f3ef]">
      <div className="ar-left-col flex-1 flex flex-col min-w-0 border-r border-stone-200 overflow-hidden">
        <div className="ar-left-inner flex gap-3 p-4 pb-2 shrink-0">
          <div className="flex-1 min-w-0 flex flex-col">
            {poolExhausted && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2 mb-2 shrink-0">
                <span>🏁</span><p className="text-xs font-semibold text-emerald-700">All players auctioned</p>
              </div>
            )}
            {currentPlayer
              ? <div className="flex-1">
                  {/* ✅ Fixed: admin now gets live timer too */}
                  <PlayerHeroCard
                    player={currentPlayer}
                    seconds={analysisSeconds}
                    total={analysisTotalSecs}
                    biddingOpen={biddingOpen}
                    battingStyle={currentPlayer.battingStyle}
                    bowlingStyle={currentPlayer.bowlingStyle}
                  />
                </div>
              : <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center flex-1 min-h-32">
                  <div className="text-center">
                    <div className="text-3xl mb-1">🏏</div>
                    <p className="text-xs font-semibold text-stone-400">Press Next Player to begin</p>
                  </div>
                </div>
            }
          </div>
          {currentPlayer && (
            <div className="ar-upcoming-wrap w-64 shrink-0 flex flex-col">
              <UpcomingPlayers upcomingPlayers={engineState?.upcomingPlayers ?? []} currentPlayerId={currentPlayer?.id} />
            </div>
          )}
        </div>
        <div className="flex-1 px-4 pb-4 min-h-0 overflow-hidden flex flex-col">
          <BidHistoryTable
            auctionId={auctionId}
            mobileBudgetSlot={
              <div className="ar-budget-mobile">
                <BudgetOverview allSquads={allSquads} walletMap={walletMap} expandedSquad={expandedSquad} setExpandedSquad={setExpandedSquad} />
              </div>
            }
          />
        </div>
      </div>

      <div className="ar-ctrl-col w-72 shrink-0 flex flex-col p-4 gap-3 border-r border-stone-200 overflow-y-auto overflow-x-hidden">
        <div className="rounded-xl border border-stone-200 bg-white shrink-0 overflow-hidden">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-4 pt-3.5 pb-2">Controls</p>
          <div className="px-3 pb-3 flex flex-col gap-2">
            <div className="text-[10px] font-semibold text-stone-400 px-1">
              {activePool
                ? `Round ${getRoundLabel(activePool) ?? 1}`
                : nextActivatablePool
                  ? `Next: Round ${getRoundLabel(nextActivatablePool) ?? 2}`
                  : canStartRound2
                    ? "Next: Round 2"
                  : "No more rounds"}
            </div>
            <div className="ar-ctrl-primary">
              <button onClick={handleNextPlayer} disabled={nextPlayerBusy || !canProceedToNextPlayer}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-sm transition-all shadow-sm">
                {isStartingUnsoldRound
                  ? "Starting round 2…"
                  : activatePool.isPending
                  ? "Starting round…"
                  : nextPlayer.isPending
                    ? "Loading…"
                    : noMoreRounds || !canProceedToNextPlayer
                      ? "All rounds complete"
                      : "⏭ Next Player"}
              </button>
              <button onClick={() => setShowManualHammer(true)}
                className="w-full py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-sm transition-all">
                🔨 Hammer
              </button>
            </div>
            <div className="border-t border-stone-100 pt-2">
              {!canEndAuction && (
                <p className="text-[11px] text-amber-600 font-semibold text-center mb-1.5">
                  Each squad needs at least {MIN_SQUAD_SIZE} players unless budget is exhausted ({squadsBelowMinWithBudgetLeft.length} still short with budget left).
                </p>
              )}
              {canEndAuction && squadsBelowMinBudgetExhausted.length > 0 && (
                <p className="text-[11px] text-amber-600 font-semibold text-center mb-1.5">
                  {squadsBelowMinBudgetExhausted.length} squad(s) are below {MIN_SQUAD_SIZE}, but budget is exhausted. You can still end.
                </p>
              )}
              {!confirmEnd
                ? <button onClick={() => setConfirmEnd(true)} disabled={!canEndAuction}
                    className="w-full py-2 rounded-lg bg-stone-50 hover:bg-red-50 border border-stone-200 hover:border-red-200 text-stone-400 hover:text-red-500 font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                    🏁 End Auction
                  </button>
                : <div className="space-y-1.5">
                    <p className="text-xs text-red-500 text-center font-semibold">Cannot be undone.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmEnd(false)} className="flex-1 py-1.5 rounded-lg bg-slate-50 border text-slate-500 text-xs font-bold hover:bg-slate-100">Cancel</button>
                      <button onClick={() => {
                        if (squadsBelowMinBudgetExhausted.length > 0) {
                          const names = squadsBelowMinBudgetExhausted
                            .map(s => s.name)
                            .slice(0, 8)
                            .join(", ")
                          const extra = squadsBelowMinBudgetExhausted.length > 8
                            ? ` +${squadsBelowMinBudgetExhausted.length - 8} more`
                            : ""
                          window.alert(
                            `Warning: Some squads are below ${MIN_SQUAD_SIZE} players but have exhausted budget.\n\n${names}${extra}`,
                          )
                        }
                        endAuction.mutate()
                        setConfirmEnd(false)
                      }} disabled={endAuction.isPending || !canEndAuction}
                        className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed">End</button>
                    </div>
                  </div>
              }
            </div>
          </div>
        </div>
        <div className="ar-budget-desktop">
          <BudgetOverview allSquads={allSquads} walletMap={walletMap} expandedSquad={expandedSquad} setExpandedSquad={setExpandedSquad} />
        </div>
      </div>

      <ManualHammerDialog open={showManualHammer} onOpenChange={setShowManualHammer}
        currentPlayer={currentPlayer} participants={participants} participantsLoading={participantsLoading}
        allSquads={allSquads} onHammer={data => manualHammer.mutate(data)} isPending={manualHammer.isPending} />

      <UnsoldConfirmModal
        open={showUnsoldConfirm}
        playerName={currentPlayer?.name ?? ""}
        basePrice={Number(currentPlayer?.basePrice ?? 0)}
        onCancel={() => setShowUnsoldConfirm(false)}
        onConfirm={async () => { setShowUnsoldConfirm(false); await doNextPlayer() }}
      />
    </div>
  )
}

// ─── PARTICIPANT VIEW ─────────────────────────────────────────────────────

function ParticipantView({
  auctionId,
  readOnly = false,
}: {
  auctionId: string
  me: { participantId: string; role: string; name: string }
  readOnly?: boolean
}) {
  const expandedSquad    = useAuctionRoomStore(s => s.expandedSquad)
  const setExpandedSquad = useAuctionRoomStore(s => s.setExpandedSquad)

  const { data: engineState } = useQuery({
    queryKey: ["engineState", auctionId],
    queryFn: () => auctionEngineApi.state(auctionId),
    refetchInterval: 2500,
    staleTime: 2000,
  })
  const currentPlayer     = engineState?.currentPlayer ?? null
  const biddingOpen       = engineState?.biddingOpen ?? false
  const analysisSeconds   = engineState?.analysisSeconds ?? 0
  const analysisTotalSecs = engineState?.analysisTotalSecs ?? 0

  const { data: auction } = useQuery({
    queryKey: ["auction", auctionId],
    queryFn: () => auctionApi.getById(auctionId),
    refetchInterval: 10000,
    staleTime: 8000,
  })
  const { data: allSquads } = useQuery({
    queryKey: ["allSquads", auctionId],
    queryFn: () => squadApi.allSquads(auctionId),
    refetchInterval: 8000,
    staleTime: 0,
    placeholderData: (prev) => prev,
  })
  const { data: walletMap } = useWalletMap(auctionId, allSquads)
  const isPaused = auction?.status === "PAUSED"

  const sortedSquads = [...(allSquads ?? [])].sort((a: { players?: unknown[] }, b: { players?: unknown[] }) =>
    (b.players?.length ?? 0) - (a.players?.length ?? 0)
  )

  return (
    <div className="ar-body flex-1 flex gap-0 overflow-hidden min-h-0 bg-[#f5f3ef]">
      <div className="ar-left-col flex-1 flex flex-col min-w-0 border-r border-stone-200 overflow-hidden">
        <div className="ar-left-inner flex gap-3 p-4 pb-2 shrink-0">
          <div className="flex-1 min-w-0 flex flex-col">
            {readOnly ? (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 flex items-center justify-center flex-1 min-h-32 px-4">
                <div className="text-center max-w-md">
                  <div className="text-3xl mb-2">🏁</div>
                  <p className="text-sm font-black text-emerald-900">Auction finished</p>
                  <p className="text-xs text-emerald-800/80 mt-1 font-medium">
                    Open <span className="font-black">Fantasy</span> from the header to see points per match and how each player earned them (batting, bowling, fielding).
                  </p>
                </div>
              </div>
            ) : currentPlayer ? (
              <div className="flex-1">
                <PlayerHeroCard
                  player={currentPlayer}
                  seconds={analysisSeconds}
                  total={analysisTotalSecs}
                  biddingOpen={biddingOpen}
                  paused={isPaused}
                  battingStyle={currentPlayer.battingStyle}
                  bowlingStyle={currentPlayer.bowlingStyle}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center flex-1 min-h-32">
                <div className="text-center">
                  <div className="text-3xl mb-1 animate-pulse">🏏</div>
                  <p className="text-xs text-slate-400 font-medium">Waiting for next player…</p>
                </div>
              </div>
            )}
          </div>
          {!readOnly && currentPlayer && (
            <div className="ar-upcoming-wrap w-64 shrink-0 flex flex-col">
              <UpcomingPlayers upcomingPlayers={engineState?.upcomingPlayers ?? []} currentPlayerId={currentPlayer?.id} />
            </div>
          )}
        </div>

        {/* ✅ Fixed: removed duplicate nested padding wrapper */}
        <div className="flex-1 px-4 pb-4 min-h-0 overflow-hidden flex flex-col">
          <BidHistoryTable
            auctionId={auctionId}
            mobileBudgetSlot={
              <div className="ar-budget-mobile">
                <BudgetOverview allSquads={allSquads} walletMap={walletMap} expandedSquad={expandedSquad} setExpandedSquad={setExpandedSquad} />
              </div>
            }
          />
        </div>
      </div>

      <div className="ar-squads-col w-64 shrink-0 flex flex-col bg-stone-50 border-l border-stone-200">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-slate-200/60">
          <div>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">All Squads</p>
            <p className="text-xs text-stone-600 mt-0.5 font-semibold">{sortedSquads.length} participants</p>
          </div>
          {!readOnly && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
          {sortedSquads.length === 0
            ? <div className="flex items-center justify-center h-full">
                <p className="text-xs text-stone-300 italic">No squads yet</p>
              </div>
            : sortedSquads.map((s: { id?: string; name: string; players?: unknown[]; participantId?: string }) => {
                const key       = s.id ?? s.name
                const remaining = s.participantId ? (walletMap?.[s.participantId] ?? null) : null
                return (
                  <SquadCard
                    key={key}
                    squad={s as Parameters<typeof SquadCard>[0]["squad"]}
                    isMe={false}
                    expanded={expandedSquad === key}
                    onToggle={() => setExpandedSquad(expandedSquad === key ? null : key)}
                    remainingBudget={remaining}
                  />
                )
              })
          }
        </div>
      </div>
    </div>
  )
}

// ─── ROOT PAGE ────────────────────────────────────────────────────────────

function AuctionRoomPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId/" })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const setSoldInfo               = useAuctionRoomStore(s => s.setSoldInfo)
  const lastSeenResultTimestamp   = useAuctionRoomStore(s => s.lastSeenResultTimestamp)
  const setLastSeenResultTimestamp= useAuctionRoomStore(s => s.setLastSeenResultTimestamp)
  const soldInfo                  = useAuctionRoomStore(s => s.soldInfo)

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: authApi.me, staleTime: 60000 })
  const { data: auction } = useQuery({
    queryKey: ["auction", auctionId],
    queryFn: () => auctionApi.getById(auctionId),
    refetchInterval: 10000,
    staleTime: 8000,
  })
  const { data: engineState } = useQuery({
    queryKey: ["engineState", auctionId],
    queryFn: () => auctionEngineApi.state(auctionId),
    refetchInterval: 2500,
    staleTime: 2000,
  })

  useEffect(() => {
    const result = engineState?.lastResult
    if (!result) return
    const ts = result.timestamp != null ? String(result.timestamp) : null
    if (ts == null || ts === lastSeenResultTimestamp) return
    setLastSeenResultTimestamp(ts)
    setSoldInfo({
      playerName: String(result.playerName ?? ""),
      squadName:  result.squadName != null ? String(result.squadName) : undefined,
      amount:     result.amount != null ? Number(result.amount) : undefined,
      unsold:     result.unsold != null ? Boolean(result.unsold) : undefined,
      timestamp: ts,
    })
    const t = setTimeout(() => setSoldInfo(null), result.unsold ? 1200 : 1800)
    return () => clearTimeout(t)
  }, [engineState?.lastResult?.timestamp])

  const isAdmin = me?.role === "ADMIN"
  const auctionEnded = auction?.status === "COMPLETED"
  const [showRemainingPlayers, setShowRemainingPlayers] = useState(false)
  const [showTradeCenter, setShowTradeCenter] = useState(false)
  const [fromSquadId, setFromSquadId] = useState("")
  const [toSquadId, setToSquadId] = useState("")
  const [fromPlayerA, setFromPlayerA] = useState("")
  const [fromPlayerB, setFromPlayerB] = useState("")
  const [toPlayerA, setToPlayerA] = useState("")
  const [toPlayerB, setToPlayerB] = useState("")
  const [cashFromToTo, setCashFromToTo] = useState("")
  const [cashToToFrom, setCashToToFrom] = useState("")
  const [tradeMode, setTradeMode] = useState<"TRADE" | "SELL" | "LOAN">("TRADE")
  const [remainingPage, setRemainingPage] = useState(0)
  const { data: allPlayersForRemaining } = useQuery({
    queryKey: ["players", { getAll: true }, "remainingModal", auctionId],
    queryFn: () => import("@/lib/playerApi").then(m => m.playerApi.list({ getAll: true })),
    enabled: showRemainingPlayers,
    staleTime: 0,
    placeholderData: (prev) => prev,
  })

  const statusChip = (() => {
    if (auctionEnded) {
      return (
        <div className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 rounded-full px-2.5 py-1">
          <span className="text-xs">✓</span>
          <span className="text-xs font-bold text-slate-600">Auction ended</span>
        </div>
      )
    }
    const pool   = engineState?.pools?.[0]
    const status = pool?.status
    if (status === "ACTIVE")        return <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" /><span className="text-xs font-bold text-emerald-700">Running</span></div>
    if (status === "COMPLETED")     return <div className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 rounded-full px-2.5 py-1"><span className="text-xs">✓</span><span className="text-xs font-bold text-slate-500">Round done</span></div>
    if (engineState?.poolExhausted) return <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1"><span className="text-xs">🏁</span><span className="text-xs font-bold text-indigo-600">All auctioned</span></div>
    return <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-full px-2.5 py-1"><span className="text-xs font-bold text-slate-400">Ready</span></div>
  })()

  const currentPlayerId = engineState?.currentPlayer?.id
  const remainingPlayersForModal = ((allPlayersForRemaining ?? []) as Player[])
    .filter((p: Player) => p.auctioned !== true && p.id !== currentPlayerId)
    .sort((a: Player, b: Player) => Number(b.basePrice ?? 0) - Number(a.basePrice ?? 0))
  const remainingPageSize = 50
  const remainingTotalPages = Math.ceil(remainingPlayersForModal.length / remainingPageSize)
  const remainingClampedPage =
    remainingTotalPages === 0 ? 0 : Math.min(remainingPage, remainingTotalPages - 1)
  const remainingStartIdx = remainingClampedPage * remainingPageSize
  const remainingEndIdx = Math.min(remainingStartIdx + remainingPageSize, remainingPlayersForModal.length)
  const remainingPageItems = remainingPlayersForModal.slice(remainingStartIdx, remainingEndIdx)
  const { data: allSquadsForTrades } = useQuery({
    queryKey: ["allSquads", auctionId, "tradeCenter"],
    queryFn: () => squadApi.allSquads(auctionId),
    enabled: auctionEnded,
    staleTime: 10000,
  })
  const { data: tradeRows } = useQuery({
    queryKey: ["trades", auctionId],
    queryFn: () => tradeApi.listByAuction(auctionId),
    enabled: auctionEnded && showTradeCenter,
    refetchInterval: 7000,
    staleTime: 3000,
  })
  const { data: tradeWalletMap } = useWalletMap(
    auctionId,
    (allSquadsForTrades ?? []) as Array<{ participantId?: string }>
  )
  const [showPhase2Dialog, setShowPhase2Dialog] = useState(false)
  const [phase2Status, setPhase2Status] = useState<{ squadsNeedingPlayers: number; squadsWithBudget: number } | null>(null)
  const [showReauctionConfirm, setShowReauctionConfirm] = useState(false)

  const startReauction = useMutation({
    mutationFn: () => auctionApi.startReauction(auctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allWallets", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] })
    },
    onError: (e: unknown) => {
      const msg =
        typeof e === "object" && e && "message" in e
          ? String((e as { message?: unknown }).message ?? "Failed to start re-auction")
          : "Failed to start re-auction"
      window.alert(msg)
    },
  })

  const startRemainingPool = useMutation({
    mutationFn: () => auctionEngineApi.startRemainingPool(auctionId),
    onSuccess: () => {
      setShowPhase2Dialog(false)
      setPhase2Status(null)
      queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] })
    },
    onError: (e: unknown) => {
      const msg =
        typeof e === "object" && e && "message" in e
          ? String((e as { message?: unknown }).message ?? "Failed to start pool phase")
          : "Failed to start pool phase"
      window.alert(msg)
    },
  })

  // Detect when re-auction Phase 1 exhausts and prompt admin for Phase 2
  useEffect(() => {
    if (
      engineState?.isReauctionMode &&
      engineState?.phase1Exhausted &&
      engineState?.poolExhausted &&
      !engineState?.currentPlayer &&
      me?.role === "ADMIN" &&
      !showPhase2Dialog
    ) {
      auctionEngineApi.getReauctionPhaseStatus(auctionId).then((status) => {
        if (status.squadsNeedingPlayers > 0 && status.squadsWithBudget > 0 && status.hasRemainingPoolPlayers) {
          setPhase2Status({ squadsNeedingPlayers: status.squadsNeedingPlayers, squadsWithBudget: status.squadsWithBudget })
          setShowPhase2Dialog(true)
        }
      }).catch(() => { /* ignore */ })
    }
  }, [engineState?.isReauctionMode, engineState?.phase1Exhausted, engineState?.poolExhausted, engineState?.currentPlayer, me?.role])

  const endAuctionFromPage = useMutation({
    mutationFn: () => auctionApi.end(auctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auction", auctionId] })
      navigate({ to: "/auction/$auctionId/fantasy", params: { auctionId } })
    },
  })

  const createTrade = useMutation({
    mutationFn: () => {
      const fromIds = [fromPlayerA, fromPlayerB].filter(Boolean)
      const toIds = tradeMode === "TRADE" ? [toPlayerA, toPlayerB].filter(Boolean) : []
      return tradeApi.create({
        auctionId,
        fromSquadId,
        toSquadId,
        fromPlayerIds: [...new Set(fromIds)],
        toPlayerIds: [...new Set(toIds)],
        cashFromToTo: toRupeesFromCr(cashFromToToCr),
        cashToToFrom: toRupeesFromCr(cashToToFromCr),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId] })
      setFromPlayerA(""); setFromPlayerB(""); setToPlayerA(""); setToPlayerB("")
      setCashFromToTo(""); setCashToToFrom("")
      setTradeMode("TRADE")
    },
    onError: (e: unknown) => {
      const msg = typeof e === "object" && e && "message" in e ? String((e as { message?: unknown }).message ?? "Failed to create trade") : "Failed to create trade"
      window.alert(msg)
    },
  })
  const acceptTrade = useMutation({
    mutationFn: (tradeId: string) => tradeApi.accept(tradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allWallets", auctionId] })
    },
  })
  const rejectTrade = useMutation({
    mutationFn: (tradeId: string) => tradeApi.reject(tradeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trades", auctionId] }),
  })
  const cancelTrade = useMutation({
    mutationFn: (tradeId: string) => tradeApi.cancel(tradeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trades", auctionId] }),
  })

  const tradeSquads = (allSquadsForTrades ?? []) as Array<{ squadId: string; participantId?: string; name: string; players?: Array<{ id: string; name: string }> }>
  const fromSquad = tradeSquads.find((s) => s.squadId === fromSquadId)
  const toSquad = tradeSquads.find((s) => s.squadId === toSquadId)
  const tradeSquadById = Object.fromEntries(tradeSquads.map((s) => [s.squadId, s])) as Record<string, (typeof tradeSquads)[number]>
  const selectedFromPlayers = [...new Set([fromPlayerA, fromPlayerB].filter(Boolean))]
  const selectedToPlayers = [...new Set([toPlayerA, toPlayerB].filter(Boolean))]
  const validCashFromToTo = cashFromToTo.trim() === "" || (!Number.isNaN(Number(cashFromToTo)) && Number(cashFromToTo) >= 0)
  const validCashToToFrom = cashToToFrom.trim() === "" || (!Number.isNaN(Number(cashToToFrom)) && Number(cashToToFrom) >= 0)
  const cashFromToToCr = cashFromToTo.trim() ? Number(cashFromToTo) : 0
  const cashToToFromCr = cashToToFrom.trim() ? Number(cashToToFrom) : 0
  const toRupeesFromCr = (cr: number) => Math.round(cr * 10_000_000)
  const fmtCr = (rupees: number) => `${(rupees / 10_000_000).toFixed(2)}Cr`
  const tradeFromParticipantId = fromSquad?.participantId
  const tradeToParticipantId = toSquad?.participantId
  const fromWallet = tradeFromParticipantId ? tradeWalletMap?.[tradeFromParticipantId] ?? null : null
  const toWallet = tradeToParticipantId ? tradeWalletMap?.[tradeToParticipantId] ?? null : null
  const fromWalletCr = fromWallet != null ? fromWallet / 10_000_000 : null
  const toWalletCr = toWallet != null ? toWallet / 10_000_000 : null
  const fromCashWithinWallet = fromWallet == null || toRupeesFromCr(cashFromToToCr) <= fromWallet
  const toCashWithinWallet = toWallet == null || toRupeesFromCr(cashToToFromCr) <= toWallet
  const hasTradeLeg =
    tradeMode === "TRADE"
      ? (selectedFromPlayers.length > 0 || selectedToPlayers.length > 0)
      : selectedFromPlayers.length > 0
  const modeCashRule =
    tradeMode === "SELL"
      ? cashFromToToCr > 0 && cashToToFromCr === 0
      : tradeMode === "LOAN"
        ? false
        : true
  const canCreateTrade =
    !!fromSquadId &&
    !!toSquadId &&
    fromSquadId !== toSquadId &&
    hasTradeLeg &&
    validCashFromToTo &&
    validCashToToFrom &&
    fromCashWithinWallet &&
    toCashWithinWallet &&
    modeCashRule &&
    tradeMode !== "LOAN"
  const playerNameById = (squadId: string, playerId: string) =>
    tradeSquadById[squadId]?.players?.find((p) => p.id === playerId)?.name ?? playerId

  if (!auction || !me) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-100">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">🏏</div>
          <p className="text-stone-500 text-sm font-medium">Loading auction room…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{mobileCSS}</style>
      <div className="ar-root h-screen flex flex-col overflow-hidden"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#f5f3ef" }}>

        {soldInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm pointer-events-none">
            <div className={`text-center p-10 rounded-3xl border-2 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300 ${
              soldInfo.unsold ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
            }`}>
              <div className="text-7xl mb-4">{soldInfo.unsold ? "🚫" : "🎉"}</div>
              <p className={`text-3xl font-black ${soldInfo.unsold ? "text-red-600" : "text-emerald-700"}`}>
                {soldInfo.unsold ? "Unsold" : "Sold!"}
              </p>
              <p className="text-xl font-bold mt-2 text-stone-600">{soldInfo.playerName}</p>
              {!soldInfo.unsold && soldInfo.amount != null && (
                <div className="mt-5 bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
                  <p className="text-sm text-stone-400">to</p>
                  <p className="font-black text-xl text-emerald-600">{soldInfo.squadName}</p>
                  <p className="text-3xl font-black tabular-nums mt-1 text-stone-800">{fmt(soldInfo.amount)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <header className="ar-header shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-linear-to-br from-emerald-700 to-emerald-900 flex items-center justify-center text-base shadow-sm shrink-0">🏏</div>
            <h1 className="ar-title font-black text-base leading-tight tracking-tight text-stone-800 truncate">{auction.name}</h1>
            <div className="ar-status-chip shrink-0">{statusChip}</div>
          </div>
          <div className="ar-header-right flex items-center gap-2">
            {isAdmin && !auctionEnded && <AddParticipantNavButton auctionId={auctionId} />}
            {!auctionEnded && (
              <button
                onClick={() => { setRemainingPage(0); setShowRemainingPlayers(true) }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-all"
              >
                📋 Remaining
              </button>
            )}
            <button onClick={() => navigate({ to: "/auction/$auctionId/fantasy", params: { auctionId } })}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
                auctionEnded
                  ? "border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                  : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}>
              🏆 Fantasy
            </button>
            {auctionEnded && (
              <button
                type="button"
                onClick={() => setShowReauctionConfirm(true)}
                disabled={startReauction.isPending || auction.reauctionStarted === true}
                title={auction.reauctionStarted ? "Re-auction already started" : "Start re-auction"}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                ↻ {auction.reauctionStarted ? "Re-auction started" : startReauction.isPending ? "Starting..." : "Re-auction"}
              </button>
            )}
            {auctionEnded && (
              <button
                type="button"
                onClick={() => navigate({ to: "/auction/$auctionId/trade", params: { auctionId } })}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              >
                ⇄ Trade Center
              </button>
            )}
            {auctionEnded && (
              <button
                type="button"
                onClick={() => navigate({ to: "/auction/$auctionId/ipl-matches", params: { auctionId } })}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100"
              >
                📅 IPL Matches
              </button>
            )}
            {auctionEnded && (
              <button
                type="button"
                onClick={() => navigate({ to: "/auction/$auctionId/mid-season", params: { auctionId } })}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100"
              >
                ⚡ Mid-Season
              </button>
            )}
            <button onClick={() => navigate({ to: "/auction" })}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-all">
              ← Back to Lobby
            </button>
          </div>
        </header>

        {/* ── Mobile bar ── */}
        {auctionEnded && (
          <div className="shrink-0 px-4 py-3 border-b border-emerald-200/90 bg-linear-to-r from-emerald-50/95 to-amber-50/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-emerald-950 tracking-tight">This auction has ended</p>
              <p className="text-[11px] text-emerald-900/75 font-medium mt-0.5">
                Fantasy is the home for squad rankings and per-match point breakdowns. You can start re-auction, open Trade Center, and view IPL Matches.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate({ to: "/auction/$auctionId/fantasy", params: { auctionId } })}
                className="text-xs font-black px-3 py-2 rounded-lg bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-700 shadow-sm"
              >
                🏆 Open Fantasy
              </button>
              <button
                type="button"
                onClick={() => setShowReauctionConfirm(true)}
                disabled={startReauction.isPending || auction.reauctionStarted === true}
                title={auction.reauctionStarted ? "Re-auction already started" : "Start re-auction"}
                className="text-xs font-bold px-3 py-2 rounded-lg border border-stone-300 bg-white text-stone-700 disabled:text-stone-400 disabled:cursor-not-allowed"
              >
                ↻ {auction.reauctionStarted ? "Re-auction started" : startReauction.isPending ? "Starting..." : "Re-auction"}
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/auction/$auctionId/trade", params: { auctionId } })}
                className="text-xs font-bold px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700"
              >
                ⇄ Trade Center
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/auction/$auctionId/ipl-matches", params: { auctionId } })}
                className="text-xs font-bold px-3 py-2 rounded-lg border border-sky-300 bg-sky-50 text-sky-700"
              >
                📅 IPL Matches
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/auction/$auctionId/mid-season", params: { auctionId } })}
                className="text-xs font-bold px-3 py-2 rounded-lg border border-amber-400 bg-amber-50 text-amber-800"
              >
                ⚡ Mid-Season
              </button>
            </div>
          </div>
        )}

        <div className="ar-mobile-bar">
          <div className="ar-mobile-bar-left">
            {statusChip}
            {!auctionEnded && (
              <button
                onClick={() => { setRemainingPage(0); setShowRemainingPlayers(true) }}
                className="ar-mob-back-btn"
              >
                📋 Remaining
              </button>
            )}
            {isAdmin && !auctionEnded && <AddParticipantNavButton auctionId={auctionId} />}
          </div>
          <div className="ar-mobile-bar-right">
            {/* ✅ Fixed: use ar-mob-back-btn class consistently */}
            <button onClick={() => navigate({ to: "/auction/$auctionId/fantasy", params: { auctionId } })}
              className="ar-mob-back-btn"
              style={auctionEnded
                ? { borderColor: "#34d399", color: "#fff", background: "#059669", fontWeight: 800 }
                : { borderColor: "#fcd34d", color: "#92400e", background: "#fffbeb" }}>
              🏆 Fantasy
            </button>
            <button onClick={() => navigate({ to: "/auction" })} className="ar-mob-back-btn">
              ← Lobby
            </button>
          </div>
        </div>

        <Dialog open={showTradeCenter} onOpenChange={setShowTradeCenter}>
          <DialogContent className="max-w-[92vw] w-[1200px] bg-white border-stone-200 text-stone-800 shadow-2xl overflow-y-auto max-h-[92vh]">
            <DialogHeader>
              <DialogTitle className="text-xl font-black">Transfer Market</DialogTitle>
            </DialogHeader>

            <div className="mt-1 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-900">
              Build offers like a marketplace. Use `Trade` for swap deals, `Sell` for player + Cr only, and `Loan` is the next phase.
              Wallet checks use each squad's live existing balance.
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-5 mt-3">
              <div className="rounded-2xl border border-stone-200 p-5 space-y-4 bg-stone-50/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Create Offer</p>
                  <button
                    type="button"
                    className="text-[11px] px-2 py-1 rounded border border-stone-300 bg-white hover:bg-stone-100"
                    onClick={() => {
                      const prevFrom = fromSquadId
                      setFromSquadId(toSquadId)
                      setToSquadId(prevFrom)
                      setFromPlayerA(toPlayerA); setFromPlayerB(toPlayerB)
                      setToPlayerA(fromPlayerA); setToPlayerB(fromPlayerB)
                      const prevCash = cashFromToTo
                      setCashFromToTo(cashToToFrom)
                      setCashToToFrom(prevCash)
                    }}
                  >
                    ⇄ Swap sides
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTradeMode("TRADE")}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${tradeMode === "TRADE" ? "border-indigo-500 bg-indigo-600 text-white" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
                  >
                    Player Trade
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTradeMode("SELL"); setToPlayerA(""); setToPlayerB(""); setCashToToFrom("") }}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${tradeMode === "SELL" ? "border-emerald-500 bg-emerald-600 text-white" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
                  >
                    Sell Player
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradeMode("LOAN")}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${tradeMode === "LOAN" ? "border-amber-500 bg-amber-500 text-white" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
                  >
                    Loan (Soon)
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-stone-500 mb-1">Seller / From squad</p>
                    <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white" value={fromSquadId} onChange={(e) => { setFromSquadId(e.target.value); setFromPlayerA(""); setFromPlayerB("") }}>
                      <option value="">Select squad</option>
                      {tradeSquads.map((s) => <option key={s.squadId} value={s.squadId}>{s.name}</option>)}
                    </select>
                    <p className="text-[11px] mt-1 text-stone-500">
                      Wallet: <span className="font-bold text-stone-700">{fromWalletCr == null ? "—" : `${fromWalletCr.toFixed(2)}Cr`}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-stone-500 mb-1">Buyer / To squad</p>
                    <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white" value={toSquadId} onChange={(e) => { setToSquadId(e.target.value); setToPlayerA(""); setToPlayerB("") }}>
                      <option value="">Select squad</option>
                      {tradeSquads.filter((s) => s.squadId !== fromSquadId).map((s) => <option key={s.squadId} value={s.squadId}>{s.name}</option>)}
                    </select>
                    <p className="text-[11px] mt-1 text-stone-500">
                      Wallet: <span className="font-bold text-stone-700">{toWalletCr == null ? "—" : `${toWalletCr.toFixed(2)}Cr`}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-stone-500 mb-1">From side gives</p>
                    <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white mb-2" value={fromPlayerA} onChange={(e) => setFromPlayerA(e.target.value)}>
                      <option value="">Player 1</option>
                      {(fromSquad?.players ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white" value={fromPlayerB} onChange={(e) => setFromPlayerB(e.target.value)}>
                      <option value="">Player 2 (optional)</option>
                      {(fromSquad?.players ?? []).filter((p) => p.id !== fromPlayerA).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  {tradeMode === "TRADE" ? (
                    <div>
                      <p className="text-[10px] font-semibold text-stone-500 mb-1">To side gives</p>
                      <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white mb-2" value={toPlayerA} onChange={(e) => setToPlayerA(e.target.value)}>
                        <option value="">Player 1</option>
                        {(toSquad?.players ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white" value={toPlayerB} onChange={(e) => setToPlayerB(e.target.value)}>
                        <option value="">Player 2 (optional)</option>
                        {(toSquad?.players ?? []).filter((p) => p.id !== toPlayerA).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-stone-300 bg-white/70 p-3 text-xs text-stone-500">
                      {tradeMode === "SELL"
                        ? "Sell mode: buyer sends only cash. No player required from buyer side."
                        : "Loan mode is coming in next update (duration, return date and fee)."}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Input value={cashFromToTo} onChange={(e) => setCashFromToTo(e.target.value)} placeholder="Cash from → to (Cr)" />
                    {!fromCashWithinWallet && <p className="text-[11px] text-rose-600 font-semibold">Exceeds from squad wallet.</p>}
                  </div>
                  <div className="space-y-1">
                    <Input value={cashToToFrom} onChange={(e) => setCashToToFrom(e.target.value)} placeholder="Cash to → from (Cr)" />
                    {!toCashWithinWallet && <p className="text-[11px] text-rose-600 font-semibold">Exceeds to squad wallet.</p>}
                  </div>
                </div>
                {!validCashFromToTo || !validCashToToFrom ? (
                  <p className="text-xs text-rose-600 font-semibold">Cash values must be valid positive numbers (or blank).</p>
                ) : tradeMode === "SELL" && !(cashFromToToCr > 0 && cashToToFromCr === 0) ? (
                  <p className="text-xs text-rose-600 font-semibold">In sell mode, only "Cash from → to" should be set and must be greater than 0.</p>
                ) : tradeMode === "LOAN" ? (
                  <p className="text-xs text-amber-700 font-semibold">Loan listing UI is enabled, but submit is intentionally disabled until loan backend rules are added.</p>
                ) : (
                  <p className="text-xs text-stone-600 rounded-lg border border-stone-200 bg-white px-3 py-2">
                    {tradeMode === "SELL"
                      ? <>Preview: <span className="font-semibold">{fromSquad?.name ?? "From"}</span> sells {selectedFromPlayers.length ? selectedFromPlayers.map((id) => playerNameById(fromSquadId, id)).join(", ") : "no players"} to <span className="font-semibold">{toSquad?.name ?? "To"}</span> for <span className="font-bold">{cashFromToToCr.toFixed(2)}Cr</span>.</>
                      : <>Preview: <span className="font-semibold">{fromSquad?.name ?? "From"}</span> gives {selectedFromPlayers.length ? selectedFromPlayers.map((id) => playerNameById(fromSquadId, id)).join(", ") : "no players"}{cashFromToTo.trim() ? ` + ${cashFromToToCr.toFixed(2)}Cr` : ""} to <span className="font-semibold">{toSquad?.name ?? "To"}</span>{tradeMode === "TRADE" ? <> in return for {selectedToPlayers.length ? selectedToPlayers.map((id) => playerNameById(toSquadId, id)).join(", ") : "no players"}{cashToToFrom.trim() ? ` + ${cashToToFromCr.toFixed(2)}Cr` : ""}</> : null}.</>
                    }
                  </p>
                )}
                <Button
                  onClick={() => createTrade.mutate()}
                  disabled={!canCreateTrade || createTrade.isPending}
                  className="w-full h-11 text-sm font-black bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {tradeMode === "LOAN"
                    ? "Loan API Pending"
                    : createTrade.isPending ? "Creating..." : tradeMode === "SELL" ? "List Sell Offer" : "Create Trade Offer"}
                </Button>
                <p className="text-[11px] text-stone-500">
                  Allowed: player-for-player, player + cash, 1-for-2/2-for-1, and sell listing.
                  All cash validations are against current live wallets only.
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 p-4 bg-white">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Live Market Book</p>
                  <p className="text-[11px] text-stone-400">Newest first</p>
                </div>
                <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
                  {((tradeRows ?? []) as TradeResponse[]).length === 0 ? (
                    <p className="text-sm text-stone-400 italic py-4 text-center">No trades yet.</p>
                  ) : (
                    ((tradeRows ?? []) as TradeResponse[]).map((t) => {
                      const fromName = tradeSquads.find((s) => s.squadId === t.fromSquadId)?.name ?? t.fromSquadId
                      const toName = tradeSquads.find((s) => s.squadId === t.toSquadId)?.name ?? t.toSquadId
                      const isSellStyle = t.toPlayerIds.length === 0 && Number(t.cashFromToTo) > 0
                      return (
                        <div key={t.id} className="border border-stone-200 rounded-xl p-3 bg-stone-50">
                          <p className="text-xs text-stone-500">#{t.id.slice(0, 8)} · {t.status} · {isSellStyle ? "SELL" : "TRADE"}</p>
                          <p className="text-sm font-semibold mt-1">{fromName} ⇄ {toName}</p>
                          <p className="text-xs text-stone-600 mt-1">
                            From: {t.fromPlayerIds.length ? t.fromPlayerIds.map((id) => playerNameById(t.fromSquadId, id)).join(", ") : "—"} {t.cashFromToTo > 0 ? ` + ${fmtCr(Number(t.cashFromToTo))}` : ""}
                          </p>
                          <p className="text-xs text-stone-600">
                            To: {t.toPlayerIds.length ? t.toPlayerIds.map((id) => playerNameById(t.toSquadId, id)).join(", ") : "—"} {t.cashToToFrom > 0 ? ` + ${fmtCr(Number(t.cashToToFrom))}` : ""}
                          </p>
                          {t.status === "PENDING" && (
                            <div className="flex gap-2 mt-2">
                              <button className="px-2 py-1 text-xs rounded bg-emerald-600 text-white disabled:opacity-50" disabled={acceptTrade.isPending || rejectTrade.isPending || cancelTrade.isPending} onClick={() => acceptTrade.mutate(t.id)}>Accept</button>
                              <button className="px-2 py-1 text-xs rounded bg-rose-600 text-white disabled:opacity-50" disabled={acceptTrade.isPending || rejectTrade.isPending || cancelTrade.isPending} onClick={() => rejectTrade.mutate(t.id)}>Reject</button>
                              <button className="px-2 py-1 text-xs rounded bg-stone-400 text-white disabled:opacity-50" disabled={acceptTrade.isPending || rejectTrade.isPending || cancelTrade.isPending} onClick={() => cancelTrade.mutate(t.id)}>Cancel</button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showRemainingPlayers} onOpenChange={setShowRemainingPlayers}>
          <DialogContent className="max-w-2xl bg-white border-stone-200 text-stone-800 shadow-2xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="text-lg font-black">📋 Remaining in current round</DialogTitle>
                <div className="text-right">
                  <p className="text-[11px] text-stone-400 font-semibold">Total remaining</p>
                  <p className="text-sm font-black text-stone-700">{remainingPlayersForModal.length}</p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              <div className="rounded-xl border border-stone-100 divide-y divide-stone-50 overflow-y-auto max-h-[55vh]">
                {remainingPageItems.length === 0 ? (
                  <p className="text-xs text-stone-400 italic text-center py-6">No remaining players in this round.</p>
                ) : (
                  remainingPageItems.map((p: Player, i: number) => {
                    const st = specialismStyle(p.specialism)
                    const sp = normaliseSpecialism(p.specialism)
                    const abbr =
                      sp === "WICKETKEEPER" ? "WK" :
                      sp === "ALLROUNDER" ? "AR" :
                      sp === "BOWLER" ? "BWL" :
                      sp === "BATSMAN" ? "BAT" :
                      ""

                    const base = p.basePrice == null ? null : Number(p.basePrice)
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[11px] font-black text-stone-300 w-5 shrink-0 text-center">
                            {remainingStartIdx + i + 1}
                          </span>
                          <div className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-black text-stone-800 truncate">{p.name}</p>
                            {abbr ? (
                              <p className="text-xs font-semibold text-stone-400 truncate">{abbr}</p>
                            ) : (
                              <p className="text-xs font-semibold text-stone-400 truncate">&nbsp;</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-stone-400">Base</p>
                          <p className="text-sm font-black text-amber-600 tabular-nums">
                            {base != null && !Number.isNaN(base) ? fmt(base) : "—"}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {remainingPlayersForModal.length > 0 && (
                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 text-xs font-bold transition-all disabled:opacity-40"
                    disabled={remainingClampedPage === 0}
                    onClick={() => setRemainingPage(p => Math.max(0, p - 1))}
                  >
                    ← Prev
                  </button>
                  <p className="text-[11px] text-stone-400 italic">
                    Page {remainingClampedPage + 1} / {remainingTotalPages} · Showing {remainingStartIdx + 1}-{Math.max(remainingEndIdx, remainingStartIdx + 1)} of {remainingPlayersForModal.length}
                  </p>
                  <button
                    className="px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 text-xs font-bold transition-all disabled:opacity-40"
                    disabled={remainingClampedPage >= remainingTotalPages - 1}
                    onClick={() => setRemainingPage(p => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {auctionEnded ? (
          <ParticipantView auctionId={auctionId} me={me} readOnly />
        ) : isAdmin ? (
          <AdminPanel
            auctionId={auctionId}
            onEnd={() => navigate({ to: "/auction/$auctionId/fantasy", params: { auctionId } })}
          />
        ) : (
          <ParticipantView auctionId={auctionId} me={me} />
        )}
      </div>

      {/* Re-auction Confirmation Dialog */}
      <Dialog open={showReauctionConfirm} onOpenChange={setShowReauctionConfirm}>
        <DialogContent className="max-w-md bg-white border-stone-200 text-stone-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black">↻ Start Re-auction?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-stone-600">
              Are you sure you want to enter into re-auction mode? Players along with points of this season will be shuffled.
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 bg-stone-800 hover:bg-stone-900 text-white"
                disabled={startReauction.isPending}
                onClick={() => {
                  setShowReauctionConfirm(false)
                  startReauction.mutate()
                }}
              >
                {startReauction.isPending ? "Starting..." : "Yes, Start Re-auction"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={startReauction.isPending}
                onClick={() => setShowReauctionConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Re-auction Phase 2 Dialog — admin only */}
      <Dialog open={showPhase2Dialog} onOpenChange={() => {}}>
        <DialogContent className="max-w-md bg-white border-stone-200 text-stone-800 shadow-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-lg font-black">🏁 Phase 1 Complete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-stone-600">
              All previously sold players have been re-auctioned.
            </p>
            {phase2Status && (
              <p className="text-sm text-stone-700 font-medium">
                {phase2Status.squadsNeedingPlayers} squad{phase2Status.squadsNeedingPlayers !== 1 ? "s" : ""} still
                {" "}have room for more players and {phase2Status.squadsWithBudget} still{" "}
                {phase2Status.squadsWithBudget !== 1 ? "have" : "has"} remaining budget.
              </p>
            )}
            <p className="text-sm text-stone-600">
              Do you want to bring in the remaining unsold players from the original pool?
            </p>
            <div className="flex gap-3 pt-2">
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={startRemainingPool.isPending}
                onClick={() => startRemainingPool.mutate()}
              >
                {startRemainingPool.isPending ? "Starting..." : "Yes, Start Pool Auction"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={startRemainingPool.isPending}
                onClick={() => {
                  setShowPhase2Dialog(false)
                  endAuctionFromPage.mutate()
                }}
              >
                No, End Auction
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}