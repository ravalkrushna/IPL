import { createFileRoute, useParams, Link } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { midSeasonApi, RETENTION_CUMULATIVE_CR, type MidSeasonStatus } from "@/lib/midSeasonApi"
import { auctionApi } from "@/lib/auctionApi"
import { fantasyApi, type FantasySquadPlayerEntry } from "@/lib/fantasyApi"

export const Route = createFileRoute("/auction/$auctionId/mid-season/")({
  component: MidSeasonOverviewPage,
})

const CR = 10_000_000

function fmtCr(raw: number) {
  return `${(raw / CR).toFixed(0)} CR`
}

function PhaseTag({ phase }: { phase: MidSeasonStatus["midSeasonPhase"] }) {
  const map: Record<string, { label: string; color: string }> = {
    NOT_STARTED:     { label: "Not Started",      color: "#6B7280" },
    RETENTION_ENTRY: { label: "Retention Entry",  color: "#D97706" },
    LIVE:            { label: "Live Re-Auction",   color: "#16A34A" },
    COMPLETED:       { label: "Completed",         color: "#2563EB" },
  }
  const { label, color } = map[phase] ?? { label: phase, color: "#6B7280" }
  return (
    <span style={{ background: color + "22", color, border: `1px solid ${color}44` }}
          className="text-xs font-semibold px-2 py-0.5 rounded-full">
      {label}
    </span>
  )
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

function SquadPlayerRows({ squadId }: { squadId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasySquad", squadId],
    queryFn: () => fantasyApi.squad(squadId),
    staleTime: 60000,
  })

  if (isLoading) return <p className="px-4 py-3 text-xs text-stone-400">Loading players…</p>
  if (!data?.players?.length) return <p className="px-4 py-3 text-xs text-stone-400 italic">No players</p>

  const sorted = [...data.players].sort((a: FantasySquadPlayerEntry, b: FantasySquadPlayerEntry) => b.totalPoints - a.totalPoints)
  return (
    <div className="divide-y divide-stone-100">
      {sorted.map((p: FantasySquadPlayerEntry) => (
        <div key={p.playerId} className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm text-stone-800 font-medium truncate">{p.playerName}</span>
            <SpecPill spec={p.specialism} />
            {p.iplTeam && <span className="text-[10px] text-stone-400">{p.iplTeam}</span>}
          </div>
          <span className={`text-sm font-bold tabular-nums ${p.totalPoints > 0 ? "text-indigo-600" : "text-stone-400"}`}>
            {p.totalPoints} pts
          </span>
        </div>
      ))}
    </div>
  )
}

