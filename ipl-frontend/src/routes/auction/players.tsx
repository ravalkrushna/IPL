/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { usePlayers } from "@/hooks/usePlayers"

export const Route = createFileRoute("/auction/players")({
  validateSearch: z.object({
    page: z.number().catch(1),
    search: z.string().catch(""),
    sold: z.boolean().optional(),
  }),
  component: PlayersPoolPage,
})

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');

  .pp {
    --bg:          #181f2e;
    --surface:     #1e2640;
    --surface-hi:  #252e4a;
    --border:      #2c3858;
    --border-soft: #222a44;
    --text:        #dde4f5;
    --muted:       #68738f;
    --accent:      #f5a623;
    --accent-glow: rgba(245,166,35,0.20);
    --accent-dim:  rgba(245,166,35,0.09);
    --green:       #4ade80;
    --green-dim:   rgba(74,222,128,0.09);
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 36px 28px 60px;
    max-width: 1400px;
    margin: 0 auto;
    box-sizing: border-box;
  }

  /* ─── Header ─── */
  .pp-title {
    font-family: 'Syne', sans-serif;
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: var(--text);
    margin: 0 0 4px;
  }
  .pp-sub {
    font-size: 0.8rem;
    color: var(--muted);
    margin: 0 0 24px;
    letter-spacing: 0.02em;
  }

  /* ─── Toolbar ─── */
  .pp-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 16px;
    margin-bottom: 18px;
  }
  .pp-input {
    height: 36px;
    max-width: 230px;
    background: var(--surface-hi);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 0.845rem;
    font-family: 'DM Sans', sans-serif;
    border-radius: 7px;
    padding: 0 12px;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
    box-sizing: border-box;
  }
  .pp-input::placeholder { color: var(--muted); }
  .pp-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  .pp-sep { width: 1px; height: 22px; background: var(--border); }
  .pp-filters { display: flex; gap: 7px; }
  .pp-fbtn {
    height: 30px;
    padding: 0 13px;
    border-radius: 6px;
    font-size: 0.73rem;
    font-family: 'DM Mono', monospace;
    font-weight: 500;
    letter-spacing: 0.06em;
    border: 1px solid var(--border);
    background: var(--surface-hi);
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .pp-fbtn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
  .pp-fbtn.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #1a1200;
    font-weight: 700;
    box-shadow: 0 1px 10px var(--accent-glow);
  }

  /* ─── Table shell ─── */
  .pp-tshell {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 22px;
  }

  /* ─── Table Header ─── */
  .pp-tshell thead tr {
    background: var(--surface-hi) !important;
    border-bottom: 1px solid var(--border) !important;
  }
  .pp-tshell thead th {
    font-family: 'DM Mono', monospace !important;
    font-size: 0.66rem !important;
    font-weight: 500 !important;
    letter-spacing: 0.13em !important;
    text-transform: uppercase !important;
    color: var(--muted) !important;
    padding: 11px 16px !important;
    border: none !important;
    white-space: nowrap;
  }

  /* ─── Table Body ─── */
  .pp-tshell tbody tr {
    border-bottom: 1px solid var(--border-soft) !important;
    transition: background 0.12s;
  }
  .pp-tshell tbody tr:last-child { border-bottom: none !important; }
  .pp-tshell tbody tr.pp-even { background: var(--surface); }
  .pp-tshell tbody tr.pp-odd  { background: rgba(37,46,74,0.50); }
  .pp-tshell tbody tr:hover   { background: var(--accent-dim) !important; }

  .pp-tshell tbody td {
    padding: 13px 16px !important;
    border: none !important;
    font-size: 0.87rem;
    color: var(--text);
    vertical-align: middle;
  }

  /* ─── Cell styles ─── */
  .pp-cell-name   { font-weight: 600; letter-spacing: 0.01em; }
  .pp-cell-cntry  { color: var(--muted); font-size: 0.84rem; }
  .pp-cell-price  {
    text-align: right !important;
    font-family: 'DM Mono', monospace;
    font-size: 0.83rem;
    color: var(--accent);
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  /* ─── Badges ─── */
  .pp-badge {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 5px;
    font-family: 'DM Mono', monospace;
    font-size: 0.67rem;
    font-weight: 500;
    letter-spacing: 0.07em;
  }
  .pp-role {
    background: var(--surface-hi);
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .pp-avail {
    background: var(--accent-dim);
    border: 1px solid rgba(245,166,35,0.28);
    color: var(--accent);
    font-weight: 700;
  }
  .pp-sold {
    background: var(--green-dim);
    border: 1px solid rgba(74,222,128,0.25);
    color: var(--green);
    font-weight: 700;
  }

  /* ─── Skeleton ─── */
  .pp-skel {
    border-radius: 4px;
    background: linear-gradient(90deg, var(--surface-hi) 25%, var(--border) 50%, var(--surface-hi) 75%);
    background-size: 400% 100%;
    animation: pp-shimmer 1.5s ease infinite;
  }
  @keyframes pp-shimmer {
    0%   { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }

  /* ─── Empty ─── */
  .pp-empty-cell { padding: 0 !important; }
  .pp-empty-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    color: var(--muted);
    font-size: 0.875rem;
    gap: 8px;
  }
  .pp-empty-inner span:first-child { font-size: 2rem; opacity: 0.3; }

  /* ─── Pagination ─── */
  .pp-pager {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 14px;
  }
  .pp-pbtn {
    height: 33px;
    padding: 0 18px;
    border-radius: 7px;
    font-size: 0.77rem;
    font-family: 'DM Mono', monospace;
    font-weight: 500;
    letter-spacing: 0.04em;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
    transition: all 0.15s;
  }
  .pp-pbtn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
  .pp-pbtn:disabled { opacity: 0.28; cursor: not-allowed; }
  .pp-plabel {
    font-family: 'DM Mono', monospace;
    font-size: 0.77rem;
    color: var(--muted);
    letter-spacing: 0.04em;
    min-width: 64px;
    text-align: center;
  }
  .pp-plabel b { color: var(--text); font-weight: 600; }
`

function PlayersPoolPage() {
  const { page, search, sold } = Route.useSearch()
  const navigate = Route.useNavigate()
  const size = 15

  const { data: players, isLoading } = usePlayers({ search, isSold: sold, page, size })

  const filterOptions = [
    { label: "All",    val: undefined as boolean | undefined },
    { label: "Unsold", val: false as boolean | undefined },
    { label: "Sold",   val: true  as boolean | undefined },
  ]

  return (
    <div className="pp">
      <style>{styles}</style>

      {/* ── Header ── */}
      <h1 className="pp-title">Players Pool</h1>
      <p className="pp-sub">Browse and filter auction players</p>

      {/* ── Toolbar ── */}
      <div className="pp-toolbar">
        <input
          className="pp-input"
          placeholder="Search players..."
          value={search}
          onChange={(e) =>
            navigate({ search: (prev) => ({ ...prev, search: e.target.value, page: 1 }) })
          }
        />
        <div className="pp-sep" />
        <div className="pp-filters">
          {filterOptions.map(({ label, val }) => (
            <button
              key={label}
              className={`pp-fbtn ${sold === val ? "on" : ""}`}
              onClick={() =>
                navigate({ search: (prev) => ({ ...prev, sold: val, page: 1 }) })
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="pp-tshell">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Role</TableHead>
              <TableHead style={{ textAlign: "right" }}>Base Price</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>

            {/* Skeleton rows */}
            {isLoading &&
              Array.from({ length: size }).map((_, i) => (
                <TableRow key={i} className={i % 2 === 0 ? "pp-even" : "pp-odd"}>
                  <TableCell><div className="pp-skel" style={{ height: 13, width: 150 }} /></TableCell>
                  <TableCell><div className="pp-skel" style={{ height: 13, width: 90 }} /></TableCell>
                  <TableCell><div className="pp-skel" style={{ height: 22, width: 100 }} /></TableCell>
                  <TableCell style={{ textAlign: "right" }}>
                    <div className="pp-skel" style={{ height: 13, width: 72, marginLeft: "auto" }} />
                  </TableCell>
                  <TableCell><div className="pp-skel" style={{ height: 22, width: 82 }} /></TableCell>
                </TableRow>
              ))}

            {/* Data rows */}
            {!isLoading && players?.length
              ? players.map((player: any, i: number) => (
                <TableRow key={player.id} className={i % 2 === 0 ? "pp-even" : "pp-odd"}>
                  <TableCell className="pp-cell-name">{player.name}</TableCell>
                  <TableCell className="pp-cell-cntry">{player.country}</TableCell>
                  <TableCell>
                    <span className="pp-badge pp-role">{player.specialism}</span>
                  </TableCell>
                  <TableCell className="pp-cell-price">
                    ₹ {Number(player.basePrice).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {player.isSold
                      ? <span className="pp-badge pp-sold">SOLD</span>
                      : <span className="pp-badge pp-avail">AVAILABLE</span>
                    }
                  </TableCell>
                </TableRow>
              ))
              : null}

            {/* Empty state */}
            {!isLoading && !players?.length && (
              <TableRow>
                <TableCell colSpan={5} className="pp-empty-cell">
                  <div className="pp-empty-inner">
                    <span>🏏</span>
                    <span>No players found</span>
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
          className="pp-pbtn"
          disabled={page === 1}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })
          }
        >
          ← Prev
        </button>
        <span className="pp-plabel">Page <b>{page}</b></span>
        <button
          className="pp-pbtn"
          disabled={!players || players.length < size}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
          }
        >
          Next →
        </button>
      </div>
    </div>
  )
}