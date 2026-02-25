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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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

/* ───────────────── BID FEED COMPONENT ───────────────── */

function BidFeed() {
  const bidFeed = useAuctionRoomStore((s) => s.bidFeed)

  if (!bidFeed || bidFeed.length === 0) return null

  const reversed = [...bidFeed].reverse()

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">
        Recent Bids
      </p>
      <div className="max-h-36 overflow-y-auto space-y-1">
        {reversed.map((bid, i) => (
          <div
            key={i}
            className={`flex items-center justify-between text-sm px-3 py-1.5 rounded-md transition-colors ${
              i === 0
                ? "bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800"
                : "bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2">
              {i === 0 && <span>🏆</span>}
              <span
                className={`font-medium ${
                  i === 0 ? "text-green-700 dark:text-green-400" : "text-foreground"
                }`}
              >
                {bid.squadName}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`font-bold tabular-nums ${
                  i === 0 ? "text-green-700 dark:text-green-400" : ""
                }`}
              >
                {formatLakhs(bid.amount)}
              </span>
              <span className="text-xs text-muted-foreground w-14 text-right shrink-0">
                {formatTimeAgo(bid.timestamp)}
              </span>
            </div>
          </div>
        ))}
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

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
  })

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

  const {
    data: squad,
    error: squadError,
    refetch: refetchSquad,
  } = useQuery<Squad>({
    queryKey: ["mySquad", auctionId, me?.participantId],
    queryFn: () => squadApi.mySquad(auctionId, me!.participantId),
    enabled: !!me?.participantId,
    retry: false,
  })

  /* ───────────────── TIMER ───────────────── */

  const startCountdown = useCallback((from: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSeconds(from)
    timerRef.current = setInterval(() => {
      decrementSeconds()
    }, 1000)
  }, [setSeconds, decrementSeconds])

  useEffect(() => {
    if (seconds === 0 && timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [seconds])

  useEffect(() => {
    if (player?.id) startCountdown(10)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [player?.id, timerKey, startCountdown])

  /* ───────────────── WALLET SYNC ───────────────── */

  useEffect(() => {
    if (walletData?.balance !== undefined) {
      setWallet(Number(walletData.balance))
    }
  }, [walletData?.balance, setWallet])

  /* ───────────────── SAFE BID ───────────────── */

  function getSafeNextBid(increment: number) {
    const latestBid = queryClient.getQueryData<HighestBid>(["highestBid", player?.id])
    const base = latestBid?.amount ?? Number(player?.basePrice ?? 0)
    return base + increment
  }

  /* ───────────────── MUTATIONS ───────────────── */

  const createSquad = useMutation({
    mutationFn: squadApi.create,
    onSuccess: () => refetchSquad(),
  })

  const placeBid = useMutation({
    mutationFn: biddingApi.placeBid,
    onError: (err) => {
      alert(
        err instanceof AxiosError
          ? err.response?.data?.message ?? "Bid failed"
          : "Bid failed"
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highestBid", player?.id] })
    },
  })

  /* ───────────────── SOCKET ───────────────── */

  useEffect(() => {
    if (!player?.id || !me?.participantId) return

    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }

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

    const socket = createAuctionSocket(
      currentPlayerId,
      me.participantId,
      (event: AuctionEvent) => {
        switch (event.type) {

          case "NEW_BID":
            startCountdown(10)
            queryClient.invalidateQueries({ queryKey: ["highestBid", currentPlayerId] })
            if (event.squadName) {
              addBidToFeed({
                squadName: event.squadName,
                amount: Number(event.amount ?? 0),
                timestamp: Date.now(),
              })
            }
            break

          case "PLAYER_SOLD":
            if (timerRef.current) {
              clearInterval(timerRef.current)
              timerRef.current = null
            }
            setSeconds(0)
            setSoldInfo({
              squadName: event.squadName ?? "Unknown",
              playerName: player.name,
              amount: Number(event.amount ?? 0),
            })
            queryClient.invalidateQueries({ queryKey: ["mySquad"] })
            refetchSquad()
            advanceToNextPlayer(2500)
            break

          case "SYSTEM_MESSAGE":
            if (event.message === "PLAYER_UNSOLD") {
              if (timerRef.current) {
                clearInterval(timerRef.current)
                timerRef.current = null
              }
              setSeconds(0)
              setSoldInfo({
                squadName: "UNSOLD",
                playerName: player.name,
                amount: 0,
              })
              advanceToNextPlayer(1500)
            }
            break

          case "WALLET_UPDATE":
            if (event.walletBalance !== undefined) {
              setWallet(Number(event.walletBalance))
            }
            break
        }
      }
    )

    return () => {
      if (pollRef.current) {
        clearTimeout(pollRef.current)
        pollRef.current = null
      }
      void socket.deactivate()
    }

  }, [
    player?.id,
    me?.participantId,
    startCountdown,
    queryClient,
    addBidToFeed,
    setSeconds,
    setSoldInfo,
    setWallet,
    resetForNextPlayer,
    refetchPlayer,
    refetchSquad,
  ])

  /* ───────────────── GUARDS ───────────────── */

  if (!auction || !me || !player) {
    return <p>Loading auction...</p>
  }

  /* ───────────────── DERIVED STATE ───────────────── */

  const currentBid = highestBid?.amount ?? Number(player.basePrice ?? 0)

  const canBid =
    auction.status === "LIVE" &&
    !!squad &&
    !soldInfo &&
    !pendingNextPlayer &&
    !!me.participantId

  const squadMissing =
    me.role === "PARTICIPANT" &&
    squadError instanceof AxiosError &&
    squadError.response?.status === 404

  const squadPlayers = squad?.players ?? []
  const squadPlayerCount = squadPlayers.length

  const timerColor =
    seconds <= 3 ? "text-red-500" :
    seconds <= 6 ? "text-yellow-500" :
    "text-green-600"

  /* ───────────────── UI ───────────────── */

  return (
    <div className="p-8 space-y-6">

      {/* ── Create Squad dialog ── */}
      {squadMissing && (
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Your Squad</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Squad name"
              value={squadName}
              onChange={(e) => setSquadName(e.target.value)}
            />
            <Button
              disabled={!squadName.trim()}
              onClick={() =>
                createSquad.mutate({
                  auctionId,
                  participantId: me.participantId,
                  name: squadName,
                })
              }
            >
              Enter Auction
            </Button>
          </DialogContent>
        </Dialog>
      )}

      {/* ── My Squad dialog ── */}
      <Dialog open={showSquadDialog} onOpenChange={setShowSquadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              🏏 {squad?.name ?? "My Squad"}&nbsp;
              <span className="text-muted-foreground text-base font-normal">
                ({squadPlayerCount} player{squadPlayerCount !== 1 ? "s" : ""})
              </span>
            </DialogTitle>
          </DialogHeader>

          {squadPlayerCount > 0 ? (
            <ul className="divide-y max-h-125 overflow-y-auto">
              {squadPlayers.map((p) => (
                <li key={p.id} className="py-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">{p.name}</span>
                    <span className="text-sm font-bold text-green-600">
                      {p.soldPrice ? formatLakhs(p.soldPrice) : "—"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {p.country && <span>🌍 {p.country}</span>}
                    {p.age && <span>🎂 Age {p.age}</span>}
                    {p.specialism && <span>⭐ {p.specialism}</span>}
                    {p.battingStyle && <span>🦇 {p.battingStyle}</span>}
                    {p.bowlingStyle && <span>⚡ {p.bowlingStyle}</span>}
                    {p.basePrice && <span>💰 Base: {formatLakhs(Number(p.basePrice))}</span>}
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="bg-muted rounded px-2 py-0.5">
                      Test <strong>{p.testCaps ?? 0}</strong>
                    </span>
                    <span className="bg-muted rounded px-2 py-0.5">
                      ODI <strong>{p.odiCaps ?? 0}</strong>
                    </span>
                    <span className="bg-muted rounded px-2 py-0.5">
                      T20 <strong>{p.t20Caps ?? 0}</strong>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm py-6 text-center">
              No players bought yet.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Waiting for next player overlay ── */}
      {pendingNextPlayer && !soldInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Card className="w-80 text-center shadow-2xl">
            <CardContent className="py-8 space-y-3">
              <div className="text-4xl animate-spin inline-block">⏳</div>
              <p className="text-lg font-semibold">Loading next player...</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Sold / Unsold overlay ── */}
      {soldInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Card className="w-80 text-center shadow-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">
                {soldInfo.squadName === "UNSOLD" ? "🚫 Unsold" : "🎉 Sold!"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="font-semibold text-lg">{soldInfo.playerName}</p>
              {soldInfo.squadName !== "UNSOLD" && (
                <>
                  <p className="text-muted-foreground">to {soldInfo.squadName}</p>
                  <p className="text-xl font-bold">{formatLakhs(soldInfo.amount)}</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{auction.name}</h1>
          {me.role === "PARTICIPANT" && squad && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Your squad: <span className="font-semibold text-foreground">{squad.name}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {me.role === "PARTICIPANT" && squad && (
            <div className="flex flex-col items-end gap-1">
              <Button
                variant="outline"
                onClick={() => setShowSquadDialog(true)}
                className="flex items-center gap-2"
              >
                🏏 {squad.name}
                <Badge variant="secondary">{squadPlayerCount}</Badge>
              </Button>
              {squadPlayerCount > 0 && (
                <p className="text-xs text-muted-foreground max-w-xs text-right leading-snug">
                  {squadPlayers.map((p) => p.name).join(" · ")}
                </p>
              )}
            </div>
          )}
          <Badge className="text-sm px-3 py-1">{auction.status}</Badge>
        </div>
      </div>

      {/* ── Player Card ── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{player.name}</CardTitle>
            {player.country && (
              <p className="text-sm text-muted-foreground">
                🌍 {player.country}{player.age ? ` · Age ${player.age}` : ""}
              </p>
            )}
          </div>

          {/* ── Timer ── */}
          <div className="flex flex-col items-center min-w-16">
            <span className={`text-4xl font-bold tabular-nums leading-none ${timerColor}`}>
              {seconds}
            </span>
            <span className="text-xs text-muted-foreground mt-1">seconds</span>
            <svg width="56" height="56" className="mt-1 -rotate-90">
              <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="4" />
              <circle
                cx="28" cy="28" r="24"
                fill="none"
                stroke={seconds <= 3 ? "#ef4444" : seconds <= 6 ? "#eab308" : "#22c55e"}
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 24}`}
                strokeDashoffset={`${2 * Math.PI * 24 * (1 - seconds / 10)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.8s linear, stroke 0.3s" }}
              />
            </svg>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">

          {/* ── Player Details Grid ── */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            {player.specialism && (
              <>
                <span className="text-muted-foreground">Specialism</span>
                <span className="font-medium">{player.specialism}</span>
              </>
            )}
            {player.battingStyle && (
              <>
                <span className="text-muted-foreground">Batting Style</span>
                <span className="font-medium">{player.battingStyle}</span>
              </>
            )}
            {player.bowlingStyle && (
              <>
                <span className="text-muted-foreground">Bowling Style</span>
                <span className="font-medium">{player.bowlingStyle}</span>
              </>
            )}
            <span className="text-muted-foreground">Base Price</span>
            <span className="font-medium">{formatLakhs(Number(player.basePrice ?? 0))}</span>
          </div>

          {/* ── International Caps ── */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              International Caps
            </p>
            <div className="flex gap-3">
              <div className="flex flex-col items-center bg-muted rounded-lg px-5 py-2">
                <span className="text-xl font-bold">{player.testCaps ?? 0}</span>
                <span className="text-xs text-muted-foreground">Test</span>
              </div>
              <div className="flex flex-col items-center bg-muted rounded-lg px-5 py-2">
                <span className="text-xl font-bold">{player.odiCaps ?? 0}</span>
                <span className="text-xs text-muted-foreground">ODI</span>
              </div>
              <div className="flex flex-col items-center bg-muted rounded-lg px-5 py-2">
                <span className="text-xl font-bold">{player.t20Caps ?? 0}</span>
                <span className="text-xs text-muted-foreground">T20</span>
              </div>
            </div>
          </div>

          {/* ── Current Bid + Highest Bidder ── */}
          <div className="border-t pt-4 space-y-4">

            {/* Big bid + bidder hero row */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Current Bid
                </p>
                <p className="text-3xl font-bold tabular-nums">
                  {formatLakhs(currentBid)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Highest Bidder
                </p>
                {highestBid?.bidderName ? (
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-lg">🏆</span>
                    <span className="font-semibold text-base">
                      {highestBid.bidderName}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No bids yet</p>
                )}
              </div>
            </div>

            {/* Live bid feed — populated by socket NEW_BID events */}
            <BidFeed />
          </div>

          {/* ── Bid Buttons ── */}
          <div className="flex gap-2">
            <Button
              disabled={!canBid || placeBid.isPending}
              onClick={() =>
                placeBid.mutate({
                  auctionId,
                  playerId: player.id,
                  participantId: me.participantId,
                  amount: getSafeNextBid(1_000_000),
                })
              }
            >
              +10L
            </Button>

            <Button
              disabled={!canBid || placeBid.isPending}
              onClick={() =>
                placeBid.mutate({
                  auctionId,
                  playerId: player.id,
                  participantId: me.participantId,
                  amount: getSafeNextBid(2_500_000),
                })
              }
            >
              +25L
            </Button>

            <Button
              disabled={!canBid || placeBid.isPending}
              onClick={() =>
                placeBid.mutate({
                  auctionId,
                  playerId: player.id,
                  participantId: me.participantId,
                  amount: getSafeNextBid(5_000_000),
                })
              }
            >
              +50L
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}