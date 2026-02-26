/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import { useMutation, useQueryClient } from "@tanstack/react-query"

import { useUpdateAuctionStatus } from "@/hooks/useUpdateAuctionStatus"
import { useActiveAuction } from "@/hooks/useActiveAuction"
import { useCreateAuction } from "@/hooks/useCreateAuction"
import { useSoldPlayers, useUnsoldPlayers } from "@/hooks/useDashboard"
import { useWallet } from "@/hooks/useWallet"
import { useWalletLeaderboard } from "@/hooks/useWalletLeaderboard"

import { authApi } from "@/lib/auth"
import { auctionApi } from "@/lib/auctionApi"


export const Route = createFileRoute("/auction/")({
  component: AuctionLobbyPage,
})

type CreateAuctionForm = { name: string }

function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(0)}L`
  return `₹${amount.toLocaleString()}`
}

/* ───────────────── PAGE ───────────────── */

function AuctionLobbyPage() {
  const navigate      = useNavigate()
  const updateStatus  = useUpdateAuctionStatus()
  const createAuction = useCreateAuction()
  const queryClient   = useQueryClient()

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => {
      queryClient.clear()
      navigate({ to: "/" })
    },
  })

  const { data: me }                = useQuery({ queryKey: ["me"], queryFn: authApi.me })
  const { data: auction }           = useActiveAuction()
  const { data: soldPlayers }       = useSoldPlayers()
  const { data: unsoldPlayers }     = useUnsoldPlayers()
  const { data: wallet }            = useWallet(me?.participantId)
  const { data: walletLeaderboard } = useWalletLeaderboard()
  const { data: auctions }          = useQuery({ queryKey: ["auctions"], queryFn: auctionApi.list })

  const isAdmin    = me?.role === "ADMIN"
  const totalPlayers = (soldPlayers?.length || 0) + (unsoldPlayers?.length || 0)
  const soldPct    = totalPlayers > 0 ? Math.round(((soldPlayers?.length || 0) / totalPlayers) * 100) : 0

  const form = useForm<CreateAuctionForm>({ defaultValues: { name: "" } })
  const onSubmit = (data: CreateAuctionForm) => {
    if (!data.name.trim()) return
    createAuction.mutate(data, { onSuccess: () => form.reset() })
  }

  const liveAuction = auctions?.find((a: any) => a.status === "LIVE")

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800;900&display=swap');

        :root {
          --cream: #faf8f4;
          --parchment: #f3efe6;
          --border: #e8e0d0;
          --border-dark: #d5c9b5;
          --ink: #1a1410;
          --ink-muted: #6b5e4e;
          --ink-faint: #a89880;
          --green: #2d7a4f;
          --green-light: #edf7f1;
          --green-border: #b8dfc9;
          --amber: #b06b00;
          --amber-light: #fef8ed;
          --amber-border: #f0d5a0;
          --rose: #c0392b;
          --rose-light: #fdf2f0;
          --sky: #1a5fa8;
          --sky-light: #eff5fd;
          --sky-border: #b8d0ee;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .lobby-root {
          height: 100vh;
          display: flex;
          flex-direction: column;
          background-color: var(--cream);
          background-image:
            radial-gradient(ellipse at 80% 0%, #e8f4ef 0%, transparent 55%),
            radial-gradient(ellipse at 0% 100%, #f0ece3 0%, transparent 50%);
          color: var(--ink);
          font-family: 'DM Sans', system-ui, sans-serif;
          overflow: hidden;
        }

        /* NAV */
        .lobby-nav {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          height: 60px;
          background: rgba(250, 248, 244, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
          box-shadow: 0 1px 0 rgba(255,255,255,0.8), 0 2px 12px rgba(0,0,0,0.04);
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nav-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #2d7a4f, #3da066);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          box-shadow: 0 2px 8px rgba(45,122,79,0.3);
        }

        .nav-title {
          font-family: 'Playfair Display', serif;
          font-size: 17px;
          font-weight: 900;
          color: var(--ink);
          line-height: 1;
          letter-spacing: -0.3px;
        }

        .nav-sub {
          font-size: 11px;
          color: var(--ink-faint);
          margin-top: 2px;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: white;
          font-size: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }

        .chip-label { color: var(--ink-faint); font-weight: 500; }
        .chip-value { color: var(--green); font-weight: 800; font-variant-numeric: tabular-nums; font-family: 'Plus Jakarta Sans', sans-serif; }

        .live-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 8px;
          background: var(--green-light);
          border: 1px solid var(--green-border);
          font-size: 11px;
          font-weight: 800;
          color: var(--green);
          letter-spacing: 0.5px;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green);
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }

        .btn-primary {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: linear-gradient(135deg, #2d7a4f, #3da066);
          color: white;
          font-size: 13px;
          font-weight: 800;
          border: none;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 12px rgba(45,122,79,0.3), 0 1px 0 rgba(255,255,255,0.15) inset;
          letter-spacing: 0.1px;
        }

        .btn-primary:hover {
          background: linear-gradient(135deg, #256840, #339958);
          box-shadow: 0 4px 18px rgba(45,122,79,0.4);
          transform: translateY(-1px);
        }

        .btn-logout {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 7px 13px;
          background: white;
          color: var(--ink-muted);
          font-size: 12px;
          font-weight: 700;
          border: 1px solid var(--border);
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .btn-logout:hover {
          background: var(--rose-light);
          border-color: #f5c4b8;
          color: var(--rose);
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(192,57,43,0.12);
        }

        .btn-profile {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 5px 5px 10px;
          background: white;
          border: 1px solid var(--border);
          border-radius: 9px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-muted);
          transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .btn-profile:hover {
          border-color: var(--border-dark);
          color: var(--ink);
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
        }

        .btn-profile-avatar {
          width: 24px; height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #2d7a4f, #3da066);
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 900;
          color: white;
          font-family: 'Plus Jakarta Sans', sans-serif;
          flex-shrink: 0;
        }

        /* BODY */
        .lobby-body {
          flex: 1;
          display: flex;
          gap: 0;
          overflow: hidden;
          min-height: 0;
        }

        /* LEFT */
        .lobby-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
          gap: 16px;
          min-width: 0;
          overflow: hidden;
        }

        /* STAT STRIP */
        .stat-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          flex-shrink: 0;
        }

        .stat-card {
          background: white;
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px 16px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.9) inset;
          position: relative;
          overflow: hidden;
        }

        .stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: 14px 14px 0 0;
        }

        .stat-card.accent-default::before { background: linear-gradient(90deg, #c9b99a, #e0d4be); }
        .stat-card.accent-sky::before     { background: linear-gradient(90deg, #1a5fa8, #5b9de8); }
        .stat-card.accent-green::before   { background: linear-gradient(90deg, #2d7a4f, #5bb88a); }
        .stat-card.accent-rose::before    { background: linear-gradient(90deg, #c0392b, #e57a70); }

        .stat-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--ink-faint);
        }

        .stat-value {
          font-family: 'Plus Jakarta Sans', 'DM Sans', sans-serif;
          font-size: 24px;
          font-weight: 900;
          margin-top: 6px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: -0.5px;
        }

        .stat-value.c-default { color: var(--ink); }
        .stat-value.c-sky     { color: var(--sky); }
        .stat-value.c-green   { color: var(--green); }
        .stat-value.c-rose    { color: var(--rose); }

        /* PROGRESS */
        .progress-card {
          flex-shrink: 0;
          background: white;
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 14px 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .progress-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }

        .progress-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--ink-faint);
        }

        .progress-count {
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-muted);
        }

        .progress-track {
          height: 8px;
          background: var(--parchment);
          border-radius: 99px;
          overflow: hidden;
          border: 1px solid var(--border);
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #2d7a4f, #5bb88a);
          border-radius: 99px;
          transition: width 0.7s cubic-bezier(0.4,0,0.2,1);
        }

        .progress-pct {
          font-size: 11px;
          color: var(--ink-faint);
          margin-top: 6px;
          font-weight: 600;
        }

        /* CREATE FORM */
        .create-card {
          flex-shrink: 0;
          background: white;
          border: 1px solid var(--border);
          border-radius: 14px;
          padding: 16px 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .section-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--ink-faint);
          margin-bottom: 12px;
        }

        .create-form {
          display: flex;
          gap: 8px;
        }

        .create-input {
          flex: 1;
          padding: 9px 14px;
          border: 1.5px solid var(--border);
          border-radius: 9px;
          background: var(--parchment);
          color: var(--ink);
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .create-input:focus {
          border-color: var(--green);
          background: white;
          box-shadow: 0 0 0 3px rgba(45,122,79,0.1);
        }

        .create-input::placeholder { color: var(--ink-faint); }

        .btn-create {
          padding: 9px 20px;
          background: linear-gradient(135deg, #2d7a4f, #3da066);
          color: white;
          font-size: 13px;
          font-weight: 800;
          border: none;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(45,122,79,0.25);
          white-space: nowrap;
          font-family: 'DM Sans', sans-serif;
        }

        .btn-create:hover:not(:disabled) {
          background: linear-gradient(135deg, #256840, #339958);
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(45,122,79,0.35);
        }

        .btn-create:disabled { opacity: 0.55; cursor: not-allowed; }

        /* TABLE */
        .table-card {
          flex: 1;
          background: white;
          border: 1px solid var(--border);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .table-header {
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          background: var(--parchment);
          border-radius: 14px 14px 0 0;
        }

        .table-scroll {
          flex: 1;
          overflow-y: auto;
          min-height: 0;
        }

        .table-scroll::-webkit-scrollbar { width: 5px; }
        .table-scroll::-webkit-scrollbar-track { background: transparent; }
        .table-scroll::-webkit-scrollbar-thumb { background: var(--border-dark); border-radius: 99px; }

        table { width: 100%; border-collapse: collapse; }

        thead { position: sticky; top: 0; background: white; z-index: 1; }

        thead tr { border-bottom: 1px solid var(--border); }

        th {
          text-align: left;
          padding: 10px 20px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--ink-faint);
        }

        tbody tr {
          border-bottom: 1px solid #f0ebe0;
          transition: background 0.15s;
        }

        tbody tr:last-child { border-bottom: none; }
        tbody tr:hover { background: var(--parchment); }
        tbody tr.clickable { cursor: pointer; }

        td {
          padding: 12px 20px;
          font-size: 13px;
          color: var(--ink-muted);
        }

        .td-name {
          font-weight: 700;
          color: var(--ink);
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 99px;
          letter-spacing: 0.3px;
        }

        .status-live {
          background: var(--green-light);
          color: var(--green);
          border: 1px solid var(--green-border);
        }

        .status-other {
          background: var(--parchment);
          color: var(--ink-faint);
          border: 1px solid var(--border);
        }

        .td-date {
          font-size: 12px;
          color: var(--ink-faint);
          font-variant-numeric: tabular-nums;
        }

        .btn-start {
          padding: 6px 14px;
          background: linear-gradient(135deg, #2d7a4f, #3da066);
          color: white;
          font-size: 11px;
          font-weight: 800;
          border: none;
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
        }

        .btn-start:hover {
          background: linear-gradient(135deg, #256840, #339958);
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(45,122,79,0.3);
        }

        .btn-open {
          padding: 6px 14px;
          background: var(--sky-light);
          color: var(--sky);
          border: 1px solid var(--sky-border);
          font-size: 11px;
          font-weight: 800;
          border-radius: 7px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
        }

        .btn-open:hover {
          background: var(--sky);
          color: white;
          border-color: var(--sky);
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(26,95,168,0.25);
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 40px;
        }

        .empty-text {
          font-size: 13px;
          color: var(--ink-faint);
          font-style: italic;
        }

        /* RIGHT */
        .lobby-right {
          width: 272px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--border);
          background: var(--parchment);
        }

        /* LEADERBOARD */
        .lb-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          border-bottom: 1px solid var(--border);
        }

        .lb-header {
          padding: 14px 16px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
          border-bottom: 1px solid var(--border);
          background: white;
        }

        .lb-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-height: 0;
        }

        .lb-list::-webkit-scrollbar { width: 4px; }
        .lb-list::-webkit-scrollbar-track { background: transparent; }
        .lb-list::-webkit-scrollbar-thumb { background: var(--border-dark); border-radius: 99px; }

        .lb-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid transparent;
          transition: all 0.15s;
        }

        .lb-row:hover { transform: translateX(2px); }

        .lb-row.rank-1 { background: #fffbee; border-color: #f0d88a; box-shadow: 0 2px 8px rgba(176,107,0,0.08); }
        .lb-row.rank-2 { background: #f7f7f9; border-color: #dddde8; }
        .lb-row.rank-3 { background: #fff5f0; border-color: #f5c4aa; }
        .lb-row.rank-other { background: white; border-color: var(--border); }

        .lb-left {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .lb-rank {
          width: 22px;
          text-align: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        .lb-rank.text {
          font-size: 12px;
          font-weight: 800;
          color: var(--ink-faint);
        }

        .lb-name {
          font-size: 13px;
          font-weight: 700;
          color: var(--ink);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .lb-balance {
          font-size: 13px;
          font-weight: 800;
          flex-shrink: 0;
          margin-left: 6px;
          font-variant-numeric: tabular-nums;
          color: var(--green);
          font-family: 'Plus Jakarta Sans', 'DM Sans', sans-serif;
          letter-spacing: -0.3px;
        }

        .lb-balance.rank-1 { color: var(--amber); }

        /* QUICK ACTIONS */
        .qa-section {
          flex-shrink: 0;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .btn-action {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: white;
          border: 1px solid var(--border);
          border-radius: 11px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          color: var(--ink-muted);
          transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }

        .btn-action:hover {
          background: var(--cream);
          color: var(--ink);
          border-color: var(--border-dark);
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(0,0,0,0.07);
        }

        .btn-action .arrow { color: var(--ink-faint); transition: transform 0.15s; }
        .btn-action:hover .arrow { transform: translateX(3px); }

        .btn-action-live {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: linear-gradient(135deg, #2d7a4f, #3da066);
          border: none;
          border-radius: 11px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          color: white;
          transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 0 4px 16px rgba(45,122,79,0.28);
        }

        .btn-action-live:hover {
          background: linear-gradient(135deg, #256840, #339958);
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(45,122,79,0.38);
        }

        /* WALLET CARD */
        .wallet-card {
          border-radius: 11px;
          background: white;
          border: 1px solid var(--border);
          padding: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .wallet-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--ink-faint);
        }

        .wallet-amount {
          font-family: 'Plus Jakarta Sans', 'DM Sans', sans-serif;
          font-size: 26px;
          font-weight: 900;
          color: var(--green);
          margin-top: 4px;
          line-height: 1.1;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.5px;
        }

        .wallet-sub {
          font-size: 11px;
          color: var(--ink-faint);
          margin-top: 4px;
          font-weight: 500;
        }
      `}</style>

      <div className="lobby-root">

        {/* ══════════════ NAV BAR ══════════════ */}
        <header className="lobby-nav">
          <div className="nav-brand">
            <div className="nav-icon">🏏</div>
            <div>
              <div className="nav-title">Auction Lobby</div>
              <div className="nav-sub">Manage sessions &amp; participants</div>
            </div>
          </div>

          <div className="nav-actions">
            {!isAdmin && wallet?.balance != null && (
              <div className="chip">
                <span className="chip-label">Balance</span>
                <span className="chip-value">{fmt(Number(wallet.balance))}</span>
              </div>
            )}

            {liveAuction && (
              <div className="live-chip">
                <span className="live-dot" />
                LIVE
              </div>
            )}

            {!isAdmin && liveAuction && (
              <button
                className="btn-primary"
                onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId: liveAuction.id } })}
              >
                Enter Auction →
              </button>
            )}

            {/* Divider */}
            <div style={{ width: 1, height: 22, background: "var(--border)", flexShrink: 0 }} />

            {/* Profile button */}
            <button
              className="btn-profile"
              onClick={() => navigate({ to: "/auction/profile", search: { q: "" } })}
              title="View profile"
            >
              <div className="btn-profile-avatar">
                {me?.name ? me.name.charAt(0).toUpperCase() : "?"}
              </div>
              <span>{me?.name ?? "Profile"}</span>
              <span style={{ color: "var(--ink-faint)", fontSize: 11 }}>›</span>
            </button>

            <button
              className="btn-logout"
              onClick={() => logout.mutate()}
              title="Log out"
            >
              <span>↪</span>
              Logout
            </button>
          </div>
        </header>

        {/* ══════════════ BODY ══════════════ */}
        <div className="lobby-body">

          {/* ── LEFT ── */}
          <div className="lobby-left">

            {/* Stat strip */}
            <div className="stat-strip">
              {[
                { label: "Active Auction", value: auction?.name ?? "None",            accent: "default" },
                { label: "Total Players",  value: String(totalPlayers),               accent: "sky" },
                { label: "Sold",           value: String(soldPlayers?.length || 0),   accent: "green" },
                { label: "Unsold",         value: String(unsoldPlayers?.length || 0), accent: "rose" },
              ].map(({ label, value, accent }) => (
                <div key={label} className={`stat-card accent-${accent}`}>
                  <div className="stat-label">{label}</div>
                  <div className={`stat-value c-${accent}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {totalPlayers > 0 && (
              <div className="progress-card">
                <div className="progress-header">
                  <span className="progress-label">Auction Progress</span>
                  <span className="progress-count">{soldPlayers?.length || 0} / {totalPlayers} sold</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${soldPct}%` }} />
                </div>
                <div className="progress-pct">{soldPct}% complete</div>
              </div>
            )}

            {/* Admin: create auction */}
            {isAdmin && (
              <div className="create-card">
                <div className="section-label">Create Auction</div>
                <form
                  className="create-form"
                  onSubmit={form.handleSubmit(onSubmit)}
                >
                  <input
                    {...form.register("name")}
                    placeholder="Enter auction name…"
                    className="create-input"
                  />
                  <button
                    type="submit"
                    disabled={createAuction.isPending}
                    className="btn-create"
                  >
                    {createAuction.isPending ? "Creating…" : "Create"}
                  </button>
                </form>
              </div>
            )}

            {/* Auctions table */}
            <div className="table-card">
              <div className="table-header">
                <div className="section-label" style={{ marginBottom: 0 }}>All Auctions</div>
              </div>
              <div className="table-scroll">
                {auctions?.length ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Created</th>
                        {isAdmin && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {auctions.map((a: any) => {
                        const isLive = a.status === "LIVE"
                        return (
                          <tr
                            key={a.id}
                            onClick={() => {
                              if (!isAdmin && isLive) navigate({ to: "/auction/$auctionId", params: { auctionId: a.id } })
                            }}
                            className={!isAdmin && isLive ? "clickable" : ""}
                          >
                            <td className="td-name">{a.name}</td>
                            <td>
                              <span className={`status-badge ${isLive ? "status-live" : "status-other"}`}>
                                {isLive && <span className="live-dot" style={{ width: 5, height: 5, flexShrink: 0 }} />}
                                {a.status}
                              </span>
                            </td>
                            <td className="td-date">
                              {new Date(a.createdAt).toLocaleString()}
                            </td>
                            {isAdmin && (
                              <td style={{ textAlign: "right" }}>
                                {a.status === "PRE_AUCTION" && (
                                  <button
                                    className="btn-start"
                                    onClick={() => updateStatus.mutate({ id: a.id, status: "LIVE" })}
                                  >
                                    Start
                                  </button>
                                )}
                                {isLive && (
                                  <button
                                    className="btn-open"
                                    onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId: a.id } })}
                                  >
                                    Open →
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-state">
                    <span className="empty-text">No auctions created yet</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div className="lobby-right">

            {/* Leaderboard */}
            <div className="lb-section">
              <div className="lb-header">
                <div className="section-label" style={{ marginBottom: 0 }}>Leaderboard</div>
                <span style={{ fontSize: 10, color: "var(--ink-faint)", fontWeight: 600 }}>by balance</span>
              </div>
              <div className="lb-list">
                {walletLeaderboard?.length ? (
                  walletLeaderboard.map((p: any, i: number) => (
                    <div
                      key={p.participantId}
                      className={`lb-row ${i === 0 ? "rank-1" : i === 1 ? "rank-2" : i === 2 ? "rank-3" : "rank-other"}`}
                    >
                      <div className="lb-left">
                        <span className="lb-rank">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (
                            <span className="text">{i + 1}</span>
                          )}
                        </span>
                        <span className="lb-name">{p.participantName}</span>
                      </div>
                      <span className={`lb-balance ${i === 0 ? "rank-1" : ""}`}>
                        {fmt(Number(p.balance))}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <span className="empty-text">No participants yet</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="qa-section">
              <div className="section-label">Quick Actions</div>

              <button
                className="btn-action"
                onClick={() => navigate({ to: "/auction/players", search: { page: 1, search: "" } })}
              >
                <span>View Players Pool</span>
                <span className="arrow">→</span>
              </button>

              {liveAuction && (
                <button
                  className="btn-action-live"
                  onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId: liveAuction.id } })}
                >
                  <span>Enter Live Auction</span>
                  <span>→</span>
                </button>
              )}

              {!isAdmin && wallet?.balance != null && (
                <div className="wallet-card">
                  <div className="wallet-label">Your Wallet</div>
                  <div className="wallet-amount">{fmt(Number(wallet.balance))}</div>
                  <div className="wallet-sub">remaining balance</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}