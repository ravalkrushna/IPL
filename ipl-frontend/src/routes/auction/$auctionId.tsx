/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import { AxiosError } from "axios"

import { auctionApi } from "@/lib/auctionApi"
import { auctionEngineApi, auctionPoolApi } from "@/lib/auctionEngineApi"
import { biddingApi } from "@/lib/biddingApi"
import { hammerApi, participantApi } from "@/lib/hammerApi"
import { squadApi } from "@/lib/squadApi"
import { authApi } from "@/lib/auth"
import { useAuctionRoomStore } from "@/store/auctionRoomStore"
import { Player } from "@/types/player"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// ─── NOTE ─────────────────────────────────────────────────────────────────
// Zero useState — all local UI state lives in useAuctionRoomStore (Zustand).
// Add these fields to your auctionRoomStore.ts:
//
//   // ManualHammerDialog
//   hammerParticipantId: string
//   setHammerParticipantId: (v: string) => void
//   hammerAmount: number | ""
//   setHammerAmount: (v: number | "") => void
//
//   // AddParticipantDialog
//   addSearch: string
//   setAddSearch: (v: string) => void
//   addNewName: string
//   setAddNewName: (v: string) => void
//   addShowNewForm: boolean
//   setAddShowNewForm: (v: boolean) => void
//
//   // AdminPanel
//   showAddParticipant: boolean
//   setShowAddParticipant: (v: boolean) => void

export const Route = createFileRoute("/auction/$auctionId")({
  component: AuctionRoomPage,
})

// ─── HELPERS ───────────────────────────────────────────────────────────────

