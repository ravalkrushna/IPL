/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useRef, useEffect, useSyncExternalStore } from "react"
import { fantasyApi, FantasySquadPlayerEntry, FantasyPlayerMatchEntry, FantasyPointBreakdown } from "@/lib/fantasyApi"

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

const SPLIT_MQ = "(min-width: 1024px)"

function useWideSplitLayout() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const m = window.matchMedia(SPLIT_MQ)
      m.addEventListener("change", onStoreChange)
      return () => m.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia(SPLIT_MQ).matches,
    () => false,
  )
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
  * { box-sizing: border-box; }

  .sd-root {
    min-height: 100vh; height: 100vh; display: flex; flex-direction: column;
    background: linear-gradient(180deg, #faf8f5 0%, #f0ebe3 100%);
    color: #1c1917;
    font-family: 'DM Sans', system-ui, sans-serif;
    overflow: hidden;
  }

  /* ── HEADER ── */
  .sd-header {
    flex-shrink: 0; display: flex; align-items: center;
    justify-content: space-between; padding: 0 clamp(1rem, 3vw, 2.5rem); min-height: 64px;
    background: #ffffff; border-bottom: 1px solid #e5dfd4;
    box-shadow: 0 1px 0 rgba(255,255,255,0.9) inset, 0 4px 20px rgba(28,25,23,0.06);
    gap: 12px;
  }
  .sd-header-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .sd-icon {
    width: 44px; height: 44px; border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .sd-title { font-size: 18px; font-weight: 800; color: #1c1917; letter-spacing: -0.4px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: min(280px, 50vw); }
  .sd-subtitle { font-size: 12px; color: #78716c; font-weight: 600; margin-top: 3px; }
  .sd-pts-chip {
    display: flex; align-items: center; gap: 6px; padding: 6px 12px;
    border-radius: 99px; border: 1px solid; flex-shrink: 0;
    font-size: 13px; font-weight: 800; font-family: 'JetBrains Mono', monospace;
    letter-spacing: -0.02em;
  }
  .sd-back-btn {
    display: flex; align-items: center; gap: 6px; padding: 10px 14px;
    border-radius: 12px; border: 1px solid #d6cfc4; background: #fafaf9;
    color: #57534e; font-size: 13px; font-weight: 700; cursor: pointer;
    transition: all 0.15s; font-family: 'DM Sans', sans-serif; white-space: nowrap; flex-shrink: 0;
  }
  .sd-back-btn:hover { border-color: #a8a29e; color: #1c1917; background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

  /* ── STATS STRIP ── */
  .sd-stats {
    flex-shrink: 0; display: flex;
    background: linear-gradient(180deg, #ffffff 0%, #faf8f5 100%);
    border-bottom: 1px solid #e8e0d0;
    padding: 4px clamp(1rem, 3vw, 2.5rem);
    max-width: min(1600px, 100%);
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }
  .sd-stat {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center;
    padding: 16px 12px; gap: 6px; position: relative;
  }
  .sd-stat + .sd-stat::before {
    content: ''; position: absolute; left: 0; top: 22%; height: 56%;
    width: 1px; background: #e7e2d9;
  }
  .sd-stat-val { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; }
  .sd-stat-lbl { font-size: 10px; color: #78716c; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }

  /* ── BODY ── */
  .sd-body-wrap {
    flex: 1; min-height: 0;
    padding: 0 clamp(1rem, 3vw, 2.5rem) clamp(1.25rem, 3vw, 2rem);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .sd-body-wrap.sd-split {
    display: grid;
    grid-template-columns: minmax(280px, 1fr) minmax(340px, 1fr);
    grid-template-rows: 1fr;
    gap: clamp(1rem, 2vw, 1.75rem);
    align-items: stretch;
    align-content: stretch;
    max-width: min(1600px, 100%);
    margin: 0 auto;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding-top: clamp(0.75rem, 2vw, 1.25rem);
  }
  .sd-split-col-list {
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 4px;
    width: 100%;
  }
  .sd-split-col-list::-webkit-scrollbar { width: 6px; }
  .sd-split-col-list::-webkit-scrollbar-thumb { background: #d6cfc4; border-radius: 99px; }

  .sd-split-col-detail {
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border: 1px solid #e5dfd4;
    border-radius: 18px;
    box-shadow: 0 4px 24px rgba(28,25,23,0.07);
    width: 100%;
  }
  .sd-detail-sticky {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .sd-detail-sticky::-webkit-scrollbar { width: 6px; }
  .sd-detail-sticky::-webkit-scrollbar-thumb { background: #d6cfc4; border-radius: 99px; }
  .sd-detail-head {
    flex-shrink: 0;
    padding: 16px 18px 12px;
    border-bottom: 1px solid #f0ebe3;
    background: linear-gradient(180deg, #fafaf9 0%, #ffffff 100%);
  }
  .sd-detail-head-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #78716c; }
  .sd-detail-head-name { font-size: 18px; font-weight: 800; color: #1c1917; margin-top: 4px; letter-spacing: -0.03em; }
  .sd-detail-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px 24px;
    text-align: center;
    color: #78716c;
    font-size: 15px;
    font-weight: 600;
    line-height: 1.5;
  }
  .sd-detail-empty-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.85; }

  .sd-detail-sticky .sd-matches:first-of-type {
    border-top: none;
    margin-top: 0;
  }

  /* Single column: full width up to a comfortable max */
  .sd-body-wrap:not(.sd-split) {
    overflow-y: auto;
  }
  .sd-body-wrap:not(.sd-split)::-webkit-scrollbar { width: 6px; }
  .sd-body-wrap:not(.sd-split)::-webkit-scrollbar-thumb { background: #d6cfc4; border-radius: 99px; }

  .sd-body {
    width: 100%;
    max-width: min(1200px, 100%);
    margin: 0 auto;
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sd-split .sd-body {
    max-width: none;
    margin: 0;
    padding-top: 0;
  }

  .sd-section-head { margin-bottom: 4px; }
  .sd-section-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: #57534e; }
  .sd-section-hint { font-size: 13px; color: #78716c; font-weight: 500; margin-top: 6px; line-height: 1.45; }

  /* ── Player card ── */
  .sd-player {
    border-radius: 16px; border: 1px solid #e5dfd4; background: #ffffff;
    cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(28,25,23,0.05);
    flex-shrink: 0;
    width: 100%;
    min-height: 92px;
  }
  .sd-player:hover { border-color: #c4bbb0; box-shadow: 0 8px 24px rgba(28,25,23,0.08); transform: translateY(-1px); }
  .sd-player.active { border-color: #10b981; box-shadow: 0 0 0 2px rgba(16,185,129,0.25), 0 8px 28px rgba(16,185,129,0.12); }
  .sd-player-bar { height: 4px; width: 100%; }
  .sd-player-main { display: flex; align-items: stretch; gap: 0; min-height: 88px; }
  .sd-rank {
    width: 48px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px; font-weight: 800; color: #a8a29e;
    background: linear-gradient(90deg, #f5f3ef 0%, #fafaf9 100%);
    border-right: 1px solid #f0ebe3;
  }
  .sd-rank.top3 { color: #57534e; font-size: 17px; }
  .sd-player-inner { flex: 1; display: flex; align-items: center; gap: 12px; padding: 16px 16px 16px 14px; min-width: 0; }
  .sd-spec { font-size: 10px; font-weight: 800; padding: 5px 10px; border-radius: 99px; letter-spacing: 0.05em; flex-shrink: 0; border: 1px solid; align-self: center; }
  .sd-player-info { flex: 1; min-width: 0; }
  .sd-player-name { font-size: 17px; font-weight: 800; color: #1c1917; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sd-player-team { font-size: 13px; color: #78716c; font-weight: 600; margin-top: 4px; }
  .sd-player-right { text-align: right; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .sd-player-pts { font-family: 'JetBrains Mono', monospace; font-size: 24px; font-weight: 800; line-height: 1; letter-spacing: -0.04em; }
  .sd-player-pts-lbl { font-size: 10px; font-weight: 700; color: #a8a29e; text-transform: uppercase; letter-spacing: 0.06em; }
  .sd-player-price { font-size: 12px; color: #78716c; font-weight: 600; }
  .sd-chevron-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding-right: 4px; flex-shrink: 0; color: #a8a29e; }
  .sd-chevron-hint { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; max-width: 44px; text-align: center; line-height: 1.15; }
  .sd-chevron { font-size: 14px; transition: transform 0.2s; display: inline-block; }
  .sd-chevron.open { transform: rotate(180deg); color: #059669; }

  /* ── Match breakdown ── */
  .sd-matches {
    border-top: 1px solid #f0ebe3;
    padding: 18px 18px 20px;
    background: linear-gradient(180deg, #fafaf9 0%, #ffffff 40%);
  }
  .sd-matches-season {
    font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;
    color: #57534e; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #ede8e0;
    display: flex; align-items: center; justify-content: space-between;
  }
  .sd-matches-season-pts { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 800; color: #059669; }
  .sd-match-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border-radius: 12px; background: #f5f3ef;
    border: 1px solid #ede8e0;
    margin-bottom: 6px;
  }
  .sd-match-row:last-child { margin-bottom: 0; }
  .sd-match-no { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #78716c; width: 36px; flex-shrink: 0; font-weight: 800; }
  .sd-match-teams { font-size: 14px; font-weight: 700; color: #292524; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sd-match-stats { display: flex; flex-wrap: wrap; gap: 6px; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
  .sd-match-stat-pill { background: #e7e2d9; border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700; color: #44403c; }
  .sd-match-pts { font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 800; color: #059669; flex-shrink: 0; min-width: 44px; text-align: right; }
  .sd-match-block { margin-bottom: 6px; }
  .sd-match-block:last-child { margin-bottom: 0; }
  .sd-match-bd {
    display: flex; flex-wrap: wrap; gap: 4px 8px;
    padding: 0 12px 10px 50px;
    margin-top: -2px;
  }
  .sd-match-bd-chip {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 700;
    padding: 4px 9px; border-radius: 8px;
    background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;
  }
  .sd-no-matches { font-size: 14px; color: #78716c; font-style: italic; text-align: center; padding: 20px 0; }

  /* ── Empty / Loading ── */
  .sd-loading { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 12px; padding: 48px 24px; }
  .sd-loading-spin { font-size: 36px; animation: sdSpin 2s linear infinite; }
  @keyframes sdSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .sd-loading-text { font-size: 14px; color: #78716c; font-weight: 600; }

  /* Mobile */
  @media (max-width: 640px) {
    .sd-root { height: auto; min-height: 100vh; overflow-y: auto; }
    .sd-header { padding: 0 14px; min-height: 56px; }
    .sd-title { font-size: 16px; max-width: 160px; }
    .sd-back-btn { padding: 8px 10px; font-size: 12px; }
    .sd-body-wrap { padding: 0 12px 20px; }
    .sd-player-inner { padding: 14px 12px; min-height: 80px; }
    .sd-player-name { font-size: 16px; }
    .sd-rank { width: 40px; font-size: 13px; }
    .sd-player-pts { font-size: 21px; }
    .sd-chevron-hint { display: none; }
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

function PointBreakdownChips({ b }: { b: FantasyPointBreakdown }) {
  const parts = [
    { label: "Playing XI", v: b.playingXi },
    { label: "Batting", v: b.batting },
    { label: "Bowling", v: b.bowling },
    { label: "Fielding", v: b.fielding },
  ].filter((x) => x.v !== 0)
  if (parts.length === 0) return null
  return (
    <div className="sd-match-bd">
      {parts.map((p) => (
        <span key={p.label} className="sd-match-bd-chip" title={`${p.label} points`}>
          {p.label.replace("Playing ", "")} {p.v > 0 ? "+" : ""}
          {p.v}
        </span>
      ))}
    </div>
  )
}

function PlayerMatchBreakdown({ playerId, season }: { playerId: string; season: "2026" | "2025" }) {
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
            <div key={m.matchId} className="sd-match-block">
              <div className="sd-match-row">
                <span className="sd-match-no">M{m.matchNo}</span>
                <span className="sd-match-teams">{m.teamA} vs {m.teamB}</span>
                <div className="sd-match-stats">
                  {m.runs > 0      && <span className="sd-match-stat-pill">{m.runs}r</span>}
                  {m.wickets > 0   && <span className="sd-match-stat-pill">{m.wickets}w</span>}
                  {(m.dotBalls ?? 0) > 0 && <span className="sd-match-stat-pill">{m.dotBalls}db</span>}
                  {m.catches > 0   && <span className="sd-match-stat-pill">{m.catches}ct</span>}
                  {m.stumpings > 0 && <span className="sd-match-stat-pill">{m.stumpings}st</span>}
                </div>
                <span className="sd-match-pts">
                  {m.fantasyPoints > 0 ? `+${m.fantasyPoints}` : m.fantasyPoints}
                </span>
              </div>
              {m.pointBreakdown && <PointBreakdownChips b={m.pointBreakdown} />}
            </div>
          ))
        )}
      </div>
    )
  }

  return <>{season === "2026" ? renderSeason(data?.matches2026 ?? [], "IPL 2026", true) : renderSeason(data?.matches2025 ?? [], "IPL 2025", true)}</>
}

// ─── PLAYER CARD ──────────────────────────────────────────────────────────

function PlayerCard({
  p, rank, isActive, onToggle, season, embedBreakdown = true,
}: {
  p: FantasySquadPlayerEntry
  rank: number
  isActive: boolean
  onToggle: () => void
  season: "2026" | "2025"
  embedBreakdown?: boolean
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
        <div className={`sd-rank ${rank < 3 ? "top3" : ""}`} aria-hidden>
          {rank + 1}
        </div>
        <div className="sd-player-inner">
          <SpecBadge specialism={p.specialism} />
          <div className="sd-player-info">
            <div className="sd-player-name">{p.playerName}</div>
            <div className="sd-player-team">{p.iplTeam || "IPL team —"}</div>
          </div>
          <div className="sd-player-right">
            <span className="sd-player-pts-lbl">Fantasy pts</span>
            <div className="sd-player-pts" style={{ color }}>{p.totalPoints.toLocaleString()}</div>
            <div className="sd-player-price">{p.soldPrice ? fmt(Number(p.soldPrice)) : "Auction —"}</div>
          </div>
          <div className="sd-chevron-wrap" aria-hidden>
            <span className="sd-chevron-hint">{isActive ? "Hide" : "Breakdown"}</span>
            <span className={`sd-chevron ${isActive ? "open" : ""}`}>▾</span>
          </div>
        </div>
      </div>
      {isActive && embedBreakdown && <PlayerMatchBreakdown playerId={p.playerId} season={season} />}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────

function FantasySquadPage() {
  const { auctionId, squadId } = useParams({ from: "/auction/$auctionId/fantasy/$squadId" })
  const navigate = useNavigate()

  const { activePlayerId, season: seasonParam } = Route.useSearch() as { activePlayerId?: string; season?: string }
  const season: "2026" | "2025" = seasonParam === "2025" ? "2025" : "2026"

  const { data, isLoading } = useQuery({
    queryKey: ["fantasySquad", squadId, season],
    queryFn: () => fantasyApi.squad(squadId, season),
    staleTime: 30000,
  })

  const players: FantasySquadPlayerEntry[] = [...(data?.players ?? [])].sort(
    (a, b) => b.totalPoints - a.totalPoints
  )

  const totalSpent = players.reduce((acc, p) => acc + Number(p.soldPrice ?? 0), 0)
  const squadColor = TEAM_COLORS[0] // consistent accent for this squad

  const wideSplit = useWideSplitLayout()
  const useSidePanel = wideSplit && players.length > 0
  const activePlayer = activePlayerId
    ? players.find((x) => x.playerId === activePlayerId)
    : undefined

  const setActivePlayer = (pid: string) => {
    navigate({
      to: "/auction/$auctionId/fantasy/$squadId",
      params: { auctionId, squadId },
      search: { activePlayerId: activePlayerId === pid ? "" : pid, season },
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
              <div className="sd-subtitle">Fantasy · squad detail · IPL {season}</div>
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              className="sd-back-btn"
              style={season === "2026" ? { background: "#059669", color: "#fff", borderColor: "#059669" } : {}}
              onClick={() => navigate({ to: "/auction/$auctionId/fantasy/$squadId", params: { auctionId, squadId }, search: { activePlayerId: "", season: "2026" }, replace: true })}
            >
              IPL 2026
            </button>
            <button
              className="sd-back-btn"
              style={season === "2025" ? { background: "#334155", color: "#fff", borderColor: "#334155" } : {}}
              onClick={() => navigate({ to: "/auction/$auctionId/fantasy/$squadId", params: { auctionId, squadId }, search: { activePlayerId: "", season: "2025" }, replace: true })}
            >
              IPL 2025
            </button>
            <button
              className="sd-back-btn"
              onClick={() => navigate({ to: "/auction/$auctionId/fantasy", params: { auctionId } })}
            >
              ← Leaderboard
            </button>
          </div>
        </header>

        {/* Stats strip */}
        {!isLoading && data && (
          <div className="sd-stats">
            {[
              { val: players.length,                              lbl: "Players",  color: squadColor },
              { val: totalSpent > 0 ? fmt(totalSpent) : "—",     lbl: "Budget spent",    color: squadColor },
              { val: data.totalPoints.toLocaleString(),                            lbl: "Squad total",color: squadColor },
            ].map(({ val, lbl, color }) => (
              <div key={lbl} className="sd-stat">
                <div className="sd-stat-val" style={{ color }}>{val}</div>
                <div className="sd-stat-lbl">{lbl}</div>
              </div>
            ))}
          </div>
        )}

        <div className={`sd-body-wrap${useSidePanel ? " sd-split" : ""}`}>
          <div className={`sd-body${useSidePanel ? " sd-split-col-list" : ""}`}>
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
                <div className="sd-section-head">
                  <div className="sd-section-label">Your squad</div>
                  <div className="sd-section-hint">
                    {players.length} players · highest points first.
                    {useSidePanel
                      ? " Select a player to see match breakdown on the right."
                      : " Tap a player for match-by-match fantasy points and batting / bowling / fielding split."}
                  </div>
                </div>
                {players.map((p, i) => (
                  <PlayerCard
                    key={p.playerId}
                    p={p}
                    rank={i}
                    isActive={activePlayerId === p.playerId}
                    onToggle={() => setActivePlayer(p.playerId)}
                    season={season}
                    embedBreakdown={!useSidePanel}
                  />
                ))}
              </>
            )}
          </div>

          {useSidePanel && (
            <aside className="sd-split-col-detail" aria-label="Match breakdown">
              {activePlayerId && activePlayer ? (
                <div className="sd-detail-sticky">
                  <div className="sd-detail-head">
                    <div className="sd-detail-head-label">Match breakdown</div>
                    <div className="sd-detail-head-name">{activePlayer.playerName}</div>
                  </div>
                  <PlayerMatchBreakdown playerId={activePlayerId} season={season} />
                </div>
              ) : (
                <div className="sd-detail-empty">
                  <div className="sd-detail-empty-icon">📊</div>
                  <p>
                    Select a player from the list to see IPL 2025 / 2026 fantasy points, stat lines, and batting · bowling · fielding splits.
                  </p>
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </>
  )
}