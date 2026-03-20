/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useRef, useEffect } from "react"
import { fantasyApi, FantasySquadPlayerEntry, FantasyPlayerMatchEntry } from "@/lib/fantasyApi"

export const Route = createFileRoute("/auction/$auctionId/fantasy/$squadId")({
  component: FantasySquadPage,
})

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

const SPEC_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  BATSMAN:      { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  BOWLER:       { bg: "#fff1f2", text: "#be123c", border: "#fecdd3" },
  ALLROUNDER:   { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  WICKETKEEPER: { bg: "#fffbeb", text: "#92400e", border: "#fde68a" },
  UNKNOWN:      { bg: "#f8fafc", text: "#475569", border: "#e2e8f0" },
}

const TEAM_COLORS = [
  "#6366f1","#10b981","#f59e0b","#ef4444",
  "#8b5cf6","#06b6d4","#f97316","#ec4899",
  "#14b8a6","#84cc16",
]

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
  * { box-sizing: border-box; }

  .sd-root {
    height: 100vh; display: flex; flex-direction: column;
    background: #f5f3ef; color: #1c1917;
    font-family: 'DM Sans', system-ui, sans-serif; overflow: hidden;
  }

  /* ── HEADER ── */
  .sd-header {
    flex-shrink: 0; display: flex; align-items: center;
    justify-content: space-between; padding: 0 24px; height: 56px;
    background: #ffffff; border-bottom: 1px solid #e8e0d0; gap: 12px;
  }
  .sd-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .sd-icon {
    width: 32px; height: 32px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0;
  }
  .sd-title { font-size: 15px; font-weight: 800; color: #1c1917; letter-spacing: -0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
  .sd-subtitle { font-size: 11px; color: #a8a29e; font-weight: 500; }
  .sd-pts-chip {
    display: flex; align-items: center; gap: 5px; padding: 4px 10px;
    border-radius: 99px; border: 1px solid; flex-shrink: 0;
    font-size: 12px; font-weight: 800; font-family: 'JetBrains Mono', monospace;
  }
  .sd-back-btn {
    display: flex; align-items: center; gap: 5px; padding: 6px 12px;
    border-radius: 8px; border: 1px solid #e2d9cc; background: #ffffff;
    color: #78716c; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all 0.15s; font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0;
  }
  .sd-back-btn:hover { border-color: #c8bfb4; color: #44403c; background: #f5f3ef; }

  /* ── STATS STRIP ── */
  .sd-stats {
    flex-shrink: 0; display: flex; background: #ffffff;
    border-bottom: 1px solid #e8e0d0;
  }
  .sd-stat {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    padding: 12px 8px; gap: 2px; position: relative;
  }
  .sd-stat + .sd-stat::before {
    content: ''; position: absolute; left: 0; top: 20%; height: 60%;
    width: 1px; background: #ede8e0;
  }
  .sd-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; line-height: 1; }
  .sd-stat-lbl { font-size: 9px; color: #a8a29e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

  /* ── BODY ── */
  .sd-body { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
  .sd-body::-webkit-scrollbar { width: 4px; }
  .sd-body::-webkit-scrollbar-thumb { background: #e2d9cc; border-radius: 99px; }

  .sd-section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #a8a29e; padding: 2px 4px 6px; }

  /* ── Player card ── */
  .sd-player {
    border-radius: 14px; border: 1px solid #ede8e0; background: #ffffff;
    cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
    overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .sd-player:hover { border-color: #d6cfc4; box-shadow: 0 2px 8px rgba(0,0,0,0.07); }
  .sd-player.active { border-color: #10b981; box-shadow: 0 0 0 1px rgba(16,185,129,0.2), 0 2px 16px rgba(16,185,129,0.1); }
  .sd-player-bar { height: 3px; width: 100%; }
  .sd-player-main { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
  .sd-spec { font-size: 9px; font-weight: 800; padding: 4px 9px; border-radius: 99px; letter-spacing: 0.4px; flex-shrink: 0; border: 1px solid; }
  .sd-player-info { flex: 1; min-width: 0; }
  .sd-player-name { font-size: 14px; font-weight: 800; color: #1c1917; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sd-player-team { font-size: 11px; color: #a8a29e; font-weight: 500; margin-top: 2px; }
  .sd-player-right { text-align: right; flex-shrink: 0; }
  .sd-player-pts { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 700; line-height: 1; }
  .sd-player-price { font-size: 10px; color: #a8a29e; margin-top: 3px; }
  .sd-chevron { font-size: 12px; color: #c8bfb4; margin-left: 10px; flex-shrink: 0; transition: transform 0.2s; display: inline-block; }
  .sd-chevron.open { transform: rotate(180deg); }

  /* ── Match breakdown ── */
  .sd-matches { border-top: 1px solid #f0ebe3; padding: 14px 16px 16px; }
  .sd-matches-season {
    font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
    color: #a8a29e; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #f0ebe3;
    display: flex; align-items: center; justify-content: space-between;
  }
  .sd-matches-season-pts { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #059669; }
  .sd-match-row {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 10px; background: #f8f6f2;
    margin-bottom: 4px;
  }
  .sd-match-row:last-child { margin-bottom: 0; }
  .sd-match-no { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #c8bfb4; width: 28px; flex-shrink: 0; font-weight: 600; }
  .sd-match-teams { font-size: 12px; font-weight: 600; color: #57534e; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sd-match-stats { display: flex; gap: 6px; font-size: 10px; color: #a8a29e; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
  .sd-match-stat-pill { background: #ede8e0; border-radius: 4px; padding: 2px 5px; font-size: 9px; font-weight: 700; color: #78716c; }
  .sd-match-pts { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 800; color: #059669; flex-shrink: 0; width: 36px; text-align: right; }
  .sd-no-matches { font-size: 12px; color: #c8bfb4; font-style: italic; text-align: center; padding: 16px 0; }

  /* ── Empty / Loading ── */
  .sd-loading { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; padding: 32px; }
  .sd-loading-spin { font-size: 28px; animation: sdSpin 2s linear infinite; }
  @keyframes sdSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .sd-loading-text { font-size: 11px; color: #a8a29e; }

  /* Mobile */
  @media (max-width: 640px) {
    .sd-root { height: auto; min-height: 100vh; overflow-y: auto; }
    .sd-header { padding: 0 14px; height: 50px; }
    .sd-subtitle { display: none; }
    .sd-body { overflow: visible; padding: 10px 12px; }
    .sd-title { max-width: 140px; }
  }
`

// ─── SPEC BADGE ───────────────────────────────────────────────────────────

function SpecBadge({ specialism }: { specialism: string }) {
  const sp = normaliseSpecialism(specialism)
  const c = SPEC_COLORS[sp] ?? SPEC_COLORS.UNKNOWN
  const label =
    sp === "WICKETKEEPER" ? "WK" :
    sp === "ALLROUNDER"   ? "AR" :
    sp === "BOWLER"       ? "BWL" :
    sp === "BATSMAN"      ? "BAT" : "—"
  return (
    <span className="sd-spec" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      {label}
    </span>
  )
}

// ─── MATCH BREAKDOWN ──────────────────────────────────────────────────────

function PlayerMatchBreakdown({ playerId }: { playerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasyPlayer", playerId],
    queryFn: () => fantasyApi.player(playerId),
    staleTime: 30000,
  })

  if (isLoading) {
    return (
      <div className="sd-matches">
        <p className="sd-no-matches">Loading matches…</p>
      </div>
    )
  }

  const renderSeason = (matches: FantasyPlayerMatchEntry[], label: string, alwaysShow = false) => {
    if (!matches?.length && !alwaysShow) return null
    const seasonPts = matches.reduce((s, m) => s + m.fantasyPoints, 0)
    return (
      <div className="sd-matches" key={label}>
        <div className="sd-matches-season">
          <span>{label}</span>
          {seasonPts > 0 && <span className="sd-matches-season-pts">+{seasonPts} pts</span>}
        </div>
        {!matches?.length ? (
          <div className="sd-match-row" style={{ justifyContent: "center", opacity: 0.6 }}>
            <span style={{ fontSize: 11, color: "#a8a29e", fontStyle: "italic" }}>
              🏏 Points will appear after player plays any matches
            </span>
          </div>
        ) : (
          matches.map(m => (
            <div key={m.matchId} className="sd-match-row">
              <span className="sd-match-no">M{m.matchNo}</span>
              <span className="sd-match-teams">{m.teamA} vs {m.teamB}</span>
              <div className="sd-match-stats">
                {m.runs > 0      && <span className="sd-match-stat-pill">{m.runs}r</span>}
                {m.wickets > 0   && <span className="sd-match-stat-pill">{m.wickets}w</span>}
                {m.catches > 0   && <span className="sd-match-stat-pill">{m.catches}ct</span>}
                {m.stumpings > 0 && <span className="sd-match-stat-pill">{m.stumpings}st</span>}
              </div>
              <span className="sd-match-pts">
                {m.fantasyPoints > 0 ? `+${m.fantasyPoints}` : m.fantasyPoints}
              </span>
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <>
      {renderSeason(data?.matches2026 ?? [], "IPL 2026", true)}
      {renderSeason(data?.matches2025 ?? [], "IPL 2025")}
    </>
  )
}

// ─── PLAYER CARD ──────────────────────────────────────────────────────────

function PlayerCard({
  p, rank, isActive, onToggle,
}: {
  p: FantasySquadPlayerEntry
  rank: number
  isActive: boolean
  onToggle: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const color = TEAM_COLORS[rank % TEAM_COLORS.length]

  useEffect(() => {
    if (isActive && cardRef.current) {
      const t = setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60)
      return () => clearTimeout(t)
    }
  }, [isActive])

  return (
    <div ref={cardRef} className={`sd-player ${isActive ? "active" : ""}`} onClick={onToggle}>
      <div className="sd-player-bar" style={{ background: color }} />
      <div className="sd-player-main">
        <SpecBadge specialism={p.specialism} />
        <div className="sd-player-info">
          <div className="sd-player-name">{p.playerName}</div>
          <div className="sd-player-team">{p.iplTeam || "—"}</div>
        </div>
        <div className="sd-player-right">
          <div className="sd-player-pts" style={{ color }}>{p.totalPoints}</div>
          <div className="sd-player-price">{p.soldPrice ? fmt(Number(p.soldPrice)) : "—"}</div>
        </div>
        <span className={`sd-chevron ${isActive ? "open" : ""}`}>▾</span>
      </div>
      {isActive && <PlayerMatchBreakdown playerId={p.playerId} />}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────

function FantasySquadPage() {
  const { auctionId, squadId } = useParams({ from: "/auction/$auctionId/fantasy/$squadId" })
  const navigate = useNavigate()

  const { activePlayerId } = Route.useSearch() as { activePlayerId?: string }

  const { data, isLoading } = useQuery({
    queryKey: ["fantasySquad", squadId],
    queryFn: () => fantasyApi.squad(squadId),
    staleTime: 30000,
  })

  const players: FantasySquadPlayerEntry[] = [...(data?.players ?? [])].sort(
    (a, b) => b.totalPoints - a.totalPoints
  )

  const totalSpent = players.reduce((acc, p) => acc + Number(p.soldPrice ?? 0), 0)
  const squadColor = TEAM_COLORS[0] // consistent accent for this squad

  const setActivePlayer = (pid: string) => {
    navigate({
      to: "/auction/$auctionId/fantasy/$squadId",
      params: { auctionId, squadId },
      search: { activePlayerId: activePlayerId === pid ? "" : pid },
      replace: true,
    })
  }

  return (
    <>
      <style>{css}</style>
      <div className="sd-root">

        {/* Header */}
        <header className="sd-header">
          <div className="sd-header-left">
            <div
              className="sd-icon"
              style={{ background: `linear-gradient(135deg, ${squadColor}33, ${squadColor}66)`, fontSize: 18 }}
            >
              🏏
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="sd-title">{data?.squadName ?? "Loading…"}</div>
              <div className="sd-subtitle">Fantasy Squad</div>
            </div>
            {data && (
              <div
                className="sd-pts-chip"
                style={{ background: `${squadColor}15`, borderColor: `${squadColor}40`, color: squadColor }}
              >
                {data.totalPoints} PTS
              </div>
            )}
          </div>
          <button
            className="sd-back-btn"
            onClick={() => navigate({ to: "/auction/$auctionId/fantasy", params: { auctionId } })}
          >
            ← Leaderboard
          </button>
        </header>

        {/* Stats strip */}
        {!isLoading && data && (
          <div className="sd-stats">
            {[
              { val: players.length,                              lbl: "Players",  color: squadColor },
              { val: totalSpent > 0 ? fmt(totalSpent) : "—",     lbl: "Spent",    color: squadColor },
              { val: data.totalPoints,                            lbl: "Total Pts",color: squadColor },
            ].map(({ val, lbl, color }) => (
              <div key={lbl} className="sd-stat">
                <div className="sd-stat-val" style={{ color }}>{val}</div>
                <div className="sd-stat-lbl">{lbl}</div>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="sd-body">
          {isLoading ? (
            <div className="sd-loading">
              <div className="sd-loading-spin">⚡</div>
              <div className="sd-loading-text">Loading squad…</div>
            </div>
          ) : players.length === 0 ? (
            <div className="sd-loading" style={{ opacity: 0.5 }}>
              <div style={{ fontSize: 36 }}>🏏</div>
              <div className="sd-loading-text">No players in this squad yet</div>
            </div>
          ) : (
            <>
              <div className="sd-section-label">{players.length} Players · sorted by points</div>
              {players.map((p, i) => (
                <PlayerCard
                  key={p.playerId}
                  p={p}
                  rank={i}
                  isActive={activePlayerId === p.playerId}
                  onToggle={() => setActivePlayer(p.playerId)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </>
  )
}