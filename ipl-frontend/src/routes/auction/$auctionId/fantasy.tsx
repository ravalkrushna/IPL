/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { auctionApi } from "@/lib/auctionApi"
import { fantasyApi, FantasySquadPlayerEntry, FantasyPlayerMatchEntry } from "@/lib/fantasyApi"

export const Route = createFileRoute("/auction/$auctionId/fantasy")({
  component: FantasyPage,
})

// ─── HELPERS ─────────────────────────────────────────────────────────────

function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`
  return `₹${amount.toLocaleString()}`
}

function normaliseSpecialism(raw?: string): string {
  const s = (raw ?? "").toUpperCase().replace(/[\s_-]/g, "")
  if (s.includes("ALLROUND") || s === "AR") return "ALLROUNDER"
  if (s.includes("WICKET") || s === "WK") return "WICKETKEEPER"
  if (s.includes("BOWL") || s === "BWL") return "BOWLER"
  if (s.includes("BAT")) return "BATSMAN"
  return "UNKNOWN"
}

const SPEC_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  BATSMAN:     { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", accent: "#3b82f6" },
  BOWLER:      { bg: "#fff1f2", text: "#be123c", border: "#fecdd3", accent: "#f43f5e" },
  ALLROUNDER:  { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe", accent: "#8b5cf6" },
  WICKETKEEPER:{ bg: "#fffbeb", text: "#92400e", border: "#fde68a", accent: "#f59e0b" },
  UNKNOWN:     { bg: "#f8fafc", text: "#475569", border: "#e2e8f0", accent: "#94a3b8" },
}

const TEAM_COLORS = [
  "#6366f1","#10b981","#f59e0b","#ef4444",
  "#8b5cf6","#06b6d4","#f97316","#ec4899",
  "#14b8a6","#84cc16",
]

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

  .fp-root { height: 100vh; display: flex; flex-direction: column; background: #0c0a09; color: #f5f5f4; font-family: 'Sora', system-ui, sans-serif; overflow: hidden; }
  .fp-header { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 24px; height: 56px; background: rgba(12,10,9,0.95); border-bottom: 1px solid #292524; backdrop-filter: blur(12px); gap: 12px; }
  .fp-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .fp-icon { width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, #16a34a, #4ade80); display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .fp-title { font-size: 15px; font-weight: 800; color: #f5f5f4; letter-spacing: -0.3px; }
  .fp-subtitle { font-size: 11px; color: #78716c; font-weight: 500; }
  .fp-badge { display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 99px; background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.25); font-size: 10px; font-weight: 700; color: #4ade80; letter-spacing: 0.5px; flex-shrink: 0; }
  .fp-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: #4ade80; animation: fpPulse 2s infinite; }
  @keyframes fpPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
  .fp-back-btn { display: flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 8px; border: 1px solid #292524; background: #1c1917; color: #a8a29e; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: 'Sora', sans-serif; white-space: nowrap; flex-shrink: 0; }
  .fp-back-btn:hover { border-color: #44403c; color: #d6d3d1; background: #292524; }

  .fp-body { flex: 1; display: flex; min-height: 0; overflow: hidden; }

  /* ── LEFT: leaderboard ── */
  .fp-left { width: 380px; flex-shrink: 0; border-right: 1px solid #1c1917; display: flex; flex-direction: column; overflow: hidden; }
  .fp-left-header { padding: 16px 20px 12px; border-bottom: 1px solid #1c1917; flex-shrink: 0; }
  .fp-section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #57534e; margin-bottom: 4px; }
  .fp-left-title { font-size: 18px; font-weight: 900; color: #f5f5f4; letter-spacing: -0.5px; }
  .fp-left-list { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 6px; }
  .fp-left-list::-webkit-scrollbar { width: 4px; }
  .fp-left-list::-webkit-scrollbar-thumb { background: #292524; border-radius: 99px; }

  /* ── Leaderboard entry ── */
  .fp-entry { border-radius: 14px; border: 1px solid #1c1917; background: #161412; cursor: pointer; transition: all 0.15s; overflow: hidden; position: relative; }
  .fp-entry:hover { border-color: #292524; background: #1c1917; }
  .fp-entry.active { border-color: #4ade80; background: #0a1a0f; box-shadow: 0 0 0 1px rgba(74,222,128,0.15); }
  .fp-entry-bar { height: 2px; width: 100%; }
  .fp-entry-main { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
  .fp-rank { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #57534e; width: 20px; text-align: center; flex-shrink: 0; }
  .fp-rank.r1 { color: #fbbf24; font-size: 14px; }
  .fp-rank.r2 { color: #94a3b8; font-size: 13px; }
  .fp-rank.r3 { color: #b45309; font-size: 12px; }
  .fp-entry-info { flex: 1; min-width: 0; }
  .fp-entry-squad { font-size: 13px; font-weight: 700; color: #f5f5f4; truncate: true; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fp-entry-participant { font-size: 10px; color: #78716c; font-weight: 500; margin-top: 1px; }
  .fp-entry-pts { text-align: right; flex-shrink: 0; }
  .fp-pts-val { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; color: #4ade80; line-height: 1; }
  .fp-pts-label { font-size: 9px; color: #57534e; font-weight: 600; letter-spacing: 0.5px; margin-top: 2px; }
  .fp-entry-matches { font-size: 10px; color: #57534e; padding: 0 14px 10px; }

  /* ── RIGHT: detail panel ── */
  .fp-right { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  .fp-right-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; }
  .fp-right-empty-icon { font-size: 48px; opacity: 0.15; }
  .fp-right-empty-text { font-size: 13px; color: #57534e; font-weight: 500; }

  /* ── Squad detail ── */
  .fp-squad-header { padding: 20px 24px 16px; border-bottom: 1px solid #1c1917; flex-shrink: 0; }
  .fp-squad-name { font-size: 22px; font-weight: 900; color: #f5f5f4; letter-spacing: -0.5px; }
  .fp-squad-meta { display: flex; align-items: center; gap: 16px; margin-top: 8px; }
  .fp-squad-stat { display: flex; flex-direction: column; gap: 1px; }
  .fp-squad-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; color: #4ade80; line-height: 1; }
  .fp-squad-stat-lbl { font-size: 9px; color: #57534e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .fp-divider { width: 1px; height: 28px; background: #1c1917; }

  .fp-player-list { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
  .fp-player-list::-webkit-scrollbar { width: 4px; }
  .fp-player-list::-webkit-scrollbar-thumb { background: #292524; border-radius: 99px; }

  /* ── Player card ── */
  .fp-player-card { border-radius: 12px; border: 1px solid #1c1917; background: #161412; cursor: pointer; transition: all 0.15s; overflow: hidden; }
  .fp-player-card:hover { border-color: #292524; background: #1c1917; }
  .fp-player-card.active { border-color: #4ade80; background: #0a1a0f; }
  .fp-player-main { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
  .fp-player-spec { font-size: 8px; font-weight: 800; padding: 3px 7px; border-radius: 99px; letter-spacing: 0.4px; flex-shrink: 0; }
  .fp-player-info { flex: 1; min-width: 0; }
  .fp-player-name { font-size: 13px; font-weight: 700; color: #f5f5f4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fp-player-team { font-size: 10px; color: #78716c; font-weight: 500; margin-top: 1px; }
  .fp-player-right { text-align: right; flex-shrink: 0; }
  .fp-player-pts { font-family: 'JetBrains Mono', monospace; font-size: 16px; font-weight: 700; color: #4ade80; line-height: 1; }
  .fp-player-price { font-size: 10px; color: #78716c; margin-top: 2px; }

  /* ── Match breakdown (expanded player) ── */
  .fp-matches { border-top: 1px solid #1c1917; padding: 8px 14px 12px; display: flex; flex-direction: column; gap: 4px; }
  .fp-match-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; background: #0c0a09; }
  .fp-match-no { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #57534e; width: 28px; flex-shrink: 0; }
  .fp-match-teams { font-size: 10px; font-weight: 600; color: #a8a29e; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fp-match-stats { display: flex; gap: 8px; font-size: 9px; color: #57534e; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
  .fp-match-pts { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 700; color: #4ade80; flex-shrink: 0; width: 36px; text-align: right; }

  /* ── Loading ── */
  .fp-loading { flex: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; }
  .fp-loading-icon { font-size: 36px; animation: fpSpin 2s linear infinite; }
  @keyframes fpSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .fp-loading-text { font-size: 12px; color: #57534e; }

  /* ── Mobile ── */
  .fp-mob-bar { display: none; }
  @media (max-width: 640px) {
    .fp-root { height: auto; min-height: 100vh; overflow-y: auto; }
    .fp-header { padding: 0 14px; height: 50px; }
    .fp-subtitle { display: none; }
    .fp-body { flex-direction: column; overflow: visible; }
    .fp-left { width: 100%; border-right: none; border-bottom: 1px solid #1c1917; overflow: visible; max-height: none; }
    .fp-left-list { overflow: visible; }
    .fp-right { overflow: visible; }
    .fp-player-list { overflow: visible; }
  }
  @media (min-width: 641px) and (max-width: 960px) {
    .fp-left { width: 300px; }
  }
`

