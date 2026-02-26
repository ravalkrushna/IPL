/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useCallback, useState } from "react"
import { AxiosError } from "axios"

import { auctionApi } from "@/lib/auctionApi"
import { auctionEngineApi } from "@/lib/auctionEngineApi"
import { biddingApi } from "@/lib/biddingApi"
import { squadApi } from "@/lib/squadApi"
import { authApi } from "@/lib/auth"
import { createAuctionSocket } from "@/lib/auctionSocket"
import { useAuctionRoomStore } from "@/store/auctionRoomStore"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

import { AuctionEvent } from "@/types/AuctionEvent"

export const Route = createFileRoute("/auction/$auctionId")({
  component: AuctionRoomPage,
})

/* ───────────────── TYPES ───────────────── */
type HighestBid    = { amount: number; bidderName: string }
type WalletResponse = { balance: number }
type SquadPlayer   = {
  id: string; name: string; country?: string; age?: number
  specialism?: string; battingStyle?: string; bowlingStyle?: string
  testCaps?: number; odiCaps?: number; t20Caps?: number
  basePrice?: number; soldPrice?: number
}
type Squad = {
  id?: string; name: string; players?: SquadPlayer[]
  participantId?: string; walletBalance?: number
}
type Player = {
  id: string; name: string; country?: string; age?: number
  specialism?: string; battingStyle?: string; bowlingStyle?: string
  testCaps?: number; odiCaps?: number; t20Caps?: number
  basePrice?: number; isSold?: boolean; isAuctioned?: boolean
}

/* ───────────────── HELPERS ───────────────── */
function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(0)}L`
  return `₹${amount.toLocaleString()}`
}
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return "now"
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m`
}
function specialismStyle(sp?: string) {
  switch (sp?.toLowerCase()) {
    case "batsman":      return { bg: "bg-sky-500/15",    text: "text-sky-400" }
    case "bowler":       return { bg: "bg-rose-500/15",   text: "text-rose-400" }
    case "all-rounder":
    case "allrounder":   return { bg: "bg-violet-500/15", text: "text-violet-400" }
    case "wicket-keeper":
    case "keeper":       return { bg: "bg-amber-500/15",  text: "text-amber-400" }
    default:             return { bg: "bg-slate-500/15",  text: "text-slate-400" }
  }
}

/* ───────────────── TIMER RING ───────────────── */
function TimerRing({ seconds, paused }: { seconds: number; paused?: boolean }) {
  const color  = paused ? "#64748b" : seconds <= 3 ? "#f87171" : seconds <= 6 ? "#fbbf24" : "#34d399"
  const circ   = 2 * Math.PI * 22
  const offset = circ * (1 - seconds / 10)
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="56" height="56">
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={paused ? circ * 0.5 : offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s linear, stroke 0.3s" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {paused ? (
          <span className="text-lg text-slate-500">⏸</span>
        ) : (
          <>
            <span className="text-lg font-black tabular-nums leading-none" style={{ color }}>{seconds}</span>
            <span className="text-[9px] text-white/40 font-medium">SEC</span>
          </>
        )}
      </div>
    </div>
  )
}

