/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams, useNavigate, Outlet, useChildMatches } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { auctionApi } from "@/lib/auctionApi"
import { fantasyApi, FantasyLeaderboardEntry } from "@/lib/fantasyApi"

export const Route = createFileRoute("/auction/$auctionId/fantasy")({
  component: FantasyLayout,
})

function FantasyLayout() {
  const matches = useChildMatches()
  if (matches.length > 0) return <Outlet />
  return <FantasyPage />
}

// ─── HELPERS ──────────────────────────────────────────────────────────────

function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`
  return `₹${amount.toLocaleString()}`
}

const RANK_COLORS = [
  { main: "#BA7517", bg: "#FAEEDA", text: "#854F0B" },
  { main: "#534AB7", bg: "#EEEDFE", text: "#3C3489" },
  { main: "#0F6E56", bg: "#E1F5EE", text: "#085041" },
  { main: "#993556", bg: "#FBEAF0", text: "#72243E" },
  { main: "#185FA5", bg: "#E6F1FB", text: "#0C447C" },
  { main: "#639922", bg: "#EAF3DE", text: "#3B6D11" },
  { main: "#993C1D", bg: "#FAECE7", text: "#712B13" },
  { main: "#5F5E5A", bg: "#F1EFE8", text: "#2C2C2A" },
]

const SPEC_AVATAR: Record<string, { bg: string; color: string }> = {
  BATSMAN:      { bg: "#E6F1FB", color: "#185FA5" },
  BOWLER:       { bg: "#FCEBEB", color: "#A32D2D" },
  ALLROUNDER:   { bg: "#EEEDFE", color: "#534AB7" },
  WICKETKEEPER: { bg: "#FAEEDA", color: "#854F0B" },
  UNKNOWN:      { bg: "#F1EFE8", color: "#5F5E5A" },
}

function normaliseSpecialism(raw?: string): string {
  const s = (raw ?? "").toUpperCase().replace(/[\s_-]/g, "")
  if (s.includes("ALLROUND") || s === "AR") return "ALLROUNDER"
  if (s.includes("WICKET")   || s === "WK") return "WICKETKEEPER"
  if (s.includes("BOWL")     || s === "BWL") return "BOWLER"
  if (s.includes("BAT"))                     return "BATSMAN"
  return "UNKNOWN"
}

function specLabel(sp: string) {
  if (sp === "WICKETKEEPER") return "WK"
  if (sp === "ALLROUNDER")   return "AR"
  if (sp === "BOWLER")       return "BWL"
  if (sp === "BATSMAN")      return "BAT"
  return "—"
}

const SPEC_PILL: Record<string, { bg: string; color: string }> = {
  BATSMAN:      { bg: "#E6F1FB", color: "#185FA5" },
  BOWLER:       { bg: "#FCEBEB", color: "#A32D2D" },
  ALLROUNDER:   { bg: "#EEEDFE", color: "#534AB7" },
  WICKETKEEPER: { bg: "#FAEEDA", color: "#854F0B" },
  UNKNOWN:      { bg: "#F1EFE8", color: "#5F5E5A" },
}

// ─── SQUAD DETAIL HOOK ────────────────────────────────────────────────────

function useSquadPreview(squadId: string) {
  return useQuery({
    queryKey: ["fantasySquad", squadId],
    queryFn: () => fantasyApi.squad(squadId),
    staleTime: 60000,
  })
}

// ─── SQUAD CARD ───────────────────────────────────────────────────────────

function SquadCard({
  entry,
  rank,
  pct,
  onClick,
}: {
  entry: FantasyLeaderboardEntry
  rank: number
  pct: number
  onClick: () => void
}) {
  const c = RANK_COLORS[rank % RANK_COLORS.length]
  const rankEmoji = rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : null

  const { data: squad } = useSquadPreview(entry.squadId)
  const players = squad?.players ?? []

  const star = [...players].sort((a, b) => b.totalPoints - a.totalPoints)[0]
  const starSp = star ? normaliseSpecialism(star.specialism) : null

  const topPlayers = [...players].sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 4)
  const extra = Math.max(0, players.length - 4)

  const rankChange = entry.rank <= 1 ? "up" : entry.rank === 2 ? "same" : "down"
  const rankDelta  = entry.rank <= 1 ? 2 : 0

  return (
    <div className="sq-card" style={{ "--accent": c.main } as React.CSSProperties} onClick={onClick}>
      {/* Accent bar */}
      <div style={{ height: 3, background: c.main, flexShrink: 0 }} />

      {/* Card body — explicit block layout, never flex-shrinks */}
      <div style={{ padding: "14px 16px 12px", minHeight: 0 }}>

        {/* Top row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {rankEmoji
                ? <span style={{ fontSize: 18, lineHeight: 1 }}>{rankEmoji}</span>
                : <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>#{entry.rank}</span>
              }
              {rankEmoji && (
                <span style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-secondary)" }}>
                  #{entry.rank}
                </span>
              )}
              {rankDelta > 0 && rankChange === "up" && (
                <span style={{ fontSize: 11, fontWeight: 500, background: "#EAF3DE", color: "#3B6D11", padding: "2px 7px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 2 }}>
                  ↑{rankDelta}
                </span>
              )}
              {rankChange === "same" && (
                <span style={{ fontSize: 11, fontWeight: 500, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", padding: "2px 7px", borderRadius: 99 }}>
                  — same
                </span>
              )}
              {rankChange === "down" && (
                <span style={{ fontSize: 11, fontWeight: 500, background: "#FCEBEB", color: "#A32D2D", padding: "2px 7px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 2 }}>
                  ↓1
                </span>
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "var(--color-text-primary)", marginTop: 6, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {entry.squadName}
            </div>
            {entry.participantName !== entry.squadName && (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {entry.participantName}
              </div>
            )}
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 28, fontWeight: 500, lineHeight: 1, color: c.main }}>{entry.totalPoints}</div>
            <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 2, letterSpacing: "0.5px" }}>POINTS</div>
          </div>
        </div>

        {/* Mid row: star player | avatars */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          {star && starSp ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 10, color: "var(--color-text-secondary)", flexShrink: 0 }}>Star</span>
              <span style={{
                fontSize: 9, fontWeight: 500, padding: "2px 7px", borderRadius: 99, flexShrink: 0,
                background: SPEC_PILL[starSp]?.bg ?? SPEC_PILL.UNKNOWN.bg,
                color: SPEC_PILL[starSp]?.color ?? SPEC_PILL.UNKNOWN.color,
              }}>
                {specLabel(starSp)}
              </span>
              <span style={{ fontSize: 12, color: "var(--color-text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {star.playerName}
              </span>
              <span style={{ fontSize: 11, fontWeight: 500, color: c.main, flexShrink: 0, marginLeft: "auto" }}>
                {star.totalPoints}pts
              </span>
            </div>
          ) : (
            <div style={{ flex: 1, fontSize: 12, color: "var(--color-text-secondary)", fontStyle: "italic" }}>
              {players.length === 0 ? "No players yet" : "—"}
            </div>
          )}

          {topPlayers.length > 0 && (
            <div style={{ display: "flex", flexShrink: 0 }}>
              {topPlayers.map((p, i) => {
                const sp = normaliseSpecialism(p.specialism)
                const av = SPEC_AVATAR[sp] ?? SPEC_AVATAR.UNKNOWN
                const initials = p.playerName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
                return (
                  <div key={p.playerId} style={{
                    width: 22, height: 22, borderRadius: "50%",
                    border: "1.5px solid var(--color-background-primary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, fontWeight: 500,
                    background: av.bg, color: av.color,
                    marginLeft: i === 0 ? 0 : -5,
                    flexShrink: 0, zIndex: topPlayers.length - i,
                    position: "relative",
                  }}>
                    {initials}
                  </div>
                )
              })}
              {extra > 0 && (
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  border: "1.5px solid var(--color-background-primary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 500, marginLeft: -5,
                  background: "var(--color-background-secondary)",
                  color: "var(--color-text-secondary)",
                  flexShrink: 0, position: "relative",
                }}>
                  +{extra}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Points bar */}
        <div style={{ height: 3, borderRadius: 99, background: "var(--color-background-secondary)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", borderRadius: 99, width: `${pct}%`, background: c.main, transition: "width 0.7s ease" }} />
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            {entry.matchesPlayed} matches played
          </span>
          <span className="sq-cta" style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
            View squad <span className="sq-arrow">›</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
  * { box-sizing: border-box; }

  /*
   * FIX: Desktop layout was collapsing card content because:
   *   1. fp-root had height:100vh + overflow:hidden — flex children had no
   *      guaranteed height and were being shrunk to zero on wide viewports.
   *   2. fp-body was flex with overflow-y:auto but cards inside had no
   *      min-height, so flex shrink crushed them to just the 3px accent bar.
   *
   * Solution: remove overflow:hidden from fp-root, let the page scroll
   * naturally at the root level, and constrain overflow only on fp-body.
   * Cards now always render their full content on every viewport.
   */

  .fp-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--color-background-tertiary, #f5f3ef);
    font-family: 'DM Sans', system-ui, sans-serif;
    /* REMOVED: height: 100vh and overflow: hidden — these were the culprits */
  }

  .fp-header {
    position: sticky;
    top: 0;
    z-index: 10;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    height: 56px;
    background: var(--color-background-primary);
    border-bottom: 0.5px solid var(--color-border-tertiary);
    gap: 12px;
  }

  .fp-header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }

  .fp-icon {
    width: 32px; height: 32px; border-radius: 10px;
    background: #E1F5EE; display: flex; align-items: center;
    justify-content: center; font-size: 16px; flex-shrink: 0;
  }

  .fp-title { font-size: 15px; font-weight: 500; color: var(--color-text-primary); letter-spacing: -0.2px; }
  .fp-subtitle { font-size: 11px; color: var(--color-text-secondary); }

  .fp-badge {
    display: flex; align-items: center; gap: 5px; padding: 3px 9px;
    border-radius: 99px; background: #E1F5EE;
    border: 0.5px solid #9FE1CB;
    font-size: 10px; font-weight: 500; color: #0F6E56; flex-shrink: 0;
  }
  .fp-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: #1D9E75; animation: fpPulse 2s infinite; }
  @keyframes fpPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

  .fp-back-btn {
    display: flex; align-items: center; gap: 5px; padding: 6px 12px;
    border-radius: 8px; border: 0.5px solid var(--color-border-secondary);
    background: var(--color-background-primary);
    color: var(--color-text-secondary); font-size: 12px; font-weight: 500;
    cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif;
    white-space: nowrap; flex-shrink: 0;
  }
  .fp-back-btn:hover { background: var(--color-background-secondary); color: var(--color-text-primary); }

  /* FIX: fp-body no longer needs to fill remaining viewport height via flex.
     It just flows naturally. The page itself scrolls. */
  .fp-body {
    flex: 1;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Custom scrollbar styles kept for browsers that show them on body */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: var(--color-border-secondary); border-radius: 99px; }

  .fp-list-header { padding: 2px 2px 6px; flex-shrink: 0; }
  .fp-section-label { font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: 1px; color: var(--color-text-secondary); margin-bottom: 2px; }
  .fp-list-title { font-size: 18px; font-weight: 500; color: var(--color-text-primary); letter-spacing: -0.4px; }

  /* Squad card — min-height ensures content is never crushed by flex parent */
  .sq-card {
    background: var(--color-background-primary);
    border: 0.5px solid var(--color-border-tertiary);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    flex-shrink: 0; /* ADDED: never let the card compress vertically */
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  }
  .sq-card:hover {
    transform: translateY(-2px);
    border-color: var(--color-border-secondary);
    box-shadow: 0 6px 20px rgba(0,0,0,0.08);
  }
  .sq-arrow { display: inline-block; transition: transform 0.18s ease; font-size: 14px; }
  .sq-card:hover .sq-arrow { transform: translateX(3px); }

  /* Loading */
  .fp-loading { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; padding: 32px; }
  .fp-loading-spin { font-size: 28px; animation: fpSpin 2s linear infinite; }
  @keyframes fpSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .fp-loading-text { font-size: 12px; color: var(--color-text-secondary); }

  /* Desktop: full-width body with generous horizontal padding, cards stretch edge-to-edge */
  @media (min-width: 641px) {
    .fp-body {
      padding: 16px 24px;
    }
  }

  /* Mobile: unchanged behaviour */
  @media (max-width: 640px) {
    .fp-header { padding: 0 14px; height: 50px; }
    .fp-subtitle, .fp-badge { display: none; }
    .fp-body { padding: 10px 12px; }
  }
`

function FantasyPage() {
  const { auctionId } = useParams({ from: "/auction/$auctionId/fantasy" })
  const navigate = useNavigate()

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
            <div className="fp-badge"><span className="fp-badge-dot" /> IPL 2026</div>
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
            <div className="fp-loading">
              <div className="fp-loading-spin">🏆</div>
              <div className="fp-loading-text">Loading leaderboard…</div>
            </div>
          ) : (leaderboard?.entries.length ?? 0) === 0 ? (
            <div className="fp-loading" style={{ opacity: 0.5 }}>
              <div style={{ fontSize: 36 }}>🏏</div>
              <div className="fp-loading-text">No fantasy data yet</div>
            </div>
          ) : (
            leaderboard!.entries.map((entry, i) => (
              <SquadCard
                key={entry.squadId}
                entry={entry}
                rank={i}
                pct={(entry.totalPoints / maxPoints) * 100}
                onClick={() => navigate({
                  to: "/auction/$auctionId/fantasy/$squadId",
                  params: { auctionId, squadId: entry.squadId },
                  search: { filter: "ALL", sort: "pts", expanded: "", playerId: "" },
                })}
              />
            ))
          )}
        </div>

      </div>
    </>
  )
}