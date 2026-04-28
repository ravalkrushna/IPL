import { createFileRoute, useParams, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { midSeasonApi, RETENTION_COSTS_CR, RETENTION_CUMULATIVE_CR } from "@/lib/midSeasonApi"
import { squadApi } from "@/lib/squadApi"

export const Route = createFileRoute("/auction/$auctionId/mid-season/admin")({
  component: MidSeasonAdminPage,
})

const CR = 10_000_000

function fmtCr(raw: number) {
  return `${(raw / CR).toFixed(0)} CR`
}

type SquadPlayer = {
  id: string
  name: string
  specialism?: string
  iplTeam?: string
  basePrice?: number
  soldPrice?: number
}

type Squad = {
  squadId: string
  name: string
  participantId: string
  players?: SquadPlayer[]
}

const SPEC_COLORS: Record<string, { bg: string; text: string }> = {
  BATSMAN:      { bg: "#E6F1FB", text: "#185FA5" },
  BOWLER:       { bg: "#FCEBEB", text: "#A32D2D" },
  ALLROUNDER:   { bg: "#EEEDFE", text: "#534AB7" },
  WICKETKEEPER: { bg: "#FAEEDA", text: "#854F0B" },
}

function SpecPill({ spec }: { spec?: string }) {
  const s = (spec ?? "").toUpperCase()
  const normalized = s.includes("ALLROUND") ? "ALLROUNDER"
    : s.includes("WICKET") ? "WICKETKEEPER"
    : s.includes("BOWL") ? "BOWLER"
    : s.includes("BAT") ? "BATSMAN"
    : ""
  const c = SPEC_COLORS[normalized] ?? { bg: "#F1EFE8", text: "#5F5E5A" }
  const label = normalized === "WICKETKEEPER" ? "WK"
    : normalized === "ALLROUNDER" ? "AR"
    : normalized.slice(0, 3)
  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{ background: c.bg, color: c.text }}>
      {label || "?"}
    </span>
  )
}