// ─── SPEC BADGE ──────────────────────────────────────────────────────────

function SpecBadge({ specialism }: { specialism: string }) {
  const sp = normaliseSpecialism(specialism)
  const c = SPEC_COLORS[sp] ?? SPEC_COLORS.UNKNOWN
  const label = sp === "WICKETKEEPER" ? "WK" : sp === "ALLROUNDER" ? "AR" : sp === "BOWLER" ? "BWL" : sp === "BATSMAN" ? "BAT" : "—"
  return (
    <span className="fp-player-spec" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
      {label}
    </span>
  )
}

// ─── PLAYER DETAIL (expanded inside squad) ───────────────────────────────

function PlayerMatchBreakdown({ playerId }: { playerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasyPlayer", playerId],
    queryFn: () => fantasyApi.player(playerId),
    staleTime: 30000,
  })

  if (isLoading) return (
    <div className="fp-matches">
      <p className="text-[10px] text-stone-600 italic">Loading matches…</p>
    </div>
  )

  const renderMatches = (matches: FantasyPlayerMatchEntry[], label: string) => (
    <div className="fp-matches">
      <div style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "#57534e",
        marginBottom: 6,
        paddingBottom: 4,
        borderBottom: "1px solid #1c1917"
      }}>
        {label}
      </div>
      {matches.length === 0 ? (
        <p className="text-[10px] text-stone-600 italic">No matches played yet</p>
      ) : (
        matches.map((m: FantasyPlayerMatchEntry) => (
          <div key={m.matchId} className="fp-match-row">
            <span className="fp-match-no">M{m.matchNo}</span>
            <span className="fp-match-teams">{m.teamA} vs {m.teamB}</span>
            <div className="fp-match-stats">
              {m.runs > 0 && <span>{m.runs}r</span>}
              {m.wickets > 0 && <span>{m.wickets}w</span>}
              {m.catches > 0 && <span>{m.catches}ct</span>}
              {m.stumpings > 0 && <span>{m.stumpings}st</span>}
            </div>
            <span className="fp-match-pts">
              {m.fantasyPoints > 0 ? `+${m.fantasyPoints}` : m.fantasyPoints}
            </span>
          </div>
        ))
      )}
    </div>
  )

  return (
    <>
      {renderMatches(data?.matches2026 ?? [], "IPL 2026")}
      {renderMatches(data?.matches2025 ?? [], "IPL 2025")}
    </>
  )
}

