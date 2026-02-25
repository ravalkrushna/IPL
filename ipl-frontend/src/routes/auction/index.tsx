/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import { useUpdateAuctionStatus } from "@/hooks/useUpdateAuctionStatus"
import { useActiveAuction } from "@/hooks/useActiveAuction"
import { useCreateAuction } from "@/hooks/useCreateAuction"

import {
  useSoldPlayers,
  useUnsoldPlayers,
} from "@/hooks/useDashboard"

import { useWallet } from "@/hooks/useWallet"
import { useWalletLeaderboard } from "@/hooks/useWalletLeaderboard"

import { authApi } from "@/lib/auth"
import { auctionApi } from "@/lib/auctionApi"

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table"

export const Route = createFileRoute("/auction/")({
  component: AuctionLobbyPage,
})

type CreateAuctionForm = {
  name: string
}

function AuctionLobbyPage() {
  const navigate = useNavigate()

  const updateStatus = useUpdateAuctionStatus()
  const createAuction = useCreateAuction()

  // ✅ REAL USER (Never use debugAuth)
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
  })

  const { data: auction } = useActiveAuction()
  const { data: soldPlayers } = useSoldPlayers()
  const { data: unsoldPlayers } = useUnsoldPlayers()

  // ✅ Wallet + Leaderboard
  const { data: wallet } = useWallet(me?.participantId)
  const { data: walletLeaderboard } = useWalletLeaderboard()

  const { data: auctions } = useQuery({
    queryKey: ["auctions"],
    queryFn: auctionApi.list,
  })

  const isAdmin = me?.role === "ADMIN"

  const form = useForm<CreateAuctionForm>({
    defaultValues: { name: "" },
  })

  const totalPlayers =
    (soldPlayers?.length || 0) + (unsoldPlayers?.length || 0)

  const onSubmit = (data: CreateAuctionForm) => {
    if (!data.name.trim()) return

    createAuction.mutate(data, {
      onSuccess: () => form.reset(),
    })
  }

  return (
    <div className="p-8 space-y-6">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Auction Lobby</h1>
          <p className="text-muted-foreground">
            Manage auction session & participants
          </p>
        </div>

        <Badge variant="secondary">
          {auction?.status || "Waiting"}
        </Badge>
      </div>

      <Separator />

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Auction" value={auction?.name || "None"} />
        <StatCard label="Total Players" value={String(totalPlayers)} />
        <StatCard label="Sold Players" value={String(soldPlayers?.length || 0)} />
        <StatCard label="Unsold Players" value={String(unsoldPlayers?.length || 0)} />
      </div>

      {/* ADMIN CREATE */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Create Auction</CardTitle>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex gap-3"
            >
              <div className="flex-1 space-y-2">
                <Label>Auction Name</Label>
                <Input
                  {...form.register("name")}
                  placeholder="Enter auction name"
                />
              </div>

              <Button
                type="submit"
                disabled={createAuction.isPending}
              >
                {createAuction.isPending ? "Creating..." : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* AUCTIONS TABLE */}
      <Card>
        <CardHeader>
          <CardTitle>All Auctions</CardTitle>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>

            <TableBody>
              {auctions?.length ? (
                auctions.map((a: any) => (
                  <TableRow
                    key={a.id}
                    className={
                      !isAdmin && a.status === "LIVE"
                        ? "cursor-pointer hover:bg-muted/50"
                        : ""
                    }
                    onClick={() => {
                      if (!isAdmin && a.status === "LIVE") {
                        navigate({
                          to: "/auction/$auctionId",
                          params: { auctionId: a.id },
                        })
                      }
                    }}
                  >
                    <TableCell>{a.name}</TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          a.status === "LIVE"
                            ? "default"
                            : "outline"
                        }
                      >
                        {a.status}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {new Date(a.createdAt).toLocaleString()}
                    </TableCell>

                    {isAdmin && (
                      <TableCell>
                        {a.status === "PRE_AUCTION" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              updateStatus.mutate({
                                id: a.id,
                                status: "LIVE",
                              })
                            }
                          >
                            Start
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No auctions created
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* LOWER PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* LEADERBOARD */}
        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {walletLeaderboard?.length ? (
              walletLeaderboard.map((p: any, index: number) => (
                <ParticipantRow
                  key={p.participantId}
                  name={p.participantName}
                  amount={p.balance}
                  highlight={index === 0}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No participants yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* QUICK ACTIONS */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">

            <Button
              className="w-full"
              onClick={() =>
                navigate({
                  to: "/auction/players",
                  search: { page: 1, search: "" },
                })
              }
            >
              View Players Pool
            </Button>

            {/* ✅ Wallet Overview */}
            <div className="border rounded-xl p-4">
              <p className="text-sm text-muted-foreground">
                Wallet Remaining
              </p>

              <p className="text-2xl font-bold text-green-600">
                ₹ {wallet?.balance ?? "Loading..."}
              </p>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* COMPONENTS */

function StatCard({ label, value }: any) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function ParticipantRow({ name, amount, highlight }: any) {
  return (
    <div
      className={`flex items-center justify-between ${
        highlight ? "font-bold text-green-600" : ""
      }`}
    >
      <span className="text-sm">{name}</span>
      <Badge variant="outline">₹ {amount}</Badge>
    </div>
  )
}