/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { AxiosError } from "axios"

import { auctionApi } from "@/lib/auctionApi"
import { auctionEngineApi } from "@/lib/auctionEngineApi"
import { biddingApi } from "@/lib/biddingApi"
import { hammerApi, participantApi } from "@/lib/hammerApi"
import { squadApi } from "@/lib/squadApi"
import { authApi } from "@/lib/auth"
import { useAuctionRoomStore } from "@/store/auctionRoomStore"
import { Player } from "@/types/player"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export const Route = createFileRoute("/auction/$auctionId")({
  component: AuctionRoomPage,
})

const MAX_SQUAD_SIZE = 16

// ─── HELPERS ───────────────────────────────────────────────────────────────

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
    case "BATSMAN": return { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-400", bar: "#38bdf8" }
    case "BOWLER": return { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-400", bar: "#fb7185" }
    case "ALLROUNDER": return { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-400", bar: "#a78bfa" }
    case "WICKETKEEPER": return { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400", bar: "#fbbf24" }
    default: return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400", bar: "#94a3b8" }
  }
}

// ─── WALLET MAP HOOK ─────────────────────────────────────────────────────

type SquadForWallet = { participantId?: string }

function useWalletMap(auctionId: string, squads: SquadForWallet[] | undefined) {
  return useQuery({
    queryKey: ["allWallets", auctionId, (squads ?? []).map(s => s.participantId).join(",")],
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
    refetchInterval: 5000,
  })
}

// ─── TIMER RING ──────────────────────────────────────────────────────────

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
        {paused ? <span className="text-base text-slate-400">⏸</span>
          : biddingOpen ? (<><span className="text-[10px] font-black text-emerald-500 tracking-wider">LIVE</span><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mt-0.5" /></>)
            : seconds > 0 ? (<><span className="text-lg font-black tabular-nums leading-none" style={{ color }}>{seconds}</span><span className="text-[9px] text-slate-400 font-semibold tracking-widest">SEC</span></>)
              : <span className="text-slate-300 text-xs">—</span>}
      </div>
    </div>
  )
}

// ─── PLAYER HERO CARD ────────────────────────────────────────────────────

function PlayerHeroCard({ player, seconds, total, biddingOpen, paused, battingStyle, bowlingStyle }: {
  player: Player; seconds: number; total: number; biddingOpen: boolean; paused?: boolean
  battingStyle?: string; bowlingStyle?: string
}) {
  const st = specialismStyle(player.specialism)
  return (
    <div className="rounded-xl overflow-hidden border border-stone-200 shadow-sm h-full flex flex-col"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)" }}>
      <div className="px-5 pt-5 pb-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black tracking-tight truncate text-white">{player.name}</h2>
            {player.country && <p className="text-stone-300 text-sm mt-1">🌍 {player.country}{player.age ? ` · Age ${player.age}` : ""}</p>}
            <div className="flex gap-2 mt-2 flex-wrap">
              {player.specialism && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${st.bg} ${st.text} ${st.border}`}>{player.specialism}</span>
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
      </div>
      <div className="border-t border-white/10 grid grid-cols-3 divide-x divide-white/10 mt-auto">
        {[
          { label: "TEST", value: player.testCaps ?? 0, color: "text-sky-300" },
          { label: "ODI", value: player.odiCaps ?? 0, color: "text-violet-300" },
          { label: "T20", value: player.t20Caps ?? 0, color: "text-amber-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`flex flex-col items-center py-3.5 ${value > 0 ? "opacity-100" : "opacity-35"}`}>
            <span className={`text-xl font-black tabular-nums ${value > 0 ? color : "text-slate-500"}`}>{value > 0 ? value : "—"}</span>
            <span className="text-[10px] text-stone-400 font-semibold tracking-widest mt.0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── UPCOMING PLAYERS PANEL ──────────────────────────────────────────────

function UpcomingPlayers({ upcomingPlayers, currentPlayerId }: {
  upcomingPlayers: Player[]
  currentPlayerId?: string
}) {
  const needsFallback = upcomingPlayers.length === 0

  const { data: allPlayers } = useQuery({
    queryKey: ["players", { getAll: true }],
    queryFn: () => import("@/lib/playerApi").then(m => m.playerApi.list({ getAll: true })),
    refetchInterval: 15000,
    enabled: needsFallback,
  })

  const display = needsFallback
    ? (allPlayers ?? [] as Player[])
      .filter((p: Player) => !p.isAuctioned && p.id !== currentPlayerId)
      .sort((a: Player, b: Player) => Number(b.basePrice) - Number(a.basePrice))
      .slice(0, 5)
    : upcomingPlayers
      .filter(p => p.id !== currentPlayerId)
      .slice(0, 5)

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

// ─── RADIAL CHART ────────────────────────────────────────────────────────

function RadialChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return null
  const r = 30
  const circ = 2 * Math.PI * r
  let offset = 0
  const arcs = segments.map(seg => {
    const pct = seg.value / total
    const dash = pct * circ
    const gap = circ - dash
    const arc = { ...seg, dash, gap, offset }
    offset += dash
    return arc
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

// ─── BID HISTORY TABLE ───────────────────────────────────────────────────

function BidHistoryTable({ auctionId, auctionedCount }: { auctionId: string; auctionedCount?: number }) {
  const { data: allSquads } = useQuery({
    queryKey: ["allSquads", auctionId],
    queryFn: () => squadApi.allSquads(auctionId),
    refetchInterval: 5000,
  })

  const { data: allPlayersData } = useQuery({
    queryKey: ["players", { getAll: true }],
    queryFn: () => import("@/lib/playerApi").then(m => m.playerApi.list({ getAll: true })),
    refetchInterval: 10000,
  })

  type SquadPlayer = { id: string; name: string; specialism?: string; soldPrice?: number }
  type Squad = { id?: string; name: string; participantId?: string; players?: SquadPlayer[] }

  const allSales: { playerName: string; squadName: string; specialism?: string; soldPrice: number }[] = []
  ;(allSquads as Squad[] ?? []).forEach((sq: Squad) => {
    (sq.players ?? []).forEach((p: SquadPlayer) => {
      if (p.soldPrice != null && p.soldPrice > 0) {
        allSales.push({ playerName: p.name, squadName: sq.name, specialism: p.specialism, soldPrice: p.soldPrice })
      }
    })
  })
  allSales.sort((a, b) => b.soldPrice - a.soldPrice)

  const totalPlayers = (allPlayersData as Player[] | undefined)?.length ?? 0
  const soldCount = allSales.length
  const unsoldCount = auctionedCount != null ? auctionedCount - soldCount : 0
  const remainingCount = totalPlayers > 0 ? totalPlayers - (auctionedCount ?? 0) : 0

  const SPEC_COLORS: Record<string, string> = {
    BATSMAN: "#38bdf8", BOWLER: "#fb7185", ALLROUNDER: "#a78bfa", WICKETKEEPER: "#fbbf24"
  }
  const specialismCount: Record<string, number> = {}
  allSales.forEach(s => {
    const sp = normaliseSpecialism(s.specialism) || "Unknown"
    specialismCount[sp] = (specialismCount[sp] ?? 0) + 1
  })
  const radialSegments = Object.entries(specialismCount).map(([label, value]) => ({
    label, value, color: SPEC_COLORS[label] ?? "#94a3b8"
  }))

  return (
    <div className="flex flex-col gap-2 h-full min-h-0 overflow-hidden">
      <div className="grid grid-cols-4 gap-2 shrink-0">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Sold</p>
          <p className="text-lg font-black text-emerald-600 tabular-nums leading-tight">{soldCount}</p>
          <p className="text-[9px] text-emerald-400 font-semibold">of {totalPlayers}</p>
          {totalPlayers > 0 && (
            <div className="mt-1 h-0.5 rounded-full bg-emerald-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                style={{ width: `${Math.min((soldCount / totalPlayers) * 100, 100)}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Unsold</p>
          <p className="text-lg font-black text-red-500 tabular-nums leading-tight">{unsoldCount}</p>
          <p className="text-[9px] text-red-400 font-semibold">of {totalPlayers}</p>
          {totalPlayers > 0 && (
            <div className="mt-1 h-0.5 rounded-full bg-red-100 overflow-hidden">
              <div className="h-full rounded-full bg-red-400 transition-all duration-500"
                style={{ width: `${Math.min((unsoldCount / totalPlayers) * 100, 100)}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
          <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-widest">Remaining</p>
          <p className="text-lg font-black text-stone-700 tabular-nums leading-tight">{remainingCount}</p>
          <p className="text-[9px] text-stone-400 font-semibold">of {totalPlayers}</p>
          {totalPlayers > 0 && (
            <div className="mt-1 h-0.5 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full rounded-full bg-stone-400 transition-all duration-500"
                style={{ width: `${Math.min((remainingCount / totalPlayers) * 100, 100)}%` }} />
            </div>
          )}
        </div>
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
          <div className="divide-y divide-stone-50 overflow-y-auto flex-1">
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

// ─── SQUAD CARD ──────────────────────────────────────────────────────────

function SquadCard({ squad, isMe, expanded, onToggle, remainingBudget }: {
  squad: { id?: string; name: string; participantId?: string; players?: { id: string; name: string; specialism?: string; soldPrice?: number }[] }
  isMe: boolean; expanded: boolean; onToggle: () => void
  remainingBudget?: number | null
}) {
  const players = squad.players ?? []
  const spent = players.reduce((s, p) => s + (p.soldPrice ?? 0), 0)
  return (
    <div onClick={onToggle}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer
        ${isMe ? "border-emerald-300 bg-emerald-50 shadow-[0_2px_12px_rgba(16,185,129,0.15)]"
          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"}`}>
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
          <svg className={`w-3 h-3 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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
            Left:{" "}
            <span className={`font-semibold tabular-nums ${remainingBudget < 10_000_000 ? "text-red-500" : remainingBudget < 50_000_000 ? "text-amber-500" : "text-indigo-600"}`}>
              {fmt(remainingBudget)}
            </span>
          </span>
        )}
      </div>
      {expanded && (
        <div className="border-t border-stone-100">
          {players.length === 0
            ? <p className="text-center py-3 text-xs text-stone-400 italic">No players yet</p>
            : <div className="divide-y divide-stone-50 max-h-48 overflow-y-auto">
              {players.map((p) => {
                const st = specialismStyle(p.specialism)
                return (
                  <div key={p.id} className="flex items-center justify-between px-3.5 py-2 hover:bg-stone-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-stone-700 truncate">{p.name}</p>
                      {p.specialism && <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${st.bg} ${st.text} ${st.border}`}>{p.specialism}</span>}
                    </div>
                    {p.soldPrice != null && <span className="text-[11px] font-black text-emerald-600 tabular-nums ml-2">{fmt(p.soldPrice)}</span>}
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

// ─── HAMMER DIALOG ───────────────────────────────────────────────────────

function ManualHammerDialog({
  open, onOpenChange, currentPlayer, participants, participantsLoading, allSquads, onHammer, isPending,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; currentPlayer: Player | null
  participants: { id: string; name: string; walletBalance?: number }[] | undefined
  participantsLoading: boolean
  allSquads: { participantId?: string; players?: unknown[] }[] | undefined
  onHammer: (data: { participantId: string; finalAmount: number }) => void; isPending: boolean
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
    if (open) {
      setSelectedParticipantId("")
      setAmount(null)
      setRawInput("")
      setInputError("")
    }
  }, [open])

  // Input is always in Crore — e.g. 0.25 = ₹25L
  const handleRawInput = (val: string) => {
    setRawInput(val)
    setInputError("")
    if (!val.trim()) { setAmount(null); return }
    const num = parseFloat(val)
    if (!isNaN(num) && num > 0) {
      setAmount(Math.round(num * 10_000_000))
    } else {
      setAmount(null)
      setInputError("Enter a valid number")
    }
  }

  const handleQuickAmount = (value: number) => {
    setAmount(value)
    setRawInput(String(value / 10_000_000))
    setInputError("")
  }

  const basePrice = Number(currentPlayer?.basePrice ?? 0)
  const belowBase = Number(amount) > 0 && Number(amount) < basePrice
  const selectedSquad = (allSquads ?? []).find(s => s.participantId === selectedParticipantId)
  const selectedSquadFull = (selectedSquad?.players?.length ?? 0) >= MAX_SQUAD_SIZE

  const canSubmit = !isPending && !!currentPlayer && Number(amount) > 0 && !belowBase && !!selectedParticipantId && !inputError && !selectedSquadFull

  const QUICK_AMOUNTS = [
    { label: "50L", value: 5_000_000 }, { label: "1Cr", value: 10_000_000 },
    { label: "2Cr", value: 20_000_000 }, { label: "5Cr", value: 50_000_000 },
    { label: "10Cr", value: 100_000_000 }, { label: "15Cr", value: 150_000_000 },
    { label: "20Cr", value: 200_000_000 }, { label: "25Cr", value: 250_000_000 },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-white border-stone-200 text-stone-800 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-black">🔨 Hammer</DialogTitle>
            {/* Player inline in header */}
            <div className="text-right mr-6">
              <p className="font-bold text-stone-700 text-sm">{currentPlayer?.name ?? "—"}</p>
              <p className="text-xs text-slate-400">Base: <span className="font-bold text-amber-600">{fmt(basePrice)}</span></p>
            </div>
          </div>
        </DialogHeader>
        <div className="space-y-4 mt-2">

          {/* Quick select — full width */}
          <div>
            <p className="text-xs font-semibold text-stone-400 mb-2 uppercase tracking-wider">Quick Select</p>
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_AMOUNTS.map(({ label, value }) => (
                <button key={label} onClick={() => handleQuickAmount(value)}
                  className={`py-2 rounded-xl text-xs font-black transition-all border ${Number(amount) === value ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700"}`}>
                  ₹{label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Two columns: Amount (left) + Participant (right) ── */}
          <div className="grid grid-cols-2 gap-4 items-start">

            {/* Left: Custom Amount */}
            <div>
              <p className="text-xs font-semibold text-stone-400 mb-1.5 uppercase tracking-wider">Custom Amount (Crore)</p>
              <div className="relative">
                <Input
                  placeholder="e.g. 0.25 or 1.5"
                  value={rawInput}
                  onChange={(e) => handleRawInput(e.target.value)}
                  className={`bg-stone-50 pr-10 ${inputError ? "border-red-300 focus-visible:ring-red-300" : "border-stone-200"}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-stone-400">Cr</span>
              </div>
              <div className="mt-1.5 min-h-5">
                {inputError
                  ? <p className="text-xs text-red-500 font-medium">{inputError}</p>
                  : Number(amount) > 0
                    ? <p className="text-sm font-black text-amber-500">= {fmt(Number(amount))}</p>
                    : <p className="text-xs text-stone-300">0.25 Cr = ₹25L</p>
                }
                {belowBase && (
                  <p className="text-xs text-red-500 font-semibold mt-0.5">⚠️ Below base</p>
                )}
              </div>
            </div>

            {/* Right: Participant */}
            <div>
              <p className="text-xs font-semibold text-stone-400 mb-1.5 uppercase tracking-wider">Participant</p>
              {participantsLoading
                ? <p className="text-xs text-stone-400 italic">Loading…</p>
                : (participants ?? []).length === 0
                  ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center"><p className="text-xs text-slate-400">No participants yet.</p></div>
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

          {/* Actions */}
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

// ─── ADD PARTICIPANT DIALOG ──────────────────────────────────────────────

function AddParticipantDialog({ open, onOpenChange, auctionId, onAdded }: {
  open: boolean; onOpenChange: (v: boolean) => void; auctionId: string; onAdded: () => void
}) {
  const search = useAuctionRoomStore(s => s.addSearch)
  const setSearch = useAuctionRoomStore(s => s.setAddSearch)
  const newName = useAuctionRoomStore(s => s.addNewName)
  const setNewName = useAuctionRoomStore(s => s.setAddNewName)
  const showNewForm = useAuctionRoomStore(s => s.addShowNewForm)
  const setShowNewForm = useAuctionRoomStore(s => s.setAddShowNewForm)

  useEffect(() => { if (open) { setSearch(""); setNewName(""); setShowNewForm(false) } }, [open])

  const { data: allParticipants, isLoading } = useQuery({ queryKey: ["allParticipants"], queryFn: () => participantApi.getAll(), enabled: open })
  const { data: auctionSquads } = useQuery({ queryKey: ["allSquads", auctionId], queryFn: () => import("@/lib/squadApi").then(m => m.squadApi.allSquads(auctionId)), enabled: open })

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
            {isLoading ? <p className="text-xs text-slate-400 italic text-center py-4">Loading…</p>
              : filtered.length === 0 ? <p className="text-xs text-slate-400 italic text-center py-4">No participants found</p>
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
                        </button>
                      }
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
            ? <button onClick={() => setShowNewForm(true)} className="w-full py-2.5 rounded-lg border-2 border-dashed border-emerald-300 text-emerald-700 text-sm font-bold hover:bg-emerald-50 transition-all">＋ Create New Participant</button>
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

// ─── BUDGET OVERVIEW (merged with squad list) ────────────────────────────

function BudgetOverview({
  allSquads, walletMap, expandedSquad, setExpandedSquad,
}: {
  allSquads: { id?: string; name: string; participantId?: string; players?: { id: string; name: string; specialism?: string; soldPrice?: number }[] }[] | undefined
  walletMap: Record<string, number | null> | undefined
  expandedSquad: string | null
  setExpandedSquad: (id: string | null) => void
}) {
  const TEAM_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"]

  const rows = (allSquads ?? []).map((s, i) => {
    const spent = (s.players ?? []).reduce((acc, p) => acc + (p.soldPrice ?? 0), 0)
    const remaining = s.participantId ? (walletMap?.[s.participantId] ?? null) : null
    const total = remaining != null ? spent + remaining : spent
    const key = s.id ?? s.name
    return { key, name: s.name, spent, remaining: remaining ?? 0, total: total || 1_000_000_000, players: s.players ?? [], color: TEAM_COLORS[i % TEAM_COLORS.length] }
  }).sort((a, b) => b.spent - a.spent)

  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border border-stone-200 bg-white shrink-0 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Teams</p>
        <span className="text-[10px] text-stone-300 font-semibold">{rows.length} teams · {rows.reduce((a, r) => a + r.players.length, 0)} players</span>
      </div>
      <div className="divide-y divide-slate-50">
        {rows.map((row, i) => {
          const spentPct = Math.min((row.spent / row.total) * 100, 100)
          const remainPct = Math.min((row.remaining / row.total) * 100, 100)
          const isTopSpender = i === 0 && row.spent > 0
          const isExpanded = expandedSquad === row.key
          return (
            <div key={row.key}>
              {/* Row header — clickable to expand */}
              <button className="w-full text-left px-4 py-2.5 hover:bg-stone-50 transition-colors" onClick={() => setExpandedSquad(isExpanded ? null : row.key)}>
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                    <span className="text-xs font-bold text-stone-700 truncate">{row.name}</span>
                    {isTopSpender && <span className="text-[8px] font-black bg-amber-100 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full shrink-0">TOP</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold text-stone-400 tabular-nums">{row.players.length}/{MAX_SQUAD_SIZE}</span>
                    <span className="text-[10px] font-black tabular-nums" style={{ color: row.color }}>{row.spent > 0 ? fmt(row.spent) : "—"}</span>
                    <span className="text-[9px] text-slate-300">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${spentPct}%`, background: row.color, opacity: 0.9 }} />
                  <div className="h-full transition-all duration-700" style={{ width: `${remainPct}%`, background: row.color, opacity: 0.15 }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] text-slate-300">spent</span>
                  <span className="text-[9px] font-semibold" style={{ color: row.color, opacity: 0.7 }}>{row.remaining > 0 ? `${fmt(row.remaining)} left` : "—"}</span>
                </div>
              </button>
              {/* Expanded player list */}
              {isExpanded && (
                <div className="bg-stone-50 border-t border-stone-100 px-4 py-2 space-y-1 max-h-48 overflow-y-auto">
                  {row.players.length === 0
                    ? <p className="text-xs text-slate-300 italic py-1">No players yet</p>
                    : row.players.map(p => {
                      const st = specialismStyle(p.specialism)
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2 py-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${st.bg} ${st.text} ${st.border} shrink-0`}>
                              {normaliseSpecialism(p.specialism) === "WICKETKEEPER" ? "WK" : normaliseSpecialism(p.specialism) === "ALLROUNDER" ? "AR" : normaliseSpecialism(p.specialism) === "BOWLER" ? "BWL" : "BAT"}
                            </span>
                            <span className="text-xs text-stone-600 font-semibold truncate">{p.name}</span>
                          </div>
                          <span className="text-[10px] font-black tabular-nums text-stone-500 shrink-0">{p.soldPrice ? fmt(p.soldPrice) : "—"}</span>
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


// ─── ADMIN PANEL ─────────────────────────────────────────────────────────

function AdminPanel({ auctionId }: { auctionId: string }) {
  const queryClient = useQueryClient()

  const confirmEnd = useAuctionRoomStore(s => s.confirmEnd)
  const setConfirmEnd = useAuctionRoomStore(s => s.setConfirmEnd)
  const showManualHammer = useAuctionRoomStore(s => s.showManualHammer)
  const setShowManualHammer = useAuctionRoomStore(s => s.setShowManualHammer)
  const expandedSquad = useAuctionRoomStore(s => s.expandedSquad)
  const setExpandedSquad = useAuctionRoomStore(s => s.setExpandedSquad)
  const { data: engineState } = useQuery({
    queryKey: ["engineState", auctionId],
    queryFn: () => auctionEngineApi.state(auctionId),
    refetchInterval: 1500,
  })

  const currentPlayer = engineState?.currentPlayer ?? null
  const allPool = engineState?.pools?.[0] ?? null
  const poolStatus = allPool?.status ?? null
  const poolExhausted = engineState?.poolExhausted ?? false

  const { data: auction } = useQuery({ queryKey: ["auction", auctionId], queryFn: () => auctionApi.getById(auctionId), refetchInterval: 5000 })
  const { data: allSquads } = useQuery({ queryKey: ["allSquads", auctionId], queryFn: () => squadApi.allSquads(auctionId), refetchInterval: 3000 })
  const { data: participants, isLoading: participantsLoading } = useQuery({
    queryKey: ["participants", auctionId],
    queryFn: () => hammerApi.getParticipants(auctionId),
    refetchInterval: 3000,
  })
  const { data: walletMap } = useWalletMap(auctionId, allSquads)

  const endAuction = useMutation({ mutationFn: () => auctionApi.end(auctionId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auction", auctionId] }) })

  const nextPlayer = useMutation({
    mutationFn: () => auctionEngineApi.nextPlayer(auctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["players", { getAll: true }] })
    },
  })
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
    <div className="flex-1 flex gap-0 overflow-hidden min-h-0 bg-[#f5f3ef]">

      {/* ── Left: Player Info + Data ── */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-stone-200 overflow-hidden">
        <div className="flex gap-3 p-4 pb-2 shrink-0">
          <div className="flex-1 min-w-0 flex flex-col">
            {poolExhausted && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2 mb-2 shrink-0">
                <span>🏁</span><p className="text-xs font-semibold text-emerald-700">All players auctioned</p>
              </div>
            )}
            {currentPlayer
              ? <div className="flex-1"><PlayerHeroCard player={currentPlayer} seconds={0} total={0} biddingOpen={false} battingStyle={currentPlayer.battingStyle} bowlingStyle={currentPlayer.bowlingStyle} /></div>
              : <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center flex-1 min-h-32">
                <div className="text-center">
                  <div className="text-3xl mb-1">🏏</div>
                  <p className="text-xs font-semibold text-stone-400">Press Next Player to begin</p>
                </div>
              </div>
            }
          </div>
          {currentPlayer && (
            <div className="w-64 shrink-0 flex flex-col">
              <UpcomingPlayers upcomingPlayers={engineState?.upcomingPlayers ?? []} currentPlayerId={currentPlayer?.id} />
            </div>
          )}
        </div>
        <div className="flex-1 px-4 pb-4 min-h-0">
          <BidHistoryTable auctionId={auctionId} auctionedCount={allPool?.auctionedCount} />
        </div>
      </div>

      {/* ── Centre: Admin Controls ── */}
      <div className="w-72 shrink-0 flex flex-col p-4 gap-3 border-r border-stone-200 overflow-y-auto">
        {/* ── Controls: Next Player + Hammer + End Auction merged ── */}
        <div className="rounded-xl border border-stone-200 bg-white shrink-0 overflow-hidden">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-4 pt-3.5 pb-2">Controls</p>
          <div className="px-3 pb-3 flex flex-col gap-2">
            <button onClick={() => nextPlayer.mutate()} disabled={nextPlayer.isPending}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-sm transition-all shadow-sm">
              ⏭ Next Player
            </button>
            <button onClick={() => setShowManualHammer(true)}
              className="w-full py-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-sm transition-all">
              🔨 Hammer
            </button>
            <div className="border-t border-stone-100 pt-2">
              {!confirmEnd
                ? <button onClick={() => setConfirmEnd(true)}
                  className="w-full py-2 rounded-lg bg-stone-50 hover:bg-red-50 border border-stone-200 hover:border-red-200 text-stone-400 hover:text-red-500 font-bold text-sm transition-all">
                  🏁 End Auction
                </button>
                : <div className="space-y-1.5">
                  <p className="text-xs text-red-500 text-center font-semibold">Cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmEnd(false)} className="flex-1 py-1.5 rounded-lg bg-slate-50 border text-slate-500 text-xs font-bold hover:bg-slate-100">Cancel</button>
                    <button onClick={() => { endAuction.mutate(); setConfirmEnd(false) }} disabled={endAuction.isPending} className="flex-1 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-black">End</button>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        <BudgetOverview allSquads={allSquads} walletMap={walletMap} expandedSquad={expandedSquad} setExpandedSquad={setExpandedSquad} />
      </div>


      <ManualHammerDialog open={showManualHammer} onOpenChange={setShowManualHammer}
        currentPlayer={currentPlayer} participants={participants} participantsLoading={participantsLoading}
        allSquads={allSquads}
        onHammer={(data) => manualHammer.mutate(data)} isPending={manualHammer.isPending} />

    </div>
  )
}

// ─── PARTICIPANT VIEW ────────────────────────────────────────────────────

function ParticipantView({ auctionId, me }: { auctionId: string; me: { participantId: string; role: string; name: string } }) {
  const queryClient = useQueryClient()

  const expandedSquad = useAuctionRoomStore(s => s.expandedSquad)
  const setExpandedSquad = useAuctionRoomStore(s => s.setExpandedSquad)
  const showSquadDialog = useAuctionRoomStore(s => s.showSquadDialog)
  const setShowSquadDialog = useAuctionRoomStore(s => s.setShowSquadDialog)
  const squadNameInput = useAuctionRoomStore(s => s.squadNameInput)
  const setSquadNameInput = useAuctionRoomStore(s => s.setSquadNameInput)
  const myBalance = useAuctionRoomStore(s => s.myBalance)
  const setMyBalance = useAuctionRoomStore(s => s.setMyBalance)

  const { data: engineState } = useQuery({
    queryKey: ["engineState", auctionId],
    queryFn: () => auctionEngineApi.state(auctionId),
    refetchInterval: 1500,
  })

  const currentPlayer = engineState?.currentPlayer ?? null
  const biddingOpen = engineState?.biddingOpen ?? false
  const analysisSeconds = engineState?.analysisSeconds ?? 0
  const analysisTotalSecs = engineState?.analysisTotalSecs ?? 0

  const { data: auction } = useQuery({ queryKey: ["auction", auctionId], queryFn: () => auctionApi.getById(auctionId), refetchInterval: 5000 })
  const { data: squad, error: squadError, refetch: refetchSquad } = useQuery({
    queryKey: ["mySquad", auctionId, me.participantId],
    queryFn: () => squadApi.mySquad(auctionId, me.participantId),
    enabled: !!me.participantId,
    retry: false,
  })
  const { data: allSquads } = useQuery({ queryKey: ["allSquads", auctionId], queryFn: () => squadApi.allSquads(auctionId), refetchInterval: 5000 })
  const { data: highestBid } = useQuery({
    queryKey: ["highestBid", currentPlayer?.id],
    queryFn: () => biddingApi.highestBid(auctionId, currentPlayer!.id),
    enabled: !!currentPlayer?.id,
    refetchInterval: 1500,
  })
  const { data: walletData } = useQuery({
    queryKey: ["wallet", me.participantId, auctionId],
    queryFn: () => biddingApi.getWallet(me.participantId, auctionId),
    enabled: !!me.participantId,
    refetchInterval: 5000,
  })
  const { data: walletMap } = useWalletMap(auctionId, allSquads)

  useEffect(() => { if (walletData?.balance !== undefined) setMyBalance(Number(walletData.balance)) }, [walletData?.balance])

  const createSquad = useMutation({ mutationFn: squadApi.create, onSuccess: () => refetchSquad() })
  const placeBid = useMutation({
    mutationFn: biddingApi.placeBid,
    onError: (err) => alert(err instanceof AxiosError ? err.response?.data?.message ?? "Bid failed" : "Bid failed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highestBid", currentPlayer?.id] })
      queryClient.invalidateQueries({ queryKey: ["players", { getAll: true }] })
    },
  })

  const isPaused = auction?.status === "PAUSED"
  const squadMissing = squadError instanceof AxiosError && squadError.response?.status === 404
  const squadPlayers = (squad as { players?: { id: string; name: string; specialism?: string; soldPrice?: number }[] } | undefined)?.players ?? []
  const currentBid = highestBid?.amount ?? Number(currentPlayer?.basePrice ?? 0)
  const squadFull = squadPlayers.length >= MAX_SQUAD_SIZE
  const canBid = auction?.status === "LIVE" && biddingOpen && !!squad && !!me.participantId && !squadFull

  const sortedSquads = [...(allSquads ?? [])].sort((a: { name: string; players?: unknown[] }, b: { name: string; players?: unknown[] }) => {
    if (a.name === (squad as { name?: string } | undefined)?.name) return -1
    if (b.name === (squad as { name?: string } | undefined)?.name) return 1
    return (b.players?.length ?? 0) - (a.players?.length ?? 0)
  })

  const allPool = engineState?.pools?.[0] ?? null
  const auctionedCount = allPool?.auctionedCount

  const BID_INCREMENTS = [
    { label: "+5L", amount: 500_000 }, { label: "+10L", amount: 1_000_000 },
    { label: "+25L", amount: 2_500_000 }, { label: "+40L", amount: 4_000_000 },
    { label: "+80L", amount: 8_000_000 }, { label: "+1Cr", amount: 10_000_000 },
    { label: "+5Cr", amount: 50_000_000 }, { label: "+10Cr", amount: 100_000_000 },
  ]

  return (
    <>
      {squadMissing && (
        <Dialog open>
          <DialogContent className="bg-white border-stone-200 text-slate-800 shadow-2xl">
            <DialogHeader><DialogTitle className="text-xl text-slate-800">🏏 Name Your Squad</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-500 mb-3">Choose a name to enter the auction.</p>
            <Input placeholder="e.g. Mumbai Indians" value={squadNameInput} onChange={e => setSquadNameInput(e.target.value)} className="bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-300" />
            <Button disabled={!squadNameInput.trim() || createSquad.isPending} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold mt-3"
              onClick={() => createSquad.mutate({ auctionId, participantId: me.participantId, name: squadNameInput })}>
              Enter Auction →
            </Button>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showSquadDialog} onOpenChange={setShowSquadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white border-stone-200 text-slate-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              🏏 {(squad as { name?: string } | undefined)?.name ?? "My Squad"}
              <span className="text-slate-400 text-sm font-normal ml-2">{squadPlayers.length} players</span>
            </DialogTitle>
          </DialogHeader>
          {squadPlayers.length > 0
            ? <div className="overflow-y-auto flex-1 mt-2">
              <Table>
                <TableHeader><TableRow className="border-slate-100">{["Player", "Role", "Sold For"].map(h => <TableHead key={h} className="text-slate-400">{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {squadPlayers.map((p: { id: string; name: string; specialism?: string; soldPrice?: number }) => (
                    <TableRow key={p.id} className="border-slate-50">
                      <TableCell className="font-semibold text-sm text-slate-700">{p.name}</TableCell>
                      <TableCell>{p.specialism && <Badge variant="secondary" className="text-xs">{p.specialism}</Badge>}</TableCell>
                      <TableCell className="font-bold text-emerald-600">{p.soldPrice ? fmt(p.soldPrice) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            : <div className="flex flex-col items-center justify-center py-12"><div className="text-5xl mb-3">🛒</div><p className="text-slate-500">No players yet</p></div>
          }
        </DialogContent>
      </Dialog>

      <div className="flex-1 flex gap-0 overflow-hidden min-h-0 bg-[#f5f3ef]">
        <div className="flex-1 flex flex-col min-w-0 border-r border-stone-200 overflow-hidden">
          <div className="flex gap-3 p-4 pb-2 shrink-0">
            <div className="flex-1 min-w-0 flex flex-col">
              {currentPlayer
                ? <div className="flex-1"><PlayerHeroCard player={currentPlayer} seconds={analysisSeconds} total={analysisTotalSecs} biddingOpen={biddingOpen} paused={isPaused} battingStyle={currentPlayer.battingStyle} bowlingStyle={currentPlayer.bowlingStyle} /></div>
                : <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center flex-1 min-h-32">
                  <div className="text-center"><div className="text-3xl mb-1 animate-pulse">🏏</div><p className="text-xs text-slate-400 font-medium">Waiting for next player…</p></div>
                </div>
              }
            </div>
            {currentPlayer && (
              <div className="w-64 shrink-0 flex flex-col">
                <UpcomingPlayers upcomingPlayers={engineState?.upcomingPlayers ?? []} currentPlayerId={currentPlayer?.id} />
              </div>
            )}
          </div>
          <div className="flex-1 px-4 pb-4 min-h-0">
            <BidHistoryTable auctionId={auctionId} auctionedCount={auctionedCount} />
          </div>
        </div>

        <div className="w-64 shrink-0 flex flex-col p-5 gap-4 border-r border-slate-200/60 overflow-hidden">
          <div className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white p-4 shrink-0 shadow-sm">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Your Balance</p>
            <p className="text-3xl font-black tabular-nums text-emerald-600">{myBalance != null ? fmt(myBalance) : "—"}</p>
            <p className="text-[10px] text-emerald-300 mt-1 font-semibold">remaining budget</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shrink-0 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Bid</p>
            <p className="text-4xl font-black tabular-nums text-slate-800">{fmt(currentBid)}</p>
            {highestBid?.participantName
              ? <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5"><span>🏆</span><span className="text-sm font-bold text-emerald-700">{highestBid.participantName}</span></div>
              : <p className="mt-2 text-xs text-slate-300 italic">No bids</p>
            }
          </div>
          {squadFull && (
            <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-center shrink-0">
              <p className="text-sm font-bold text-red-600">🚫 Squad Full</p>
              <p className="text-xs text-red-400 mt-0.5">{MAX_SQUAD_SIZE}/{MAX_SQUAD_SIZE} players reached</p>
            </div>
          )}
          {!biddingOpen && currentPlayer && !isPaused && !squadFull && (
            <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-center shrink-0">
              <p className="text-sm font-bold text-indigo-700">🔍 Analysis Phase</p>
              <p className="text-xs text-indigo-400 mt-0.5">Bidding opens after timer</p>
            </div>
          )}
          {isPaused && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-center shrink-0">
              <p className="text-sm font-bold text-amber-700">⏸ Paused</p>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shrink-0 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Place Bid</p>
            <div className="grid grid-cols-2 gap-2">
              {BID_INCREMENTS.map(({ label, amount }) => (
                <button key={label} disabled={!canBid || placeBid.isPending}
                  onClick={() => placeBid.mutate({
                    auctionId, playerId: currentPlayer!.id, participantId: me.participantId,
                    amount: (queryClient.getQueryData<{ amount: number }>(["highestBid", currentPlayer?.id])?.amount ?? Number(currentPlayer?.basePrice ?? 0)) + amount,
                  })}
                  className={`flex items-center justify-center py-2.5 rounded-xl font-black text-sm transition-all ${label === "+10Cr" ? "col-span-2" : ""} ${canBid ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-stone-50 text-stone-300 cursor-not-allowed border border-stone-100"}`}>
                  {label}
                </button>
              ))}
            </div>
            {!canBid && (
              <p className="text-[11px] text-slate-300 text-center mt-3 italic">
                {!squad ? "Create a squad to bid"
                  : squadFull ? `Squad full (${MAX_SQUAD_SIZE}/${MAX_SQUAD_SIZE} players)`
                  : isPaused ? "Auction paused"
                  : !biddingOpen ? "Analysis phase…"
                  : "Bidding unavailable"}
              </p>
            )}
          </div>
        </div>

        <div className="w-56 shrink-0 flex flex-col bg-stone-50">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-slate-200/60">
            <div>
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">All Squads</p>
              <p className="text-xs text-stone-600 mt-0.5 font-semibold">{sortedSquads.length} participants</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {sortedSquads.length === 0
              ? <div className="flex items-center justify-center h-full"><p className="text-xs text-stone-300 italic">No squads yet</p></div>
              : sortedSquads.map((s: { id?: string; name: string; players?: unknown[]; participantId?: string }) => {
                const key = s.id ?? s.name
                const remaining = s.participantId ? (walletMap?.[s.participantId] ?? null) : null
                return (
                  <SquadCard key={key} squad={s as Parameters<typeof SquadCard>[0]["squad"]}
                    isMe={s.name === (squad as { name?: string } | undefined)?.name}
                    expanded={expandedSquad === key}
                    onToggle={() => setExpandedSquad(expandedSquad === key ? null : key)}
                    remainingBudget={remaining} />
                )
              })
            }
          </div>
        </div>
      </div>
    </>
  )
}

// ─── ADD PARTICIPANT NAV BUTTON ──────────────────────────────────────────

function AddParticipantNavButton({ auctionId }: { auctionId: string }) {
  const queryClient = useQueryClient()
  const setShowAddParticipant = useAuctionRoomStore(s => s.setShowAddParticipant)
  const showAddParticipant = useAuctionRoomStore(s => s.showAddParticipant)
  return (
    <>
      <button onClick={() => setShowAddParticipant(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 transition-all">
        ＋ Add Participant
      </button>

    </>
  )
}

// ─── ROOT PAGE ────────────────────────────────────────────────────────────

function AuctionRoomPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId" })
  const navigate = useNavigate()

  const setSoldInfo = useAuctionRoomStore(s => s.setSoldInfo)
  const lastSeenResultTimestamp = useAuctionRoomStore(s => s.lastSeenResultTimestamp)
  const setLastSeenResultTimestamp = useAuctionRoomStore(s => s.setLastSeenResultTimestamp)
  const soldInfo = useAuctionRoomStore(s => s.soldInfo)

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: authApi.me })
  const { data: auction } = useQuery({ queryKey: ["auction", auctionId], queryFn: () => auctionApi.getById(auctionId), refetchInterval: 5000 })
  const { data: engineState } = useQuery({ queryKey: ["engineState", auctionId], queryFn: () => auctionEngineApi.state(auctionId), refetchInterval: 1500 })

  useEffect(() => {
    const result = engineState?.lastResult
    if (!result) return
    const ts = result.timestamp != null ? String(result.timestamp) : null
    if (ts == null || ts === lastSeenResultTimestamp) return
    setLastSeenResultTimestamp(ts)
    setSoldInfo({
      playerName: String(result.playerName ?? ""),
      squadName: result.squadName != null ? String(result.squadName) : undefined,
      amount: result.amount != null ? Number(result.amount) : undefined,
      unsold: result.unsold != null ? Boolean(result.unsold) : undefined,
      timestamp: ts,
    })
    const t = setTimeout(() => setSoldInfo(null), result.unsold ? 2500 : 3500)
    return () => clearTimeout(t)
  }, [engineState?.lastResult?.timestamp])

  const isAdmin = me?.role === "ADMIN"

  if (!auction || !me) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-100">
        <div className="text-center space-y-3"><div className="text-5xl animate-pulse">🏏</div><p className="text-stone-500 text-sm font-medium">Loading auction room…</p></div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#f5f3ef" }}>

      {soldInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm pointer-events-none">
          <div className={`text-center p-10 rounded-3xl border-2 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300 ${soldInfo.unsold ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
            <div className="text-7xl mb-4">{soldInfo.unsold ? "🚫" : "🎉"}</div>
            <p className={`text-3xl font-black ${soldInfo.unsold ? "text-red-600" : "text-emerald-700"}`}>{soldInfo.unsold ? "Unsold" : "Sold!"}</p>
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

      <header className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-emerald-700 to-emerald-900 flex items-center justify-center text-base shadow-sm">🏏</div>
          <h1 className="font-black text-base leading-tight tracking-tight text-stone-800">{auction.name}</h1>
          {/* Auction running status — moved from admin panel card */}
          {(() => {
            const pool = engineState?.pools?.[0]
            const status = pool?.status
            if (status === "ACTIVE") return (
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs font-bold text-emerald-700">Running</span>
              </div>
            )
            if (status === "COMPLETED") return (
              <div className="flex items-center gap-1.5 bg-stone-100 border border-stone-200 rounded-full px-2.5 py-1">
                <span className="text-xs">✓</span>
                <span className="text-xs font-bold text-slate-500">Completed</span>
              </div>
            )
            if (engineState?.poolExhausted) return (
              <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1">
                <span className="text-xs">🏁</span>
                <span className="text-xs font-bold text-indigo-600">All auctioned</span>
              </div>
            )
            return (
              <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-full px-2.5 py-1">
                <span className="text-xs font-bold text-slate-400">Ready</span>
              </div>
            )
          })()}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <AddParticipantNavButton auctionId={auctionId} />}
          <button onClick={() => navigate({ to: "/auction" })} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-700 transition-all">
            ← Back to Lobby
          </button>
        </div>
      </header>

      {isAdmin ? <AdminPanel auctionId={auctionId} /> : <ParticipantView auctionId={auctionId} me={me} />}
    </div>
  )
}