// ─── SQUAD DETAIL PANEL ──────────────────────────────────────────────────

function SquadDetailPanel({
  squadId,
  squadName,
  totalPoints,
  matchesPlayed,
  activePlayerId,
  onPlayerClick,
  color,
}: {
  squadId: string
  squadName: string
  totalPoints: number
  matchesPlayed: number
  activePlayerId: string | null
  onPlayerClick: (id: string) => void
  color: string
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasySquad", squadId],
    queryFn: () => fantasyApi.squad(squadId),
    staleTime: 30000,
  })

  return (
    <>
      <div className="fp-squad-header">
        <div className="fp-section-label">Squad Detail</div>
        <div className="fp-squad-name">{squadName}</div>
        <div className="fp-squad-meta">
          <div className="fp-squad-stat">
            <div className="fp-squad-stat-val" style={{ color }}>{totalPoints}</div>
            <div className="fp-squad-stat-lbl">Total pts</div>
          </div>
          <div className="fp-divider" />
          <div className="fp-squad-stat">
            <div className="fp-squad-stat-val" style={{ color }}>{matchesPlayed}</div>
            <div className="fp-squad-stat-lbl">Matches</div>
          </div>
          <div className="fp-divider" />
          <div className="fp-squad-stat">
            <div className="fp-squad-stat-val" style={{ color }}>{data?.players.length ?? "—"}</div>
            <div className="fp-squad-stat-lbl">Players</div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="fp-loading">
          <div className="fp-loading-icon">⚡</div>
          <div className="fp-loading-text">Loading squad…</div>
        </div>
      ) : (
        <div className="fp-player-list">
          {(data?.players ?? []).map((p: FantasySquadPlayerEntry, i: number) => {
            const isActive = activePlayerId === p.playerId
            const barColor = TEAM_COLORS[i % TEAM_COLORS.length]
            return (
              <div
                key={p.playerId}
                className={`fp-player-card ${isActive ? "active" : ""}`}
                onClick={() => onPlayerClick(isActive ? "" : p.playerId)}
              >
                <div className="fp-player-main">
                  <SpecBadge specialism={p.specialism} />
                  <div className="fp-player-info">
                    <div className="fp-player-name">{p.playerName}</div>
                    <div className="fp-player-team">{p.iplTeam || "—"}</div>
                  </div>
                  <div className="fp-player-right">
                    <div className="fp-player-pts" style={{ color: barColor }}>{p.totalPoints}</div>
                    <div className="fp-player-price">{fmt(Number(p.soldPrice))}</div>
                  </div>
                </div>
                {isActive && <PlayerMatchBreakdown playerId={p.playerId} />}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────

function FantasyPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId/fantasy" })
  const navigate = useNavigate()

  // Zustand-free: use query-derived active IDs stored in URL search or just
  // use TanStack query's select pattern. Since project bans useState,
  // we encode selected squadId + playerId in the route search params.
  // But to keep it simple and consistent with the codebase pattern,
  // we use a ref-like approach via useQuery's select.
  // Actually: the project uses Zustand for UI state. We'll use a minimal
  // approach: store active selection in a module-level reactive variable
  // via Zustand's createStore pattern — but since we don't have a store here
  // yet, we'll use the existing auctionRoomStore pattern and add to it.
  // Simplest compliant approach: encode in URL search params via TanStack Router.

  // Active selections stored as search params
  const { activeSquadId, activePlayerId } = Route.useSearch() as { activeSquadId?: string; activePlayerId?: string }

  const { data: auction } = useQuery({
    queryKey: ["auction", auctionId],
    queryFn: () => auctionApi.getById(auctionId),
    staleTime: 60000,
  })

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["fantasyLeaderboard", auctionId],
    queryFn: () => fantasyApi.leaderboard(auctionId),
    refetchInterval: 60000,
    staleTime: 30000,
  })

  const setActive = (squadId: string, playerId?: string) => {
    navigate({
      to: "/auction/$auctionId/fantasy",
      params: { auctionId },
      search: { activeSquadId: squadId, activePlayerId: playerId ?? "" },
      replace: true,
    })
  }

  const activeEntry = leaderboard?.entries.find(e => e.squadId === activeSquadId)
  const activeColor = activeEntry
    ? TEAM_COLORS[leaderboard!.entries.indexOf(activeEntry) % TEAM_COLORS.length]
    : "#4ade80"

  return (
    <>
      <style>{css}</style>
      <div className="fp-root">

        {/* ── HEADER ── */}
        <header className="fp-header">
          <div className="fp-header-left">
            <div className="fp-icon">🏆</div>
            <div>
              <div className="fp-title">Fantasy Leaderboard</div>
              <div className="fp-subtitle">{auction?.name ?? "Loading…"}</div>
            </div>
            <div className="fp-badge">
              <span className="fp-badge-dot" />
              IPL 2025
            </div>
          </div>
          <button className="fp-back-btn" onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId } })}>
            ← Auction Room
          </button>
        </header>

        {/* ── BODY ── */}
        <div className="fp-body">

          {/* ── LEFT: Leaderboard ── */}
          <div className="fp-left">
            <div className="fp-left-header">
              <div className="fp-section-label">Rankings</div>
              <div className="fp-left-title">
                {leaderboard?.entries.length ?? 0} Squads
              </div>
            </div>

            {isLoading ? (
              <div className="fp-loading">
                <div className="fp-loading-icon">🏆</div>
                <div className="fp-loading-text">Loading leaderboard…</div>
              </div>
            ) : leaderboard?.entries.length === 0 ? (
              <div className="fp-right-empty" style={{ flex: 1 }}>
                <div className="fp-right-empty-icon">🏏</div>
                <div className="fp-right-empty-text">No fantasy data yet</div>
              </div>
            ) : (
              <div className="fp-left-list">
                {leaderboard!.entries.map((entry, i) => {
                  const color = TEAM_COLORS[i % TEAM_COLORS.length]
                  const isActive = activeSquadId === entry.squadId
                  const rankClass = i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : ""
                  const rankEmoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${entry.rank}`
                  return (
                    <div
                      key={entry.squadId}
                      className={`fp-entry ${isActive ? "active" : ""}`}
                      onClick={() => setActive(isActive ? "" : entry.squadId)}
                    >
                      <div className="fp-entry-bar" style={{ background: isActive ? color : "#1c1917" }} />
                      <div className="fp-entry-main">
                        <span className={`fp-rank ${rankClass}`}>{rankEmoji}</span>
                        <div className="fp-entry-info">
                          <div className="fp-entry-squad">{entry.squadName}</div>
                          <div className="fp-entry-participant">{entry.participantName}</div>
                        </div>
                        <div className="fp-entry-pts">
                          <div className="fp-pts-val" style={{ color }}>{entry.totalPoints}</div>
                          <div className="fp-pts-label">PTS</div>
                        </div>
                      </div>
                      <div className="fp-entry-matches">{entry.matchesPlayed} matches played</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── RIGHT: Squad detail ── */}
          <div className="fp-right">
            {!activeSquadId || !activeEntry ? (
              <div className="fp-right-empty">
                <div className="fp-right-empty-icon">👈</div>
                <div className="fp-right-empty-text">Select a squad to see player breakdown</div>
              </div>
            ) : (
              <SquadDetailPanel
                squadId={activeEntry.squadId}
                squadName={activeEntry.squadName}
                totalPoints={activeEntry.totalPoints}
                matchesPlayed={activeEntry.matchesPlayed}
                activePlayerId={activePlayerId ?? null}
                onPlayerClick={(pid) => setActive(activeSquadId, pid)}
                color={activeColor}
              />
            )}
          </div>
        </div>
      </div>
    </>
  )
}