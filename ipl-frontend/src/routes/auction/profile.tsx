/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"

import { authApi } from "@/lib/auth"
import { useWallet } from "@/hooks/useWallet"
import { useWalletLeaderboard } from "@/hooks/useWalletLeaderboard"
import { api } from "@/lib/api"

/* ─── Route ─── */
export const Route = createFileRoute("/auction/profile")({
  validateSearch: z.object({
    q: z.string().catch(""),
  }),
  component: ProfilePage,
})

/* ─── helpers ─── */
function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(0)}L`
  return `₹${amount.toLocaleString()}`
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
}

type ProfileForm = { name: string; email: string }

/* ─── styles ─── */
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
    --rose:          #c0392b;
    --rose-light:    #fdf2f0;
    --sky:           #1a5fa8;
    --sky-light:     #eff5fd;
    --sky-border:    #b8d0ee;
  }

  .prof-root {
    min-height: 100vh;
    background-color: var(--cream);
    background-image:
      radial-gradient(ellipse at 85% 0%, #e8f4ef 0%, transparent 50%),
      radial-gradient(ellipse at 0% 90%, #f0ece3 0%, transparent 45%);
    font-family: 'DM Sans', system-ui, sans-serif;
    color: var(--ink);
  }

  /* ── NAV ── */
  .prof-nav {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 32px; height: 60px;
    background: rgba(250,248,244,0.88);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 0 rgba(255,255,255,0.8), 0 2px 12px rgba(0,0,0,0.04);
  }
  .prof-nav-brand { display: flex; align-items: center; gap: 10px; }
  .prof-nav-icon {
    width: 34px; height: 34px;
    background: linear-gradient(135deg, #2d7a4f, #3da066);
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 8px rgba(45,122,79,0.3);
  }
  .prof-nav-title {
    font-family: 'Playfair Display', serif;
    font-size: 17px; font-weight: 900; color: var(--ink); letter-spacing: -0.3px;
  }
  .prof-nav-sub { font-size: 11px; color: var(--ink-faint); margin-top: 1px; }

  .btn-back {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; background: white;
    border: 1px solid var(--border); border-radius: 9px;
    font-size: 12px; font-weight: 700; color: var(--ink-muted);
    cursor: pointer; transition: all 0.15s;
    font-family: 'DM Sans', sans-serif;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .btn-back:hover { border-color: var(--border-dark); color: var(--ink); transform: translateY(-1px); }

  /* ── LAYOUT ── */
  .prof-body {
    max-width: 1100px; margin: 0 auto;
    padding: 36px 32px 72px;
    display: flex; flex-direction: column; gap: 24px;
  }

  /* ── EYEBROW / HEADING ── */
  .prof-eyebrow {
    font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;
    color: var(--green); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
  }
  .prof-eyebrow::before {
    content: ''; display: block; width: 18px; height: 2px;
    background: var(--green); border-radius: 2px;
  }
  .prof-page-title {
    font-family: 'Playfair Display', serif;
    font-size: 30px; font-weight: 900; color: var(--ink);
    letter-spacing: -0.5px; line-height: 1.1; margin: 0 0 6px;
  }
  .prof-page-sub { font-size: 13px; color: var(--ink-faint); font-weight: 500; }

  /* ── CARD ── */
  .prof-card {
    background: white; border: 1px solid var(--border);
    border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.05); overflow: hidden;
  }
  .prof-card-header {
    padding: 14px 24px; border-bottom: 1px solid var(--border);
    background: var(--parchment);
    display: flex; align-items: center; justify-content: space-between;
  }
  .prof-card-title {
    font-size: 10px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.8px; color: var(--ink-faint);
  }
  .prof-card-body { padding: 24px; }

  /* ── IDENTITY ── */
  .prof-identity { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
  .prof-avatar {
    width: 68px; height: 68px; border-radius: 50%;
    background: linear-gradient(135deg, #2d7a4f, #3da066);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 22px; font-weight: 900; color: white; flex-shrink: 0;
    box-shadow: 0 4px 16px rgba(45,122,79,0.25);
    border: 3px solid white; outline: 2px solid var(--green-border);
  }
  .prof-identity-name {
    font-family: 'Playfair Display', serif;
    font-size: 22px; font-weight: 900; color: var(--ink);
    letter-spacing: -0.3px; margin: 0 0 4px;
  }
  .prof-identity-email { font-size: 13px; color: var(--ink-faint); font-weight: 500; margin-bottom: 10px; }

  .prof-role-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.5px; padding: 3px 10px; border-radius: 99px;
  }
  .prof-role-admin {
    background: var(--amber-light) !important; border: 1px solid var(--amber-border) !important;
    color: var(--amber) !important;
  }
  .prof-role-participant {
    background: var(--sky-light) !important; border: 1px solid var(--sky-border) !important;
    color: var(--sky) !important;
  }

  /* ── STAT TILES ── */
  .prof-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }

  @media (max-width: 600px) {
    .prof-stats-row { grid-template-columns: 1fr; }
    .prof-form-grid { grid-template-columns: 1fr !important; }
  }

  .prof-stat-tile {
    background: var(--parchment); border: 1px solid var(--border);
    border-radius: 12px; padding: 16px 18px; position: relative; overflow: hidden;
  }
  .prof-stat-tile::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0;
    height: 3px; border-radius: 12px 12px 0 0;
  }
  .prof-stat-tile.t-green::before { background: linear-gradient(90deg, #2d7a4f, #5bb88a); }
  .prof-stat-tile.t-amber::before { background: linear-gradient(90deg, #b06b00, #e8a030); }
  .prof-stat-tile.t-sky::before   { background: linear-gradient(90deg, #1a5fa8, #5b9de8); }
  .prof-stat-label {
    font-size: 10px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.8px; color: var(--ink-faint); margin-bottom: 6px;
  }
  .prof-stat-value {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 22px; font-weight: 900; letter-spacing: -0.5px; font-variant-numeric: tabular-nums;
  }
  .prof-stat-value.green { color: var(--green); }
  .prof-stat-value.amber { color: var(--amber); }
  .prof-stat-value.sky   { color: var(--sky); }

  /* ── FORM ── */
  .prof-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .prof-field { display: flex; flex-direction: column; gap: 5px; }
  .prof-label { font-size: 12px; font-weight: 700; color: var(--ink-muted); letter-spacing: 0.1px; }
  .prof-input {
    height: 42px;
    background: var(--parchment) !important; border: 1.5px solid var(--border) !important;
    border-radius: 10px !important; color: var(--ink) !important;
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .prof-input:focus {
    border-color: var(--green) !important; background: white !important;
    box-shadow: 0 0 0 3px rgba(45,122,79,0.1) !important;
  }
  .prof-input::placeholder { color: var(--ink-faint); }
  .prof-input:disabled { opacity: 0.6; cursor: not-allowed; background: var(--parchment-mid) !important; }
  .prof-field-hint { font-size: 11px; color: var(--ink-faint); font-weight: 500; }

  .prof-form-actions {
    display: flex; align-items: center; justify-content: flex-end; gap: 10px;
    margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);
  }
  .btn-save {
    height: 40px; padding: 0 24px;
    background: linear-gradient(135deg, #2d7a4f, #3da066);
    color: white; font-size: 13px; font-weight: 800;
    font-family: 'DM Sans', sans-serif;
    border: none; border-radius: 10px; cursor: pointer; transition: all 0.2s;
    box-shadow: 0 2px 10px rgba(45,122,79,0.25);
  }
  .btn-save:hover:not(:disabled) {
    background: linear-gradient(135deg, #256840, #339958);
    transform: translateY(-1px); box-shadow: 0 4px 16px rgba(45,122,79,0.35);
  }
  .btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-cancel {
    height: 40px; padding: 0 20px; background: white; color: var(--ink-muted);
    font-size: 13px; font-weight: 700; font-family: 'DM Sans', sans-serif;
    border: 1px solid var(--border); border-radius: 10px; cursor: pointer; transition: all 0.15s;
  }
  .btn-cancel:hover { border-color: var(--border-dark); color: var(--ink); transform: translateY(-1px); }

  .prof-toast {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 700; color: var(--green);
    background: var(--green-light); border: 1px solid var(--green-border);
    border-radius: 8px; padding: 6px 14px;
    animation: toastIn 0.3s ease;
  }
  @keyframes toastIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  /* ── PARTICIPANTS TABLE ── */
  .participants-toolbar {
    padding: 12px 20px; border-bottom: 1px solid var(--border);
    background: white; display: flex; align-items: center; gap: 12px;
  }
  .participants-search {
    max-width: 240px; height: 34px;
    background: var(--parchment) !important; border: 1.5px solid var(--border) !important;
    border-radius: 8px !important; font-size: 13px;
    font-family: 'DM Sans', sans-serif; color: var(--ink) !important;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .participants-search:focus {
    border-color: var(--green) !important;
    box-shadow: 0 0 0 3px rgba(45,122,79,0.1) !important; background: white !important;
  }
  .participants-search::placeholder { color: var(--ink-faint); }
  .participants-count { font-size: 11px; font-weight: 700; color: var(--ink-faint); margin-left: auto; }

  .prof-table-shell { overflow: hidden; border-radius: 0 0 16px 16px; }
  .prof-table-shell thead tr { border-bottom: 1px solid var(--border); background: white; }
  .prof-table-shell thead th {
    text-align: left; padding: 10px 20px !important;
    font-size: 10px !important; font-weight: 800 !important;
    text-transform: uppercase !important; letter-spacing: 0.8px !important;
    color: var(--ink-faint) !important; white-space: nowrap; border: none !important;
  }
  .prof-table-shell tbody tr { border-bottom: 1px solid #f0ebe0; transition: background 0.12s; }
  .prof-table-shell tbody tr:last-child { border-bottom: none; }
  .prof-table-shell tbody tr:hover { background: var(--parchment); }
  .prof-table-shell tbody td {
    padding: 12px 20px !important; font-size: 13px;
    color: var(--ink-muted); border: none !important; vertical-align: middle;
  }

  .ptd-rank {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 11px !important; font-weight: 800 !important;
    color: var(--ink-faint) !important; text-align: center !important;
  }
  .ptd-name-wrap { display: flex; align-items: center; gap: 10px; }
  .ptd-avatar {
    width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800; color: white;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
  .ptd-name { font-weight: 700 !important; color: var(--ink) !important; }
  .ptd-balance {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-weight: 800 !important; font-variant-numeric: tabular-nums;
    letter-spacing: -0.2px; color: var(--green) !important;
    display: block; text-align: right;
  }

  .ptd-skel {
    border-radius: 4px;
    background: linear-gradient(90deg, var(--parchment) 25%, var(--border) 50%, var(--parchment) 75%);
    background-size: 400% 100%; animation: shimmer 1.6s ease infinite;
  }
  @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

  .prof-empty {
    padding: 48px 20px; display: flex; flex-direction: column;
    align-items: center; gap: 8px; color: var(--ink-faint);
  }
  .prof-empty-icon { font-size: 32px; opacity: 0.3; }
  .prof-empty-text { font-size: 13px; font-weight: 600; }
`

