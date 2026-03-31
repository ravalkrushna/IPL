import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { tradeApi, TradeResponse } from "@/lib/tradeApi"
import { squadApi } from "@/lib/squadApi"
import { biddingApi } from "@/lib/biddingApi"
import { auctionApi } from "@/lib/auctionApi"
import { authApi } from "@/lib/auth"
import { Player } from "@/types/player"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/auction/$auctionId/trade")({
  component: TradeCenterPage,
})

function useWalletMap(auctionId: string, squads: Array<{ participantId?: string }> | undefined) {
  const participantIds = useMemo(
    () => (squads ?? []).map((s) => s.participantId).filter(Boolean).sort().join(","),
    [squads]
  )
  return useQuery({
    queryKey: ["allWallets", auctionId, participantIds, "tradePage"],
    queryFn: async () => {
      const results = await Promise.all(
        (squads ?? [])
          .filter((s) => !!s.participantId)
          .map((s) =>
            biddingApi.getWallet(s.participantId!, auctionId)
              .then((w) => [s.participantId!, w.balance] as [string, number])
              .catch(() => [s.participantId!, null] as [string, null])
          )
      )
      return Object.fromEntries(results) as Record<string, number | null>
    },
    enabled: !!squads && squads.length > 0,
    refetchInterval: 12000,
    staleTime: 8000,
  })
}

const modeConfig = {
  TRADE: {
    label: "Player Trade",
    accent: "indigo",
    icon: "⇄",
    desc: "Swap players between squads with optional cash sweetener",
  },
  SELL: {
    label: "Sell Player",
    accent: "emerald",
    icon: "₹",
    desc: "List a player on the open market at your asking price",
  },
  LOAN: {
    label: "Loan",
    accent: "amber",
    icon: "⟳",
    desc: "Temporarily loan a player to another squad for a fee",
  },
} as const

type TradeMode = keyof typeof modeConfig

const statusColors: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700 border-amber-200",
  ACCEPTED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-700 border-rose-200",
  CANCELLED:"bg-stone-100 text-stone-500 border-stone-200",
}