function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`
  return `₹${amount.toLocaleString()}`
}

function specialismStyle(sp?: string) {
  switch (sp?.toUpperCase()) {
    case "BATSMAN": return { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-400" }
    case "BOWLER": return { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-400" }
    case "ALLROUNDER": return { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-400" }
    case "WICKETKEEPER": return { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400" }
    default: return { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" }
  }
}

// ─── TIMER RING ──────────────────────────────────────────────────────────

function TimerRing({ seconds, total, biddingOpen, paused }: {
  seconds: number; total: number; biddingOpen: boolean; paused?: boolean
}) {
  const pct = total > 0 ? seconds / total : 0
  const r = 22
  const circ = 2 * Math.PI * r
  const color = paused ? "#94a3b8"
    : biddingOpen ? "#10b981"
      : seconds <= 5 ? "#ef4444"
        : seconds <= 10 ? "#f59e0b"
          : "#6366f1"

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="56" height="56">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(100,116,139,0.15)" strokeWidth="3.5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {paused ? (
          <span className="text-base text-slate-400">⏸</span>
        ) : biddingOpen ? (
          <>
            <span className="text-[10px] font-black text-emerald-500 tracking-wider">LIVE</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mt-0.5" />
          </>
        ) : seconds > 0 ? (
          <>
            <span className="text-lg font-black tabular-nums leading-none" style={{ color }}>{seconds}</span>
            <span className="text-[9px] text-slate-400 font-semibold tracking-widest">SEC</span>
          </>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        )}
      </div>
    </div>
  )
}

// ─── PLAYER HERO CARD ────────────────────────────────────────────────────

function PlayerHeroCard({ player, seconds, total, biddingOpen, paused }: {
  player: Player; seconds: number; total: number; biddingOpen: boolean; paused?: boolean
}) {
  const st = specialismStyle(player.specialism)
  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 shrink-0 shadow-sm"
      style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)" }}>
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black tracking-tight truncate text-white">{player.name}</h2>
            {player.country && (
              <p className="text-slate-300 text-sm mt-1">
                🌍 {player.country}{player.age ? ` · Age ${player.age}` : ""}
              </p>
            )}
            <div className="flex gap-2 mt-3 flex-wrap">
              {player.specialism && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${st.bg} ${st.text} ${st.border}`}>
                  {player.specialism}
                </span>
              )}
            </div>
          </div>
          <TimerRing seconds={seconds} total={total} biddingOpen={biddingOpen} paused={paused} />
        </div>
      </div>
      <div className="border-t border-white/10 grid grid-cols-3 divide-x divide-white/10">
        {[
          { label: "TEST", value: player.testCaps ?? 0, color: "text-sky-300" },
          { label: "ODI", value: player.odiCaps ?? 0, color: "text-violet-300" },
          { label: "T20", value: player.t20Caps ?? 0, color: "text-amber-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`flex flex-col items-center py-3.5 ${value > 0 ? "opacity-100" : "opacity-35"}`}>
            <span className={`text-xl font-black tabular-nums ${value > 0 ? color : "text-slate-500"}`}>
              {value > 0 ? value : "—"}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold tracking-widest mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── BID FEED ─────────────────────────────────────────────────────────────

function BidFeed({ auctionId, currentPlayerId }: { auctionId: string; currentPlayerId?: string }) {
  const { data: bidHistory } = useQuery({
    queryKey: ["bidHistory", currentPlayerId],
    queryFn: () => biddingApi.bidHistory(auctionId, currentPlayerId!),
    enabled: !!currentPlayerId,
    refetchInterval: 2000,
  })

  const bids = bidHistory ?? []

  return (
    <div className="rounded-2xl border border-slate-200 bg-white flex-1 flex flex-col min-h-0 shadow-sm">
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between shrink-0 border-b border-slate-100">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Bids</span>
        {bids.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 min-h-0">
        {bids.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs text-slate-300 italic">No bids yet</p>
          </div>
        ) : [...bids].reverse().map((bid: { squadName?: string; participantName?: string; amount: number; isManual?: boolean }, i) => (
          <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs
            ${i === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50 border border-transparent"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <span>{i === 0 ? "🏆" : "·"}</span>
              <div className="min-w-0">
                <span className={`font-bold truncate block ${i === 0 ? "text-emerald-700" : "text-slate-600"}`}>
                  {bid.squadName || bid.participantName}
                </span>
                {bid.isManual && <span className="text-[9px] text-amber-500 font-semibold">manual</span>}
              </div>
            </div>
            <span className={`font-black tabular-nums shrink-0 ml-2 ${i === 0 ? "text-emerald-600" : "text-slate-500"}`}>
              {fmt(bid.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── SQUAD CARD ──────────────────────────────────────────────────────────

function SquadCard({ squad, isMe, expanded, onToggle }: {
  squad: { id?: string; name: string; participantId?: string; players?: { id: string; name: string; specialism?: string; soldPrice?: number }[] }
  isMe: boolean; expanded: boolean; onToggle: () => void
}) {
  const players = squad.players ?? []
  const spent = players.reduce((s, p) => s + (p.soldPrice ?? 0), 0)
  return (
    <div onClick={onToggle}
      className={`rounded-2xl border transition-all duration-200 overflow-hidden cursor-pointer
        ${isMe
          ? "border-emerald-300 bg-emerald-50 shadow-[0_2px_12px_rgba(16,185,129,0.15)]"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}>
      <div className="px-3.5 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isMe ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className={`font-bold text-sm truncate ${isMe ? "text-emerald-700" : "text-slate-700"}`}>{squad.name}</span>
          {isMe && <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full shrink-0">YOU</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-bold ${isMe ? "text-emerald-600" : "text-slate-400"}`}>{players.length}p</span>
          <svg className={`w-3 h-3 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      <div className="px-3.5 pb-2.5">
        <span className="text-[11px] text-slate-400">Spent: <span className={`font-semibold ${isMe ? "text-emerald-600" : "text-slate-600"}`}>{fmt(spent)}</span></span>
      </div>
      {expanded && (
        <div className="border-t border-slate-100">
          {players.length === 0
            ? <p className="text-center py-3 text-xs text-slate-400 italic">No players yet</p>
            : <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
              {players.map((p) => {
                const st = specialismStyle(p.specialism)
                return (
                  <div key={p.id} className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{p.name}</p>
                      {p.specialism && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border ${st.bg} ${st.text} ${st.border}`}>
                          {p.specialism}
                        </span>
                      )}
                    </div>
                    {p.soldPrice != null && (
                      <span className="text-[11px] font-black text-emerald-600 tabular-nums ml-2">{fmt(p.soldPrice)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          }
        </div>
      )}
    </div>
  )
}

// ─── MANUAL HAMMER DIALOG ────────────────────────────────────────────────

function ManualHammerDialog({
  open,
  onOpenChange,
  currentPlayer,
  participants,
  participantsLoading,
  onHammer,
  isPending,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  currentPlayer: Player | null
  participants: { id: string; name: string; walletBalance?: number }[] | undefined
  participantsLoading: boolean
  onHammer: (data: { participantId: string; finalAmount: number }) => void
  isPending: boolean
}) {
  const selectedParticipantId = useAuctionRoomStore(s => s.hammerParticipantId)
  const setSelectedParticipantId = useAuctionRoomStore(s => s.setHammerParticipantId)
  const amount = useAuctionRoomStore(s => s.hammerAmount)
  const setAmount = useAuctionRoomStore(s => s.setHammerAmount)

  useEffect(() => {
    if (open) { setSelectedParticipantId(""); setAmount("") }
  }, [open])

  const canSubmit = !isPending && !!currentPlayer && Number(amount) > 0 && !!selectedParticipantId && Number(amount) >= Number(currentPlayer.basePrice)

  const QUICK_AMOUNTS = [
    { label: "50L", value: 5_000_000 },
    { label: "1Cr", value: 10_000_000 },
    { label: "2Cr", value: 20_000_000 },
    { label: "5Cr", value: 50_000_000 },
    { label: "10Cr", value: 100_000_000 },
    { label: "15Cr", value: 150_000_000 },
    { label: "20Cr", value: 200_000_000 },
    { label: "25Cr", value: 250_000_000 },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border-slate-200 text-slate-800 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">✍️ Manual Hammer</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">

          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">Player</p>
            <p className="font-bold text-slate-700">{currentPlayer?.name ?? "—"}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Quick Select Amount</p>
            <div className="grid grid-cols-4 gap-1.5">
              {QUICK_AMOUNTS.map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => setAmount(value)}
                  className={`py-2 rounded-xl text-xs font-black transition-all border
                    ${amount === value
                      ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700"
                    }`}>
                  ₹{label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Final Amount (₹) — or type custom
            </p>
            <Input
              type="number"
              placeholder="e.g. 15000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              className="bg-slate-50 border-slate-200"
            />
            {Number(amount) > 0 && (
              <p className="text-xs text-amber-600 font-semibold mt-1">= {fmt(Number(amount))}</p>
            )}
            {Number(amount) > 0 && Number(amount) < Number(currentPlayer?.basePrice ?? 0) && (
              <p className="text-xs text-red-500 font-semibold mt-1">
                ⚠️ Amount must be at least {fmt(Number(currentPlayer?.basePrice ?? 0))} (base price)
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Participant</p>
            {participantsLoading ? (
              <p className="text-xs text-slate-400 italic">Loading participants…</p>
            ) : (participants ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center">
                <p className="text-xs text-slate-400">No participants in this auction yet.</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Use ＋ Add in All Squads to add participants first.</p>
              </div>
            ) : (
              <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                <SelectTrigger className="bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Select participant…" />
                </SelectTrigger>
                <SelectContent>
                  {(participants ?? []).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center justify-between gap-4 w-full">
                        <span className="font-semibold">{p.name}</span>
                        {p.walletBalance != null && (
                          <span className="text-xs text-slate-400">({fmt(p.walletBalance)} left)</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-black"
              disabled={!canSubmit}
              onClick={() => onHammer({ participantId: selectedParticipantId, finalAmount: Number(amount) })}>
              {isPending ? "Hammering…" : "🔨 Hammer"}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── ADD PARTICIPANT DIALOG ──────────────────────────────────────────────

function AddParticipantDialog({
  open,
  onOpenChange,
  auctionId,
  onAdded,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  auctionId: string
  onAdded: () => void
}) {
  const search = useAuctionRoomStore(s => s.addSearch)
  const setSearch = useAuctionRoomStore(s => s.setAddSearch)
  const newName = useAuctionRoomStore(s => s.addNewName)
  const setNewName = useAuctionRoomStore(s => s.setAddNewName)
  const showNewForm = useAuctionRoomStore(s => s.addShowNewForm)
  const setShowNewForm = useAuctionRoomStore(s => s.setAddShowNewForm)

  useEffect(() => {
    if (open) { setSearch(""); setNewName(""); setShowNewForm(false) }
  }, [open])

  const { data: allParticipants, isLoading } = useQuery({
    queryKey: ["allParticipants"],
    queryFn: () => participantApi.getAll(),
    enabled: open,
  })

  const { data: auctionSquads } = useQuery({
    queryKey: ["allSquads", auctionId],
    queryFn: () => import("@/lib/squadApi").then(m => m.squadApi.allSquads(auctionId)),
    enabled: open,
  })

  const alreadyInAuction = new Set(
    (auctionSquads ?? []).map((s: { participantId?: string }) => s.participantId).filter(Boolean)
  )

  const filtered = (allParticipants ?? []).filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const addMutation = useMutation({
    mutationFn: (data: { participantId?: string; newParticipantName?: string }) =>
      participantApi.addToAuction(auctionId, data),
    onSuccess: () => { onAdded(); onOpenChange(false) },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border-slate-200 text-slate-800 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black">＋ Add Participant</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">

          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Search Existing</p>
            <Input
              placeholder="Search by name…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-50 border-slate-200"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-50">
            {isLoading ? (
              <p className="text-xs text-slate-400 italic text-center py-4">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">No participants found</p>
            ) : filtered.map(p => {
              const inAuction = alreadyInAuction.has(p.id)
              return (
                <div key={p.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50">
                  <span className="text-sm font-semibold text-slate-700">{p.name}</span>
                  {inAuction ? (
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      In auction
                    </span>
                  ) : (
                    <button
                      disabled={addMutation.isPending}
                      onClick={() => addMutation.mutate({ participantId: p.id })}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-all disabled:opacity-40">
                      Add →
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">or create new</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {!showNewForm ? (
            <button
              onClick={() => setShowNewForm(true)}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-indigo-200 text-indigo-600 text-sm font-bold hover:bg-indigo-50 transition-all">
              ＋ Create New Participant
            </button>
          ) : (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
              <p className="text-xs font-black text-indigo-600 uppercase tracking-wider">New Participant</p>
              <Input
                autoFocus
                placeholder="e.g. Rohit Sharma"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="bg-white border-indigo-200"
              />
              <p className="text-[11px] text-indigo-400">
                Squad named <span className="font-bold">"{newName || "…"}"</span> will be auto-created with ₹100Cr budget.
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setShowNewForm(false); setNewName("") }}
                  className="flex-1 py-1.5 rounded-lg border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  disabled={!newName.trim() || addMutation.isPending}
                  onClick={() => addMutation.mutate({ newParticipantName: newName.trim() })}
                  className="flex-1 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black disabled:opacity-40 transition-all">
                  {addMutation.isPending ? "Creating…" : "Create & Add"}
                </button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── ADMIN PANEL ─────────────────────────────────────────────────────────

function AdminPanel({ auctionId }: { auctionId: string }) {
  const queryClient = useQueryClient()

  const confirmEnd = useAuctionRoomStore(s => s.confirmEnd)
  const setConfirmEnd = useAuctionRoomStore(s => s.setConfirmEnd)
  const showManualHammer = useAuctionRoomStore(s => s.showManualHammer)
  const setShowManualHammer = useAuctionRoomStore(s => s.setShowManualHammer)
  const expandedSquad = useAuctionRoomStore(s => s.expandedSquad)
  const setExpandedSquad = useAuctionRoomStore(s => s.setExpandedSquad)
  const showAddParticipant = useAuctionRoomStore(s => s.showAddParticipant)
  const setShowAddParticipant = useAuctionRoomStore(s => s.setShowAddParticipant)

  const { data: engineState } = useQuery({
    queryKey: ["engineState", auctionId],
    queryFn: () => auctionEngineApi.state(auctionId),
    refetchInterval: 1500,
  })

  const currentPlayer = engineState?.currentPlayer ?? null
  const activePoolObj = engineState?.pools?.find((p: { status: string }) => p.status === "ACTIVE")
  const pausedPools = engineState?.pools?.filter((p: { status: string }) => p.status === "PAUSED") ?? []
  const pendingPools = engineState?.pools?.filter((p: { status: string }) => p.status === "PENDING") ?? []
  const availablePools = [...pausedPools, ...pendingPools]
  const poolExhausted = engineState?.poolExhausted ?? false

  const { data: auction } = useQuery({ queryKey: ["auction", auctionId], queryFn: () => auctionApi.getById(auctionId), refetchInterval: 5000 })
  const { data: allSquads } = useQuery({ queryKey: ["allSquads", auctionId], queryFn: () => squadApi.allSquads(auctionId), refetchInterval: 3000 })
  const { data: participants, isLoading: participantsLoading } = useQuery({
    queryKey: ["participants", auctionId],
    queryFn: () => hammerApi.getParticipants(auctionId),
    refetchInterval: 3000,
  })

  const { data: highestBid } = useQuery({
    queryKey: ["highestBid", currentPlayer?.id],
    queryFn: () => biddingApi.highestBid(auctionId, currentPlayer!.id),
    enabled: !!currentPlayer?.id,
    refetchInterval: 1500,
  })

  const isPaused = auction?.status === "PAUSED"
  const currentBid = highestBid?.amount ?? Number(currentPlayer?.basePrice ?? 0)

  const pause = useMutation({ mutationFn: () => auctionApi.pause(auctionId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auction", auctionId] }) })
  const resume = useMutation({ mutationFn: () => auctionApi.resume(auctionId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auction", auctionId] }) })
  const endAuction = useMutation({ mutationFn: () => auctionApi.end(auctionId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["auction", auctionId] }) })

  const nextPlayer = useMutation({
    mutationFn: () => auctionEngineApi.nextPlayer(auctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
    },
  })

  const activatePool = useMutation({
    mutationFn: (poolType: string) => auctionPoolApi.activatePool(auctionId, poolType),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] }),
  })

  const pausePool = useMutation({
    mutationFn: () => auctionPoolApi.pausePool(auctionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] }),
  })

  const completePool = useMutation({
    mutationFn: () => auctionPoolApi.completePool(auctionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] }),
  })

  const manualHammer = useMutation({
    mutationFn: (data: { participantId: string; finalAmount: number }) =>
      hammerApi.manualHammer({ playerId: currentPlayer!.id, auctionId, ...data } as Parameters<typeof hammerApi.manualHammer>[0]),
    onSuccess: () => {
      setShowManualHammer(false)
      queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["engineState", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["participants", auctionId] })
    },
  })

  return (
    <div className="flex-1 flex gap-0 overflow-hidden min-h-0">

      {/* ── Left: Player Info + Bid Feed ── */}
      <div className="flex-1 flex flex-col p-5 gap-4 min-w-0 border-r border-slate-200/60 overflow-hidden">

        {isPaused && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3 shrink-0">
            <span className="text-xl">⏸</span>
            <div>
              <p className="text-sm font-bold text-amber-700">Auction Paused</p>
              <p className="text-xs text-amber-500">All timers frozen.</p>
            </div>
          </div>
        )}

        {poolExhausted && (
          <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center gap-3 shrink-0">
            <span className="text-xl">🏁</span>
            <p className="text-sm font-bold text-indigo-700">Pool exhausted — no more players in this pool</p>
          </div>
        )}

        {currentPlayer ? (
          <PlayerHeroCard player={currentPlayer} seconds={0} total={0} biddingOpen={false} paused={isPaused} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center py-12 shrink-0">
            <div className="text-center">
              <div className="text-4xl mb-2">🏏</div>
              <p className="text-sm font-semibold text-slate-400">
                {activePoolObj ? "Press Next Player to begin"
                  : pausedPools.length > 0 ? "Resume a paused pool to continue"
                    : "Activate a pool to start"}
              </p>
            </div>
          </div>
        )}

        {currentPlayer && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shrink-0 shadow-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              {currentPlayer.battingStyle && (
                <><span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Batting</span>
                  <span className="font-semibold text-slate-700">{currentPlayer.battingStyle}</span></>
              )}
              {currentPlayer.bowlingStyle && (
                <><span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Bowling</span>
                  <span className="font-semibold text-slate-700">{currentPlayer.bowlingStyle}</span></>
              )}
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Base Price</span>
              <span className="font-black text-amber-600">{fmt(Number(currentPlayer.basePrice ?? 0))}</span>
            </div>
          </div>
        )}

        <BidFeed auctionId={auctionId} currentPlayerId={currentPlayer?.id} />
      </div>

      {/* ── Centre: Admin Controls ── */}
      <div className="w-72 shrink-0 flex flex-col p-5 gap-4 border-r border-slate-200/60 overflow-y-auto">

        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shrink-0 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Bid</p>
          <p className="text-4xl font-black tabular-nums text-slate-800">{fmt(currentBid)}</p>
          {highestBid?.participantName ? (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
              <span>🏆</span>
              <span className="text-sm font-bold text-emerald-700">{highestBid.participantName}</span>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-300 italic">No bids</p>
          )}
        </div>

        {/* Pool management */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Pool</p>

          {activePoolObj && (
            <div className="space-y-2 mb-3">
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${specialismStyle(activePoolObj.poolType).bg} ${specialismStyle(activePoolObj.poolType).border}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${specialismStyle(activePoolObj.poolType).dot}`} />
                <span className={`text-sm font-bold ${specialismStyle(activePoolObj.poolType).text}`}>{activePoolObj.poolType}</span>
                <span className="ml-auto text-[10px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">ACTIVE</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => pausePool.mutate()} disabled={pausePool.isPending}
                  className="py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-all disabled:opacity-40">
                  ⏸ Pause
                </button>
                <button
                  onClick={() => { if (confirm(`Permanently complete the ${activePoolObj.poolType} pool?`)) completePool.mutate() }}
                  disabled={completePool.isPending}
                  className="py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-all disabled:opacity-40">
                  ✓ Complete
                </button>
              </div>
            </div>
          )}

          {pausedPools.length > 0 && (
            <div className="space-y-1.5 mb-2">
              <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Paused — resumable</p>
              {pausedPools.map((p: { id: string; poolType: string }) => (
                <button key={p.id}
                  onClick={() => activatePool.mutate(p.poolType)}
                  disabled={activatePool.isPending || !!activePoolObj}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-sm transition-all
                    ${specialismStyle(p.poolType).bg} ${specialismStyle(p.poolType).border} ${specialismStyle(p.poolType).text}
                    hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed`}>
                  <div className={`w-2 h-2 rounded-full ${specialismStyle(p.poolType).dot}`} />
                  <span>{p.poolType}</span>
                  <span className="ml-auto text-[9px] font-black bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">PAUSED</span>
                </button>
              ))}
            </div>
          )}

          {pendingPools.length > 0 && (
            <div className="space-y-1.5">
              {pausedPools.length > 0 && <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Not started</p>}
              {pendingPools.map((p: { id: string; poolType: string }) => (
                <button key={p.id}
                  onClick={() => activatePool.mutate(p.poolType)}
                  disabled={activatePool.isPending || !!activePoolObj}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border font-bold text-sm transition-all
                    ${specialismStyle(p.poolType).bg} ${specialismStyle(p.poolType).border} ${specialismStyle(p.poolType).text}
                    hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed`}>
                  <div className={`w-2 h-2 rounded-full ${specialismStyle(p.poolType).dot}`} />
                  {p.poolType}
                </button>
              ))}
            </div>
          )}

          {availablePools.length === 0 && !activePoolObj && (
            <p className="text-xs text-slate-400 text-center italic py-2">All pools completed</p>
          )}

          {activePoolObj && availablePools.length > 0 && (
            <p className="text-[9px] text-slate-400 italic text-center mt-2">
              Pause {activePoolObj.poolType} first to switch pools
            </p>
          )}
        </div>

        {/* Player flow */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Player Flow</p>
          <div className="space-y-2">
            <button
              onClick={() => nextPlayer.mutate()}
              disabled={nextPlayer.isPending || !activePoolObj}
              className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white font-black text-sm transition-all shadow-sm">
              ⏭ Next Player
            </button>
          </div>
        </div>

        {/* Hammer */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Hammer</p>
          <div className="space-y-2">
            <button
              onClick={() => setShowManualHammer(true)}
              className="w-full py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold text-sm transition-all">
              ✍️ Manual Hammer
            </button>
          </div>
        </div>

        {/* Auction controls */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Auction</p>
          <div className="space-y-2">
            {isPaused ? (
              <button onClick={() => resume.mutate()} disabled={resume.isPending}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-black text-sm transition-all">
                ▶ Resume
              </button>
            ) : auction?.status === "LIVE" ? (
              <button onClick={() => pause.mutate()} disabled={pause.isPending}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-50 text-white font-black text-sm transition-all">
                ⏸ Pause
              </button>
            ) : null}
            {!confirmEnd ? (
              <button onClick={() => setConfirmEnd(true)}
                className="w-full py-2.5 rounded-xl bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-red-500 font-bold text-sm transition-all">
                🏁 End Auction
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-red-500 text-center font-semibold">Cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmEnd(false)} className="flex-1 py-2 rounded-lg bg-slate-50 border text-slate-500 text-xs font-bold hover:bg-slate-100">Cancel</button>
                  <button onClick={() => { endAuction.mutate(); setConfirmEnd(false) }} disabled={endAuction.isPending}
                    className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-black">End</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: All Squads ── */}
      <div className="w-72 shrink-0 flex flex-col bg-slate-50/50">
        <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-slate-200/60">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All Squads</p>
            <p className="text-xs text-slate-600 mt-0.5 font-semibold">{allSquads?.length ?? 0} participants</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddParticipant(true)}
              className="text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg transition-all">
              ＋ Add
            </button>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
          {(allSquads ?? []).map((s: { id?: string; name: string; participantId?: string; players?: { id: string; name: string; specialism?: string; soldPrice?: number }[] }) => {
            const key = s.id ?? s.name
            return (
              <SquadCard key={key} squad={s} isMe={false}
                expanded={expandedSquad === key}
                onToggle={() => setExpandedSquad(expandedSquad === key ? null : key)} />
            )
          })}
        </div>
      </div>

      {/* ── Manual Hammer Dialog ── */}
      <ManualHammerDialog
        open={showManualHammer}
        onOpenChange={setShowManualHammer}
        currentPlayer={currentPlayer}
        participants={participants}
        participantsLoading={participantsLoading}
        onHammer={(data) => manualHammer.mutate(data)}
        isPending={manualHammer.isPending}
      />

      {/* ── Add Participant Dialog ── */}
      <AddParticipantDialog
        open={showAddParticipant}
        onOpenChange={setShowAddParticipant}
        auctionId={auctionId}
        onAdded={() => {
          queryClient.invalidateQueries({ queryKey: ["allSquads", auctionId] })
          queryClient.invalidateQueries({ queryKey: ["participants", auctionId] })
        }}
      />
    </div>
  )
}

// ─── PARTICIPANT VIEW ────────────────────────────────────────────────────

function ParticipantView({ auctionId, me }: { auctionId: string; me: { participantId: string; role: string; name: string } }) {
  const queryClient = useQueryClient()

  const expandedSquad = useAuctionRoomStore(s => s.expandedSquad)
  const setExpandedSquad = useAuctionRoomStore(s => s.setExpandedSquad)
  const showSquadDialog = useAuctionRoomStore(s => s.showSquadDialog)
  const setShowSquadDialog = useAuctionRoomStore(s => s.setShowSquadDialog)
  const squadNameInput = useAuctionRoomStore(s => s.squadNameInput)
  const setSquadNameInput = useAuctionRoomStore(s => s.setSquadNameInput)
  const myBalance = useAuctionRoomStore(s => s.myBalance)
  const setMyBalance = useAuctionRoomStore(s => s.setMyBalance)

  const { data: engineState } = useQuery({
    queryKey: ["engineState", auctionId],
    queryFn: () => auctionEngineApi.state(auctionId),
    refetchInterval: 1500,
  })

  const currentPlayer = engineState?.currentPlayer ?? null
  const biddingOpen = engineState?.biddingOpen ?? false
  const analysisSeconds = engineState?.analysisSeconds ?? 0
  const analysisTotalSecs = engineState?.analysisTotalSecs ?? 0

  const { data: auction } = useQuery({ queryKey: ["auction", auctionId], queryFn: () => auctionApi.getById(auctionId), refetchInterval: 5000 })
  const { data: squad, error: squadError, refetch: refetchSquad } = useQuery({
    queryKey: ["mySquad", auctionId, me.participantId],
    queryFn: () => squadApi.mySquad(auctionId, me.participantId),
    enabled: !!me.participantId,
    retry: false,
  })
  const { data: allSquads } = useQuery({
    queryKey: ["allSquads", auctionId],
    queryFn: () => squadApi.allSquads(auctionId),
    refetchInterval: 5000,
  })
  const { data: highestBid } = useQuery({
    queryKey: ["highestBid", currentPlayer?.id],
    queryFn: () => biddingApi.highestBid(auctionId, currentPlayer!.id),
    enabled: !!currentPlayer?.id,
    refetchInterval: 1500,
  })
  const { data: walletData } = useQuery({
    queryKey: ["wallet", me.participantId, auctionId],
    queryFn: () => biddingApi.getWallet(me.participantId, auctionId),
    enabled: !!me.participantId,
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (walletData?.balance !== undefined) setMyBalance(Number(walletData.balance))
  }, [walletData?.balance])

  const createSquad = useMutation({ mutationFn: squadApi.create, onSuccess: () => refetchSquad() })
  const placeBid = useMutation({
    mutationFn: biddingApi.placeBid,
    onError: (err) => alert(err instanceof AxiosError ? err.response?.data?.message ?? "Bid failed" : "Bid failed"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["highestBid", currentPlayer?.id] }),
  })

  const isPaused = auction?.status === "PAUSED"
  const squadMissing = squadError instanceof AxiosError && squadError.response?.status === 404
  const squadPlayers = (squad as { players?: { id: string; name: string; specialism?: string; soldPrice?: number }[] } | undefined)?.players ?? []
  const currentBid = highestBid?.amount ?? Number(currentPlayer?.basePrice ?? 0)
  const canBid = auction?.status === "LIVE" && biddingOpen && !!squad && !!me.participantId

  const sortedSquads = [...(allSquads ?? [])].sort((a: { name: string; players?: unknown[] }, b: { name: string; players?: unknown[] }) => {
    if (a.name === (squad as { name?: string } | undefined)?.name) return -1
    if (b.name === (squad as { name?: string } | undefined)?.name) return 1
    return (b.players?.length ?? 0) - (a.players?.length ?? 0)
  })

  return (
    <>
      {squadMissing && (
        <Dialog open>
          <DialogContent className="bg-white border-slate-200 text-slate-800 shadow-2xl">
            <DialogHeader><DialogTitle className="text-xl text-slate-800">🏏 Name Your Squad</DialogTitle></DialogHeader>
            <p className="text-sm text-slate-500 mb-3">Choose a name to enter the auction.</p>
            <Input placeholder="e.g. Mumbai Indians" value={squadNameInput} onChange={e => setSquadNameInput(e.target.value)}
              className="bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-300" />
            <Button disabled={!squadNameInput.trim() || createSquad.isPending}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold mt-3"
              onClick={() => createSquad.mutate({ auctionId, participantId: me.participantId, name: squadNameInput })}>
              Enter Auction →
            </Button>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showSquadDialog} onOpenChange={setShowSquadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col bg-white border-slate-200 text-slate-800 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              🏏 {(squad as { name?: string } | undefined)?.name ?? "My Squad"}
              <span className="text-slate-400 text-sm font-normal ml-2">{squadPlayers.length} players</span>
            </DialogTitle>
          </DialogHeader>
          {squadPlayers.length > 0
            ? <div className="overflow-y-auto flex-1 mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-100">
                    {["Player", "Role", "Sold For"].map(h => <TableHead key={h} className="text-slate-400">{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {squadPlayers.map((p: { id: string; name: string; specialism?: string; soldPrice?: number }) => (
                    <TableRow key={p.id} className="border-slate-50">
                      <TableCell className="font-semibold text-sm text-slate-700">{p.name}</TableCell>
                      <TableCell>{p.specialism && <Badge variant="secondary" className="text-xs">{p.specialism}</Badge>}</TableCell>
                      <TableCell className="font-bold text-emerald-600">{p.soldPrice ? fmt(p.soldPrice) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            : <div className="flex flex-col items-center justify-center py-12">
              <div className="text-5xl mb-3">🛒</div>
              <p className="text-slate-500">No players yet</p>
            </div>
          }
        </DialogContent>
      </Dialog>

      <div className="flex-1 flex gap-0 overflow-hidden min-h-0">

        {/* Col 1: Player */}
        <div className="flex-1 flex flex-col p-5 gap-4 min-w-0 border-r border-slate-200/60 overflow-hidden">
          {currentPlayer ? (
            <PlayerHeroCard player={currentPlayer} seconds={analysisSeconds} total={analysisTotalSecs} biddingOpen={biddingOpen} paused={isPaused} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center py-16 shrink-0">
              <div className="text-center">
                <div className="text-5xl mb-3 animate-pulse">🏏</div>
                <p className="text-sm text-slate-400 font-medium">Waiting for next player…</p>
              </div>
            </div>
          )}
          {currentPlayer && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shrink-0 shadow-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {currentPlayer.battingStyle && (<><span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Batting</span><span className="font-semibold text-slate-700">{currentPlayer.battingStyle}</span></>)}
                {currentPlayer.bowlingStyle && (<><span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Bowling</span><span className="font-semibold text-slate-700">{currentPlayer.bowlingStyle}</span></>)}
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Base Price</span>
                <span className="font-black text-amber-600">{fmt(Number(currentPlayer.basePrice ?? 0))}</span>
              </div>
            </div>
          )}
          <BidFeed auctionId={auctionId} currentPlayerId={currentPlayer?.id} />
        </div>

        {/* Col 2: Bidding */}
        <div className="w-64 shrink-0 flex flex-col p-5 gap-4 border-r border-slate-200/60 overflow-hidden">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shrink-0 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Bid</p>
            <p className="text-4xl font-black tabular-nums text-slate-800">{fmt(currentBid)}</p>
            {highestBid?.participantName
              ? <div className="mt-2 inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
                <span>🏆</span>
                <span className="text-sm font-bold text-emerald-700">{highestBid.participantName}</span>
              </div>
              : <p className="mt-2 text-xs text-slate-300 italic">No bids</p>
            }
          </div>

          {!biddingOpen && currentPlayer && !isPaused && (
            <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-center shrink-0">
              <p className="text-sm font-bold text-indigo-700">🔍 Analysis Phase</p>
              <p className="text-xs text-indigo-400 mt-0.5">Bidding opens after timer</p>
            </div>
          )}
          {isPaused && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-center shrink-0">
              <p className="text-sm font-bold text-amber-700">⏸ Paused</p>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shrink-0 shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Place Bid</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "+10L", amount: 1_000_000 },
                { label: "+20L", amount: 2_000_000 },
                { label: "+40L", amount: 4_000_000 },
                { label: "+80L", amount: 8_000_000 },
                { label: "+1Cr", amount: 10_000_000 },
                { label: "+5Cr", amount: 50_000_000 },
                { label: "+10Cr", amount: 100_000_000 },
              ].map(({ label, amount }) => (
                <button key={label}
                  disabled={!canBid || placeBid.isPending}
                  onClick={() => placeBid.mutate({
                    auctionId,
                    playerId: currentPlayer!.id,
                    participantId: me.participantId,
                    amount: (queryClient.getQueryData<{ amount: number }>(["highestBid", currentPlayer?.id])?.amount ?? Number(currentPlayer?.basePrice ?? 0)) + amount,
                  })}
                  className={`flex items-center justify-center py-2.5 rounded-xl font-black text-sm transition-all
                    ${label === "+10Cr" ? "col-span-2" : ""}
                    ${canBid
                      ? "bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]"
                      : "bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100"}`}>
                  {label}
                </button>
              ))}
            </div>
            {!canBid && (
              <p className="text-[11px] text-slate-300 text-center mt-3 italic">
                {!squad ? "Create a squad to bid"
                  : isPaused ? "Auction paused"
                    : !biddingOpen ? "Analysis phase…"
                      : "Bidding unavailable"}
              </p>
            )}
          </div>

          {myBalance != null && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 flex items-center justify-between shrink-0 shadow-sm">
              <span className="text-xs text-slate-400 font-semibold">Your Balance</span>
              <span className="font-black text-emerald-600 tabular-nums">{fmt(myBalance)}</span>
            </div>
          )}
        </div>

        {/* Col 3: Squads */}
        <div className="w-72 shrink-0 flex flex-col bg-slate-50/80">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-slate-200/60">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">All Squads</p>
              <p className="text-xs text-slate-600 mt-0.5 font-semibold">{sortedSquads.length} participants</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
            {sortedSquads.length === 0
              ? <div className="flex items-center justify-center h-full"><p className="text-xs text-slate-300 italic">No squads yet</p></div>
              : sortedSquads.map((s: { id?: string; name: string; players?: unknown[] }) => {
                const key = s.id ?? s.name
                return (
                  <SquadCard key={key}
                    squad={s as Parameters<typeof SquadCard>[0]["squad"]}
                    isMe={s.name === (squad as { name?: string } | undefined)?.name}
                    expanded={expandedSquad === key}
                    onToggle={() => setExpandedSquad(expandedSquad === key ? null : key)} />
                )
              })
            }
          </div>
        </div>
      </div>
    </>
  )
}

// ─── ROOT PAGE ────────────────────────────────────────────────────────────

function AuctionRoomPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId" })
  const navigate = useNavigate()

  const setSoldInfo = useAuctionRoomStore(s => s.setSoldInfo)
  const lastSeenResultTimestamp = useAuctionRoomStore(s => s.lastSeenResultTimestamp)
  const setLastSeenResultTimestamp = useAuctionRoomStore(s => s.setLastSeenResultTimestamp)
  const soldInfo = useAuctionRoomStore(s => s.soldInfo)

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: authApi.me })
  const { data: auction } = useQuery({ queryKey: ["auction", auctionId], queryFn: () => auctionApi.getById(auctionId), refetchInterval: 5000 })

  const { data: engineState } = useQuery({
    queryKey: ["engineState", auctionId],
    queryFn: () => auctionEngineApi.state(auctionId),
    refetchInterval: 1500,
  })

  useEffect(() => {
    const result = engineState?.lastResult
    if (!result) return
    if (result.timestamp === lastSeenResultTimestamp) return

    setLastSeenResultTimestamp(result.timestamp)
    setSoldInfo({
      playerName: result.playerName,
      squadName: result.squadName,
      amount: result.amount,
      unsold: result.unsold,
      timestamp: result.timestamp,
    })

    const t = setTimeout(() => setSoldInfo(null), result.unsold ? 2500 : 3500)
    return () => clearTimeout(t)
  }, [engineState?.lastResult?.timestamp])

  const isAdmin = me?.role === "ADMIN"

  if (!auction || !me) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-100">
        <div className="text-center space-y-3">
          <div className="text-5xl animate-pulse">🏏</div>
          <p className="text-slate-500 text-sm font-medium">Loading auction room…</p>
        </div>
      </div>
    )
  }

  const isPaused = auction.status === "PAUSED"

  return (
    <div className="h-screen flex flex-col overflow-hidden"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "linear-gradient(160deg, #f8fafc 0%, #f1f5f9 40%, #e8edf5 100%)" }}>

      {/* ── Sold / Unsold Overlay ── */}
      {soldInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm pointer-events-none">
          <div className={`text-center p-10 rounded-3xl border-2 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300
            ${soldInfo.unsold ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
            <div className="text-7xl mb-4">{soldInfo.unsold ? "🚫" : "🎉"}</div>
            <p className={`text-3xl font-black ${soldInfo.unsold ? "text-red-600" : "text-emerald-700"}`}>
              {soldInfo.unsold ? "Unsold" : "Sold!"}
            </p>
            <p className="text-xl font-bold mt-2 text-slate-600">{soldInfo.playerName}</p>
            {!soldInfo.unsold && soldInfo.amount != null && (
              <div className="mt-5 bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm">
                <p className="text-sm text-slate-400">to</p>
                <p className="font-black text-xl text-emerald-600">{soldInfo.squadName}</p>
                <p className="text-3xl font-black tabular-nums mt-1 text-slate-800">{fmt(soldInfo.amount)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Nav Bar ── */}
      <header className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-slate-700 to-slate-900 flex items-center justify-center text-base shadow-sm">🏏</div>
          <div>
            <h1 className="font-black text-base leading-tight tracking-tight text-slate-800">{auction.name}</h1>
            <p className="text-[11px] text-slate-400">{isAdmin ? "Admin View" : "Participant"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPaused && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <span className="text-sm">⏸</span>
              <span className="text-xs font-bold text-amber-600">PAUSED</span>
            </div>
          )}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border
            ${auction.status === "LIVE" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : auction.status === "PAUSED" ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-50 text-slate-500 border-slate-200"}`}>
            {auction.status === "LIVE" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
            {auction.status}
          </div>
          <button
            onClick={() => navigate({ to: "/auction" })}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all">
            ← Back to Lobby
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      {isAdmin
        ? <AdminPanel auctionId={auctionId} />
        : <ParticipantView auctionId={auctionId} me={me} />
      }
    </div>
  )
}