const AVATAR_COLORS = [
  "linear-gradient(135deg,#2d7a4f,#3da066)",
  "linear-gradient(135deg,#1a5fa8,#5b9de8)",
  "linear-gradient(135deg,#b06b00,#e8a030)",
  "linear-gradient(135deg,#6b3fa0,#a070d8)",
  "linear-gradient(135deg,#c0392b,#e57060)",
]

/* ─────────────── COMPONENT ─────────────── */
function ProfilePage() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const { q }       = Route.useSearch()

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
  })

  const isAdmin = me?.role === "ADMIN"

  const { data: wallet }      = useWallet(me?.participantId)
  const { data: leaderboard } = useWalletLeaderboard()

  const myRankIdx = (leaderboard ?? []).findIndex(
    (p: any) => p.participantId === me?.participantId
  )
  const myRankDisplay = myRankIdx >= 0 ? `#${myRankIdx + 1}` : "—"

  /* ─ edit form ─ */
  const form = useForm<ProfileForm>({
    values: { name: me?.name ?? "", email: me?.email ?? "" },
  })

  const updateProfile = useMutation({
    mutationFn: (data: ProfileForm) =>
      fetch("/api/v1/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to update profile")
        return r.json()
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  })

  /* ─ admin: participants ─ */
  const { data: allParticipants, isLoading: participantsLoading } = useQuery({
  queryKey: ["participants"],
  queryFn: () => api.get("/participants/list").then((r) => r.data),
  enabled: isAdmin,
  retry: 1,
})

  const participants: any[] = Array.isArray(allParticipants) ? allParticipants : []

  const filteredParticipants = participants.filter((p: any) => {
    if (!q) return true
    const lower = q.toLowerCase()
    return p.name?.toLowerCase().includes(lower)
  })

  return (
    <div className="prof-root">
      <style>{styles}</style>

      {/* ── NAV ── */}
      <nav className="prof-nav">
        <div className="prof-nav-brand">
          <div className="prof-nav-icon">🏏</div>
          <div>
            <div className="prof-nav-title">BidXI</div>
            <div className="prof-nav-sub">Fantasy Cricket Auction</div>
          </div>
        </div>
        <button className="btn-back" onClick={() => navigate({ to: "/auction" })}>
          ← Back to Lobby
        </button>
      </nav>

      {/* ── BODY ── */}
      <div className="prof-body">

        {/* heading */}
        <div>
          <div className="prof-eyebrow">{isAdmin ? "Admin" : "My Account"}</div>
          <h1 className="prof-page-title">
            {isAdmin ? "Profile & Participants" : "Your Profile"}
          </h1>
          <p className="prof-page-sub">
            {isAdmin
              ? "Manage your account and view all auction participants."
              : "View and update your personal details."}
          </p>
        </div>

        {/* identity card */}
        <div className="prof-card">
          <div className="prof-card-header">
            <span className="prof-card-title">Account</span>
            <span className={`prof-role-badge ${isAdmin ? "prof-role-admin" : "prof-role-participant"}`}>
              {isAdmin ? "⚙ Admin" : "🏏 Participant"}
            </span>
          </div>
          <div className="prof-card-body">
            <div className="prof-identity">
              <div className="prof-avatar">{me?.name ? initials(me.name) : "?"}</div>
              <div>
                <h2 className="prof-identity-name">
                  {meLoading ? "Loading…" : (me?.name ?? "—")}
                </h2>
                <p className="prof-identity-email">{me?.email ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* wallet stats — participant only */}
        {!isAdmin && (
          <div className="prof-stats-row">
            <div className="prof-stat-tile t-green">
              <div className="prof-stat-label">Wallet Balance</div>
              <div className="prof-stat-value green">
                {wallet?.balance != null ? fmt(Number(wallet.balance)) : "—"}
              </div>
            </div>
            <div className="prof-stat-tile t-amber">
              <div className="prof-stat-label">Leaderboard Rank</div>
              <div className="prof-stat-value amber">{myRankDisplay}</div>
            </div>
            <div className="prof-stat-tile t-sky">
              <div className="prof-stat-label">Total Participants</div>
              <div className="prof-stat-value sky">{leaderboard?.length ?? "—"}</div>
            </div>
          </div>
        )}

        {/* edit form */}
        <div className="prof-card">
          <div className="prof-card-header">
            <span className="prof-card-title">Edit Profile</span>
            {updateProfile.isSuccess && (
              <span className="prof-toast">✓ Saved successfully</span>
            )}
          </div>
          <div className="prof-card-body">
            <form onSubmit={form.handleSubmit((data) => updateProfile.mutate(data))}>
              <div className="prof-form-grid">
                <div className="prof-field">
                  <label className="prof-label">Full name</label>
                  <Input
                    {...form.register("name", { required: true })}
                    placeholder="Your name"
                    className="prof-input"
                  />
                </div>
                <div className="prof-field">
                  <label className="prof-label">Email address</label>
                  <Input
                    {...form.register("email", { required: true })}
                    type="email"
                    placeholder="you@example.com"
                    className="prof-input"
                  />
                </div>
                <div className="prof-field">
                  <label className="prof-label">Role</label>
                  <Input
                    value={isAdmin ? "Administrator" : "Participant"}
                    disabled
                    className="prof-input"
                  />
                  <span className="prof-field-hint">Role cannot be changed here.</span>
                </div>
                <div className="prof-field">
                  <label className="prof-label">Participant ID</label>
                  <Input
                    value={me?.participantId ?? me?.id ?? "—"}
                    disabled
                    className="prof-input"
                  />
                  <span className="prof-field-hint">System-assigned identifier.</span>
                </div>
              </div>
              <div className="prof-form-actions">
                <button type="button" className="btn-cancel" onClick={() => form.reset()}>
                  Reset
                </button>
                <button
                  type="submit"
                  className="btn-save"
                  disabled={updateProfile.isPending || !form.formState.isDirty}
                >
                  {updateProfile.isPending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* admin: participants table */}
        {isAdmin && (
          <div className="prof-card">
            <div className="prof-card-header">
              <span className="prof-card-title">All Participants</span>
              <span style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600 }}>
                {filteredParticipants.length} total
              </span>
            </div>

            <div className="participants-toolbar">
              <Input
                placeholder="Search by name…"
                value={q}
                onChange={(e) =>
                  navigate({ to: "/auction/profile", search: { q: e.target.value } })
                }
                className="participants-search"
              />
              <span className="participants-count">
                {filteredParticipants.length} participant{filteredParticipants.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="prof-table-shell">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ width: 48, textAlign: "center" }}>#</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead style={{ textAlign: "right" }}>Balance</TableHead>
                    <TableHead style={{ textAlign: "center" }}>Rank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>

                  {/* skeleton rows while loading */}
                  {participantsLoading && Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell className="ptd-rank">
                        <div className="ptd-skel" style={{ height: 12, width: 20, margin: "0 auto" }} />
                      </TableCell>
                      <TableCell>
                        <div className="ptd-name-wrap">
                          <div className="ptd-skel" style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0 }} />
                          <div className="ptd-skel" style={{ height: 13, width: 140 }} />
                        </div>
                      </TableCell>
                      <TableCell style={{ textAlign: "right" }}>
                        <div className="ptd-skel" style={{ height: 13, width: 64, marginLeft: "auto" }} />
                      </TableCell>
                      <TableCell style={{ textAlign: "center" }}>
                        <div className="ptd-skel" style={{ height: 12, width: 24, margin: "0 auto" }} />
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* participant rows */}
                  {!participantsLoading && filteredParticipants.map((p: any, i: number) => {
                    const lb    = (leaderboard ?? []) as any[]
                    const entry = lb.find((l) => l.participantId === p.id)
                    const rank  = lb.findIndex((l) => l.participantId === p.id)
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="ptd-rank">{i + 1}</TableCell>
                        <TableCell>
                          <div className="ptd-name-wrap">
                            <div
                              className="ptd-avatar"
                              style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                            >
                              {initials(p.name ?? "?")}
                            </div>
                            <span className="ptd-name">{p.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="ptd-balance">
                            {entry?.balance != null ? fmt(Number(entry.balance)) : "—"}
                          </span>
                        </TableCell>
                        <TableCell style={{ textAlign: "center" }}>
                          <span style={{
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            fontWeight: 800, fontSize: 13,
                            color: rank === 0
                              ? "var(--amber)"
                              : rank >= 0 ? "var(--ink-muted)" : "var(--ink-faint)",
                          }}>
                            {rank === 0 ? "🥇" : rank >= 0 ? `#${rank + 1}` : "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}

                  {/* empty state */}
                  {!participantsLoading && filteredParticipants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} style={{ padding: 0 }}>
                        <div className="prof-empty">
                          <span className="prof-empty-icon">👥</span>
                          <span className="prof-empty-text">
                            {q ? `No participants matching "${q}"` : "No participants yet"}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                </TableBody>
              </Table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}