const typeColors: Record<string, string> = {
  TRADE: "bg-indigo-50 text-indigo-600 border-indigo-100",
  SELL:  "bg-emerald-50 text-emerald-600 border-emerald-100",
  LOAN:  "bg-amber-50 text-amber-600 border-amber-100",
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${className}`}>
      {children}
    </span>
  )
}

function WalletChip({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-stone-50 border border-stone-100 px-2.5 py-1.5">
      <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">{label}</span>
      <span className="text-xs font-black text-stone-700">{value ?? "—"}</span>
    </div>
  )
}

function TradeCenterPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId/trade" })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [tradeMode, setTradeMode] = useState<TradeMode>("TRADE")
  const [fromSquadId, setFromSquadId] = useState("")
  const [toSquadId, setToSquadId] = useState("")
  const [fromPlayerA, setFromPlayerA] = useState("")
  const [fromPlayerB, setFromPlayerB] = useState("")
  const [toPlayerA, setToPlayerA] = useState("")
  const [toPlayerB, setToPlayerB] = useState("")
  const [cashFromToTo, setCashFromToTo] = useState("")
  const [cashToToFrom, setCashToToFrom] = useState("")
  const [sellBuyerByTradeId, setSellBuyerByTradeId] = useState<Record<string, string>>({})
  const [loanBorrowerByTradeId, setLoanBorrowerByTradeId] = useState<Record<string, string>>({})

  const { data: auction } = useQuery({
    queryKey: ["auction", auctionId, "tradePage"],
    queryFn: () => auctionApi.getById(auctionId),
    staleTime: 10000,
  })
  const { data: me } = useQuery({
    queryKey: ["me", "tradePage"],
    queryFn: () => authApi.me(),
    staleTime: 10000,
  })
  const { data: allSquadsForTrades } = useQuery({
    queryKey: ["allSquads", auctionId, "tradePage"],
    queryFn: () => squadApi.allSquads(auctionId),
    staleTime: 7000,
  })
  const { data: tradeRows } = useQuery({
    queryKey: ["trades", auctionId, "tradePage"],
    queryFn: () => tradeApi.listByAuction(auctionId),
    refetchInterval: 7000,
    staleTime: 3000,
  })
  const { data: allPlayers } = useQuery({
    queryKey: ["players", "tradeNames", auctionId],
    queryFn: () => import("@/lib/playerApi").then((m) => m.playerApi.list({ getAll: true })),
    staleTime: 120000,
  })

  const tradeSquads = (allSquadsForTrades ?? []) as Array<{
    squadId: string
    participantId?: string
    name: string
    players?: Array<{ id: string; name: string }>
  }>
  const { data: tradeWalletMap } = useWalletMap(auctionId, tradeSquads)

  const fromSquad = tradeSquads.find((s) => s.squadId === fromSquadId)
  const toSquad = tradeSquads.find((s) => s.squadId === toSquadId)
  const tradeSquadById = Object.fromEntries(tradeSquads.map((s) => [s.squadId, s])) as Record<string, (typeof tradeSquads)[number]>
  const globalPlayerNameById = Object.fromEntries(
    ((allPlayers ?? []) as Player[]).map((p) => [p.id, p.name])
  ) as Record<string, string>

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
      ? selectedFromPlayers.length > 0 || selectedToPlayers.length > 0
      : selectedFromPlayers.length === 1 && !fromPlayerB
  const modeCashRule =
    tradeMode === "SELL"
      ? cashFromToToCr > 0 && cashToToFromCr === 0
      : tradeMode === "LOAN"
        ? cashFromToToCr === 0 && cashToToFromCr >= 0
        : true
  const modeSquadRule = tradeMode === "TRADE" ? !!toSquadId && fromSquadId !== toSquadId : true
  const modeWalletRule = tradeMode === "TRADE"
    ? fromCashWithinWallet && toCashWithinWallet
      : true
  const modeLoanRule = tradeMode !== "LOAN" || (!!fromPlayerA && !fromPlayerB && selectedToPlayers.length === 0)
  const canCreateTrade =
    !!fromSquadId &&
    modeSquadRule &&
    hasTradeLeg &&
    validCashFromToTo &&
    validCashToToFrom &&
    modeWalletRule &&
    modeCashRule &&
    modeLoanRule

  const playerNameById = (squadId: string, playerId: string) =>
    tradeSquadById[squadId]?.players?.find((p) => p.id === playerId)?.name ??
    globalPlayerNameById[playerId] ??
    playerId

  const createTrade = useMutation({
    mutationFn: () => {
      if (tradeMode === "SELL") {
        if (!fromPlayerA) throw new Error("Choose one player to sell")
        return tradeApi.createSellListing({
          auctionId, fromSquadId, playerId: fromPlayerA,
          askingPrice: toRupeesFromCr(cashFromToToCr),
        })
      }
      if (tradeMode === "LOAN") {
        if (!fromPlayerA) throw new Error("Choose one player to loan")
        return tradeApi.createLoan({
          auctionId, fromSquadId, playerId: fromPlayerA,
          loanFee: toRupeesFromCr(cashToToFromCr),
        })
      }
      const fromIds = [fromPlayerA, fromPlayerB].filter(Boolean)
      const toIds = tradeMode === "TRADE" ? [toPlayerA, toPlayerB].filter(Boolean) : []
      return tradeApi.create({
        auctionId, fromSquadId, toSquadId,
        fromPlayerIds: [...new Set(fromIds)],
        toPlayerIds: [...new Set(toIds)],
        cashFromToTo: toRupeesFromCr(cashFromToToCr),
        cashToToFrom: toRupeesFromCr(cashToToFromCr),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId, "tradePage"] })
      setFromPlayerA(""); setFromPlayerB(""); setToPlayerA(""); setToPlayerB("")
      setToSquadId(""); setCashFromToTo(""); setCashToToFrom("")
    },
  })

  const acceptTrade = useMutation({
    mutationFn: (tradeId: string) => tradeApi.accept(tradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId, "tradePage"] })
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allWallets", auctionId] })
    },
  })
  const rejectTrade = useMutation({
    mutationFn: (tradeId: string) => tradeApi.reject(tradeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trades", auctionId, "tradePage"] }),
  })
  const cancelTrade = useMutation({
    mutationFn: (tradeId: string) => tradeApi.cancel(tradeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trades", auctionId, "tradePage"] }),
  })
  const acceptSellTrade = useMutation({
    mutationFn: ({ tradeId, buyerSquadId }: { tradeId: string; buyerSquadId: string }) =>
      tradeApi.acceptSellListing(tradeId, buyerSquadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId, "tradePage"] })
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allWallets", auctionId] })
    },
  })
  const approveLoan = useMutation({
    mutationFn: ({ tradeId, borrowerSquadId }: { tradeId: string; borrowerSquadId: string }) =>
      tradeApi.approveLoan(tradeId, borrowerSquadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId, "tradePage"] })
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allWallets", auctionId] })
    },
  })
  const closeLoan = useMutation({
    mutationFn: (tradeId: string) => tradeApi.closeLoan(tradeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId, "tradePage"] })
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allWallets", auctionId] })
    },
  })

  const isAdmin = me?.role === "ADMIN"
  const anyPending = acceptTrade.isPending || rejectTrade.isPending || cancelTrade.isPending || approveLoan.isPending || closeLoan.isPending || acceptSellTrade.isPending

  if (auction && auction.status !== "COMPLETED") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center" style={{ fontFamily: "'Sora', system-ui, sans-serif" }}>
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-10 text-center shadow-2xl max-w-sm mx-4">
          <div className="text-4xl mb-4">🔒</div>
          <p className="text-lg font-black text-white">Trade Center is locked</p>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">The transfer market opens once the auction is complete.</p>
          <button
            className="mt-6 w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 text-sm transition-all"
            onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId } })}
          >
            ← Back to Auction
          </button>
        </div>
      </div>
    )
  }

  const tradeList = (tradeRows ?? []) as TradeResponse[]
  const marketBookList = tradeList.filter((t) => t.tradeType === tradeMode)

  // Build summary preview string
  const previewText = (() => {
    if (tradeMode === "SELL" && fromPlayerA) {
      return `${fromSquad?.name ?? "Squad"} lists ${playerNameById(fromSquadId, fromPlayerA)} for ${cashFromToToCr > 0 ? cashFromToToCr.toFixed(2) + "Cr" : "?"}`
    }
    if (tradeMode === "LOAN" && fromPlayerA) {
      return `${fromSquad?.name ?? "Squad"} loans ${playerNameById(fromSquadId, fromPlayerA)} to ${toSquad?.name ?? "?"} for ${cashToToFromCr > 0 ? cashToToFromCr.toFixed(2) + "Cr" : "0Cr"}`
    }
    if (tradeMode === "TRADE") {
      const from = selectedFromPlayers.map((id) => playerNameById(fromSquadId, id)).join(", ") || "—"
      const to = selectedToPlayers.map((id) => playerNameById(toSquadId, id)).join(", ") || "—"
      return `${fromSquad?.name ?? "Squad A"} [${from}${cashFromToToCr > 0 ? ` +${cashFromToToCr.toFixed(2)}Cr` : ""}] ⇄ ${toSquad?.name ?? "Squad B"} [${to}${cashToToFromCr > 0 ? ` +${cashToToFromCr.toFixed(2)}Cr` : ""}]`
    }
    return null
  })()

  return (
    <div
      className="min-h-screen bg-slate-950"
      style={{ fontFamily: "'Sora', system-ui, sans-serif" }}
    >
      {/* Top nav bar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-[1560px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-indigo-400 text-lg">⚡</span>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-widest hidden sm:block">Transfer Market</span>
            <span className="text-slate-600 hidden sm:block">/</span>
            <span className="text-sm font-black text-white truncate max-w-[180px]">{auction?.name ?? "Auction"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-1.5 text-xs font-semibold transition-all"
              onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId } })}
            >
              ← Auction
            </button>
            <button
              className="rounded-lg bg-emerald-600/20 border border-emerald-500/30 hover:bg-emerald-600/30 text-emerald-400 hover:text-emerald-300 px-3 py-1.5 text-xs font-semibold transition-all"
              onClick={() => navigate({ to: "/auction/$auctionId/fantasy", params: { auctionId } })}
            >
              Fantasy
            </button>
            <button
              className="rounded-lg bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-400 hover:text-indigo-300 px-3 py-1.5 text-xs font-semibold transition-all"
              onClick={() => navigate({ to: "/auction/$auctionId/ipl-matches", params: { auctionId } })}
            >
              IPL Matches
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1560px] mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-5">

          {/* ── LEFT: Create Offer ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/8 bg-slate-900/70 backdrop-blur-sm overflow-hidden shadow-2xl">
            {/* Header strip */}
            <div className="px-5 pt-5 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">New Offer</p>
                  <h2 className="text-base font-black text-white">Create Transfer</h2>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  disabled={tradeMode !== "TRADE"}
                  onClick={() => {
                    if (tradeMode !== "TRADE") return
                    const prevFrom = fromSquadId
                    setFromSquadId(toSquadId); setToSquadId(prevFrom)
                    setFromPlayerA(toPlayerA); setFromPlayerB(toPlayerB)
                    setToPlayerA(fromPlayerA); setToPlayerB(fromPlayerB)
                    const prevCash = cashFromToTo
                    setCashFromToTo(cashToToFrom); setCashToToFrom(prevCash)
                  }}
                >
                  <span className="text-base leading-none">⇄</span> Swap sides
                </button>
              </div>
            </div>

            <div className="px-5 py-5 space-y-5">
              {/* Mode tabs */}
              <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-slate-800/60 border border-white/5">
                {(["TRADE", "SELL", "LOAN"] as TradeMode[]).map((mode) => {
                  const cfg = modeConfig[mode]
                  const active = tradeMode === mode
                  const activeClass = mode === "TRADE"
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/40"
                    : mode === "SELL"
                      ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40"
                      : "bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-900/40"
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setTradeMode(mode)
                        if (mode === "SELL") { setToPlayerA(""); setToPlayerB(""); setCashToToFrom("") }
                        if (mode === "LOAN") { setToPlayerA(""); setToPlayerB(""); setCashFromToTo("") }
                      }}
                      className={`rounded-lg border px-2 py-2.5 text-xs font-bold transition-all ${active ? activeClass : "border-transparent text-slate-400 hover:text-slate-200"}`}
                    >
                      <span className="mr-1">{cfg.icon}</span>{cfg.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-slate-500 -mt-2 px-1">{modeConfig[tradeMode].desc}</p>

              {/* Squad selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">From Squad</label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-slate-800 text-sm text-slate-200 px-3 py-2.5 focus:outline-none focus:border-indigo-500/60 transition-all appearance-none cursor-pointer"
                    value={fromSquadId}
                    onChange={(e) => { setFromSquadId(e.target.value); setFromPlayerA(""); setFromPlayerB("") }}
                  >
                    <option value="">Select squad…</option>
                    {tradeSquads.map((s) => <option key={s.squadId} value={s.squadId}>{s.name}</option>)}
                  </select>
                  {fromWalletCr != null && (
                    <WalletChip label="Wallet" value={`${fromWalletCr.toFixed(2)}Cr`} />
                  )}
                </div>

                {tradeMode === "TRADE" ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      To Squad
                    </label>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-slate-800 text-sm text-slate-200 px-3 py-2.5 focus:outline-none focus:border-indigo-500/60 transition-all appearance-none cursor-pointer"
                      value={toSquadId}
                      onChange={(e) => { setToSquadId(e.target.value); setToPlayerA(""); setToPlayerB("") }}
                    >
                      <option value="">Select squad…</option>
                      {tradeSquads.filter((s) => s.squadId !== fromSquadId).map((s) => <option key={s.squadId} value={s.squadId}>{s.name}</option>)}
                    </select>
                    {toWalletCr != null && (
                      <WalletChip label="Wallet" value={`${toWalletCr.toFixed(2)}Cr`} />
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-emerald-500/20 bg-emerald-500/5 p-3.5 flex items-center gap-2.5">
                    <span className="text-emerald-400 text-xl shrink-0">🏪</span>
                    <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                      {tradeMode === "LOAN"
                        ? "Open loan listing. Borrower squad will be selected from Live Book on the right."
                        : "Open market listing. Any squad can purchase from the book."}
                    </p>
                  </div>
                )}
              </div>

              {/* Player selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    {tradeMode === "LOAN" ? "Player to Loan" : "From Side Gives"}
                  </label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-slate-800 text-sm text-slate-200 px-3 py-2.5 focus:outline-none focus:border-indigo-500/60 transition-all appearance-none cursor-pointer"
                    value={fromPlayerA}
                    onChange={(e) => setFromPlayerA(e.target.value)}
                  >
                    <option value="">Player 1…</option>
                    {(fromSquad?.players ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {tradeMode !== "LOAN" && tradeMode !== "SELL" && (
                    <select
                      className="w-full rounded-xl border border-white/10 bg-slate-800 text-sm text-slate-200 px-3 py-2.5 focus:outline-none focus:border-indigo-500/60 transition-all appearance-none cursor-pointer"
                      value={fromPlayerB}
                      onChange={(e) => setFromPlayerB(e.target.value)}
                    >
                      <option value="">Player 2 (optional)…</option>
                      {(fromSquad?.players ?? []).filter((p) => p.id !== fromPlayerA).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>

                {tradeMode === "TRADE" ? (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">To Side Gives</label>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-slate-800 text-sm text-slate-200 px-3 py-2.5 focus:outline-none focus:border-indigo-500/60 transition-all appearance-none cursor-pointer"
                      value={toPlayerA}
                      onChange={(e) => setToPlayerA(e.target.value)}
                    >
                      <option value="">Player 1…</option>
                      {(toSquad?.players ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-slate-800 text-sm text-slate-200 px-3 py-2.5 focus:outline-none focus:border-indigo-500/60 transition-all appearance-none cursor-pointer"
                      value={toPlayerB}
                      onChange={(e) => setToPlayerB(e.target.value)}
                    >
                      <option value="">Player 2 (optional)…</option>
                      {(toSquad?.players ?? []).filter((p) => p.id !== toPlayerA).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 bg-slate-800/40 p-3.5 flex items-center gap-2.5">
                    <span className="text-slate-500 text-xl shrink-0">{tradeMode === "SELL" ? "💰" : "📋"}</span>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {tradeMode === "SELL" ? "Buyer sends cash only — no counter players." : "Loan: exactly one player travels; no counter players needed."}
                    </p>
                  </div>
                )}
              </div>

              {/* Cash inputs */}
              {tradeMode === "TRADE" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cash From→To (Cr)</label>
                    <Input
                      value={cashFromToTo}
                      onChange={(e) => setCashFromToTo(e.target.value)}
                      placeholder="e.g. 2.50"
                      className="rounded-xl border-white/10 bg-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/60"
                    />
                    {!fromCashWithinWallet && (
                      <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                        <span>⚠</span> Exceeds from-squad wallet
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cash To→From (Cr)</label>
                    <Input
                      value={cashToToFrom}
                      onChange={(e) => setCashToToFrom(e.target.value)}
                      placeholder="e.g. 1.00"
                      className="rounded-xl border-white/10 bg-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500/60"
                    />
                    {!toCashWithinWallet && (
                      <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                        <span>⚠</span> Exceeds to-squad wallet
                      </p>
                    )}
                  </div>
                </div>
              )}
              {tradeMode === "SELL" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asking Price (Cr)</label>
                  <Input
                    value={cashFromToTo}
                    onChange={(e) => setCashFromToTo(e.target.value)}
                    placeholder="e.g. 2.50"
                    className="rounded-xl border-white/10 bg-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/60"
                  />
                </div>
              )}
              {tradeMode === "LOAN" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Loan Fee (Borrower→Lender, Cr)</label>
                  <Input
                    value={cashToToFrom}
                    onChange={(e) => setCashToToFrom(e.target.value)}
                    placeholder="e.g. 1.00"
                    className="rounded-xl border-white/10 bg-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-amber-500/60"
                  />
                  {!toCashWithinWallet && (
                    <p className="text-[11px] text-rose-400 font-semibold flex items-center gap-1">
                      <span>⚠</span> Exceeds borrower wallet
                    </p>
                  )}
                </div>
              )}

              {/* Validation / preview */}
              {(!validCashFromToTo || !validCashToToFrom) ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-3.5 py-2.5 text-xs text-rose-400 font-semibold">
                  ⚠ Cash values must be valid positive numbers or blank.
                </div>
              ) : previewText ? (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/8 px-3.5 py-2.5">
                  <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-1">Preview</p>
                  <p className="text-xs text-indigo-200 font-medium leading-relaxed">{previewText}</p>
                </div>
              ) : null}

              {/* Submit */}
              <button
                type="button"
                onClick={() => createTrade.mutate()}
                disabled={!canCreateTrade || createTrade.isPending}
                className={`w-full h-12 rounded-xl text-sm font-black tracking-wide transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed
                  ${tradeMode === "TRADE"
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40"
                    : tradeMode === "SELL"
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40"
                      : "bg-amber-500 hover:bg-amber-400 text-white shadow-amber-900/40"
                  }`}
              >
                {createTrade.isPending
                  ? "Creating…"
                  : tradeMode === "SELL" ? "📋 List Sell Offer"
                  : tradeMode === "LOAN" ? "⟳ Create Loan Offer"
                  : "⇄ Create Trade Offer"}
              </button>
            </div>
          </div>

          {/* ── RIGHT: Market Book ────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/8 bg-slate-900/70 backdrop-blur-sm overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between gap-2 shrink-0">
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">Live Book</p>
                <h2 className="text-base font-black text-white">{modeConfig[tradeMode].label} Offers</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
                <span className="text-[11px] text-slate-500">{marketBookList.length} offer{marketBookList.length !== 1 ? "s" : ""}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5 max-h-[68vh]">
              {marketBookList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="text-4xl mb-3 opacity-40">📭</span>
                  <p className="text-sm font-semibold text-slate-500">No {modeConfig[tradeMode].label.toLowerCase()} offers yet</p>
                  <p className="text-xs text-slate-600 mt-1">Switch tab or create a {modeConfig[tradeMode].label.toLowerCase()} offer from the left panel.</p>
                </div>
              ) : (
                marketBookList.map((t) => {
                  const fromName = tradeSquads.find((s) => s.squadId === t.fromSquadId)?.name ?? t.fromSquadId
                  const toName = tradeSquads.find((s) => s.squadId === t.toSquadId)?.name ?? t.toSquadId
                  const isSellStyle = t.tradeType === "SELL"
                  const isLoanStyle = t.tradeType === "LOAN"
                  const selectedBuyer = sellBuyerByTradeId[t.id] ?? ""
                  const selectedBorrower = loanBorrowerByTradeId[t.id] ?? ""
                  const statusCls = statusColors[t.status] ?? "bg-slate-100 text-slate-600 border-slate-200"
                  const typeCls = typeColors[t.tradeType] ?? "bg-slate-50 text-slate-500 border-slate-100"

                  return (
                    <div key={t.id} className="group rounded-xl border border-white/8 bg-slate-800/60 hover:bg-slate-800/80 hover:border-white/12 transition-all p-4 space-y-3">
                      {/* Row 1: badges + id */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={typeCls}>{t.tradeType}</Badge>
                          <Badge className={statusCls}>{t.status}</Badge>
                        </div>
                        <span className="text-[10px] text-slate-600 font-mono">#{t.id.slice(0, 8)}</span>
                      </div>

                      {/* Row 2: trade summary */}
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-xs font-black text-slate-200 truncate">{fromName}</span>
                            {t.tradeType !== "SELL" && (
                              <>
                                <span className="text-slate-600 text-xs shrink-0">→</span>
                                <span className="text-xs font-black text-slate-200 truncate">
                                  {isLoanStyle && t.status === "PENDING" && t.fromSquadId === t.toSquadId ? "Open Loan Market" : toName}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[11px] text-slate-400">
                              <span className="text-slate-500 font-semibold">From:</span>{" "}
                              {t.fromPlayerIds.length
                                ? t.fromPlayerIds.map((id) => playerNameById(t.fromSquadId, id)).join(", ")
                                : <span className="text-slate-600 italic">no players</span>}
                              {t.cashFromToTo > 0 && <span className="text-emerald-400 font-bold"> +{fmtCr(Number(t.cashFromToTo))}</span>}
                            </p>
                            {t.tradeType !== "SELL" && (
                              <p className="text-[11px] text-slate-400">
                                <span className="text-slate-500 font-semibold">To:</span>{" "}
                                {t.toPlayerIds.length
                                  ? t.toPlayerIds.map((id) => playerNameById(t.toSquadId, id)).join(", ")
                                  : <span className="text-slate-600 italic">no players</span>}
                                {t.cashToToFrom > 0 && <span className="text-emerald-400 font-bold"> +{fmtCr(Number(t.cashToToFrom))}</span>}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Row 3: actions */}
                      {t.status === "PENDING" && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
                          {isSellStyle ? (
                            <>
                              <select
                                className="rounded-lg border border-white/10 bg-slate-700 text-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500/50 flex-1 min-w-0 appearance-none cursor-pointer"
                                value={selectedBuyer}
                                onChange={(e) => setSellBuyerByTradeId((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              >
                                <option value="">Buyer squad…</option>
                                {tradeSquads.filter((s) => s.squadId !== t.fromSquadId).map((s) => <option key={s.squadId} value={s.squadId}>{s.name}</option>)}
                              </select>
                              <button
                                className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold disabled:opacity-40 transition-all"
                                disabled={!selectedBuyer || anyPending}
                                onClick={() => acceptSellTrade.mutate({ tradeId: t.id, buyerSquadId: selectedBuyer })}
                              >
                                Accept
                              </button>
                            </>
                          ) : isLoanStyle ? (
                            isAdmin ? (
                              <>
                                <select
                                  className="rounded-lg border border-white/10 bg-slate-700 text-slate-200 px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500/50 flex-1 min-w-0 appearance-none cursor-pointer"
                                  value={selectedBorrower}
                                  onChange={(e) => setLoanBorrowerByTradeId((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                >
                                  <option value="">Borrower squad…</option>
                                  {tradeSquads.filter((s) => s.squadId !== t.fromSquadId).map((s) => <option key={s.squadId} value={s.squadId}>{s.name}</option>)}
                                </select>
                                <button
                                  className="rounded-lg bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 text-xs font-bold disabled:opacity-40 transition-all"
                                  disabled={!selectedBorrower || anyPending}
                                  onClick={() => approveLoan.mutate({ tradeId: t.id, borrowerSquadId: selectedBorrower })}
                                >
                                  Approve Loan
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] text-amber-400 font-semibold">⏳ Awaiting admin approval</span>
                            )
                          ) : (
                            <button
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold disabled:opacity-40 transition-all"
                              disabled={anyPending}
                              onClick={() => acceptTrade.mutate(t.id)}
                            >
                              Accept
                            </button>
                          )}
                          <button
                            className="rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white px-3 py-1.5 text-xs font-bold disabled:opacity-40 transition-all"
                            disabled={anyPending}
                            onClick={() => rejectTrade.mutate(t.id)}
                          >
                            Reject
                          </button>
                          <button
                            className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 px-3 py-1.5 text-xs font-bold disabled:opacity-40 transition-all"
                            disabled={anyPending}
                            onClick={() => cancelTrade.mutate(t.id)}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {isLoanStyle && t.status === "ACCEPTED" && isAdmin && (
                        <div className="pt-1 border-t border-white/5">
                          <button
                            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 text-xs font-bold disabled:opacity-40 transition-all"
                            disabled={anyPending}
                            onClick={() => closeLoan.mutate(t.id)}
                          >
                            ⟳ Close Loan (Return Player)
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}