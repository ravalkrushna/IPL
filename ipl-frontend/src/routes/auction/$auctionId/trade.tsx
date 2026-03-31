import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { tradeApi, TradeResponse } from "@/lib/tradeApi"
import { squadApi } from "@/lib/squadApi"
import { biddingApi } from "@/lib/biddingApi"
import { auctionApi } from "@/lib/auctionApi"
import { Player } from "@/types/player"
import { Button } from "@/components/ui/button"
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

function TradeCenterPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId/trade" })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [tradeMode, setTradeMode] = useState<"TRADE" | "SELL" | "LOAN">("TRADE")
  const [fromSquadId, setFromSquadId] = useState("")
  const [toSquadId, setToSquadId] = useState("")
  const [fromPlayerA, setFromPlayerA] = useState("")
  const [fromPlayerB, setFromPlayerB] = useState("")
  const [toPlayerA, setToPlayerA] = useState("")
  const [toPlayerB, setToPlayerB] = useState("")
  const [cashFromToTo, setCashFromToTo] = useState("")
  const [cashToToFrom, setCashToToFrom] = useState("")
  const [sellBuyerByTradeId, setSellBuyerByTradeId] = useState<Record<string, string>>({})

  const { data: auction } = useQuery({
    queryKey: ["auction", auctionId, "tradePage"],
    queryFn: () => auctionApi.getById(auctionId),
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
      ? (selectedFromPlayers.length > 0 || selectedToPlayers.length > 0)
      : selectedFromPlayers.length === 1 && !fromPlayerB
  const modeCashRule =
    tradeMode === "SELL"
      ? cashFromToToCr > 0 && cashToToFromCr === 0
      : tradeMode === "LOAN"
        ? false
        : true
  const modeSquadRule = tradeMode === "TRADE" ? !!toSquadId && fromSquadId !== toSquadId : true
  const modeWalletRule = tradeMode === "TRADE"
    ? fromCashWithinWallet && toCashWithinWallet
    : true
  const canCreateTrade =
    !!fromSquadId &&
    modeSquadRule &&
    hasTradeLeg &&
    validCashFromToTo &&
    validCashToToFrom &&
    modeWalletRule &&
    modeCashRule &&
    tradeMode !== "LOAN"

  const playerNameById = (squadId: string, playerId: string) =>
    tradeSquadById[squadId]?.players?.find((p) => p.id === playerId)?.name ??
    globalPlayerNameById[playerId] ??
    playerId

  const createTrade = useMutation({
    mutationFn: () => {
      if (tradeMode === "SELL") {
        if (!fromPlayerA) throw new Error("Choose one player to sell")
        return tradeApi.createSellListing({
          auctionId,
          fromSquadId,
          playerId: fromPlayerA,
          askingPrice: toRupeesFromCr(cashFromToToCr),
        })
      }
      const fromIds = [fromPlayerA, fromPlayerB].filter(Boolean)
      const toIds = tradeMode === "TRADE" ? [toPlayerA, toPlayerB].filter(Boolean) : []
      return tradeApi.create({
        auctionId,
        fromSquadId,
        toSquadId,
        fromPlayerIds: [...new Set(fromIds)],
        toPlayerIds: [...new Set(toIds)],
        cashFromToTo: toRupeesFromCr(cashFromToToCr),
        cashToToFrom: toRupeesFromCr(cashToToFromCr),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["trades", auctionId, "tradePage"] })
      setFromPlayerA("")
      setFromPlayerB("")
      setToPlayerA("")
      setToPlayerB("")
      setToSquadId("")
      setCashFromToTo("")
      setCashToToFrom("")
      setTradeMode("TRADE")
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

  if (auction && auction.status !== "COMPLETED") {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-black text-stone-800">Trade Center unlocks after auction completion.</p>
          <p className="text-sm text-stone-500 mt-1">Complete the auction first, then reopen this page.</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId } })}>Back to Auction</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-100" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-5 md:py-7">
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4 md:px-6 md:py-5 shadow-sm mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Auction Transfer Market</p>
            <h1 className="text-xl md:text-2xl font-black text-stone-800">{auction?.name ?? "Transfer Market"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId } })}>Back to Auction</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate({ to: "/auction/$auctionId/fantasy", params: { auctionId } })}>Open Fantasy</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate({ to: "/auction/$auctionId/ipl-matches", params: { auctionId } })}>IPL Matches</Button>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3 text-xs text-indigo-900 mb-4">
          Full-page marketplace view. Create trade/sell offers with max 2 players each side. Cash checks always use live existing wallet balances.
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-4">
          <section className="rounded-2xl border border-stone-200 p-5 bg-white shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Create Offer</p>
              <button
                type="button"
                className="text-[11px] px-2 py-1 rounded border border-stone-300 bg-white hover:bg-stone-100"
                disabled={tradeMode !== "TRADE"}
                onClick={() => {
                  if (tradeMode !== "TRADE") return
                  const prevFrom = fromSquadId
                  setFromSquadId(toSquadId)
                  setToSquadId(prevFrom)
                  setFromPlayerA(toPlayerA); setFromPlayerB(toPlayerB)
                  setToPlayerA(fromPlayerA); setToPlayerB(fromPlayerB)
                  const prevCash = cashFromToTo
                  setCashFromToTo(cashToToFrom)
                  setCashToToFrom(prevCash)
                }}
              >
                ⇄ Swap sides
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setTradeMode("TRADE")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${tradeMode === "TRADE" ? "border-indigo-500 bg-indigo-600 text-white" : "border-stone-300 bg-white text-stone-700"}`}>Player Trade</button>
              <button type="button" onClick={() => { setTradeMode("SELL"); setToPlayerA(""); setToPlayerB(""); setCashToToFrom("") }} className={`rounded-xl border px-3 py-2 text-xs font-bold ${tradeMode === "SELL" ? "border-emerald-500 bg-emerald-600 text-white" : "border-stone-300 bg-white text-stone-700"}`}>Sell Player</button>
              <button type="button" onClick={() => setTradeMode("LOAN")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${tradeMode === "LOAN" ? "border-amber-500 bg-amber-500 text-white" : "border-stone-300 bg-white text-stone-700"}`}>Loan (Soon)</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-stone-500 mb-1">Seller / From squad</p>
                <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white" value={fromSquadId} onChange={(e) => { setFromSquadId(e.target.value); setFromPlayerA(""); setFromPlayerB("") }}>
                  <option value="">Select squad</option>
                  {tradeSquads.map((s) => <option key={s.squadId} value={s.squadId}>{s.name}</option>)}
                </select>
                <p className="text-[11px] mt-1 text-stone-500">Wallet: <span className="font-bold text-stone-700">{fromWalletCr == null ? "—" : `${fromWalletCr.toFixed(2)}Cr`}</span></p>
              </div>
              {tradeMode === "TRADE" ? (
                <div>
                  <p className="text-[10px] font-semibold text-stone-500 mb-1">Buyer / To squad</p>
                  <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white" value={toSquadId} onChange={(e) => { setToSquadId(e.target.value); setToPlayerA(""); setToPlayerB("") }}>
                    <option value="">Select squad</option>
                    {tradeSquads.filter((s) => s.squadId !== fromSquadId).map((s) => <option key={s.squadId} value={s.squadId}>{s.name}</option>)}
                  </select>
                  <p className="text-[11px] mt-1 text-stone-500">Wallet: <span className="font-bold text-stone-700">{toWalletCr == null ? "—" : `${toWalletCr.toFixed(2)}Cr`}</span></p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3 text-xs text-stone-500">
                  Sell listing is open market. You only set player + asking price. Interested squads accept from the market book.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-stone-500 mb-1">From side gives</p>
                <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white mb-2" value={fromPlayerA} onChange={(e) => setFromPlayerA(e.target.value)}>
                  <option value="">Player 1</option>
                  {(fromSquad?.players ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white" value={fromPlayerB} onChange={(e) => setFromPlayerB(e.target.value)}>
                  <option value="">Player 2 (optional)</option>
                  {(fromSquad?.players ?? []).filter((p) => p.id !== fromPlayerA).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {tradeMode === "TRADE" ? (
                <div>
                  <p className="text-[10px] font-semibold text-stone-500 mb-1">To side gives</p>
                  <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white mb-2" value={toPlayerA} onChange={(e) => setToPlayerA(e.target.value)}>
                    <option value="">Player 1</option>
                    {(toSquad?.players ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select className="w-full border border-stone-200 rounded-lg px-2 py-2 text-sm bg-white" value={toPlayerB} onChange={(e) => setToPlayerB(e.target.value)}>
                    <option value="">Player 2 (optional)</option>
                    {(toSquad?.players ?? []).filter((p) => p.id !== toPlayerA).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3 text-xs text-stone-500">
                  {tradeMode === "SELL" ? "Sell mode: buyer sends only cash." : "Loan mode is a UI placeholder until loan backend is added."}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Input value={cashFromToTo} onChange={(e) => setCashFromToTo(e.target.value)} placeholder="Cash from → to (Cr)" />
                {tradeMode === "TRADE" && !fromCashWithinWallet && <p className="text-[11px] text-rose-600 font-semibold">Exceeds from squad wallet.</p>}
              </div>
              <div className="space-y-1">
                <Input value={cashToToFrom} onChange={(e) => setCashToToFrom(e.target.value)} placeholder="Cash to → from (Cr)" />
                {tradeMode === "TRADE" && !toCashWithinWallet && <p className="text-[11px] text-rose-600 font-semibold">Exceeds to squad wallet.</p>}
              </div>
            </div>

            {!validCashFromToTo || !validCashToToFrom ? (
              <p className="text-xs text-rose-600 font-semibold">Cash values must be valid positive numbers (or blank).</p>
            ) : tradeMode === "SELL" && !(cashFromToToCr > 0 && cashToToFromCr === 0 && !!fromPlayerA && !fromPlayerB) ? (
              <p className="text-xs text-rose-600 font-semibold">In sell mode, choose exactly one player and set only "Cash from → to" (&gt; 0).</p>
            ) : tradeMode === "LOAN" ? (
              <p className="text-xs text-amber-700 font-semibold">Loan submit disabled until backend loan rules are added.</p>
            ) : (
              <p className="text-xs text-stone-600 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                {tradeMode === "SELL"
                  ? <>Preview: <span className="font-semibold">{fromSquad?.name ?? "From"}</span> sells {selectedFromPlayers.length ? selectedFromPlayers.map((id) => playerNameById(fromSquadId, id)).join(", ") : "no players"} to <span className="font-semibold">{toSquad?.name ?? "To"}</span> for <span className="font-bold">{cashFromToToCr.toFixed(2)}Cr</span>.</>
                  : <>Preview: <span className="font-semibold">{fromSquad?.name ?? "From"}</span> gives {selectedFromPlayers.length ? selectedFromPlayers.map((id) => playerNameById(fromSquadId, id)).join(", ") : "no players"}{cashFromToTo.trim() ? ` + ${cashFromToToCr.toFixed(2)}Cr` : ""} to <span className="font-semibold">{toSquad?.name ?? "To"}</span> in return for {selectedToPlayers.length ? selectedToPlayers.map((id) => playerNameById(toSquadId, id)).join(", ") : "no players"}{cashToToFrom.trim() ? ` + ${cashToToFromCr.toFixed(2)}Cr` : ""}.</>}
              </p>
            )}

            <Button onClick={() => createTrade.mutate()} disabled={!canCreateTrade || createTrade.isPending} className="w-full h-11 text-sm font-black bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
              {tradeMode === "LOAN" ? "Loan API Pending" : createTrade.isPending ? "Creating..." : tradeMode === "SELL" ? "List Sell Offer" : "Create Trade Offer"}
            </Button>
          </section>

          <section className="rounded-2xl border border-stone-200 p-4 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Live Market Book</p>
              <p className="text-[11px] text-stone-400">Newest first</p>
            </div>
            <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
              {((tradeRows ?? []) as TradeResponse[]).length === 0 ? (
                <p className="text-sm text-stone-400 italic py-4 text-center">No trades yet.</p>
              ) : (
                ((tradeRows ?? []) as TradeResponse[]).map((t) => {
                  const fromName = tradeSquads.find((s) => s.squadId === t.fromSquadId)?.name ?? t.fromSquadId
                  const toName = tradeSquads.find((s) => s.squadId === t.toSquadId)?.name ?? t.toSquadId
                  const isSellStyle = t.toPlayerIds.length === 0 && Number(t.cashFromToTo) > 0
                  const selectedBuyer = sellBuyerByTradeId[t.id] ?? ""
                  return (
                    <div key={t.id} className="border border-stone-200 rounded-xl p-3 bg-stone-50">
                      <p className="text-xs text-stone-500">#{t.id.slice(0, 8)} · {t.status} · {isSellStyle ? "SELL" : "TRADE"}</p>
                      <p className="text-sm font-semibold mt-1">{fromName} ⇄ {toName}</p>
                      <p className="text-xs text-stone-600 mt-1">
                        From: {t.fromPlayerIds.length ? t.fromPlayerIds.map((id) => playerNameById(t.fromSquadId, id)).join(", ") : "—"} {t.cashFromToTo > 0 ? ` + ${fmtCr(Number(t.cashFromToTo))}` : ""}
                      </p>
                      <p className="text-xs text-stone-600">
                        To: {t.toPlayerIds.length ? t.toPlayerIds.map((id) => playerNameById(t.toSquadId, id)).join(", ") : "—"} {t.cashToToFrom > 0 ? ` + ${fmtCr(Number(t.cashToToFrom))}` : ""}
                      </p>
                      {t.status === "PENDING" && (
                        <div className="flex gap-2 mt-2">
                          {isSellStyle ? (
                            <>
                              <select
                                className="border border-stone-300 rounded px-2 py-1 text-xs bg-white"
                                value={selectedBuyer}
                                onChange={(e) => setSellBuyerByTradeId((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              >
                                <option value="">Buyer squad</option>
                                {tradeSquads
                                  .filter((s) => s.squadId !== t.fromSquadId)
                                  .map((s) => <option key={s.squadId} value={s.squadId}>{s.name}</option>)}
                              </select>
                              <button
                                className="px-2 py-1 text-xs rounded bg-emerald-600 text-white disabled:opacity-50"
                                disabled={!selectedBuyer || acceptSellTrade.isPending || rejectTrade.isPending || cancelTrade.isPending}
                                onClick={() => acceptSellTrade.mutate({ tradeId: t.id, buyerSquadId: selectedBuyer })}
                              >
                                Accept Sell
                              </button>
                            </>
                          ) : (
                            <button className="px-2 py-1 text-xs rounded bg-emerald-600 text-white disabled:opacity-50" disabled={acceptTrade.isPending || rejectTrade.isPending || cancelTrade.isPending} onClick={() => acceptTrade.mutate(t.id)}>Accept</button>
                          )}
                          <button className="px-2 py-1 text-xs rounded bg-rose-600 text-white disabled:opacity-50" disabled={acceptTrade.isPending || acceptSellTrade.isPending || rejectTrade.isPending || cancelTrade.isPending} onClick={() => rejectTrade.mutate(t.id)}>Reject</button>
                          <button className="px-2 py-1 text-xs rounded bg-stone-400 text-white disabled:opacity-50" disabled={acceptTrade.isPending || acceptSellTrade.isPending || rejectTrade.isPending || cancelTrade.isPending} onClick={() => cancelTrade.mutate(t.id)}>Cancel</button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