/* ───────────────── SQUAD CARD ───────────────── */
function SquadCard({ squad, isMe, expanded, onToggle }: {
  squad: Squad; isMe: boolean; expanded: boolean; onToggle: () => void
}) {
  const players = squad.players ?? []
  const spent   = players.reduce((s, p) => s + (p.soldPrice ?? 0), 0)
  return (
    <div onClick={onToggle}
      className={`rounded-xl border transition-all duration-200 overflow-hidden cursor-pointer
        ${isMe
          ? "border-emerald-500/50 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
          : "border-white/8 bg-white/4 hover:bg-white/7 hover:border-white/15"}`}>
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isMe ? "bg-emerald-400" : "bg-slate-500"}`} />
          <span className={`font-bold text-sm truncate ${isMe ? "text-emerald-300" : "text-white/90"}`}>{squad.name}</span>
          {isMe && <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full flex-shrink-0">YOU</span>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-bold ${isMe ? "text-emerald-400" : "text-white/50"}`}>{players.length}p</span>
          <svg className={`w-3 h-3 text-white/30 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <div className="px-3 pb-2 flex items-center justify-between text-[11px]">
        <span className="text-white/40">Spent: <span className={`font-semibold ${isMe ? "text-emerald-400" : "text-white/70"}`}>{fmt(spent)}</span></span>
        {squad.walletBalance !== undefined && (
          <span className="text-white/40">Left: <span className="font-semibold text-white/70">{fmt(squad.walletBalance)}</span></span>
        )}
      </div>
      {expanded && (
        <div className="border-t border-white/8">
          {players.length === 0 ? (
            <p className="text-center py-3 text-xs text-white/30 italic">No players yet</p>
          ) : (
            <div className="divide-y divide-white/5 max-h-48 overflow-y-auto">
              {players.map((p) => {
                const st = specialismStyle(p.specialism)
                return (
                  <div key={p.id} className="flex items-center justify-between px-3 py-1.5 hover:bg-white/5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white/85 truncate">{p.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {p.specialism && <span className={`text-[9px] px-1 py-0.5 rounded font-semibold ${st.bg} ${st.text}`}>{p.specialism}</span>}
                        {p.country && <span className="text-[9px] text-white/30">{p.country}</span>}
                      </div>
                    </div>
                    {p.soldPrice != null && <span className="text-[11px] font-black text-emerald-400 tabular-nums ml-2">{fmt(p.soldPrice)}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ───────────────── ADMIN CONTROL PANEL ───────────────── */
function AdminControlPanel({ auctionId, auction, player, highestBid, bidFeed, allSquads }: {
  auctionId: string
  auction: { name: string; status: string }
  player: Player
  highestBid?: HighestBid
  bidFeed: { squadName: string; amount: number; timestamp: number }[]
  allSquads?: Squad[]
}) {
  const queryClient = useQueryClient()
  const [confirmEnd, setConfirmEnd] = useState(false)
  const isPaused = auction.status === "PAUSED"

  const pause = useMutation({
    mutationFn: () => auctionApi.pause(auctionId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["auction", auctionId] }),
  })
  const resume = useMutation({
    mutationFn: () => auctionApi.resume(auctionId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["auction", auctionId] }),
  })
  const end = useMutation({
    mutationFn: () => auctionApi.end(auctionId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["auction", auctionId] }),
  })

  const currentBid = highestBid?.amount ?? Number(player.basePrice ?? 0)
  const totalPlayers = allSquads?.flatMap(s => s.players ?? []).length ?? 0

  return (
    <div className="flex-1 flex gap-0 overflow-hidden min-h-0">

      {/* ── Left: Player Info ── */}
      <div className="flex-1 flex flex-col p-4 gap-3 min-w-0 border-r border-white/8">

        {/* Admin warning banner when paused */}
        {isPaused && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <span className="text-xl">⏸</span>
            <div>
              <p className="text-sm font-black text-amber-400">Auction Paused</p>
              <p className="text-xs text-amber-400/60">Timer is frozen. Click Resume to continue.</p>
            </div>
          </div>
        )}

        {/* Player hero */}
        <div className="rounded-2xl overflow-hidden border border-white/8 flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-black tracking-tight truncate">{player.name}</h2>
                {player.country && (
                  <p className="text-slate-400 text-sm mt-1">🌍 {player.country}{player.age ? ` · Age ${player.age}` : ""}</p>
                )}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {player.specialism && (() => {
                    const st = specialismStyle(player.specialism)
                    return (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${st.bg} ${st.text} border-current/20`}>
                        {player.specialism}
                      </span>
                    )
                  })()}
                </div>
              </div>
              <TimerRing seconds={0} paused={isPaused} />
            </div>
          </div>
          <div className="border-t border-white/8 grid grid-cols-3 divide-x divide-white/8">
            {[
              { label: "TEST", value: player.testCaps ?? 0, color: "text-sky-400",    played: (player.testCaps ?? 0) > 0 },
              { label: "ODI",  value: player.odiCaps  ?? 0, color: "text-violet-400", played: (player.odiCaps  ?? 0) > 0 },
              { label: "T20",  value: player.t20Caps  ?? 0, color: "text-amber-400",  played: (player.t20Caps  ?? 0) > 0 },
            ].map(({ label, value, color, played }) => (
              <div key={label} className={`flex flex-col items-center py-3 transition-opacity ${played ? "opacity-100" : "opacity-30"}`}>
                <span className={`text-xl font-black tabular-nums ${played ? color : "text-slate-600"}`}>
                  {played ? value : "—"}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold tracking-widest mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Player stats */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex-shrink-0">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
            {player.battingStyle && (<><span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Batting</span><span className="font-semibold text-white/85">{player.battingStyle}</span></>)}
            {player.bowlingStyle && (<><span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Bowling</span><span className="font-semibold text-white/85">{player.bowlingStyle}</span></>)}
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Base Price</span>
            <span className="font-black text-amber-400">{fmt(Number(player.basePrice ?? 0))}</span>
          </div>
        </div>

        {/* Live bid feed */}
        <div className="rounded-xl border border-white/8 bg-white/3 flex-1 flex flex-col min-h-0">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Live Bids</span>
            {bidFeed.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 min-h-0">
            {bidFeed.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-slate-600 italic">No bids yet for this player</p>
              </div>
            ) : (
              [...bidFeed].reverse().map((bid, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs
                  ${i === 0 ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-white/4 border border-transparent"}`}>
                  <div className="flex items-center gap-2">
                    <span>{i === 0 ? "🏆" : "·"}</span>
                    <span className={`font-bold ${i === 0 ? "text-emerald-400" : "text-white/70"}`}>{bid.squadName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-black tabular-nums ${i === 0 ? "text-emerald-400" : "text-white/60"}`}>{fmt(bid.amount)}</span>
                    <span className="text-slate-600 text-[10px]">{timeAgo(bid.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Centre: Current Bid + Admin Controls ── */}
      <div className="w-64 flex-shrink-0 flex flex-col p-4 gap-3 border-r border-white/8">

        {/* Current bid */}
        <div className="rounded-2xl border border-white/8 bg-white/3 p-5 text-center flex-shrink-0">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Current Bid</p>
          <p className="text-4xl font-black tabular-nums">{fmt(currentBid)}</p>
          {highestBid?.bidderName ? (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1.5">
              <span>🏆</span>
              <span className="text-sm font-bold text-emerald-400">{highestBid.bidderName}</span>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-600 italic">No bids yet</p>
          )}
        </div>

        {/* Auction stats */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex-shrink-0 space-y-2.5">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Auction Stats</p>
          {[
            { label: "Squads", value: String(allSquads?.length ?? 0) },
            { label: "Players Bought", value: String(totalPlayers) },
            { label: "Status", value: auction.status },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{label}</span>
              <span className={`text-xs font-bold tabular-nums
                ${value === "LIVE" ? "text-emerald-400" : value === "PAUSED" ? "text-amber-400" : "text-white/70"}`}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Admin controls */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex-shrink-0 space-y-2">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Admin Controls</p>

          {isPaused ? (
            <button
              onClick={() => resume.mutate()}
              disabled={resume.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-sm transition-all shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
            >
              <span>▶</span> Resume Auction
            </button>
          ) : (
            <button
              onClick={() => pause.mutate()}
              disabled={pause.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-600/80 hover:bg-amber-500 disabled:opacity-50 text-white font-black text-sm transition-all"
            >
              <span>⏸</span> Pause Auction
            </button>
          )}

          {!confirmEnd ? (
            <button
              onClick={() => setConfirmEnd(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/8 hover:border-red-500/40 text-white/50 hover:text-red-400 font-bold text-sm transition-all"
            >
              <span>🏁</span> End Auction
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-red-400 text-center font-semibold">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmEnd(false)}
                  className="flex-1 py-2 rounded-lg bg-white/5 border border-white/8 text-white/50 text-xs font-bold hover:bg-white/10 transition-all">
                  Cancel
                </button>
                <button
                  onClick={() => { end.mutate(); setConfirmEnd(false) }}
                  disabled={end.isPending}
                  className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-all">
                  End Now
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Admin info note */}
        <div className="rounded-xl border border-white/6 bg-white/2 p-3 flex-shrink-0">
          <p className="text-[10px] text-slate-600 leading-relaxed">
            ℹ️ Timer auto-pauses when all participants disconnect and resumes when someone reconnects.
          </p>
        </div>
      </div>

      {/* ── Right: All Squads ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-l border-white/8 bg-slate-900/40">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-shrink-0 border-b border-white/8">
          <div>
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">All Squads</p>
            <p className="text-xs text-white/60 mt-0.5 font-semibold">{allSquads?.length ?? 0} participants</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
          {(allSquads ?? []).map((s) => {
            const key = s.id ?? s.name
            return (
              <SquadCard key={key} squad={s} isMe={false} expanded={false} onToggle={() => {}} />
            )
          })}
          {(!allSquads || allSquads.length === 0) && (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-slate-600 italic">No squads yet</p>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {[{ label: "Batsman", color: "bg-sky-400" }, { label: "Bowler", color: "bg-rose-400" },
              { label: "All-Rounder", color: "bg-violet-400" }, { label: "Keeper", color: "bg-amber-400" }]
              .map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                  <span className="text-[10px] text-slate-600">{label}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────────── PAGE ───────────────── */
function AuctionRoomPage() {
  const { auctionId }  = useParams({ from: "/auction/$auctionId" })
  const queryClient    = useQueryClient()
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expandedSquad, setExpandedSquad] = useState<string | null>(null)

  /* ── Store ── */
  const squadName          = useAuctionRoomStore((s) => s.squadName)
  const seconds            = useAuctionRoomStore((s) => s.seconds)
  const soldInfo           = useAuctionRoomStore((s) => s.soldInfo)
  const showSquadDialog    = useAuctionRoomStore((s) => s.showSquadDialog)
  const wallet             = useAuctionRoomStore((s) => s.wallet)
  const bidFeed            = useAuctionRoomStore((s) => s.bidFeed)
  const setSquadName       = useAuctionRoomStore((s) => s.setSquadName)
  const setSeconds         = useAuctionRoomStore((s) => s.setSeconds)
  const decrementSeconds   = useAuctionRoomStore((s) => s.decrementSeconds)
  const setSoldInfo        = useAuctionRoomStore((s) => s.setSoldInfo)
  const addBidToFeed       = useAuctionRoomStore((s) => s.addBidToFeed)
  const setWallet          = useAuctionRoomStore((s) => s.setWallet)
  const resetForNextPlayer = useAuctionRoomStore((s) => s.resetForNextPlayer)
  const setShowSquadDialog = useAuctionRoomStore((s) => s.setShowSquadDialog)
  const timerKey           = useAuctionRoomStore((s) => s.timerKey)
  const pendingNextPlayer  = useAuctionRoomStore((s) => s.pendingNextPlayer)
  const setPendingNextPlayer = useAuctionRoomStore((s) => s.setPendingNextPlayer)

  /* ── Queries ── */
  const { data: me }      = useQuery({ queryKey: ["me"], queryFn: authApi.me })
  const { data: auction, refetch: refetchAuction } = useQuery({
    queryKey: ["auction", auctionId],
    queryFn:  () => auctionApi.getById(auctionId),
    refetchInterval: 3000,
  })
  const { data: player, refetch: refetchPlayer } = useQuery<Player>({
    queryKey: ["currentPlayer", auctionId],
    queryFn:  () => auctionEngineApi.currentPlayer(auctionId),
    refetchInterval: false,
  })
  const { data: highestBid } = useQuery<HighestBid>({
    queryKey: ["highestBid", player?.id],
    queryFn:  () => biddingApi.highestBid(auctionId, player!.id),
    enabled: !!player?.id,
    refetchInterval: 2000,
  })
  const { data: walletData } = useQuery<WalletResponse>({
    queryKey: ["wallet", me?.participantId],
    queryFn:  () => biddingApi.getWallet(me!.participantId),
    enabled: !!me?.participantId && me?.role === "PARTICIPANT",
  })
  const { data: squad, error: squadError, refetch: refetchSquad } = useQuery<Squad>({
    queryKey: ["mySquad", auctionId, me?.participantId],
    queryFn:  () => squadApi.mySquad(auctionId, me!.participantId),
    enabled:  !!me?.participantId && me?.role === "PARTICIPANT",
    retry: false,
  })
  const { data: allSquads, refetch: refetchAllSquads } = useQuery<Squad[]>({
    queryKey: ["allSquads", auctionId],
    queryFn:  () => squadApi.allSquads(auctionId),
    refetchInterval: 5000,
  })

  const isAdmin    = me?.role === "ADMIN"
  const isPaused   = auction?.status === "PAUSED"

  /* ── Timer ── */
  const startCountdown = useCallback((from: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSeconds(from)
    timerRef.current = setInterval(() => decrementSeconds(), 1000)
  }, [setSeconds, decrementSeconds])

  useEffect(() => {
    if (seconds === 0 && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [seconds])

  useEffect(() => {
    if (player?.id && !isPaused) startCountdown(10)
    if (isPaused && timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [player?.id, timerKey, isPaused, startCountdown])

  useEffect(() => {
    if (walletData?.balance !== undefined) setWallet(Number(walletData.balance))
  }, [walletData?.balance, setWallet])

  function getSafeNextBid(increment: number) {
    const latest = queryClient.getQueryData<HighestBid>(["highestBid", player?.id])
    return (latest?.amount ?? Number(player?.basePrice ?? 0)) + increment
  }

  /* ── Mutations ── */
  const createSquad = useMutation({
    mutationFn: squadApi.create,
    onSuccess: () => refetchSquad(),
  })
  const placeBid = useMutation({
    mutationFn: biddingApi.placeBid,
    onError: (err) => alert(err instanceof AxiosError ? err.response?.data?.message ?? "Bid failed" : "Bid failed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["highestBid", player?.id] }),
  })

  /* ── Socket ── */
  useEffect(() => {
    if (!player?.id || !me?.participantId) return
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
    const currentPlayerId = player.id

    const advanceToNextPlayer = (delay: number) => {
      if (pollRef.current) clearTimeout(pollRef.current)
      pollRef.current = setTimeout(() => {
        resetForNextPlayer()
        setPendingNextPlayer(currentPlayerId)
        const poll = async () => {
          const result = await refetchPlayer()
          const next   = result.data
          if (next?.id && next.id !== currentPlayerId) { setPendingNextPlayer(null); pollRef.current = null }
          else pollRef.current = setTimeout(poll, 1500)
        }
        pollRef.current = setTimeout(poll, 500)
      }, delay)
    }

    const socket = createAuctionSocket(currentPlayerId, me.participantId, (event: AuctionEvent) => {
      switch (event.type) {
        case "NEW_BID":
          startCountdown(10)
          queryClient.invalidateQueries({ queryKey: ["highestBid", currentPlayerId] })
          if (event.squadName) addBidToFeed({ squadName: event.squadName, amount: Number(event.amount ?? 0), timestamp: Date.now() })
          break
        case "PLAYER_SOLD":
          if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
          setSeconds(0)
          setSoldInfo({ squadName: event.squadName ?? "Unknown", playerName: player.name, amount: Number(event.amount ?? 0) })
          queryClient.invalidateQueries({ queryKey: ["mySquad"] })
          queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
          refetchSquad(); refetchAllSquads()
          advanceToNextPlayer(2500)
          break
        case "SYSTEM_MESSAGE":
          if (event.message === "PLAYER_UNSOLD") {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
            setSeconds(0)
            setSoldInfo({ squadName: "UNSOLD", playerName: player.name, amount: 0 })
            advanceToNextPlayer(1500)
          }
          break
        case "WALLET_UPDATE":
          if (event.walletBalance !== undefined) setWallet(Number(event.walletBalance))
          break
      }
    })

    return () => { if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }; void socket.deactivate() }
  }, [player?.id, me?.participantId, startCountdown, queryClient, addBidToFeed, setSeconds, setSoldInfo, setWallet, resetForNextPlayer, refetchPlayer, refetchSquad, refetchAllSquads])

  /* ── Guards ── */
  if (!auction || !me || !player) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">🏏</div>
          <p className="text-slate-400 text-sm font-medium">Loading auction room…</p>
        </div>
      </div>
    )
  }

  /* ── Derived ── */
  const currentBid   = highestBid?.amount ?? Number(player.basePrice ?? 0)
  const canBid       = auction.status === "LIVE" && !!squad && !soldInfo && !pendingNextPlayer && !!me.participantId
  const squadMissing = !isAdmin && me.role === "PARTICIPANT" && squadError instanceof AxiosError && squadError.response?.status === 404
  const squadPlayers = squad?.players ?? []
  const sortedSquads = [...(allSquads ?? [])].sort((a, b) => {
    if (a.name === squad?.name) return -1
    if (b.name === squad?.name) return 1
    return (b.players?.length ?? 0) - (a.players?.length ?? 0)
  })

  /* ── UI ── */
  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Dialogs ── */}
      {squadMissing && (
        <Dialog open>
          <DialogContent className="bg-slate-900 border-white/10 text-white">
            <DialogHeader><DialogTitle className="text-xl text-white">🏏 Name Your Squad</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-400">Choose a squad name to enter the auction.</p>
            <Input placeholder="e.g. Mumbai Indians" value={squadName}
              onChange={(e) => setSquadName(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 mt-1" />
            <Button disabled={!squadName.trim()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              onClick={() => createSquad.mutate({ auctionId, participantId: me.participantId, name: squadName })}>
              Enter Auction →
            </Button>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showSquadDialog} onOpenChange={setShowSquadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-white">
              <span className="text-2xl">🏏</span>
              <div>
                <span className="text-xl font-bold">{squad?.name ?? "My Squad"}</span>
                <span className="text-slate-400 text-sm font-normal ml-2">{squadPlayers.length} players</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          {squadPlayers.length > 0 ? (
            <div className="overflow-y-auto flex-1 mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    {["Player", "Role", "Caps (T/O/T)", "Sold For"].map(h => (
                      <TableHead key={h} className="text-slate-400">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {squadPlayers.map((p) => (
                    <TableRow key={p.id} className="border-white/8">
                      <TableCell>
                        <p className="font-semibold text-sm text-white">{p.name}</p>
                        <p className="text-xs text-slate-500">{[p.country, p.age ? `Age ${p.age}` : null].filter(Boolean).join(" · ")}</p>
                      </TableCell>
                      <TableCell>{p.specialism && <Badge variant="secondary" className="text-xs bg-white/10 text-white/70">{p.specialism}</Badge>}</TableCell>
                      <TableCell className="text-sm tabular-nums text-slate-400">
                        <span className={(p.testCaps ?? 0) > 0 ? "text-sky-400 font-semibold" : "text-slate-600"}>{p.testCaps ?? 0}</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className={(p.odiCaps ?? 0) > 0 ? "text-violet-400 font-semibold" : "text-slate-600"}>{p.odiCaps ?? 0}</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className={(p.t20Caps ?? 0) > 0 ? "text-amber-400 font-semibold" : "text-slate-600"}>{p.t20Caps ?? 0}</span>
                      </TableCell>
                      <TableCell className="text-right"><span className="font-bold text-emerald-400">{p.soldPrice ? fmt(p.soldPrice) : "—"}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-5xl mb-3">🛒</div>
              <p className="font-medium text-white">No players yet</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Overlays ── */}
      {pendingNextPlayer && !soldInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="text-6xl animate-bounce">🏏</div>
            <p className="text-2xl font-black text-white">Next Player Up</p>
            <p className="text-slate-400">Preparing auction…</p>
          </div>
        </div>
      )}
      {soldInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className={`text-center p-10 rounded-3xl border-2 max-w-sm w-full mx-4 shadow-2xl
            ${soldInfo.squadName === "UNSOLD" ? "bg-red-950/60 border-red-500/40" : "bg-emerald-950/60 border-emerald-500/40"}`}>
            <div className="text-7xl mb-4">{soldInfo.squadName === "UNSOLD" ? "🚫" : "🎉"}</div>
            <p className="text-3xl font-black">{soldInfo.squadName === "UNSOLD" ? "Unsold" : "Sold!"}</p>
            <p className="text-xl font-bold mt-2 text-white/80">{soldInfo.playerName}</p>
            {soldInfo.squadName !== "UNSOLD" && (
              <div className="mt-5 bg-white/10 rounded-2xl p-4">
                <p className="text-sm text-white/50">to</p>
                <p className="font-black text-xl text-emerald-400">{soldInfo.squadName}</p>
                <p className="text-3xl font-black tabular-nums mt-1">{fmt(soldInfo.amount)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ NAV BAR ══════════════ */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/8 bg-slate-900/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏏</span>
          <div>
            <h1 className="font-black text-base leading-tight tracking-tight">{auction.name}</h1>
            <p className="text-[11px] text-slate-500">
              {isAdmin ? "Admin View" : squad ? `Squad: ` : ""}
              {!isAdmin && squad && <span className="text-emerald-400 font-semibold">{squad.name}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Paused indicator */}
          {isPaused && (
            <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg px-3 py-1.5">
              <span className="text-sm">⏸</span>
              <span className="text-xs font-bold text-amber-400">PAUSED</span>
            </div>
          )}

          {!isAdmin && me.role === "PARTICIPANT" && wallet != null && (
            <div className="hidden sm:flex items-center gap-1.5 bg-white/6 border border-white/8 rounded-lg px-3 py-1.5">
              <span className="text-[11px] text-slate-400">Balance</span>
              <span className="font-black text-sm tabular-nums text-emerald-400">{fmt(wallet)}</span>
            </div>
          )}
          {!isAdmin && squad && (
            <button onClick={() => setShowSquadDialog(true)}
              className="flex items-center gap-1.5 bg-white/6 hover:bg-white/10 border border-white/8 rounded-lg px-3 py-1.5 transition-colors">
              <span className="text-sm">🏏</span>
              <span className="text-sm font-bold">{squad.name}</span>
              <span className="bg-emerald-500/20 text-emerald-400 text-xs font-black px-1.5 py-0.5 rounded-full">{squadPlayers.length}</span>
            </button>
          )}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold
            ${auction.status === "LIVE"
              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
              : auction.status === "PAUSED"
              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
              : "bg-white/6 text-white/50 border border-white/8"}`}>
            {auction.status === "LIVE" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {auction.status}
          </div>
        </div>
      </header>

      {/* ══════════════ BODY ══════════════ */}
      {isAdmin ? (
        /* ── ADMIN VIEW ── */
        <AdminControlPanel
          auctionId={auctionId}
          auction={auction}
          player={player}
          highestBid={highestBid}
          bidFeed={bidFeed}
          allSquads={allSquads}
        />
      ) : (
        /* ── PARTICIPANT VIEW ── */
        <div className="flex-1 flex gap-0 overflow-hidden min-h-0">

          {/* Col 1: Player card */}
          <div className="flex-1 flex flex-col p-4 gap-3 min-w-0 border-r border-white/8">
            <div className="rounded-2xl overflow-hidden border border-white/8 flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl font-black tracking-tight truncate">{player.name}</h2>
                    {player.country && <p className="text-slate-400 text-sm mt-1">🌍 {player.country}{player.age ? ` · Age ${player.age}` : ""}</p>}
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {player.specialism && (() => {
                        const st = specialismStyle(player.specialism)
                        return <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${st.bg} ${st.text} border-current/20`}>{player.specialism}</span>
                      })()}
                    </div>
                  </div>
                  <TimerRing seconds={seconds} paused={isPaused} />
                </div>
              </div>
              <div className="border-t border-white/8 grid grid-cols-3 divide-x divide-white/8">
                {[{ label: "TEST", value: player.testCaps ?? 0, color: "text-sky-400",    played: (player.testCaps ?? 0) > 0 },
                  { label: "ODI",  value: player.odiCaps  ?? 0, color: "text-violet-400", played: (player.odiCaps  ?? 0) > 0 },
                  { label: "T20",  value: player.t20Caps  ?? 0, color: "text-amber-400",  played: (player.t20Caps  ?? 0) > 0 }].map(({ label, value, color, played }) => (
                  <div key={label} className={`flex flex-col items-center py-3 transition-opacity ${played ? "opacity-100" : "opacity-30"}`}>
                    <span className={`text-xl font-black tabular-nums ${played ? color : "text-slate-600"}`}>
                      {played ? value : "—"}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold tracking-widest mt-0.5">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex-shrink-0">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {player.battingStyle && (<><span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Batting</span><span className="font-semibold text-white/85">{player.battingStyle}</span></>)}
                {player.bowlingStyle && (<><span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Bowling</span><span className="font-semibold text-white/85">{player.bowlingStyle}</span></>)}
                <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Base Price</span>
                <span className="font-black text-amber-400">{fmt(Number(player.basePrice ?? 0))}</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/3 flex-1 flex flex-col min-h-0">
              <div className="px-4 pt-3 pb-2 flex items-center justify-between flex-shrink-0">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Live Bids</span>
                {bidFeed.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 min-h-0">
                {bidFeed.length === 0 ? (
                  <div className="flex items-center justify-center h-full"><p className="text-xs text-slate-600 italic">No bids yet — be first!</p></div>
                ) : (
                  [...bidFeed].reverse().map((bid, i) => (
                    <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs
                      ${i === 0 ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-white/4 border border-transparent"}`}>
                      <div className="flex items-center gap-2">
                        <span>{i === 0 ? "🏆" : "·"}</span>
                        <span className={`font-bold ${i === 0 ? "text-emerald-400" : "text-white/70"}`}>{bid.squadName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-black tabular-nums ${i === 0 ? "text-emerald-400" : "text-white/60"}`}>{fmt(bid.amount)}</span>
                        <span className="text-slate-600 text-[10px]">{timeAgo(bid.timestamp)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Col 2: Bidding */}
          <div className="w-64 flex-shrink-0 flex flex-col p-4 gap-3 border-r border-white/8">
            <div className="rounded-2xl border border-white/8 bg-white/3 p-5 text-center flex-shrink-0">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Current Bid</p>
              <p className="text-4xl font-black tabular-nums">{fmt(currentBid)}</p>
              {highestBid?.bidderName ? (
                <div className="mt-3 inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1.5">
                  <span>🏆</span>
                  <span className="text-sm font-bold text-emerald-400">{highestBid.bidderName}</span>
                </div>
              ) : <p className="mt-2 text-xs text-slate-600 italic">No bids yet</p>}
            </div>

            {isPaused && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-center flex-shrink-0">
                <p className="text-sm font-black text-amber-400">⏸ Auction Paused</p>
                <p className="text-xs text-amber-400/60 mt-0.5">Bidding resumes shortly</p>
              </div>
            )}

            <div className="rounded-xl border border-white/8 bg-white/3 p-4 flex-shrink-0">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Place Bid</p>
              <div className="space-y-2">
                {[{ label: "+10L", sub: "₹10 Lakhs", increment: 1_000_000 },
                  { label: "+25L", sub: "₹25 Lakhs", increment: 2_500_000 },
                  { label: "+50L", sub: "₹50 Lakhs", increment: 5_000_000 },
                  { label: "+1Cr", sub: "₹1 Crore",  increment: 10_000_000 }].map(({ label, sub, increment }) => (
                  <button key={label}
                    disabled={!canBid || placeBid.isPending}
                    onClick={() => placeBid.mutate({ auctionId, playerId: player.id, participantId: me.participantId, amount: getSafeNextBid(increment) })}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all
                      ${canBid ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.25)]" : "bg-white/5 text-white/25 cursor-not-allowed border border-white/8"}`}>
                    <span className="font-black text-base">{label}</span>
                    <span className={`text-xs ${canBid ? "text-emerald-200/70" : "text-white/20"}`}>{sub}</span>
                  </button>
                ))}
              </div>
              {!canBid && !soldInfo && (
                <p className="text-[11px] text-slate-600 text-center mt-3 italic">
                  {!squad ? "Create a squad to bid" : isPaused ? "Auction is paused" : "Bidding unavailable"}
                </p>
              )}
            </div>

            {me.role === "PARTICIPANT" && wallet != null && (
              <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 flex items-center justify-between flex-shrink-0">
                <span className="text-xs text-slate-500 font-semibold">Your Balance</span>
                <span className="font-black text-emerald-400 tabular-nums">{fmt(wallet)}</span>
              </div>
            )}
          </div>

          {/* Col 3: All Squads */}
          <div className="w-72 flex-shrink-0 flex flex-col border-l border-white/8 bg-slate-900/40">
            <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-shrink-0 border-b border-white/8">
              <div>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">All Squads</p>
                <p className="text-xs text-white/60 mt-0.5 font-semibold">{sortedSquads.length} participants</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
              {sortedSquads.length === 0 ? (
                <div className="flex items-center justify-center h-full"><p className="text-xs text-slate-600 italic">No squads yet</p></div>
              ) : sortedSquads.map((s) => {
                const key = s.id ?? s.name
                return <SquadCard key={key} squad={s} isMe={s.name === squad?.name}
                  expanded={expandedSquad === key} onToggle={() => setExpandedSquad(expandedSquad === key ? null : key)} />
              })}
            </div>
            <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {[{ label: "Batsman", color: "bg-sky-400" }, { label: "Bowler", color: "bg-rose-400" },
                  { label: "All-Rounder", color: "bg-violet-400" }, { label: "Keeper", color: "bg-amber-400" }].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                    <span className="text-[10px] text-slate-600">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}