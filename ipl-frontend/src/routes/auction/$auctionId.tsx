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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { AuctionEvent } from "@/types/AuctionEvent"

export const Route = createFileRoute("/auction/$auctionId")({
  component: AuctionRoomPage,
})

/* ───────────────── TYPES ───────────────── */

type HighestBid = { amount: number; bidderName: string }
type WalletResponse = { balance: number }
type SquadPlayer = {
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
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(0)}L`
  return `₹${amount.toLocaleString()}`
}

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 5) return "now"
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m`
}

function specialismStyle(sp?: string): { bg: string; text: string; dot: string } {
  switch (sp?.toLowerCase()) {
    case "batsman":      return { bg: "bg-sky-500/15",    text: "text-sky-400",    dot: "bg-sky-400" }
    case "bowler":       return { bg: "bg-rose-500/15",   text: "text-rose-400",   dot: "bg-rose-400" }
    case "all-rounder":
    case "allrounder":   return { bg: "bg-violet-500/15", text: "text-violet-400", dot: "bg-violet-400" }
    case "wicket-keeper":
    case "keeper":       return { bg: "bg-amber-500/15",  text: "text-amber-400",  dot: "bg-amber-400" }
    default:             return { bg: "bg-slate-500/15",  text: "text-slate-400",  dot: "bg-slate-400" }
  }
}

/* ───────────────── TIMER RING ───────────────── */

function TimerRing({ seconds }: { seconds: number }) {
  const color  = seconds <= 3 ? "#f87171" : seconds <= 6 ? "#fbbf24" : "#34d399"
  const circ   = 2 * Math.PI * 22
  const offset = circ * (1 - seconds / 10)

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="56" height="56">
        <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle cx="28" cy="28" r="22" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s linear, stroke 0.3s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black tabular-nums leading-none" style={{ color }}>{seconds}</span>
        <span className="text-[9px] text-white/40 font-medium">SEC</span>
      </div>
    </div>
  )
}

/* ───────────────── SQUAD CARD ───────────────── */

