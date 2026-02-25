/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useCallback } from "react"
import { AxiosError } from "axios"

import { auctionApi } from "@/lib/auctionApi"
import { auctionEngineApi } from "@/lib/auctionEngineApi"
import { biddingApi } from "@/lib/biddingApi"
import { squadApi } from "@/lib/squadApi"
import { authApi } from "@/lib/auth"
import { createAuctionSocket } from "@/lib/auctionSocket"
import { useAuctionRoomStore } from "@/store/auctionRoomStore"

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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

type HighestBid = {
  amount: number
  bidderName: string
}

type WalletResponse = {
  balance: number
}

type SquadPlayer = {
  id: string
  name: string
  country?: string
  age?: number
  specialism?: string
  battingStyle?: string
  bowlingStyle?: string
  testCaps?: number
  odiCaps?: number
  t20Caps?: number
  basePrice?: number
  soldPrice?: number
}

type Squad = {
  name: string
  players?: SquadPlayer[]
}

type Player = {
  id: string
  name: string
  country?: string
  age?: number
  specialism?: string
  battingStyle?: string
  bowlingStyle?: string
  testCaps?: number
  odiCaps?: number
  t20Caps?: number
  basePrice?: number
  isSold?: boolean
  isAuctioned?: boolean
}

/* ───────────────── HELPERS ───────────────── */

