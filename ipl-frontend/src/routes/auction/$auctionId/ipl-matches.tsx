import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { auctionApi } from "@/lib/auctionApi"
import { authApi } from "@/lib/auth"
import { fantasyApi } from "@/lib/fantasyApi"
import { squadApi } from "@/lib/squadApi"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const Route = createFileRoute("/auction/$auctionId/ipl-matches")({
  component: IplMatchesPage,
})

function normalizeTeam(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function colorForIndex(idx: number, total: number) {
  const hue = Math.round((idx * 360) / Math.max(total, 1))
  return {
    bg: `hsl(${hue} 85% 96%)`,
    border: `hsl(${hue} 70% 82%)`,
    text: `hsl(${hue} 75% 32%)`,
  }
}

function IplMatchesPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId/ipl-matches" })
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedMatchId, setSelectedMatchId] = useState("")
  const [season, setSeason] = useState<"2026" | "2025">("2026")
  const [matchIdInput, setMatchIdInput] = useState("")
  const [adminSeasonInput, setAdminSeasonInput] = useState("2026")
  const [adminResult, setAdminResult] = useState("")
  const [showFeedMatches, setShowFeedMatches] = useState(false)

  const { data: auction } = useQuery({
    queryKey: ["auction", auctionId, "iplMatchesPage"],
    queryFn: () => auctionApi.getById(auctionId),
    staleTime: 10000,
  })
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: authApi.me, staleTime: 60000 })
  const isAdmin = me?.role === "ADMIN"
  const { data: allSquads } = useQuery({
    queryKey: ["allSquads", auctionId, "iplMatchesPage"],
    queryFn: () => squadApi.allSquads(auctionId),
    staleTime: 15000,
  })

  const matchesQuery = useQuery({
    queryKey: ["fantasyMatchList", season],
    queryFn: () => fantasyApi.matches(season),
    staleTime: 30000,
  })

  const matchDetails = useQuery({
    queryKey: ["fantasyMatchDetails", selectedMatchId],
    queryFn: () => fantasyApi.match(selectedMatchId),
    enabled: !!selectedMatchId,
    staleTime: 15000,
  })

  const feedMatches = useQuery({
    queryKey: ["adminFantasyIplMatches", "iplMatchesPage"],
    queryFn: fantasyApi.adminIplMatches,
    enabled: isAdmin && showFeedMatches,
    staleTime: 15000,
  })

  const syncNowMutation = useMutation({
    mutationFn: () => fantasyApi.adminSyncNow(matchIdInput.trim() || undefined),
    onSuccess: (r) => {
      setAdminResult(JSON.stringify(r, null, 2))
      queryClient.invalidateQueries({ queryKey: ["fantasyMatchList"] })
    },
    onError: (e: unknown) => setAdminResult(`sync-now failed: ${String((e as { message?: unknown })?.message ?? e)}`),
  })
  const syncPointsSheetMutation = useMutation({
    mutationFn: fantasyApi.adminSyncPointsSheet,
    onSuccess: (r) => setAdminResult(JSON.stringify(r, null, 2)),
    onError: (e: unknown) => setAdminResult(`sync-points-sheet failed: ${String((e as { message?: unknown })?.message ?? e)}`),
  })
  const rebuildMutation = useMutation({
    mutationFn: () => fantasyApi.adminRebuildAndSyncAll(adminSeasonInput.trim() || "2026"),
    onSuccess: (r) => setAdminResult(JSON.stringify(r, null, 2)),
    onError: (e: unknown) => setAdminResult(`rebuild-and-sync-all failed: ${String((e as { message?: unknown })?.message ?? e)}`),
  })

  const selectedMatch = matchDetails.data
  const teamA = selectedMatch?.teamA ?? "Team A"
  const teamB = selectedMatch?.teamB ?? "Team B"

  const grouped = useMemo(() => {
    const perf = selectedMatch?.performances ?? []
    const aNorm = normalizeTeam(teamA)
    const bNorm = normalizeTeam(teamB)
    const teamAPlayers = perf.filter((p) => normalizeTeam(p.iplTeam).includes(aNorm) || aNorm.includes(normalizeTeam(p.iplTeam)))
    const teamBPlayers = perf.filter((p) => normalizeTeam(p.iplTeam).includes(bNorm) || bNorm.includes(normalizeTeam(p.iplTeam)))
    const known = new Set([...teamAPlayers, ...teamBPlayers].map((p) => p.playerId))
    const unknown = perf.filter((p) => !known.has(p.playerId))
    if (unknown.length > 0) {
      unknown.sort((x, y) => y.fantasyPoints - x.fantasyPoints).forEach((p, i) => {
        if (i % 2 === 0) teamAPlayers.push(p)
        else teamBPlayers.push(p)
      })
    }
    teamAPlayers.sort((x, y) => y.fantasyPoints - x.fantasyPoints)
    teamBPlayers.sort((x, y) => y.fantasyPoints - x.fantasyPoints)
    return { teamAPlayers, teamBPlayers }
  }, [selectedMatch, teamA, teamB])

  const playerToSquad = useMemo(() => {
    const rows = (allSquads ?? []) as Array<{ name: string; players?: Array<{ id: string }> }>
    const map: Record<string, string> = {}
    rows.forEach((s) => {
      ;(s.players ?? []).forEach((p) => {
        map[p.id] = s.name
      })
    })
    return map
  }, [allSquads])

  const squadPointsRows = useMemo(() => {
    const perf = selectedMatch?.performances ?? []
    const bySquad: Record<string, number> = {}
    perf.forEach((p) => {
      const squad = playerToSquad[p.playerId]
      if (!squad) return
      bySquad[squad] = (bySquad[squad] ?? 0) + p.fantasyPoints
    })
    return Object.entries(bySquad)
      .map(([squadName, points]) => ({ squadName, points }))
      .sort((a, b) => b.points - a.points)
  }, [selectedMatch, playerToSquad])
  const squadColorByName = useMemo(() => {
    const sortedNames = [...new Set(squadPointsRows.map((r) => r.squadName))].sort((a, b) => a.localeCompare(b))
    return Object.fromEntries(
      sortedNames.map((name, idx) => [name, colorForIndex(idx, sortedNames.length)])
    ) as Record<string, { bg: string; border: string; text: string }>
  }, [squadPointsRows])

  if (auction && auction.status !== "COMPLETED") {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <div className="rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <p className="text-lg font-black text-stone-800">IPL Matches page unlocks after auction completion.</p>
          <p className="text-sm text-stone-500 mt-1">Complete the auction first, then open this page.</p>
          <Button className="mt-4" onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId } })}>Back to Auction</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-100" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="max-w-[1550px] mx-auto px-4 md:px-6 py-5 md:py-7">
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4 md:px-6 md:py-5 shadow-sm mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-stone-500 font-semibold">IPL Match Center</p>
            <h1 className="text-xl md:text-2xl font-black text-stone-800">{auction?.name ?? "IPL Matches"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={season === "2026" ? "default" : "outline"}
              className={season === "2026" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              onClick={() => { setSeason("2026"); setSelectedMatchId("") }}
            >
              IPL 2026
            </Button>
            <Button
              variant={season === "2025" ? "default" : "outline"}
              className={season === "2025" ? "bg-slate-700 hover:bg-slate-800" : ""}
              onClick={() => { setSeason("2025"); setSelectedMatchId("") }}
            >
              IPL 2025
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId } })}>Back to Auction</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate({ to: "/auction/$auctionId/trade", params: { auctionId } })}>Trade Center</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => navigate({ to: "/auction/$auctionId/fantasy", params: { auctionId } })}>Open Fantasy</Button>
          </div>
        </div>

        {isAdmin && (
          <div className="rounded-2xl border border-stone-200 p-4 bg-white shadow-sm mb-4 space-y-3">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Fantasy Admin Sync Controls</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowFeedMatches((v) => !v)}>{showFeedMatches ? "Hide" : "Load"} IPL matches</Button>
              <Input value={matchIdInput} onChange={(e) => setMatchIdInput(e.target.value)} placeholder="matchId (optional, e.g. 2419)" style={{ maxWidth: 240 }} />
              <Button onClick={() => syncNowMutation.mutate()} disabled={syncNowMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">{syncNowMutation.isPending ? "Running..." : "sync-now"}</Button>
              <Button onClick={() => syncPointsSheetMutation.mutate()} disabled={syncPointsSheetMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">{syncPointsSheetMutation.isPending ? "Running..." : "sync-points-sheet"}</Button>
              <Input value={adminSeasonInput} onChange={(e) => setAdminSeasonInput(e.target.value)} placeholder="season" style={{ width: 120 }} />
              <Button onClick={() => rebuildMutation.mutate()} disabled={rebuildMutation.isPending} className="bg-amber-600 hover:bg-amber-700">{rebuildMutation.isPending ? "Running..." : "rebuild-and-sync-all"}</Button>
            </div>
            {showFeedMatches && (
              <div style={{ fontSize: 12, color: "#57534e", border: "1px solid #e5dfd4", borderRadius: 10, padding: 10, background: "#fafaf9" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>IPL feed matches: {feedMatches.data?.count ?? 0}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(feedMatches.data?.matches ?? []).slice(0, 25).map((m) => (
                    <button
                      key={String(m.id)}
                      onClick={() => setMatchIdInput(String(m.id))}
                      style={{ border: "1px solid #d6cfc4", background: "#fff", borderRadius: 999, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}
                    >
                      {String(m.id)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {adminResult && (
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, border: "1px solid #e5dfd4", borderRadius: 10, padding: 10, background: "#f8fafc" }}>
                {adminResult}
              </pre>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
          <section className="rounded-2xl border border-stone-200 p-3 bg-white shadow-sm max-h-[76vh] overflow-y-auto">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider px-2 pb-2">Match List · IPL {season}</p>
            <div className="space-y-2">
              {(matchesQuery.data ?? []).map((m) => (
                <button
                  key={m.matchId}
                  onClick={() => setSelectedMatchId((prev) => (prev === m.matchId ? "" : m.matchId))}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition ${selectedMatchId === m.matchId ? "border-indigo-500 bg-indigo-50" : "border-stone-200 bg-stone-50 hover:bg-stone-100"}`}
                >
                  <p className="text-xs text-stone-500">M{m.matchNo}</p>
                  <p className="text-sm font-semibold text-stone-800">{m.matchLabel}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 p-4 bg-white shadow-sm min-h-[450px]">
            {!selectedMatch ? (
              <div className="h-full flex items-center justify-center text-stone-500 text-sm">Select a match to view team-vs-team and player points.</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-xl border border-stone-200 bg-white p-3">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Squad points in this match</p>
                  {squadPointsRows.length === 0 ? (
                    <p className="text-sm text-stone-500">No squad-linked points yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                      {squadPointsRows.map((r) => (
                        <div
                          key={r.squadName}
                          className="rounded-lg border px-3 py-2.5 flex items-center justify-between"
                          style={{
                            background: squadColorByName[r.squadName]?.bg ?? "#fafaf9",
                            borderColor: squadColorByName[r.squadName]?.border ?? "#e7e5e4",
                          }}
                        >
                          <span className="text-sm font-semibold" style={{ color: squadColorByName[r.squadName]?.text ?? "#292524" }}>{r.squadName}</span>
                          <span className="text-sm font-black" style={{ color: squadColorByName[r.squadName]?.text ?? "#059669" }}>
                            {r.points >= 0 ? `+${r.points}` : r.points}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-stone-200">
                    <p className="px-3 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-200">Players</p>
                    <div className="max-h-[46vh] overflow-y-auto">
                      {grouped.teamAPlayers.map((p) => (
                        <div key={p.playerId} className="px-3 py-2 border-b last:border-b-0 border-stone-100 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-stone-800">{p.playerName}</p>
                            <p className="text-[11px] text-stone-500">
                              {playerToSquad[p.playerId] ? `${playerToSquad[p.playerId]} · ` : ""}{p.runs}r · {p.wickets}w · {(p.dotBalls ?? 0)}db
                            </p>
                          </div>
                          <p className="text-sm font-black text-emerald-700">{p.fantasyPoints >= 0 ? `+${p.fantasyPoints}` : p.fantasyPoints}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border border-stone-200">
                    <p className="px-3 py-2 text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-200">Players</p>
                    <div className="max-h-[46vh] overflow-y-auto">
                      {grouped.teamBPlayers.map((p) => (
                        <div key={p.playerId} className="px-3 py-2 border-b last:border-b-0 border-stone-100 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-stone-800">{p.playerName}</p>
                            <p className="text-[11px] text-stone-500">
                              {playerToSquad[p.playerId] ? `${playerToSquad[p.playerId]} · ` : ""}{p.runs}r · {p.wickets}w · {(p.dotBalls ?? 0)}db
                            </p>
                          </div>
                          <p className="text-sm font-black text-indigo-700">{p.fantasyPoints >= 0 ? `+${p.fantasyPoints}` : p.fantasyPoints}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