function SquadCard({ squad, isMe, expanded, onToggle }: {
  squad: Squad; isMe: boolean; expanded: boolean; onToggle: () => void
}) {
  const players = squad.players ?? []
  const spent = players.reduce((s, p) => s + (p.soldPrice ?? 0), 0)

  return (
    <div
      className={`rounded-xl border transition-all duration-200 overflow-hidden cursor-pointer
        ${isMe
          ? "border-emerald-500/50 bg-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
          : "border-white/8 bg-white/4 hover:bg-white/7 hover:border-white/15"
        }`}
      onClick={onToggle}
    >
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isMe ? "bg-emerald-400" : "bg-slate-500"}`} />
          <span className={`font-bold text-sm truncate ${isMe ? "text-emerald-300" : "text-white/90"}`}>
            {squad.name}
          </span>
          {isMe && (
            <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full shrink-0">
              YOU
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold tabular-nums ${isMe ? "text-emerald-400" : "text-white/50"}`}>
            {players.length}p
          </span>
          <svg className={`w-3 h-3 text-white/30 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Stats row */}
      <div className="px-3 pb-2 flex items-center justify-between text-[11px]">
        <span className="text-white/40">
          Spent: <span className={`font-semibold ${isMe ? "text-emerald-400" : "text-white/70"}`}>{fmt(spent)}</span>
        </span>
        {squad.walletBalance !== undefined && (
          <span className="text-white/40">
            Left: <span className="font-semibold text-white/70">{fmt(squad.walletBalance)}</span>
          </span>
        )}
      </div>

      {/* Expandable players */}
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
                        {p.specialism && (
                          <span className={`text-[9px] px-1 py-0.5 rounded font-semibold ${st.bg} ${st.text}`}>
                            {p.specialism}
                          </span>
                        )}
                        {p.country && <span className="text-[9px] text-white/30">{p.country}</span>}
                      </div>
                    </div>
                    {p.soldPrice != null && (
                      <span className="text-[11px] font-black text-emerald-400 tabular-nums ml-2">
                        {fmt(p.soldPrice)}
                      </span>
                    )}
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

/* ───────────────── PAGE ───────────────── */

function AuctionRoomPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId" })
  const queryClient   = useQueryClient()
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef       = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expandedSquad, setExpandedSquad] = useState<string | null>(null)

  /* ── Store ── */
  const squadName        = useAuctionRoomStore((s) => s.squadName)
  const seconds          = useAuctionRoomStore((s) => s.seconds)
  const soldInfo         = useAuctionRoomStore((s) => s.soldInfo)
  const showSquadDialog  = useAuctionRoomStore((s) => s.showSquadDialog)
  const wallet           = useAuctionRoomStore((s) => s.wallet)
  const bidFeed          = useAuctionRoomStore((s) => s.bidFeed)

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
  const { data: auction } = useQuery({ queryKey: ["auction", auctionId], queryFn: () => auctionApi.getById(auctionId) })

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
    enabled: !!me?.participantId,
    retry: false,
  })

  const { data: allSquads, refetch: refetchAllSquads } = useQuery<Squad[]>({
    queryKey: ["allSquads", auctionId],
    queryFn:  () => squadApi.allSquads(auctionId),
    refetchInterval: 5000,
  })

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
    if (player?.id) startCountdown(10)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [player?.id, timerKey, startCountdown])

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
  const currentBid    = highestBid?.amount ?? Number(player.basePrice ?? 0)
  const canBid        = auction.status === "LIVE" && !!squad && !soldInfo && !pendingNextPlayer && !!me.participantId
  const squadMissing  = me.role === "PARTICIPANT" && squadError instanceof AxiosError && squadError.response?.status === 404
  const squadPlayers  = squad?.players ?? []
  const playerSt      = specialismStyle(player.specialism)
  const sortedSquads  = [...(allSquads ?? [])].sort((a, b) => {
    if (a.name === squad?.name) return -1
    if (b.name === squad?.name) return 1
    return (b.players?.length ?? 0) - (a.players?.length ?? 0)
  })

  /* ── UI ── */
  return (
    <div className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Create Squad Dialog ── */}
      {squadMissing && (
        <Dialog open>
          <DialogContent className="bg-slate-900 border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl text-white">🏏 Name Your Squad</DialogTitle>
            </DialogHeader>
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

      {/* ── My Squad Full Dialog ── */}
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
                    <TableHead className="text-slate-400">Player</TableHead>
                    <TableHead className="text-slate-400">Role</TableHead>
                    <TableHead className="text-slate-400">Caps (T/O/T)</TableHead>
                    <TableHead className="text-right text-slate-400">Sold For</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {squadPlayers.map((p) => (
                    <TableRow key={p.id} className="border-white/8">
                      <TableCell>
                        <p className="font-semibold text-sm text-white">{p.name}</p>
                        <p className="text-xs text-slate-500">{[p.country, p.age ? `Age ${p.age}` : null].filter(Boolean).join(" · ")}</p>
                      </TableCell>
                      <TableCell>
                        {p.specialism && <Badge variant="secondary" className="text-xs bg-white/10 text-white/70">{p.specialism}</Badge>}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-slate-400">
                        {p.testCaps ?? 0} / {p.odiCaps ?? 0} / {p.t20Caps ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-emerald-400">{p.soldPrice ? fmt(p.soldPrice) : "—"}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-5xl mb-3">🛒</div>
              <p className="font-medium text-white">No players yet</p>
              <p className="text-sm text-slate-400">Start bidding to build your squad!</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Next Player Overlay ── */}
      {pendingNextPlayer && !soldInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="text-6xl animate-bounce">🏏</div>
            <p className="text-2xl font-black text-white">Next Player Up</p>
            <p className="text-slate-400">Preparing auction…</p>
          </div>
        </div>
      )}

      {/* ── Sold/Unsold Overlay ── */}
      {soldInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className={`text-center p-10 rounded-3xl border-2 max-w-sm w-full mx-4 shadow-2xl
            ${soldInfo.squadName === "UNSOLD"
              ? "bg-red-950/60 border-red-500/40"
              : "bg-emerald-950/60 border-emerald-500/40"}`}>
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
      <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/8 bg-slate-900/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-xl">🏏</span>
          <div>
            <h1 className="font-black text-base leading-tight tracking-tight">{auction.name}</h1>
            {me.role === "PARTICIPANT" && squad && (
              <p className="text-[11px] text-slate-500">Squad: <span className="text-emerald-400 font-semibold">{squad.name}</span></p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {me.role === "PARTICIPANT" && wallet != null && (
            <div className="flex items-center gap-1.5 bg-white/6 rounded-lg px-3 py-1.5 border border-white/8">
              <span className="text-[11px] text-slate-400">Balance</span>
              <span className="font-black text-sm tabular-nums text-emerald-400">{fmt(wallet)}</span>
            </div>
          )}
          {me.role === "PARTICIPANT" && squad && (
            <button onClick={() => setShowSquadDialog(true)}
              className="flex items-center gap-1.5 bg-white/6 hover:bg-white/10 border border-white/8 rounded-lg px-3 py-1.5 transition-colors">
              <span className="text-sm">🏏</span>
              <span className="text-sm font-bold">{squad.name}</span>
              <span className="bg-emerald-500/20 text-emerald-400 text-xs font-black px-1.5 py-0.5 rounded-full">{squadPlayers.length}</span>
            </button>
          )}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold
            ${auction.status === "LIVE" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-white/6 text-white/50 border border-white/8"}`}>
            {auction.status === "LIVE" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {auction.status}
          </div>
        </div>
      </header>

      {/* ══════════════ MAIN 3-COLUMN LAYOUT ══════════════ */}
      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">

        {/* ── COL 1: Player Card ── */}
        <div className="flex-1 flex flex-col p-4 gap-3 min-w-0 border-r border-white/8">

          {/* Player hero */}
          <div className="rounded-2xl overflow-hidden border border-white/8 shrink-0"
            style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
            <div className="px-5 pt-5 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-black tracking-tight truncate">{player.name}</h2>
                  {player.country && (
                    <p className="text-slate-400 text-sm mt-1">
                      🌍 {player.country}{player.age ? ` · Age ${player.age}` : ""}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {player.specialism && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold border
                        ${playerSt.bg} ${playerSt.text} border-current/20`}>
                        {player.specialism}
                      </span>
                    )}
                  </div>
                </div>
                <TimerRing seconds={seconds} />
              </div>
            </div>

            {/* Stats strip */}
            <div className="border-t border-white/8 grid grid-cols-3 divide-x divide-white/8">
              {[
                { label: "TEST", value: player.testCaps ?? 0, color: "text-sky-400" },
                { label: "ODI",  value: player.odiCaps  ?? 0, color: "text-violet-400" },
                { label: "T20",  value: player.t20Caps  ?? 0, color: "text-amber-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center py-3">
                  <span className={`text-xl font-black tabular-nums ${color}`}>{value}</span>
                  <span className="text-[10px] text-slate-500 font-semibold tracking-widest mt-0.5">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Player details */}
          <div className="rounded-xl border border-white/8 bg-white/3 p-4 shrink-0">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              {player.battingStyle && (
                <>
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Batting</span>
                  <span className="font-semibold text-white/85 text-sm">{player.battingStyle}</span>
                </>
              )}
              {player.bowlingStyle && (
                <>
                  <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Bowling</span>
                  <span className="font-semibold text-white/85 text-sm">{player.bowlingStyle}</span>
                </>
              )}
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Base Price</span>
              <span className="font-black text-amber-400 text-sm">{fmt(Number(player.basePrice ?? 0))}</span>
            </div>
          </div>

          {/* Live bid feed */}
          <div className="rounded-xl border border-white/8 bg-white/3 flex-1 flex flex-col min-h-0">
            <div className="px-4 pt-3 pb-2 flex items-center justify-between shrink-0">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Live Bids</span>
              {bidFeed.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1 min-h-0">
              {bidFeed.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-slate-600 italic">No bids yet — be first!</p>
                </div>
              ) : (
                [...bidFeed].reverse().map((bid, i) => (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs
                    ${i === 0
                      ? "bg-emerald-500/15 border border-emerald-500/30"
                      : "bg-white/4 border border-transparent"}`}>
                    <div className="flex items-center gap-2">
                      <span>{i === 0 ? "🏆" : "·"}</span>
                      <span className={`font-bold ${i === 0 ? "text-emerald-400" : "text-white/70"}`}>{bid.squadName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-black tabular-nums ${i === 0 ? "text-emerald-400" : "text-white/60"}`}>
                        {fmt(bid.amount)}
                      </span>
                      <span className="text-slate-600 text-[10px]">{timeAgo(bid.timestamp)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── COL 2: Bidding Panel ── */}
        <div className="w-64 shrink-0 flex flex-col p-4 gap-3 border-r border-white/8">

          {/* Current bid hero */}
          <div className="rounded-2xl border border-white/8 bg-white/3 p-5 text-center shrink-0">
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

          {/* Bid buttons */}
          <div className="rounded-xl border border-white/8 bg-white/3 p-4 shrink-0">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Place Bid</p>
            <div className="space-y-2">
              {[
                { label: "+10L", sub: "₹10 Lakhs",  increment: 1_000_000 },
                { label: "+25L", sub: "₹25 Lakhs",  increment: 2_500_000 },
                { label: "+50L", sub: "₹50 Lakhs",  increment: 5_000_000 },
                { label: "+1Cr", sub: "₹1 Crore",   increment: 10_000_000 },
              ].map(({ label, sub, increment }) => (
                <button key={label}
                  disabled={!canBid || placeBid.isPending}
                  onClick={() => placeBid.mutate({ auctionId, playerId: player.id, participantId: me.participantId, amount: getSafeNextBid(increment) })}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl font-bold text-sm transition-all
                    ${canBid
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_24px_rgba(16,185,129,0.4)] active:scale-98"
                      : "bg-white/5 text-white/25 cursor-not-allowed border border-white/8"
                    }`}>
                  <span className="font-black text-base">{label}</span>
                  <span className={`text-xs ${canBid ? "text-emerald-200/70" : "text-white/20"}`}>{sub}</span>
                </button>
              ))}
            </div>
            {!canBid && !soldInfo && (
              <p className="text-[11px] text-slate-600 text-center mt-3 italic">
                {!squad ? "Create a squad to bid" : "Bidding unavailable"}
              </p>
            )}
          </div>

          {/* Mobile wallet */}
          {me.role === "PARTICIPANT" && wallet != null && (
            <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 font-semibold">Your Balance</span>
              <span className="font-black text-emerald-400 tabular-nums">{fmt(wallet)}</span>
            </div>
          )}
        </div>

        {/* ── COL 3: All Squads ── */}
        <div className="w-72 shrink-0 flex flex-col border-l border-white/8 bg-slate-900/40">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-white/8">
            <div>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">All Squads</p>
              <p className="text-xs text-white/60 mt-0.5 font-semibold">{sortedSquads.length} participants</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Squad list — scrollable */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {sortedSquads.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-slate-600 italic">No squads yet</p>
              </div>
            ) : (
              sortedSquads.map((s) => {
                const isMe = s.name === squad?.name
                const key  = s.id ?? s.name
                return (
                  <SquadCard
                    key={key}
                    squad={s}
                    isMe={isMe}
                    expanded={expandedSquad === key}
                    onToggle={() => setExpandedSquad(expandedSquad === key ? null : key)}
                  />
                )
              })
            )}
          </div>

          {/* Footer legend */}
          <div className="px-4 py-3 border-t border-white/8 shrink-0">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {[
                { label: "Batsman",    color: "bg-sky-400" },
                { label: "Bowler",     color: "bg-rose-400" },
                { label: "All-Rounder",color: "bg-violet-400" },
                { label: "Keeper",     color: "bg-amber-400" },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
                  <span className="text-[10px] text-slate-600">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}