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
  soldPrice?: number
}

type Squad = {
  name: string
  players?: SquadPlayer[]
}

/* ───────────────── HELPERS ───────────────── */

function formatLakhs(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(0)}L`
  return `₹${amount.toLocaleString()}`
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
  // timerKey increments every resetForNextPlayer so countdown restarts
  // even when the same player id comes back (e.g. after unsold)
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

  const { data: player, refetch: refetchPlayer } = useQuery({
    // ✅ auctionId in key — unique cache per auction
    queryKey: ["currentPlayer", auctionId],
    // ✅ auctionId passed as argument — fixes literal "{auctionId}" URL bug
    queryFn: () => auctionEngineApi.currentPlayer(auctionId),
    // ✅ no refetchInterval — socket + manual refetchPlayer() drives updates
    //    removing polling stops the backend loop you saw in logs
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
  // timerKey changes on every resetForNextPlayer, forcing a fresh 10s countdown
  // even when the same player id is re-used after an unsold result
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

    // Cancel any in-flight poll when effect re-runs
    if (pollRef.current) {
      clearTimeout(pollRef.current)
      pollRef.current = null
    }

    const currentPlayerId = player.id

    /* After sold/unsold:
       1. Wait for the banner to be visible (bannerDelayMs)
       2. Clear the sold/unsold overlay
       3. Mark pendingNextPlayer = currentPlayerId so the UI shows a loading state
       4. Poll refetchPlayer() every 1.5 s until a DIFFERENT player id arrives
          then clear pendingNextPlayer so the card re-enables */
    const advanceToNextPlayer = (bannerDelayMs: number) => {
      if (pollRef.current) clearTimeout(pollRef.current)

      pollRef.current = setTimeout(() => {
        resetForNextPlayer()                      // clear overlay, reset timer
        setPendingNextPlayer(currentPlayerId)     // show loading until new player

        const poll = async () => {
          const result = await refetchPlayer()
          const next = result.data
          if (next?.id && next.id !== currentPlayerId) {
            // Genuine new player — clear the loading state
            setPendingNextPlayer(null)
            pollRef.current = null
          } else {
            // Backend still on same player — retry in 1.5 s
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

  const squadPlayerCount = squad?.players?.length ?? 0

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              🏏 {squad?.name ?? "My Squad"}&nbsp;
              <span className="text-muted-foreground text-base font-normal">
                ({squadPlayerCount} player{squadPlayerCount !== 1 ? "s" : ""})
              </span>
            </DialogTitle>
          </DialogHeader>

          {squadPlayerCount > 0 ? (
            <ul className="divide-y max-h-80 overflow-y-auto">
              {squad!.players!.map((p) => (
                <li key={p.id} className="flex justify-between py-2 text-sm">
                  <span>{p.name}</span>
                  <span className="text-muted-foreground font-medium">
                    {p.soldPrice ? formatLakhs(p.soldPrice) : "—"}
                  </span>
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
        <h1 className="text-3xl font-bold">{auction.name}</h1>

        <div className="flex items-center gap-3">
          {me.role === "PARTICIPANT" && squad && (
            <Button
              variant="outline"
              onClick={() => setShowSquadDialog(true)}
              className="flex items-center gap-2"
            >
              🏏 My Squad
              <Badge variant="secondary">{squadPlayerCount}</Badge>
            </Button>
          )}
          <Badge className="text-sm px-3 py-1">{auction.status}</Badge>
        </div>
      </div>

      {/* ── Player Card ── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle className="text-2xl">{player.name}</CardTitle>

          {/* ── Timer ── */}
          <div className="flex flex-col items-center min-w-[64px]">
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

        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-lg">
              Current Bid:{" "}
              <span className="font-semibold">{formatLakhs(currentBid)}</span>
            </p>
            {highestBid?.bidderName && (
              <p className="text-sm text-muted-foreground">
                by {highestBid.bidderName}
              </p>
            )}
          </div>

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