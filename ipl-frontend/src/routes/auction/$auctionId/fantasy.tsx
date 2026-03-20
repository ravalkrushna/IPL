/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useParams, useNavigate, Outlet, useChildMatches } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { auctionApi } from "@/lib/auctionApi"
import { fantasyApi } from "@/lib/fantasyApi"

export const Route = createFileRoute("/auction/$auctionId/fantasy")({
  component: FantasyLayout,
})

// ── Layout wrapper: shows leaderboard OR child (squad detail) ─────────────
function FantasyLayout() {
  const matches = useChildMatches()
  const hasChild = matches.length > 0
  if (hasChild) return <Outlet />
  return <FantasyPage />
}

function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`
  return `₹${amount.toLocaleString()}`
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

  /* ── BODY ── */
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
  .fp-entry:hover { border-color: #d6cfc4; box-shadow: 0 4px 12px rgba(0,0,0,0.08); background: #fdfcfb; }
  .fp-entry-bar { height: 3px; width: 100%; }
  .fp-entry-main { display: flex; align-items: center; gap: 12px; padding: 14px 16px 10px; }
  .fp-rank { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #c8bfb4; width: 22px; text-align: center; flex-shrink: 0; }
  .fp-rank.r1 { color: #f59e0b; font-size: 15px; }
  .fp-rank.r2 { color: #94a3b8; font-size: 14px; }
  .fp-rank.r3 { color: #b45309; font-size: 13px; }
  .fp-entry-info { flex: 1; min-width: 0; }
  .fp-entry-squad { font-size: 15px; font-weight: 800; color: #1c1917; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fp-entry-participant { font-size: 11px; color: #a8a29e; font-weight: 500; margin-top: 2px; }
  .fp-entry-pts { text-align: right; flex-shrink: 0; }
  .fp-pts-val { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; line-height: 1; }
  .fp-pts-label { font-size: 9px; color: #a8a29e; font-weight: 600; letter-spacing: 0.5px; margin-top: 2px; }
  .fp-entry-arrow { font-size: 14px; color: #d6cfc4; margin-left: 10px; flex-shrink: 0; }

  /* Points bar + footer */
  .fp-pts-bar-wrap { padding: 0 16px 6px; }
  .fp-pts-bar-bg { height: 3px; border-radius: 99px; background: #f0ebe3; overflow: hidden; }
  .fp-pts-bar-fill { height: 100%; border-radius: 99px; transition: width 0.7s ease; }
  .fp-entry-footer { display: flex; align-items: center; justify-content: space-between; padding: 0 16px 12px; }
  .fp-entry-matches { font-size: 10px; color: #c8bfb4; }
  .fp-entry-cta { font-size: 10px; font-weight: 700; color: #a8a29e; display: flex; align-items: center; gap: 3px; }

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
              const rankEmoji = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${entry.rank}`
              const rankClass = i === 0 ? "r1" : i === 1 ? "r2" : i === 2 ? "r3" : ""
              const pct = (entry.totalPoints / maxPoints) * 100

              return (
                <div
                  key={entry.squadId}
                  className="fp-entry"
                  onClick={() => navigate({
                    to: "/auction/$auctionId/fantasy/$squadId",
                    params: { auctionId, squadId: entry.squadId },
                  })}
                >
                  <div className="fp-entry-bar" style={{ background: color }} />
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
                    <span className="fp-entry-arrow">›</span>
                  </div>
                  <div className="fp-pts-bar-wrap">
                    <div className="fp-pts-bar-bg">
                      <div className="fp-pts-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                  <div className="fp-entry-footer">
                    <span className="fp-entry-matches">{entry.matchesPlayed} matches played</span>
                    <span className="fp-entry-cta">View squad ›</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}