function SquadStandingsSection({ auctionId }: { auctionId: string }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["fantasyLeaderboard", auctionId],
    queryFn: () => fantasyApi.leaderboard(auctionId),
    staleTime: 30000,
  })

  if (isLoading) return <p className="text-sm text-stone-400">Loading squad standings…</p>

  const entries = leaderboard?.entries ?? []
  if (entries.length === 0) return null

  return (
    <div>
      <h2 className="text-base font-semibold text-stone-700 mb-3">
        Current Squad Standings
      </h2>
      <div className="space-y-2">
        {entries.map((entry) => {
          const isOpen = expanded === entry.squadId
          return (
            <div key={entry.squadId} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : entry.squadId)}
              >
                <span className="w-6 h-6 flex items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-500 shrink-0">
                  {entry.rank}
                </span>
                <span className="flex-1 font-semibold text-stone-800">{entry.squadName}</span>
                <span className="text-base font-bold text-indigo-600 tabular-nums">
                  {entry.totalPoints} pts
                </span>
                <span className="text-stone-400 text-xs ml-1">{isOpen ? "▲" : "▼"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-stone-100">
                  <SquadPlayerRows squadId={entry.squadId} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MidSeasonOverviewPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId/mid-season/" })
  const queryClient = useQueryClient()

  const { data: auction } = useQuery({
    queryKey: ["auction", auctionId],
    queryFn: () => auctionApi.getById(auctionId),
    staleTime: 10000,
  })

  const { data: status, isLoading } = useQuery({
    queryKey: ["midSeason", auctionId],
    queryFn: () => midSeasonApi.getStatus(auctionId),
    staleTime: 5000,
    refetchInterval: 8000,
  })

  const startMutation = useMutation({
    mutationFn: () => midSeasonApi.startRetentionPhase(auctionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["midSeason", auctionId] }),
  })

  const finalizeMutation = useMutation({
    mutationFn: () => midSeasonApi.finalize(auctionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["midSeason", auctionId] })
      queryClient.invalidateQueries({ queryKey: ["auction", auctionId] })
    },
  })

  if (isLoading) return <div className="p-6 text-sm text-stone-400">Loading…</div>

  const phase = status?.midSeasonPhase ?? "NOT_STARTED"
  const canStart = auction?.status === "COMPLETED" && phase === "NOT_STARTED"
  const canFinalize = phase === "RETENTION_ENTRY"
  const isLive = phase === "LIVE"

  return (
    <div className="w-full p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/auction/$auctionId"
            params={{ auctionId }}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Back to Auction
          </Link>
          <h1 className="text-2xl font-bold text-stone-900 mt-1">Mid-Season Auction</h1>
          <p className="text-sm text-stone-500 mt-1">
            Each squad retains up to 4 players. Budget resets to 100 CR. Pre-reauction points are locked.
          </p>
        </div>
        {status && <PhaseTag phase={status.midSeasonPhase} />}
      </div>

      {/* Retention cost guide */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-3">Retention Cost Table</p>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="text-center bg-white rounded-lg p-2 border border-amber-100">
              <p className="text-xs text-stone-400">Retain {n}</p>
              <p className="text-lg font-bold text-amber-700">{RETENTION_CUMULATIVE_CR[n - 1]} CR</p>
              <p className="text-[10px] text-stone-400">total deducted</p>
            </div>
          ))}
        </div>
      </div>

      {/* Squad standings — visible before retention phase starts */}
      {phase === "NOT_STARTED" && <SquadStandingsSection auctionId={auctionId} />}

      {/* Admin actions */}
      {canStart && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-stone-800">Start Mid-Season Retention Phase</p>
            <p className="text-sm text-stone-500">Opens the retention entry form for all squads.</p>
          </div>
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {startMutation.isPending ? "Starting…" : "Start"}
          </button>
        </div>
      )}

      {phase === "RETENTION_ENTRY" && (
        <div className="flex gap-3">
          <Link
            to="/auction/$auctionId/mid-season/admin"
            params={{ auctionId }}
            className="flex-1 text-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg"
          >
            Manage Retentions (Admin)
          </Link>
          <button
            onClick={() => {
              if (confirm("Finalize retentions and start the re-auction? This cannot be undone.")) {
                finalizeMutation.mutate()
              }
            }}
            disabled={finalizeMutation.isPending}
            className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {finalizeMutation.isPending ? "Finalizing…" : "Finalize & Start Re-Auction"}
          </button>
        </div>
      )}

      {isLive && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">🏏</span>
          <div>
            <p className="font-semibold text-emerald-800">Mid-Season Re-Auction is Live!</p>
            <p className="text-sm text-emerald-600">Go to the auction room to continue bidding.</p>
          </div>
          <Link
            to="/auction/$auctionId"
            params={{ auctionId }}
            className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg"
          >
            Go to Auction Room
          </Link>
        </div>
      )}

      {/* Squad retention summary — only shown after retention phase has started */}
      {phase !== "NOT_STARTED" && status && status.squads.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-stone-700 mb-3">Squad Retentions</h2>
          <div className="space-y-3">
            {status.squads.map((squad) => {
              const totalCost = squad.retentions.reduce((sum, r) => sum + r.retentionCost, 0)
              const budgetLeft = 1_000_000_000 - totalCost
              return (
                <div key={squad.squadId} className="bg-white border border-stone-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-stone-800">{squad.squadName}</span>
                    <div className="flex items-center gap-3 text-sm">
                      {squad.lockedPoints != null && (
                        <span className="text-indigo-600 font-medium">
                          {squad.lockedPoints} pts locked
                        </span>
                      )}
                      <span className="text-stone-500">
                        Cost: <span className="font-semibold text-amber-700">{fmtCr(totalCost)}</span>
                      </span>
                      <span className="text-stone-500">
                        Budget left: <span className="font-semibold text-emerald-700">{fmtCr(budgetLeft)}</span>
                      </span>
                    </div>
                  </div>
                  {squad.retentions.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">No retentions — full squad released</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {squad.retentions.map((r, i) => (
                        <span key={r.id}
                              className="text-xs px-2 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full">
                          #{i + 1} · {r.playerName || r.playerId.slice(0, 8)} · {fmtCr(r.retentionCost)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