function formatLakhs(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(0)}L`
  return `₹${amount.toLocaleString()}`
}

function formatTimeAgo(timestamp: number) {
  const secs = Math.floor((Date.now() - timestamp) / 1000)
  if (secs < 5) return "just now"
  if (secs < 60) return `${secs}s ago`
  return `${Math.floor(secs / 60)}m ago`
}

/* ───────────────── BID FEED ───────────────── */

function BidFeed() {
  const bidFeed = useAuctionRoomStore((s) => s.bidFeed)
  if (!bidFeed || bidFeed.length === 0) return (
    <div className="text-center py-6 text-muted-foreground text-sm">
      No bids yet. Be the first to bid!
    </div>
  )

  return (
    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
      {[...bidFeed].reverse().map((bid, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
            i === 0
              ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800"
              : "bg-muted/40 border border-transparent"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base">{i === 0 ? "🏆" : "•"}</span>
            <span className={`font-semibold ${i === 0 ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
              {bid.squadName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-bold tabular-nums ${i === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"}`}>
              {formatLakhs(bid.amount)}
            </span>
            <span className="text-xs text-muted-foreground w-14 text-right">
              {formatTimeAgo(bid.timestamp)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───────────────── TIMER RING ───────────────── */

function TimerRing({ seconds }: { seconds: number }) {
  const color = seconds <= 3 ? "#ef4444" : seconds <= 6 ? "#f59e0b" : "#10b981"
  const textColor = seconds <= 3 ? "text-red-500" : seconds <= 6 ? "text-amber-500" : "text-emerald-500"
  const circumference = 2 * Math.PI * 28
  const offset = circumference * (1 - seconds / 10)

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-20 h-20">
        <svg className="absolute inset-0 -rotate-90" width="80" height="80">
          <circle cx="40" cy="40" r="28" fill="none" stroke="#e5e7eb" strokeWidth="5" />
          <circle
            cx="40" cy="40" r="28"
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s linear, stroke 0.3s" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold tabular-nums leading-none ${textColor}`}>
            {seconds}
          </span>
          <span className="text-[10px] text-muted-foreground">sec</span>
        </div>
      </div>
    </div>
  )
}

/* ───────────────── PAGE ───────────────── */

function AuctionRoomPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId" })
  const queryClient = useQueryClient()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Store ── */
  const squadName        = useAuctionRoomStore((s) => s.squadName)
  const seconds          = useAuctionRoomStore((s) => s.seconds)
  const soldInfo         = useAuctionRoomStore((s) => s.soldInfo)
  const showSquadDialog  = useAuctionRoomStore((s) => s.showSquadDialog)
  const wallet           = useAuctionRoomStore((s) => s.wallet)

  const setSquadName       = useAuctionRoomStore((s) => s.setSquadName)
  const setSeconds         = useAuctionRoomStore((s) => s.setSeconds)
  const decrementSeconds   = useAuctionRoomStore((s) => s.decrementSeconds)
  const setSoldInfo        = useAuctionRoomStore((s) => s.setSoldInfo)
  const addBidToFeed       = useAuctionRoomStore((s) => s.addBidToFeed)
  const setWallet          = useAuctionRoomStore((s) => s.setWallet)
  const resetForNextPlayer = useAuctionRoomStore((s) => s.resetForNextPlayer)
  const setShowSquadDialog = useAuctionRoomStore((s) => s.setShowSquadDialog)
  const timerKey              = useAuctionRoomStore((s) => s.timerKey)
  const pendingNextPlayer     = useAuctionRoomStore((s) => s.pendingNextPlayer)
  const setPendingNextPlayer  = useAuctionRoomStore((s) => s.setPendingNextPlayer)

  /* ── Queries ── */
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: authApi.me })

  const { data: auction } = useQuery({
    queryKey: ["auction", auctionId],
    queryFn: () => auctionApi.getById(auctionId),
  })

  const { data: player, refetch: refetchPlayer } = useQuery<Player>({
    queryKey: ["currentPlayer", auctionId],
    queryFn: () => auctionEngineApi.currentPlayer(auctionId),
    refetchInterval: false,
  })

  const { data: highestBid } = useQuery<HighestBid>({
    queryKey: ["highestBid", player?.id],
    queryFn: () => biddingApi.highestBid(auctionId, player!.id),
    enabled: !!player?.id,
    refetchInterval: 2000,
  })

  const { data: walletData } = useQuery<WalletResponse>({
    queryKey: ["wallet", me?.participantId],
    queryFn: () => biddingApi.getWallet(me!.participantId),
    enabled: !!me?.participantId && me?.role === "PARTICIPANT",
  })

  const { data: squad, error: squadError, refetch: refetchSquad } = useQuery<Squad>({
    queryKey: ["mySquad", auctionId, me?.participantId],
    queryFn: () => squadApi.mySquad(auctionId, me!.participantId),
    enabled: !!me?.participantId,
    retry: false,
  })

  /* ── Timer ── */
  const startCountdown = useCallback((from: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSeconds(from)
    timerRef.current = setInterval(() => decrementSeconds(), 1000)
  }, [setSeconds, decrementSeconds])

  useEffect(() => {
    if (seconds === 0 && timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [seconds])

  useEffect(() => {
    if (player?.id) startCountdown(10)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [player?.id, timerKey, startCountdown])

  /* ── Wallet sync ── */
  useEffect(() => {
    if (walletData?.balance !== undefined) setWallet(Number(walletData.balance))
  }, [walletData?.balance, setWallet])

  /* ── Safe bid ── */
  function getSafeNextBid(increment: number) {
    const latestBid = queryClient.getQueryData<HighestBid>(["highestBid", player?.id])
    const base = latestBid?.amount ?? Number(player?.basePrice ?? 0)
    return base + increment
  }

  /* ── Mutations ── */
  const createSquad = useMutation({
    mutationFn: squadApi.create,
    onSuccess: () => refetchSquad(),
  })

  const placeBid = useMutation({
    mutationFn: biddingApi.placeBid,
    onError: (err) => {
      alert(err instanceof AxiosError ? err.response?.data?.message ?? "Bid failed" : "Bid failed")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highestBid", player?.id] })
    },
  })

  /* ── Socket ── */
  useEffect(() => {
    if (!player?.id || !me?.participantId) return
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }

    const currentPlayerId = player.id

    const advanceToNextPlayer = (bannerDelayMs: number) => {
      if (pollRef.current) clearTimeout(pollRef.current)
      pollRef.current = setTimeout(() => {
        resetForNextPlayer()
        setPendingNextPlayer(currentPlayerId)
        const poll = async () => {
          const result = await refetchPlayer()
          const next = result.data
          if (next?.id && next.id !== currentPlayerId) {
            setPendingNextPlayer(null)
            pollRef.current = null
          } else {
            pollRef.current = setTimeout(poll, 1500)
          }
        }
        pollRef.current = setTimeout(poll, 500)
      }, bannerDelayMs)
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
          refetchSquad()
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

    return () => {
      if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
      void socket.deactivate()
    }
  }, [player?.id, me?.participantId, startCountdown, queryClient, addBidToFeed, setSeconds, setSoldInfo, setWallet, resetForNextPlayer, refetchPlayer, refetchSquad])

  /* ── Guards ── */
  if (!auction || !me || !player) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-2">
          <div className="text-4xl animate-pulse">🏏</div>
          <p className="text-muted-foreground">Loading auction...</p>
        </div>
      </div>
    )
  }

  /* ── Derived ── */
  const currentBid = highestBid?.amount ?? Number(player.basePrice ?? 0)
  const canBid = auction.status === "LIVE" && !!squad && !soldInfo && !pendingNextPlayer && !!me.participantId
  const squadMissing = me.role === "PARTICIPANT" && squadError instanceof AxiosError && squadError.response?.status === 404
  const squadPlayers = squad?.players ?? []
  const squadPlayerCount = squadPlayers.length

  /* ── UI ── */
  return (
    <div className="min-h-screen bg-background">

      {/* ── Create Squad Dialog ── */}
      {squadMissing && (
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl">🏏 Name Your Squad</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Choose a squad name to enter the auction.</p>
            <Input
              placeholder="e.g. Mumbai Indians"
              value={squadName}
              onChange={(e) => setSquadName(e.target.value)}
              className="mt-1"
            />
            <Button
              disabled={!squadName.trim()}
              className="w-full"
              onClick={() => createSquad.mutate({ auctionId, participantId: me.participantId, name: squadName })}
            >
              Enter Auction →
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* ── My Squad Dialog ── */}
      <Dialog open={showSquadDialog} onOpenChange={setShowSquadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="text-2xl">🏏</span>
              <div>
                <span className="text-xl font-bold">{squad?.name ?? "My Squad"}</span>
                <span className="text-muted-foreground text-sm font-normal ml-2">
                  {squadPlayerCount} player{squadPlayerCount !== 1 ? "s" : ""}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {squadPlayerCount > 0 ? (
            <div className="overflow-y-auto flex-1 mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Caps (T/O/T)</TableHead>
                    <TableHead className="text-right">Sold For</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {squadPlayers.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold text-sm">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[p.country, p.age ? `Age ${p.age}` : null].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          {p.specialism && <Badge variant="secondary" className="text-xs">{p.specialism}</Badge>}
                          <p className="text-xs text-muted-foreground">{p.battingStyle}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {p.testCaps ?? 0} / {p.odiCaps ?? 0} / {p.t20Caps ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-emerald-600">
                          {p.soldPrice ? formatLakhs(p.soldPrice) : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-5xl mb-3">🛒</div>
              <p className="font-medium">No players yet</p>
              <p className="text-sm text-muted-foreground">Start bidding to build your squad!</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Loading Next Player Overlay ── */}
      {pendingNextPlayer && !soldInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <Card className="w-80 text-center shadow-2xl border-0">
            <CardContent className="py-10 space-y-4">
              <div className="text-5xl animate-bounce">🏏</div>
              <div>
                <p className="text-lg font-bold">Next Player Up</p>
                <p className="text-sm text-muted-foreground mt-1">Preparing auction...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Sold / Unsold Overlay ── */}
      {soldInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <Card className={`w-96 text-center shadow-2xl border-2 ${soldInfo.squadName === "UNSOLD" ? "border-red-200" : "border-emerald-200"}`}>
            <CardContent className="py-10 space-y-3">
              <div className="text-6xl mb-2">
                {soldInfo.squadName === "UNSOLD" ? "🚫" : "🎉"}
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {soldInfo.squadName === "UNSOLD" ? "Unsold" : "Sold!"}
                </p>
                <p className="text-lg font-semibold mt-1">{soldInfo.playerName}</p>
              </div>
              {soldInfo.squadName !== "UNSOLD" && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-6 py-3 mt-2">
                  <p className="text-sm text-muted-foreground">to</p>
                  <p className="font-bold text-lg text-emerald-700 dark:text-emerald-400">{soldInfo.squadName}</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">{formatLakhs(soldInfo.amount)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Top Nav Bar ── */}
      <div className="border-b bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🏏</span>
            <div>
              <h1 className="font-bold text-base leading-tight">{auction.name}</h1>
              {me.role === "PARTICIPANT" && squad && (
                <p className="text-xs text-muted-foreground">
                  Squad: <span className="font-semibold text-foreground">{squad.name}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Wallet balance */}
            {me.role === "PARTICIPANT" && wallet != null && (
              <div className="hidden sm:flex items-center gap-1.5 bg-muted rounded-lg px-3 py-1.5">
                <span className="text-xs text-muted-foreground">Balance</span>
                <span className="font-bold text-sm tabular-nums">{formatLakhs(wallet)}</span>
              </div>
            )}

            {/* Squad button */}
            {me.role === "PARTICIPANT" && squad && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSquadDialog(true)}
                className="flex items-center gap-1.5"
              >
                🏏 {squad.name}
                <Badge variant="secondary" className="ml-1 text-xs">{squadPlayerCount}</Badge>
              </Button>
            )}

            <Badge
              className={`text-xs px-2.5 py-1 ${auction.status === "LIVE" ? "bg-emerald-500 hover:bg-emerald-500 text-white" : ""}`}
            >
              {auction.status === "LIVE" && <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              {auction.status}
            </Badge>
          </div>
        </div>

        {/* Player name pills below nav */}
        {me.role === "PARTICIPANT" && squadPlayerCount > 0 && (
          <div className="max-w-5xl mx-auto px-6 pb-2">
            <p className="text-xs text-muted-foreground truncate">
              {squadPlayers.map((p) => p.name).join(" · ")}
            </p>
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left: Player Info ── */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="overflow-hidden">
            {/* Player Header */}
            <div className="bg-linear-to-br from-slate-900 to-slate-700 text-white px-6 py-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">{player.name}</h2>
                  {player.country && (
                    <p className="text-slate-300 text-sm mt-1">
                      🌍 {player.country}{player.age ? ` · Age ${player.age}` : ""}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    {player.specialism && (
                      <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium">
                        {player.specialism}
                      </span>
                    )}
                  </div>
                </div>
                <TimerRing seconds={seconds} />
              </div>
            </div>

            <CardContent className="pt-5 space-y-5">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                {player.battingStyle && (
                  <>
                    <span className="text-muted-foreground">Batting</span>
                    <span className="font-medium">{player.battingStyle}</span>
                  </>
                )}
                {player.bowlingStyle && (
                  <>
                    <span className="text-muted-foreground">Bowling</span>
                    <span className="font-medium">{player.bowlingStyle}</span>
                  </>
                )}
                <span className="text-muted-foreground">Base Price</span>
                <span className="font-semibold text-amber-600">{formatLakhs(Number(player.basePrice ?? 0))}</span>
              </div>

              <Separator />

              {/* Caps */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                  International Caps
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Test", value: player.testCaps ?? 0, color: "text-blue-600" },
                    { label: "ODI", value: player.odiCaps ?? 0, color: "text-violet-600" },
                    { label: "T20", value: player.t20Caps ?? 0, color: "text-amber-600" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center bg-muted/50 rounded-xl py-3">
                      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Bidding Panel ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Current Bid Card */}
          <Card className="border-2 border-primary/10">
            <CardContent className="pt-5 space-y-4">

              {/* Bid hero */}
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Current Bid
                </p>
                <p className="text-4xl font-bold tabular-nums tracking-tight">
                  {formatLakhs(currentBid)}
                </p>
                {highestBid?.bidderName ? (
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-full px-3 py-1 mt-1">
                    <span>🏆</span>
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                      {highestBid.bidderName}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No bids yet</p>
                )}
              </div>

              <Separator />

              {/* Bid buttons */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  Place Bid
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "+10L", increment: 1_000_000 },
                    { label: "+25L", increment: 2_500_000 },
                    { label: "+50L", increment: 5_000_000 },
                  ].map(({ label, increment }) => (
                    <Button
                      key={label}
                      disabled={!canBid || placeBid.isPending}
                      variant={canBid ? "default" : "outline"}
                      className="font-bold"
                      onClick={() =>
                        placeBid.mutate({
                          auctionId,
                          playerId: player.id,
                          participantId: me.participantId,
                          amount: getSafeNextBid(increment),
                        })
                      }
                    >
                      {label}
                    </Button>
                  ))}
                </div>

                {!canBid && !soldInfo && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    {!squad ? "Create a squad to bid" : "Bidding unavailable"}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Live Bid Feed Card */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                Live Bids
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <BidFeed />
            </CardContent>
          </Card>

          {/* Wallet card — mobile only (shown in nav on desktop) */}
          {me.role === "PARTICIPANT" && wallet != null && (
            <Card className="sm:hidden">
              <CardContent className="py-3 px-4 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your Balance</span>
                <span className="font-bold tabular-nums">{formatLakhs(wallet)}</span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}