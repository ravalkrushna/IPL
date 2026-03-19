/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useRef, useEffect } from "react"
import { auctionApi } from "@/lib/auctionApi"
import { fantasyApi, FantasySquadPlayerEntry, FantasyPlayerMatchEntry } from "@/lib/fantasyApi"

export const Route = createFileRoute("/auction/$auctionId/fantasy")({
  component: FantasyPage,
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

  .fp-root {
    height: 100vh; display: flex; flex-direction: column;
    background: #f5f3ef; color: #1c1917;
    font-family: 'DM Sans', system-ui, sans-serif; overflow: hidden;
  }

  /* ── HEADER ── */
  .fp-header {
    flex-shrink: 0; display: flex; align-items: center;
    justify-content: space-between; padding: 0 24px; height: 56px;
    background: #ffffff; border-bottom: 1px solid #e8e0d0; gap: 12px;
  }
  .fp-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .fp-icon {
    width: 32px; height: 32px; border-radius: 10px;
    background: linear-gradient(135deg, #059669, #34d399);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(5,150,105,0.25);
  }
  .fp-title { font-size: 15px; font-weight: 800; color: #1c1917; letter-spacing: -0.3px; }
  .fp-subtitle { font-size: 11px; color: #a8a29e; font-weight: 500; }
  .fp-badge {
    display: flex; align-items: center; gap: 5px; padding: 4px 10px;
    border-radius: 99px; background: #ecfdf5; border: 1px solid #a7f3d0;
    font-size: 10px; font-weight: 700; color: #059669; letter-spacing: 0.5px; flex-shrink: 0;
  }
  .fp-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: #10b981; animation: fpPulse 2s infinite; }
  @keyframes fpPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.7)} }
  .fp-back-btn {
    display: flex; align-items: center; gap: 5px; padding: 6px 12px;
    border-radius: 8px; border: 1px solid #e2d9cc; background: #ffffff;
    color: #78716c; font-size: 12px; font-weight: 600; cursor: pointer;
    transition: all 0.15s; font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0;
  }
  .fp-back-btn:hover { border-color: #c8bfb4; color: #44403c; background: #f5f3ef; }

  /* ── BODY: single scrollable column ── */
  .fp-body { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
  .fp-body::-webkit-scrollbar { width: 4px; }
  .fp-body::-webkit-scrollbar-thumb { background: #e2d9cc; border-radius: 99px; }

  .fp-list-header { padding: 4px 4px 8px; flex-shrink: 0; }
  .fp-section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #a8a29e; margin-bottom: 2px; }
  .fp-list-title { font-size: 18px; font-weight: 900; color: #1c1917; letter-spacing: -0.5px; }

  /* ── Squad entry (leaderboard row) ── */
  .fp-entry {
    border-radius: 14px; border: 1px solid #ede8e0; background: #ffffff;
    cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  }
  .fp-entry:hover { border-color: #d6cfc4; box-shadow: 0 2px 6px rgba(0,0,0,0.07); }
  .fp-entry.active { border-color: #10b981; box-shadow: 0 0 0 1px rgba(16,185,129,0.2), 0 2px 12px rgba(16,185,129,0.1); }
  .fp-entry-bar { height: 3px; width: 100%; }
  .fp-entry-main { display: flex; align-items: center; gap: 12px; padding: 12px 14px 8px; }
  .fp-rank { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #c8bfb4; width: 22px; text-align: center; flex-shrink: 0; }
  .fp-rank.r1 { color: #f59e0b; font-size: 15px; }
  .fp-rank.r2 { color: #94a3b8; font-size: 14px; }
  .fp-rank.r3 { color: #b45309; font-size: 13px; }
  .fp-entry-info { flex: 1; min-width: 0; }
  .fp-entry-squad { font-size: 14px; font-weight: 700; color: #1c1917; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fp-entry-participant { font-size: 10px; color: #a8a29e; font-weight: 500; margin-top: 1px; }
  .fp-entry-pts { text-align: right; flex-shrink: 0; }
  .fp-pts-val { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; line-height: 1; }
  .fp-pts-label { font-size: 9px; color: #a8a29e; font-weight: 600; letter-spacing: 0.5px; margin-top: 2px; }
  .fp-entry-chevron { font-size: 11px; color: #c8bfb4; margin-left: 8px; flex-shrink: 0; transition: transform 0.2s; display: inline-block; }
  .fp-entry-chevron.open { transform: rotate(180deg); }

  /* Points bar + footer */
  .fp-pts-bar-wrap { padding: 0 14px 4px; }
  .fp-pts-bar-bg { height: 3px; border-radius: 99px; background: #f0ebe3; overflow: hidden; }
  .fp-pts-bar-fill { height: 100%; border-radius: 99px; transition: width 0.7s ease; }
  .fp-entry-footer { display: flex; align-items: center; justify-content: space-between; padding: 4px 14px 10px; }
  .fp-entry-matches { font-size: 10px; color: #c8bfb4; }

  /* ── Inline squad detail (expands below entry header) ── */
  .fp-squad-detail { border-top: 1px solid #f0ebe3; }

  /* Squad stats bar */
  .fp-squad-meta {
    display: flex; align-items: center; gap: 0;
    background: #faf8f5; border-bottom: 1px solid #f0ebe3;
  }
  .fp-squad-stat {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    padding: 10px 8px; gap: 1px; position: relative;
  }
  .fp-squad-stat + .fp-squad-stat::before {
    content: ''; position: absolute; left: 0; top: 20%; height: 60%;
    width: 1px; background: #ede8e0;
  }
  .fp-squad-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; line-height: 1; }
  .fp-squad-stat-lbl { font-size: 8px; color: #a8a29e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

  /* Player cards inside expanded squad */
  .fp-player-list { padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; }

  .fp-player-card {
    border-radius: 10px; border: 1px solid #ede8e0; background: #ffffff;
    cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    overflow: hidden;
  }
  .fp-player-card:hover { border-color: #d6cfc4; background: #faf8f5; }
  .fp-player-card.active { border-color: #10b981; background: #f0fdf4; box-shadow: 0 0 0 1px rgba(16,185,129,0.15); }
  .fp-player-main { display: flex; align-items: center; gap: 10px; padding: 9px 12px; }
  .fp-player-spec { font-size: 8px; font-weight: 800; padding: 3px 7px; border-radius: 99px; letter-spacing: 0.4px; flex-shrink: 0; }
  .fp-player-info { flex: 1; min-width: 0; }
  .fp-player-name { font-size: 12px; font-weight: 700; color: #1c1917; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fp-player-team { font-size: 10px; color: #a8a29e; font-weight: 500; margin-top: 1px; }
  .fp-player-right { text-align: right; flex-shrink: 0; }
  .fp-player-pts { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; line-height: 1; }
  .fp-player-price { font-size: 10px; color: #a8a29e; margin-top: 2px; }
  .fp-player-chevron { font-size: 10px; color: #c8bfb4; margin-left: 6px; flex-shrink: 0; transition: transform 0.2s; display: inline-block; }
  .fp-player-chevron.open { transform: rotate(180deg); }

  /* Match breakdown */
  .fp-matches { border-top: 1px solid #f0ebe3; padding: 8px 12px 10px; display: flex; flex-direction: column; gap: 3px; }
  .fp-matches-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #a8a29e; margin-bottom: 5px; padding-bottom: 4px; border-bottom: 1px solid #f0ebe3; }
  .fp-match-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 7px; background: #f5f3ef; }
  .fp-match-no { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #a8a29e; width: 26px; flex-shrink: 0; }
  .fp-match-teams { font-size: 10px; font-weight: 600; color: #78716c; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fp-match-stats { display: flex; gap: 6px; font-size: 9px; color: #a8a29e; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
  .fp-match-pts { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #059669; flex-shrink: 0; width: 32px; text-align: right; }
  .fp-no-matches { font-size: 11px; color: #c8bfb4; font-style: italic; padding: 2px 0; }

  /* Loading */
  .fp-loading { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; padding: 24px; }
  .fp-loading-icon { font-size: 28px; animation: fpSpin 2s linear infinite; }
  @keyframes fpSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .fp-loading-text { font-size: 11px; color: #a8a29e; }

  /* Mobile */
  @media (max-width: 640px) {
    .fp-root { height: auto; min-height: 100vh; overflow-y: auto; }
    .fp-header { padding: 0 14px; height: 50px; }
    .fp-subtitle, .fp-badge { display: none; }
    .fp-body { overflow: visible; padding: 10px 12px; }
  }
`

// ─── SPEC BADGE ───────────────────────────────────────────────────────────

function SpecBadge({ specialism }: { specialism: string }) {
  const sp = normaliseSpecialism(specialism)
  const c = SPEC_COLORS[sp] ?? SPEC_COLORS.UNKNOWN
  const label = sp === "WICKETKEEPER" ? "WK" : sp === "ALLROUNDER" ? "AR" : sp === "BOWLER" ? "BWL" : sp === "BATSMAN" ? "BAT" : "—"
  return <span className="fp-player-spec" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{label}</span>
}

// ─── MATCH BREAKDOWN ──────────────────────────────────────────────────────

function PlayerMatchBreakdown({ playerId }: { playerId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasyPlayer", playerId],
    queryFn: () => fantasyApi.player(playerId),
    staleTime: 30000,
  })

  if (isLoading) return <div className="fp-matches"><p className="fp-no-matches">Loading matches…</p></div>

  const renderSection = (matches: FantasyPlayerMatchEntry[], label: string, alwaysShow = false) => {
    if (!matches?.length && !alwaysShow) return null
    return (
      <div className="fp-matches">
        <div className="fp-matches-label">{label}</div>
        {matches?.length === 0 ? (
          <div className="fp-match-row" style={{ justifyContent: "center", opacity: 0.6 }}>
            <span style={{ fontSize: 10, color: "#a8a29e", fontStyle: "italic" }}>
              🏏  Points will appear after player plays any matches
            </span>
          </div>
        ) : (
          matches.map(m => (
            <div key={m.matchId} className="fp-match-row">
              <span className="fp-match-no">M{m.matchNo}</span>
              <span className="fp-match-teams">{m.teamA} vs {m.teamB}</span>
              <div className="fp-match-stats">
                {m.runs > 0 && <span>{m.runs}r</span>}
                {m.wickets > 0 && <span>{m.wickets}w</span>}
                {m.catches > 0 && <span>{m.catches}ct</span>}
                {m.stumpings > 0 && <span>{m.stumpings}st</span>}
              </div>
              <span className="fp-match-pts">{m.fantasyPoints > 0 ? `+${m.fantasyPoints}` : m.fantasyPoints}</span>
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <>
      {renderSection(data?.matches2026 ?? [], "IPL 2026", true /* always show */)}
      {renderSection(data?.matches2025 ?? [], "IPL 2025")}
    </>
  )
}

// ─── PLAYER CARD (auto-scroll on expand) ─────────────────────────────────

function PlayerCard({ p, isActive, barColor, onPlayerClick }: {
  p: FantasySquadPlayerEntry; isActive: boolean; barColor: string; onPlayerClick: (id: string) => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive && cardRef.current) {
      const t = setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60)
      return () => clearTimeout(t)
    }
  }, [isActive])

  return (
    <div ref={cardRef} className={`fp-player-card ${isActive ? "active" : ""}`} onClick={() => onPlayerClick(isActive ? "" : p.playerId)}>
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
        <span className={`fp-player-chevron ${isActive ? "open" : ""}`}>▾</span>
      </div>
      {isActive && <PlayerMatchBreakdown playerId={p.playerId} />}
    </div>
  )
}

// ─── INLINE SQUAD DETAIL ─────────────────────────────────────────────────

function InlineSquadDetail({ squadId, color, activePlayerId, onPlayerClick }: {
  squadId: string; color: string; activePlayerId: string | null; onPlayerClick: (id: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["fantasySquad", squadId],
    queryFn: () => fantasyApi.squad(squadId),
    staleTime: 30000,
  })

  const totalSpent = (data?.players ?? []).reduce(
    (acc: number, p: FantasySquadPlayerEntry) => acc + Number(p.soldPrice ?? 0), 0
  )

  if (isLoading) return (
    <div className="fp-squad-detail">
      <div className="fp-loading"><div className="fp-loading-icon">⚡</div><div className="fp-loading-text">Loading…</div></div>
    </div>
  )

  return (
    <div className="fp-squad-detail">
      {/* Stats strip */}
      <div className="fp-squad-meta">
        {[
          { val: data?.players.length ?? 0, lbl: "Players" },
          { val: totalSpent > 0 ? fmt(totalSpent) : "—", lbl: "Spent" },
        ].map(({ val, lbl }) => (
          <div key={lbl} className="fp-squad-stat">
            <div className="fp-squad-stat-val" style={{ color }}>{val}</div>
            <div className="fp-squad-stat-lbl">{lbl}</div>
          </div>
        ))}
      </div>

      {/* Player list */}
      {(data?.players ?? []).length === 0 ? (
        <div className="fp-loading"><div className="fp-loading-text" style={{ padding: "12px 0" }}>No players yet</div></div>
      ) : (
        <div className="fp-player-list">
          {(data?.players ?? []).map((p: FantasySquadPlayerEntry, i: number) => (
            <PlayerCard
              key={p.playerId}
              p={p}
              isActive={activePlayerId === p.playerId}
              barColor={TEAM_COLORS[i % TEAM_COLORS.length]}
              onPlayerClick={onPlayerClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────

function FantasyPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId/fantasy" })
  const navigate = useNavigate()

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

  const maxPoints = Math.max(...(leaderboard?.entries.map(e => e.totalPoints) ?? [1]), 1)

  return (
    <>
      <style>{css}</style>
      <div className="fp-root">
        <header className="fp-header">
          <div className="fp-header-left">
            <div className="fp-icon">🏆</div>
            <div>
              <div className="fp-title">Fantasy Leaderboard</div>
              <div className="fp-subtitle">{auction?.name ?? "Loading…"}</div>
            </div>
            <div className="fp-badge"><span className="fp-badge-dot" />IPL 2026</div>
          </div>
          <button className="fp-back-btn" onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId } })}>
            ← Auction Room
          </button>
        </header>

        <div className="fp-body">
          <div className="fp-list-header">
            <div className="fp-section-label">Rankings</div>
            <div className="fp-list-title">{leaderboard?.entries.length ?? 0} Squads</div>
          </div>

          {isLoading ? (
            <div className="fp-loading" style={{ flex: 1 }}>
              <div className="fp-loading-icon">🏆</div>
              <div className="fp-loading-text">Loading leaderboard…</div>
            </div>
          ) : (leaderboard?.entries.length ?? 0) === 0 ? (
            <div className="fp-loading" style={{ flex: 1, opacity: 0.5 }}>
              <div style={{ fontSize: 36 }}>🏏</div>
              <div className="fp-loading-text">No fantasy data yet</div>
            </div>
          ) : (
            leaderboard!.entries.map((entry, i) => {
              const color = TEAM_COLORS[i % TEAM_COLORS.length]
              const isActive = activeSquadId === entry.squadId
              const rankEmoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${entry.rank}`
              const rankClass = i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : ""
              const pct = (entry.totalPoints / maxPoints) * 100
              return (
                <div key={entry.squadId} className={`fp-entry ${isActive ? "active" : ""}`}>
                  {/* Colored top bar */}
                  <div className="fp-entry-bar" style={{ background: isActive ? color : "#f0ebe3" }} />

                  {/* Clickable header row */}
                  <div className="fp-entry-main" onClick={() => setActive(isActive ? "" : entry.squadId, "")}>
                    <span className={`fp-rank ${rankClass}`}>{rankEmoji}</span>
                    <div className="fp-entry-info">
                      <div className="fp-entry-squad">{entry.squadName}</div>
                      <div className="fp-entry-participant">{entry.participantName}</div>
                    </div>
                    <div className="fp-entry-pts">
                      <div className="fp-pts-val" style={{ color }}>{entry.totalPoints}</div>
                      <div className="fp-pts-label">PTS</div>
                    </div>
                    <span className={`fp-entry-chevron ${isActive ? "open" : ""}`}>▾</span>
                  </div>

                  {/* Points bar + matches */}
                  <div className="fp-pts-bar-wrap">
                    <div className="fp-pts-bar-bg">
                      <div className="fp-pts-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                  <div className="fp-entry-footer">
                    <span className="fp-entry-matches">{entry.matchesPlayed} matches played</span>
                  </div>

                  {/* Inline squad detail — expands right here */}
                  {isActive && (
                    <InlineSquadDetail
                      squadId={entry.squadId}
                      color={color}
                      activePlayerId={activePlayerId ?? null}
                      onPlayerClick={(pid) => setActive(entry.squadId, pid)}
                    />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}