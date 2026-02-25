/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import { useUpdateAuctionStatus } from "@/hooks/useUpdateAuctionStatus"
import { useActiveAuction } from "@/hooks/useActiveAuction"
import { useCreateAuction } from "@/hooks/useCreateAuction"
import { useSoldPlayers, useUnsoldPlayers } from "@/hooks/useDashboard"
import { useWallet } from "@/hooks/useWallet"
import { useWalletLeaderboard } from "@/hooks/useWalletLeaderboard"

import { authApi } from "@/lib/auth"
import { auctionApi } from "@/lib/auctionApi"

import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/auction/")({
  component: AuctionLobbyPage,
})

type CreateAuctionForm = { name: string }

function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(0)}L`
  return `₹${amount.toLocaleString()}`
}

/* ───────────────── PAGE ───────────────── */

function AuctionLobbyPage() {
  const navigate      = useNavigate()
  const updateStatus  = useUpdateAuctionStatus()
  const createAuction = useCreateAuction()

  const { data: me }               = useQuery({ queryKey: ["me"], queryFn: authApi.me })
  const { data: auction }          = useActiveAuction()
  const { data: soldPlayers }      = useSoldPlayers()
  const { data: unsoldPlayers }    = useUnsoldPlayers()
  const { data: wallet }           = useWallet(me?.participantId)
  const { data: walletLeaderboard } = useWalletLeaderboard()
  const { data: auctions }         = useQuery({ queryKey: ["auctions"], queryFn: auctionApi.list })

  const isAdmin    = me?.role === "ADMIN"
  const totalPlayers = (soldPlayers?.length || 0) + (unsoldPlayers?.length || 0)
  const soldPct    = totalPlayers > 0 ? Math.round(((soldPlayers?.length || 0) / totalPlayers) * 100) : 0

  const form = useForm<CreateAuctionForm>({ defaultValues: { name: "" } })
  const onSubmit = (data: CreateAuctionForm) => {
    if (!data.name.trim()) return
    createAuction.mutate(data, { onSuccess: () => form.reset() })
  }

  const liveAuction = auctions?.find((a: any) => a.status === "LIVE")

  return (
    <div
      className="h-screen flex flex-col bg-slate-950 text-white overflow-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* ══════════════ NAV BAR ══════════════ */}
      <header className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-white/8 bg-slate-900/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏏</span>
          <div>
            <h1 className="font-black text-base leading-tight tracking-tight">Auction Lobby</h1>
            <p className="text-[11px] text-slate-500">Manage sessions &amp; participants</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Wallet chip */}
          {!isAdmin && wallet?.balance != null && (
            <div className="flex items-center gap-1.5 bg-white/6 border border-white/8 rounded-lg px-3 py-1.5">
              <span className="text-[11px] text-slate-400">Balance</span>
              <span className="font-black text-sm tabular-nums text-emerald-400">
                {fmt(Number(wallet.balance))}
              </span>
            </div>
          )}

          {/* Live pulse */}
          {liveAuction && (
            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-emerald-400">LIVE</span>
            </div>
          )}

          {/* Jump to live auction */}
          {!isAdmin && liveAuction && (
            <button
              onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId: liveAuction.id } })}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black px-4 py-1.5 rounded-lg transition-colors shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
            >
              Enter Auction →
            </button>
          )}
        </div>
      </header>

      {/* ══════════════ BODY ══════════════ */}
      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">

        {/* ── LEFT: Stats + Auctions Table ── */}
        <div className="flex-1 flex flex-col p-5 gap-4 min-w-0 overflow-hidden">

          {/* Stat strip */}
          <div className="grid grid-cols-4 gap-3 shrink-0">
            {[
              { label: "Active Auction", value: auction?.name ?? "None",               accent: "text-white" },
              { label: "Total Players",  value: String(totalPlayers),                  accent: "text-sky-400" },
              { label: "Sold",           value: String(soldPlayers?.length || 0),      accent: "text-emerald-400" },
              { label: "Unsold",         value: String(unsoldPlayers?.length || 0),    accent: "text-rose-400" },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
                <p className={`text-xl font-black mt-1 truncate ${accent}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Sold progress bar */}
          {totalPlayers > 0 && (
            <div className="shrink-0 rounded-xl border border-white/8 bg-white/3 px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Auction Progress</span>
                <span className="text-xs font-bold text-white/60">{soldPlayers?.length || 0} / {totalPlayers} sold</span>
              </div>
              <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-linear-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${soldPct}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-600 mt-1.5">{soldPct}% complete</p>
            </div>
          )}

          {/* Admin: create auction */}
          {isAdmin && (
            <div className="shrink-0 rounded-xl border border-white/8 bg-white/3 px-4 py-4">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Create Auction</p>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
                <Input
                  {...form.register("name")}
                  placeholder="Enter auction name…"
                  className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/20 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={createAuction.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-black rounded-lg transition-colors"
                >
                  {createAuction.isPending ? "Creating…" : "Create"}
                </button>
              </form>
            </div>
          )}

          {/* Auctions table */}
          <div className="flex-1 rounded-xl border border-white/8 bg-white/3 flex flex-col min-h-0 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/8 shrink-0">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">All Auctions</p>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {auctions?.length ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900/80 backdrop-blur-sm">
                    <tr className="border-b border-white/8">
                      <th className="text-left px-5 py-3 text-[11px] font-black text-slate-500 uppercase tracking-widest">Name</th>
                      <th className="text-left px-5 py-3 text-[11px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                      <th className="text-left px-5 py-3 text-[11px] font-black text-slate-500 uppercase tracking-widest">Created</th>
                      {isAdmin && <th className="px-5 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {auctions.map((a: any) => {
                      const isLive = a.status === "LIVE"
                      return (
                        <tr
                          key={a.id}
                          onClick={() => {
                            if (!isAdmin && isLive) navigate({ to: "/auction/$auctionId", params: { auctionId: a.id } })
                          }}
                          className={`transition-colors ${!isAdmin && isLive ? "cursor-pointer hover:bg-white/5" : ""}`}
                        >
                          <td className="px-5 py-3 font-semibold text-white/85">{a.name}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full
                              ${isLive
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-white/6 text-white/40 border border-white/8"
                              }`}>
                              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                              {a.status}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-white/40 text-xs tabular-nums">
                            {new Date(a.createdAt).toLocaleString()}
                          </td>
                          {isAdmin && (
                            <td className="px-5 py-3 text-right">
                              {a.status === "PRE_AUCTION" && (
                                <button
                                  onClick={() => updateStatus.mutate({ id: a.id, status: "LIVE" })}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg transition-colors"
                                >
                                  Start
                                </button>
                              )}
                              {isLive && (
                                <button
                                  onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId: a.id } })}
                                  className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-lg transition-colors"
                                >
                                  Open →
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-600 italic">No auctions created yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Leaderboard + Quick Actions ── */}
        <div className="w-72 shrink-0 flex flex-col border-l border-white/8 bg-slate-900/40">

          {/* Leaderboard */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden border-b border-white/8">
            <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-white/8">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Leaderboard</p>
              <span className="text-[10px] text-slate-600">by balance</span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-1.5">
              {walletLeaderboard?.length ? (
                walletLeaderboard.map((p: any, i: number) => (
                  <div
                    key={p.participantId}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all
                      ${i === 0
                        ? "bg-amber-500/10 border-amber-500/30"
                        : i === 1
                        ? "bg-slate-400/8 border-slate-400/20"
                        : i === 2
                        ? "bg-orange-700/8 border-orange-700/20"
                        : "bg-white/3 border-white/6"
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-sm font-black w-5 text-center shrink-0
                        ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-600" : "text-white/30"}`}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                      </span>
                      <span className={`text-sm font-bold truncate ${i < 3 ? "text-white/90" : "text-white/60"}`}>
                        {p.participantName}
                      </span>
                    </div>
                    <span className={`text-xs font-black tabular-nums shrink-0 ml-2
                      ${i === 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      {fmt(Number(p.balance))}
                    </span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-slate-600 italic">No participants yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="shrink-0 px-4 py-4 space-y-3">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Quick Actions</p>

            <button
              onClick={() => navigate({ to: "/auction/players", search: { page: 1, search: "" } })}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/15 transition-all text-sm font-bold text-white/80 hover:text-white"
            >
              <span>View Players Pool</span>
              <span className="text-white/30">→</span>
            </button>

            {liveAuction && (
              <button
                onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId: liveAuction.id } })}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition-all text-sm font-black text-white shadow-[0_4px_20px_rgba(16,185,129,0.25)]"
              >
                <span>Enter Live Auction</span>
                <span>→</span>
              </button>
            )}

            {/* My wallet card */}
            {!isAdmin && wallet?.balance != null && (
              <div className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Your Wallet</p>
                <p className="text-2xl font-black text-emerald-400 tabular-nums mt-1">
                  {fmt(Number(wallet.balance))}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">remaining balance</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}