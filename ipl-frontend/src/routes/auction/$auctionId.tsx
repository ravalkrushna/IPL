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

  /* ── Store ── */

  const squadName = useAuctionRoomStore((s) => s.squadName)
  const seconds = useAuctionRoomStore((s) => s.seconds)
  const soldInfo = useAuctionRoomStore((s) => s.soldInfo)

  const setSquadName = useAuctionRoomStore((s) => s.setSquadName)
  const setSeconds = useAuctionRoomStore((s) => s.setSeconds)
  const decrementSeconds = useAuctionRoomStore((s) => s.decrementSeconds)
  const setSoldInfo = useAuctionRoomStore((s) => s.setSoldInfo)
  const addBidToFeed = useAuctionRoomStore((s) => s.addBidToFeed)
  const setWallet = useAuctionRoomStore((s) => s.setWallet)
  const resetForNextPlayer = useAuctionRoomStore((s) => s.resetForNextPlayer)

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
    queryKey: ["currentPlayer"],
    queryFn: auctionEngineApi.currentPlayer,
    refetchInterval: 2000,
  })

  const { data: highestBid } = useQuery<HighestBid>({
    queryKey: ["highestBid", player?.id],
    queryFn: () => biddingApi.highestBid(auctionId, player!.id),
    enabled: !!player,
    refetchInterval: 1000,
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
  } = useQuery({
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
  }, [player?.id, startCountdown])

  /* ───────────────── WALLET SYNC ───────────────── */

  useEffect(() => {
    if (walletData?.balance !== undefined) {
      setWallet(Number(walletData.balance))
    }
  }, [walletData?.balance, setWallet])

  /* ───────────────── SAFE BID ───────────────── */

  function getSafeNextBid(increment: number) {
    const latestBid = queryClient.getQueryData<HighestBid>([
      "highestBid",
      player?.id,
    ])

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
      queryClient.invalidateQueries({
        queryKey: ["highestBid", player.id],
      })
    },
  })

  /* ───────────────── SOCKET ───────────────── */

  useEffect(() => {
    if (!player?.id || !me?.participantId) return

    const socket = createAuctionSocket(
      player.id,
      me.participantId,
      (event: AuctionEvent) => {
        switch (event.type) {

          case "NEW_BID":
            startCountdown(10)
            queryClient.invalidateQueries({
              queryKey: ["highestBid", player?.id],
            })

            if (event.squadName) {
              addBidToFeed({
                squadName: event.squadName,
                amount: Number(event.amount ?? 0),
                timestamp: Date.now(),
              })
            }
            break

          case "PLAYER_SOLD":
            if (timerRef.current) clearInterval(timerRef.current)

            setSeconds(0)

            setSoldInfo({
              squadName: event.squadName ?? "Unknown",
              playerName: player.name,
              amount: Number(event.amount ?? 0),
            })

            setTimeout(() => {
              resetForNextPlayer()
              refetchPlayer()
            }, 3000)
            break

          case "SYSTEM_MESSAGE":
            if (event.message === "PLAYER_UNSOLD") {
              if (timerRef.current) clearInterval(timerRef.current)

              setSeconds(0)

              setSoldInfo({
                squadName: "UNSOLD",
                playerName: player.name,
                amount: 0,
              })

              setTimeout(() => {
                resetForNextPlayer()
                refetchPlayer()
              }, 2000)
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
  ])

  /* ───────────────── GUARDS ───────────────── */

  if (!auction || !me || !player) {
    return <p>Loading auction...</p>
  }

  /* ───────────────── DERIVED STATE ───────────────── */

  const currentBid =
    highestBid?.amount ?? Number(player.basePrice ?? 0)

  const canBid =
    auction.status === "LIVE" &&
    !!squad &&
    !soldInfo &&
    !!me.participantId

  const squadMissing =
    me.role === "PARTICIPANT" &&
    squadError instanceof AxiosError &&
    squadError.response?.status === 404

  /* ───────────────── UI ───────────────── */

  return (
    <div className="p-8 space-y-6">

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

      <div className="flex justify-between">
        <h1 className="text-3xl">{auction.name}</h1>
        <Badge>{auction.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{player.name}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p>Current Bid: {formatLakhs(currentBid)}</p>

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