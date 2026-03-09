/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { usePlayers } from "@/hooks/usePlayers"

export const Route = createFileRoute("/auction/players")({
  validateSearch: z.object({
    page: z.number().catch(1),
    search: z.string().catch(""),
  }),
  component: PlayersPoolPage,
})

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Plus+Jakarta+Sans:wght@600;700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
  :root {
    --cream:         #faf8f4;
    --parchment:     #f3efe6;
    --parchment-mid: #ede8dc;
    --border:        #e8e0d0;
    --border-dark:   #d5c9b5;
    --ink:           #1a1410;
    --ink-muted:     #6b5e4e;
    --ink-faint:     #a89880;
    --green:         #2d7a4f;
    --green-light:   #edf7f1;
    --green-border:  #b8dfc9;
    --amber:         #b06b00;
    --amber-light:   #fef8ed;
    --amber-border:  #f0d88a;
    --sky:           #1a5fa8;
    --sky-light:     #eff5fd;
    --sky-border:    #b8d0ee;
    --rose:          #c0392b;
    --rose-light:    #fdf2f0;
    --rose-border:   #f5c4b8;
  }
  .pp-root {
    background-color: var(--cream);
    background-image:
      radial-gradient(ellipse at 90% 0%, #e8f4ef 0%, transparent 50%),
      radial-gradient(ellipse at 0% 100%, #f0ece3 0%, transparent 45%);
    min-height: 100vh;
    font-family: 'DM Sans', system-ui, sans-serif;
    color: var(--ink);
    box-sizing: border-box;
  }

  /* ══════════════════════════════════════════
     NAV
  ══════════════════════════════════════════ */
  .pp-nav {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 32px; height: 60px;
    background: rgba(250,248,244,0.88);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 0 rgba(255,255,255,0.8), 0 2px 12px rgba(0,0,0,0.04);
  }
  .pp-nav-brand { display: flex; align-items: center; gap: 10px; }
  .pp-nav-icon {
    width: 34px; height: 34px;
    background: linear-gradient(135deg, #2d7a4f, #3da066);
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 8px rgba(45,122,79,0.3);
    flex-shrink: 0;
  }
  .pp-nav-title {
    font-family: 'Playfair Display', serif;
    font-size: 17px; font-weight: 900; color: var(--ink); letter-spacing: -0.3px;
  }
  .pp-nav-sub { font-size: 11px; color: var(--ink-faint); margin-top: 1px; }
  .btn-back {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; background: white;
    border: 1px solid var(--border); border-radius: 9px;
    font-size: 12px; font-weight: 700; color: var(--ink-muted);
    cursor: pointer; transition: all 0.15s;
    font-family: 'DM Sans', sans-serif;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    white-space: nowrap; flex-shrink: 0;
  }
  .btn-back:hover { border-color: var(--border-dark); color: var(--ink); transform: translateY(-1px); }

  /* ══════════════════════════════════════════
     BODY
  ══════════════════════════════════════════ */
  .pp-body { padding: 32px 32px 64px; }

  /* ══════════════════════════════════════════
     PAGE HEADER
  ══════════════════════════════════════════ */
  .pp-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: 24px; flex-wrap: nowrap; gap: 12px;
  }
  .pp-eyebrow {
    font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;
    color: var(--green); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
  }
  .pp-eyebrow::before {
    content: ''; display: block; width: 18px; height: 2px;
    background: var(--green); border-radius: 2px;
  }
  .pp-title {
    font-family: 'Playfair Display', serif;
    font-size: 28px; font-weight: 900; color: var(--ink);
    margin: 0 0 4px; letter-spacing: -0.5px; line-height: 1.1;
  }
.pp-sub { font-size: 13px; color: var(--ink-faint); margin: 0; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.pp-header > div:first-child { min-width: 0; }
  /* ══════════════════════════════════════════
     STAT PILLS
  ══════════════════════════════════════════ */
  .pp-stats { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
  .pp-stat-pill {
    display: flex; align-items: center; gap: 8px;
    background: white; border: 1px solid var(--border);
    border-radius: 10px; padding: 8px 14px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  }
  .pp-stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .pp-stat-label { font-size: 11px; font-weight: 600; color: var(--ink-faint); }
  .pp-stat-value {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px; font-weight: 800; letter-spacing: -0.3px;
  }

  /* ══════════════════════════════════════════
     TOOLBAR
  ══════════════════════════════════════════ */
  .pp-toolbar {
    display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
    background: white; border: 1px solid var(--border);
    border-radius: 12px; padding: 12px 16px; margin-bottom: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .pp-toolbar-search { flex: 1; min-width: 160px; }
  .pp-toolbar-search input, .pp-search-input {
    height: 36px;
    background: var(--parchment) !important;
    border-color: var(--border) !important;
    color: var(--ink) !important;
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    border-radius: 8px !important;
  }
  .pp-toolbar-search input:focus, .pp-search-input:focus {
    border-color: var(--green) !important;
    box-shadow: 0 0 0 3px rgba(45,122,79,0.1) !important;
    background: white !important;
  }
  .pp-toolbar-search input::placeholder, .pp-search-input::placeholder { color: var(--ink-faint); }

  /* ══════════════════════════════════════════
     TABLE SHELL
  ══════════════════════════════════════════ */
  .pp-table-shell {
    background: white; border: 1px solid var(--border);
    border-radius: 14px; overflow: hidden; margin-bottom: 20px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  }
  .pp-table-shell thead { background: var(--parchment); }
  .pp-table-shell thead tr { border-bottom: 1px solid var(--border) !important; }
  .pp-table-shell thead th {
    font-size: 10px !important; font-weight: 800 !important;
    text-transform: uppercase !important; letter-spacing: 0.8px !important;
    color: var(--ink-faint) !important; padding: 11px 20px !important;
    background: var(--parchment) !important; white-space: nowrap; border: none !important;
  }
  .pp-table-shell tbody tr { border-bottom: 1px solid #f0ebe0 !important; transition: background 0.12s; }
  .pp-table-shell tbody tr:last-child { border-bottom: none !important; }
  .pp-table-shell tbody tr:hover { background: var(--parchment) !important; }
  .pp-table-shell tbody td {
    padding: 13px 20px !important; border: none !important;
    font-size: 13px; color: var(--ink-muted); vertical-align: middle;
  }
  .pp-cell-name { font-weight: 700 !important; color: var(--ink) !important; font-size: 13px !important; }
  .pp-cell-country { color: var(--ink-faint) !important; font-size: 13px !important; font-weight: 500 !important; }
  .pp-cell-price {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 13px !important; font-weight: 800 !important;
    color: var(--green) !important; text-align: right !important;
    letter-spacing: -0.2px !important; font-variant-numeric: tabular-nums;
  }

  /* ── Role badge ── */
  .pp-badge-role {
    background: var(--parchment-mid) !important; border: 1px solid var(--border) !important;
    color: var(--ink-muted) !important; font-size: 10px !important; font-weight: 700 !important;
    letter-spacing: 0.4px !important; padding: 2px 8px !important; border-radius: 6px !important;
    text-transform: uppercase; font-family: 'DM Sans', sans-serif;
  }
  /* ── Status badges ── */
  .pp-badge-sold {
    background: var(--green-light) !important; border: 1px solid var(--green-border) !important;
    color: var(--green) !important; font-size: 10px !important; font-weight: 800 !important;
    letter-spacing: 0.5px !important; padding: 2px 8px !important; border-radius: 6px !important;
    text-transform: uppercase; font-family: 'DM Sans', sans-serif;
  }
  .pp-badge-available {
    background: var(--parchment-mid) !important; border: 1px solid var(--border) !important;
    color: var(--ink-faint) !important; font-size: 10px !important; font-weight: 700 !important;
    letter-spacing: 0.5px !important; padding: 2px 8px !important; border-radius: 6px !important;
    text-transform: uppercase; font-family: 'DM Sans', sans-serif;
  }

  /* ── Skeleton ── */
  .pp-skel {
    border-radius: 5px;
    background: linear-gradient(90deg, var(--parchment) 25%, var(--border) 50%, var(--parchment) 75%);
    background-size: 400% 100%; animation: pp-shimmer 1.6s ease infinite;
  }
  @keyframes pp-shimmer {
    0%   { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }

  /* ── Empty state ── */
  .pp-empty-inner {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 64px 20px; color: var(--ink-faint); gap: 10px;
  }
  .pp-empty-icon { font-size: 36px; opacity: 0.35; }
  .pp-empty-text { font-size: 14px; font-weight: 600; color: var(--ink-faint); }
  .pp-empty-hint { font-size: 12px; color: var(--ink-faint); opacity: 0.7; }

  /* ── Pagination ── */
  .pp-pager { display: flex; justify-content: center; align-items: center; gap: 12px; }
  .pp-pager-btn {
    height: 36px; padding: 0 18px; border-radius: 9px;
    font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif;
    border: 1px solid var(--border); background: white; color: var(--ink-muted);
    cursor: pointer; transition: all 0.15s; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  }
  .pp-pager-btn:hover:not(:disabled) {
    border-color: var(--green); color: var(--green); background: var(--green-light);
    transform: translateY(-1px); box-shadow: 0 3px 10px rgba(45,122,79,0.15);
  }
  .pp-pager-btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }
  .pp-pager-label {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13px; font-weight: 700; color: var(--ink-muted);
    min-width: 72px; text-align: center;
  }
  .pp-pager-label strong { color: var(--ink); font-weight: 900; }
  .pp-cell-num {
    color: var(--ink-faint) !important;
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 11px !important; font-weight: 700 !important;
    width: 40px; text-align: center !important;
  }

  /* ══════════════════════════════════════════
     MOBILE  ≤ 600px
  ══════════════════════════════════════════ */
  @media (max-width: 600px) {
    /* Nav */
    .pp-nav { padding: 0 14px !important; height: 52px !important; }
    .pp-nav-icon { width: 30px !important; height: 30px !important; font-size: 14px !important; }
    .pp-nav-title { font-size: 14px !important; }
    .pp-nav-sub { display: none !important; }

    /* Body */
    .pp-body { padding: 16px 12px 48px !important; }

    /* Header */
    .pp-header { margin-bottom: 14px !important; gap: 8px !important; flex-wrap: nowrap !important; align-items: flex-start !important; }
    .pp-title { font-size: 20px !important; }
    .pp-sub { font-size: 12px !important; }
    .pp-eyebrow { font-size: 9px !important; margin-bottom: 4px !important; }
    .pp-stat-pill { padding: 6px 10px !important; gap: 6px !important; }
    .pp-stat-label { font-size: 10px !important; }
    .pp-stat-value { font-size: 12px !important; }

    /* Toolbar */
    .pp-toolbar { padding: 10px 12px !important; gap: 8px !important; margin-bottom: 12px !important; }
    .pp-toolbar-search { min-width: 0 !important; flex: 1 !important; max-width: 100% !important; }
    .pp-toolbar-perpage { display: none !important; }

    /* Table shell */
    .pp-table-shell { border-radius: 10px !important; }
    .pp-table-shell thead th { padding: 9px 10px !important; font-size: 9px !important; }
    .pp-table-shell tbody td { padding: 10px 10px !important; }

    /* Hide Country, Role, Status columns on mobile */
    .pp-col-country,
    .pp-col-role,
    .pp-col-status { display: none !important; }

    /* Name cell */
    .pp-cell-name { font-size: 12px !important; }
    .pp-mobile-sub {
      display: flex !important;
      align-items: center;
      gap: 5px;
      margin-top: 2px;
    }
    .pp-mobile-role-dot {
      display: inline-block !important;
      width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
    }
    .pp-mobile-country-text {
      display: inline !important;
      font-size: 11px;
      color: var(--ink-faint);
      font-weight: 500;
    }
    .pp-mobile-sold-chip {
      display: inline-flex !important;
      align-items: center;
      font-size: 9px; font-weight: 800; letter-spacing: 0.4px;
      padding: 1px 6px; border-radius: 4px;
      background: var(--green-light); border: 1px solid var(--green-border);
      color: var(--green); text-transform: uppercase;
    }

    /* Price cell */
    .pp-cell-price { font-size: 12px !important; }

    /* # cell */
    .pp-cell-num { width: 28px !important; font-size: 10px !important; padding: 10px 6px !important; }

    /* Pagination */
    .pp-pager-btn { height: 32px !important; padding: 0 12px !important; font-size: 12px !important; }
    .pp-pager-label { font-size: 12px !important; min-width: 56px !important; }
  }

  /* ══════════════════════════════════════════
     TABLET  601–900px
  ══════════════════════════════════════════ */
  @media (min-width: 601px) and (max-width: 900px) {
    .pp-nav { padding: 0 20px !important; }
    .pp-body { padding: 20px 20px 48px !important; }
    .pp-title { font-size: 22px !important; }
    .pp-table-shell thead th { padding: 10px 14px !important; }
    .pp-table-shell tbody td { padding: 11px 14px !important; }
  }

  /* ── Desktop: hide mobile-only sub-line elements ── */
  .pp-mobile-sub       { display: none; }
  .pp-mobile-role-dot  { display: none; }
  .pp-mobile-country-text { display: none; }
  .pp-mobile-sold-chip { display: none; }
`

const ROLE_COLORS: Record<string, string> = {
  BATSMAN: "#38bdf8",
  BOWLER: "#fb7185",
  ALLROUNDER: "#a78bfa",
  WICKETKEEPER: "#fbbf24",
}

function roleColor(specialism?: string) {
  const s = (specialism ?? "").toUpperCase().replace(/[\s_-]/g, "")
  if (s.includes("ALLROUND") || s === "AR") return ROLE_COLORS.ALLROUNDER
  if (s.includes("WICKET") || s === "WK") return ROLE_COLORS.WICKETKEEPER
  if (s.includes("BOWL") || s === "BWL") return ROLE_COLORS.BOWLER
  if (s.includes("BAT")) return ROLE_COLORS.BATSMAN
  return "#94a3b8"
}

function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(0)}L`
  return `₹${amount.toLocaleString()}`
}

function PlayersPoolPage() {
  const { page, search } = Route.useSearch()
  const navigate = Route.useNavigate()
  const globalNavigate = useNavigate()
  const size = 10

  const { data: allPlayers, isLoading } = usePlayers(search ? { search } : {})

  const filtered = allPlayers ?? []
  const startRow = (page - 1) * size + 1
  const paginated = filtered.slice((page - 1) * size, page * size)
  const totalShown = paginated.length

  return (
    <div className="pp-root">
      <style>{styles}</style>

      {/* ── NAV ── */}
      <nav className="pp-nav">
        <div className="pp-nav-brand">
          <div className="pp-nav-icon">🏏</div>
          <div>
            <div className="pp-nav-title">BidXI</div>
            <div className="pp-nav-sub">Fantasy Cricket Auction</div>
          </div>
        </div>
        <button className="btn-back" onClick={() => globalNavigate({ to: "/auction" })}>
          ← Back to Lobby
        </button>
      </nav>

      {/* ── Body ── */}
      <div className="pp-body">

        {/* ── Page Header ── */}
        <div className="pp-header">
          <div>
            <div className="pp-eyebrow">Players Pool</div>
            <h1 className="pp-title">Players Pool</h1>
            <p className="pp-sub">Browse and track all auction players</p>
          </div>
          <div className="pp-stats">
            <div className="pp-stat-pill">
              <span className="pp-stat-dot" style={{ background: "var(--amber)" }} />
              <span className="pp-stat-label">Showing</span>
              <span className="pp-stat-value" style={{ color: "var(--ink)" }}>{totalShown}</span>
            </div>
            <div className="pp-stat-pill">
              <span className="pp-stat-dot" style={{ background: "var(--green)" }} />
              <span className="pp-stat-label">Page</span>
              <span className="pp-stat-value" style={{ color: "var(--green)" }}>{page}</span>
            </div>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="pp-toolbar">
          <div className="pp-toolbar-search">
            <Input
              placeholder="Search players…"
              value={search}
              onChange={(e) =>
                navigate({ search: (prev) => ({ ...prev, search: e.target.value, page: 1 }) })
              }
              className="pp-search-input"
            />
          </div>
          <div style={{ flex: 1 }} />
          <span className="pp-toolbar-perpage" style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600 }}>
            {size} per page
          </span>
        </div>

        {/* ── Table ── */}
        <div className="pp-table-shell">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 48, textAlign: "center" }}>#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="pp-col-country">Country</TableHead>
                <TableHead className="pp-col-role">Role</TableHead>
                <TableHead style={{ textAlign: "right" }}>Base Price</TableHead>
                <TableHead className="pp-col-status">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>

              {/* Skeleton rows */}
              {isLoading && Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pp-cell-num">
                    <div className="pp-skel" style={{ height: 12, width: 20, margin: "0 auto" }} />
                  </TableCell>
                  <TableCell>
                    <div className="pp-skel" style={{ height: 13, width: 160 }} />
                  </TableCell>
                  <TableCell className="pp-col-country">
                    <div className="pp-skel" style={{ height: 13, width: 90 }} />
                  </TableCell>
                  <TableCell className="pp-col-role">
                    <div className="pp-skel" style={{ height: 22, width: 90, borderRadius: 6 }} />
                  </TableCell>
                  <TableCell style={{ textAlign: "right" }}>
                    <div className="pp-skel" style={{ height: 13, width: 70, marginLeft: "auto" }} />
                  </TableCell>
                  <TableCell className="pp-col-status">
                    <div className="pp-skel" style={{ height: 22, width: 80, borderRadius: 6 }} />
                  </TableCell>
                </TableRow>
              ))}

              {/* Data rows */}
              {!isLoading && paginated.map((player: any, i: number) => (
                <TableRow key={player.id}>
                  <TableCell className="pp-cell-num">{startRow + i}</TableCell>

                  <TableCell className="pp-cell-name">
                    {player.name}
                    <div className="pp-mobile-sub">
                      <span
                        className="pp-mobile-role-dot"
                        style={{ background: roleColor(player.specialism) }}
                      />
                      {player.country && (
                        <span className="pp-mobile-country-text">{player.country}</span>
                      )}
                      {player.isSold && (
                        <span className="pp-mobile-sold-chip">Sold</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="pp-col-country pp-cell-country">
                    {player.country ?? "—"}
                  </TableCell>
                  <TableCell className="pp-col-role">
                    <Badge className="pp-badge-role">{player.specialism ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="pp-cell-price">
                    {fmt(Number(player.basePrice))}
                  </TableCell>
                  <TableCell className="pp-col-status">
                    {player.isSold
                      ? <Badge className="pp-badge-sold">Sold</Badge>
                      : <Badge className="pp-badge-available">Available</Badge>
                    }
                  </TableCell>
                </TableRow>
              ))}

              {/* Empty state */}
              {!isLoading && paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} style={{ padding: 0 }}>
                    <div className="pp-empty-inner">
                      <span className="pp-empty-icon">🏏</span>
                      <span className="pp-empty-text">No players found</span>
                      <span className="pp-empty-hint">
                        {search
                          ? `No results for "${search}" — try a different name`
                          : "No players match the current filter"}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}

            </TableBody>
          </Table>
        </div>

        {/* ── Pagination ── */}
        <div className="pp-pager">
          <button
            className="pp-pager-btn"
            disabled={page === 1}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })
            }
          >
            ← Previous
          </button>
          <span className="pp-pager-label">Page <strong>{page}</strong></span>
          <button
            className="pp-pager-btn"
            disabled={page * size >= filtered.length}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
            }
          >
            Next →
          </button>
        </div>

      </div>
    </div>
  )
}