function SquadRetentionPanel({ auctionId, squad }: { auctionId: string; squad: Squad }) {
  const queryClient = useQueryClient()

  const { data: retentions = [] } = useQuery({
    queryKey: ["midSeasonSquadRetentions", auctionId, squad.squadId],
    queryFn: () => midSeasonApi.getSquadRetentions(auctionId, squad.squadId),
    staleTime: 3000,
    refetchInterval: 5000,
  })

  const retainedPlayerIds = new Set(retentions.map((r) => r.playerId))
  const retentionCount = retentions.length
  const totalCostCr = RETENTION_CUMULATIVE_CR[retentionCount - 1] ?? 0
  const budgetLeft = 100 - totalCostCr

  const addMutation = useMutation({
    mutationFn: (playerId: string) => midSeasonApi.addRetention(auctionId, squad.squadId, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["midSeasonSquadRetentions", auctionId, squad.squadId] })
      queryClient.invalidateQueries({ queryKey: ["midSeason", auctionId] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (playerId: string) => midSeasonApi.removeRetention(auctionId, squad.squadId, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["midSeasonSquadRetentions", auctionId, squad.squadId] })
      queryClient.invalidateQueries({ queryKey: ["midSeason", auctionId] })
    },
  })

  const players: SquadPlayer[] = squad.players ?? []
  const nextCostCr = retentionCount < 4 ? RETENTION_COSTS_CR[retentionCount] : null

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      {/* Squad header */}
      <div className="bg-stone-50 border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-stone-800">{squad.name}</span>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-stone-500">
            Retained: <span className="font-bold text-stone-800">{retentionCount}/4</span>
          </span>
          <span className="text-amber-700 font-semibold">
            Cost: {totalCostCr} CR
          </span>
          <span className="text-emerald-700 font-semibold">
            Budget left: {budgetLeft} CR
          </span>
        </div>
      </div>

      {/* Retention slots indicator */}
      <div className="flex border-b border-stone-100">
        {[1, 2, 3, 4].map((slot) => {
          const filled = retentions.some((r) => r.retentionOrder === slot)
          return (
            <div key={slot}
                 className={`flex-1 px-3 py-2 text-center border-r border-stone-100 last:border-r-0 ${filled ? "bg-amber-50" : "bg-stone-50"}`}>
              <p className="text-[10px] text-stone-400">Slot {slot}</p>
              <p className="text-xs font-bold" style={{ color: filled ? "#D97706" : "#9CA3AF" }}>
                {RETENTION_COSTS_CR[slot - 1]} CR
              </p>
              {filled && <p className="text-[10px] text-amber-600">✓</p>}
            </div>
          )
        })}
      </div>

      {/* Player list */}
      <div className="divide-y divide-stone-100">
        {players.length === 0 && (
          <p className="p-4 text-sm text-stone-400 italic">No players in squad</p>
        )}
        {players.map((player) => {
          const isRetained = retainedPlayerIds.has(player.id)
          const retentionSlot = retentions.find((r) => r.playerId === player.id)
          const canAdd = !isRetained && retentionCount < 4
          const isPendingAdd = addMutation.isPending && addMutation.variables === player.id
          const isPendingRemove = removeMutation.isPending && removeMutation.variables === player.id

          return (
            <div key={player.id}
                 className={`flex items-center gap-3 px-4 py-3 transition-colors ${isRetained ? "bg-amber-50/60" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-stone-800 text-sm">{player.name}</span>
                  <SpecPill spec={player.specialism} />
                  {player.iplTeam && (
                    <span className="text-[10px] text-stone-400">{player.iplTeam}</span>
                  )}
                </div>
                {player.soldPrice != null && (
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Bought for: {fmtCr(player.soldPrice)}
                  </p>
                )}
              </div>

              {isRetained ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full">
                    Retained #{retentionSlot?.retentionOrder} · {fmtCr(retentionSlot?.retentionCost ?? 0)}
                  </span>
                  <button
                    onClick={() => removeMutation.mutate(player.id)}
                    disabled={isPendingRemove}
                    className="text-xs text-rose-500 hover:text-rose-700 font-medium disabled:opacity-50"
                  >
                    {isPendingRemove ? "…" : "Remove"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => addMutation.mutate(player.id)}
                  disabled={!canAdd || isPendingAdd}
                  className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                    ${canAdd ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-stone-100 text-stone-400"}`}
                  title={!canAdd && retentionCount >= 4 ? "Max 4 retentions reached" : canAdd ? `Retain for ${nextCostCr} CR` : ""}
                >
                  {isPendingAdd ? "…" : canAdd ? `Retain (+${nextCostCr} CR)` : "—"}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MidSeasonAdminPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId/mid-season/admin" })
  const queryClient = useQueryClient()

  const { data: squadsData, isLoading } = useQuery({
    queryKey: ["allSquads", auctionId],
    queryFn: () => squadApi.allSquads(auctionId),
    staleTime: 30000,
  })

  const { data: midSeasonStatus } = useQuery({
    queryKey: ["midSeason", auctionId],
    queryFn: () => midSeasonApi.getStatus(auctionId),
    staleTime: 5000,
  })

  const finalizeMutation = useMutation({
    mutationFn: () => midSeasonApi.finalize(auctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["midSeason", auctionId] })
    },
  })

  const squads: Squad[] = Array.isArray(squadsData) ? (squadsData as Squad[]) : []
  const phase = midSeasonStatus?.midSeasonPhase ?? "NOT_STARTED"

  if (phase !== "RETENTION_ENTRY") {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-4">
        <p className="text-stone-500">
          Retention entry is not active. Current phase: <strong>{phase}</strong>
        </p>
        <Link
          to="/auction/$auctionId/mid-season"
          params={{ auctionId }}
          className="inline-block text-sm text-indigo-600 hover:underline"
        >
          ← Back to Mid-Season Overview
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/auction/$auctionId/mid-season"
            params={{ auctionId }}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Mid-Season Overview
          </Link>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">Retention Entry</h1>
          <p className="text-sm text-stone-500">
            Select up to 4 players per squad to retain. Costs are deducted from the 100 CR budget.
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm("Lock all retentions and start the mid-season re-auction? This cannot be undone.")) {
              finalizeMutation.mutate()
            }
          }}
          disabled={finalizeMutation.isPending}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
        >
          {finalizeMutation.isPending ? "Finalizing…" : "Finalize & Start Re-Auction"}
        </button>
      </div>

      {/* Cost reference */}
      <div className="grid grid-cols-4 gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="text-center">
            <p className="text-xs text-stone-500">Retain {n} player{n > 1 ? "s" : ""}</p>
            <p className="text-base font-bold text-amber-700">{RETENTION_CUMULATIVE_CR[n - 1]} CR total</p>
            <p className="text-[10px] text-stone-400">(+{RETENTION_COSTS_CR[n - 1]} CR for this slot)</p>
          </div>
        ))}
      </div>

      {isLoading && <p className="text-sm text-stone-400">Loading squads…</p>}

      <div className="space-y-4">
        {squads.map((squad) => (
          <SquadRetentionPanel key={squad.squadId} auctionId={auctionId} squad={squad} />
        ))}
      </div>
    </div>
  )
}
