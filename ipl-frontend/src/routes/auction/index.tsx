/* eslint-disable react-refresh/only-export-components */

import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"

import { authApi } from "@/lib/auth"
import { auctionApi } from "@/lib/auctionApi"
import { dashboardApi } from "@/lib/dashboardApi"
import { biddingApi } from "@/lib/biddingApi"
import { Auction } from "@/types/auction"

export const Route = createFileRoute("/auction/")({
  component: AuctionLobbyPage,
})

type CreateAuctionForm = { name: string }

function fmt(amount: number) {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`
  if (amount >= 100_000)    return `₹${(amount / 100_000).toFixed(0)}L`
  return `₹${amount.toLocaleString()}`
}

function AuctionLobbyPage() {
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()

  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess:  () => { queryClient.clear(); navigate({ to: "/" }) },
  })

  const { data: me }      = useQuery({ queryKey: ["me"],       queryFn: authApi.me })
  const { data: auctions} = useQuery({ queryKey: ["auctions"], queryFn: auctionApi.list })

  const isAdmin    = me?.role === "ADMIN"
  const liveAuctions: Auction[] = (auctions ?? []).filter((a: Auction) => a.status === "LIVE")
  const firstLiveId = liveAuctions[0]?.id

  const { data: leaderboard }   = useQuery({
    queryKey: ["leaderboard", firstLiveId],
    queryFn:  () => dashboardApi.leaderboard(firstLiveId!),
    enabled:  !!firstLiveId,
  })
  const { data: walletData } = useQuery({
    queryKey: ["wallet", me?.participantId, firstLiveId],
    queryFn:  () => biddingApi.getWallet(me!.participantId, firstLiveId!),
    enabled:  !!me?.participantId && !!firstLiveId && me?.role === "PARTICIPANT",
  })

  const createAuction = useMutation({
    mutationFn: auctionApi.create,
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ["auctions"] }); form.reset() },
  })
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => auctionApi.updateStatus(id, status),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["auctions"] }),
  })

  const form = useForm<CreateAuctionForm>({
    defaultValues: { name: "" },
  })
  const onSubmit = (data: CreateAuctionForm) => {
    if (!data.name.trim()) return
    createAuction.mutate({ name: data.name, analysisTimerSecs: 0 })
  }

  const participantCount = leaderboard?.length ?? 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Grotesk:wght@600;700;800&display=swap');
        :root {
          --cream: #faf8f4; --parchment: #f3efe6; --border: #e8e0d0; --border-dark: #d5c9b5;
          --ink: #1a1410; --ink-muted: #6b5e4e; --ink-faint: #a89880;
          --green: #2d7a4f; --green-light: #edf7f1; --green-border: #b8dfc9;
          --amber: #b06b00; --amber-light: #fef8ed; --amber-border: #f0d5a0;
          --rose: #c0392b; --rose-light: #fdf2f0; --sky: #1a5fa8; --sky-light: #eff5fd; --sky-border: #b8d0ee;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .lobby-root { height: 100vh; display: flex; flex-direction: column; background-color: var(--cream); background-image: radial-gradient(ellipse at 80% 0%, #e8f4ef 0%, transparent 55%), radial-gradient(ellipse at 0% 100%, #f0ece3 0%, transparent 50%); color: var(--ink); font-family: 'Inter', system-ui, sans-serif; overflow: hidden; }
        .lobby-nav { flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: 62px; background: rgba(250,248,244,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); box-shadow: 0 1px 0 rgba(255,255,255,0.8), 0 2px 12px rgba(0,0,0,0.04); }
        .nav-brand { display: flex; align-items: center; gap: 10px; }
        .nav-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #2d7a4f, #3da066); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 2px 8px rgba(45,122,79,0.3); }
        .nav-title { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 800; color: var(--ink); line-height: 1; letter-spacing: -0.4px; }
        .nav-sub { font-size: 11px; color: var(--ink-faint); margin-top: 2px; font-weight: 500; }
        .nav-actions { display: flex; align-items: center; gap: 10px; }
        .nav-divider { width: 1px; height: 22px; background: var(--border); flex-shrink: 0; }
        .chip { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border); background: white; font-size: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .chip-label { color: var(--ink-faint); font-weight: 500; }
        .chip-value { color: var(--green); font-weight: 800; font-variant-numeric: tabular-nums; }
        .live-chip { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; background: var(--green-light); border: 1px solid var(--green-border); font-size: 11px; font-weight: 800; color: var(--green); letter-spacing: 0.5px; }
        .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--green); animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }
        .btn-primary { display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, #2d7a4f, #3da066); color: white; font-size: 13px; font-weight: 700; border: none; border-radius: 9px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 12px rgba(45,122,79,0.3); letter-spacing: 0.1px; font-family: 'Inter', sans-serif; white-space: nowrap; }
        .btn-primary:hover { background: linear-gradient(135deg, #256840, #339958); transform: translateY(-1px); box-shadow: 0 4px 18px rgba(45,122,79,0.4); }
        .btn-secondary { display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: white; color: var(--ink-muted); font-size: 13px; font-weight: 600; border: 1px solid var(--border); border-radius: 9px; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .btn-secondary:hover { background: var(--sky-light); color: var(--sky); border-color: var(--sky-border); transform: translateY(-1px); }
        .btn-logout { display: flex; align-items: center; gap: 5px; padding: 7px 13px; background: white; color: var(--ink-muted); font-size: 12px; font-weight: 600; border: 1px solid var(--border); border-radius: 9px; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; }
        .btn-logout:hover { background: var(--rose-light); border-color: #f5c4b8; color: var(--rose); transform: translateY(-1px); }
        .btn-profile { display: flex; align-items: center; gap: 6px; padding: 5px 5px 5px 10px; background: white; border: 1px solid var(--border); border-radius: 9px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--ink-muted); transition: all 0.15s; font-family: 'Inter', sans-serif; }
        .btn-profile:hover { border-color: var(--border-dark); color: var(--ink); transform: translateY(-1px); }
        .btn-profile-avatar { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #2d7a4f, #3da066); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: white; }
        .lobby-body { flex: 1; display: flex; flex-direction: column; padding: 24px 28px; gap: 18px; overflow: hidden; min-height: 0; }
        .stat-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; flex-shrink: 0; }
        .stat-card { background: white; border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative; overflow: hidden; }
        .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 14px 14px 0 0; }
        .stat-card.accent-default::before { background: linear-gradient(90deg, #c9b99a, #e0d4be); }
        .stat-card.accent-sky::before { background: linear-gradient(90deg, #1a5fa8, #5b9de8); }
        .stat-card.accent-green::before { background: linear-gradient(90deg, #2d7a4f, #5bb88a); }
        .stat-card.accent-amber::before { background: linear-gradient(90deg, #b06b00, #e8a020); }
        .stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--ink-faint); font-family: 'Inter', sans-serif; }
        .stat-value { font-family: 'Space Grotesk', sans-serif; font-size: 26px; font-weight: 800; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.5px; }
        .stat-value.c-default { color: var(--ink); } .stat-value.c-sky { color: var(--sky); } .stat-value.c-green { color: var(--green); } .stat-value.c-amber { color: var(--amber); }
        .create-card { flex-shrink: 0; background: white; border: 1px solid var(--border); border-radius: 14px; padding: 16px 20px; }
        .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--ink-faint); margin-bottom: 12px; font-family: 'Inter', sans-serif; }
        .create-row { display: flex; gap: 8px; }
        .create-input { flex: 1; padding: 10px 16px; border: 1.5px solid var(--border); border-radius: 9px; background: var(--parchment); color: var(--ink); font-size: 13px; font-family: 'Inter', sans-serif; outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
        .create-input:focus { border-color: var(--green); background: white; box-shadow: 0 0 0 3px rgba(45,122,79,0.1); }
        .create-input::placeholder { color: var(--ink-faint); }
        .btn-create { padding: 10px 24px; background: linear-gradient(135deg, #2d7a4f, #3da066); color: white; font-size: 13px; font-weight: 700; border: none; border-radius: 9px; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(45,122,79,0.25); white-space: nowrap; font-family: 'Inter', sans-serif; }
        .btn-create:hover:not(:disabled) { background: linear-gradient(135deg, #256840, #339958); transform: translateY(-1px); }
        .btn-create:disabled { opacity: 0.55; cursor: not-allowed; }
        .table-card { flex: 1; background: white; border: 1px solid var(--border); border-radius: 14px; display: flex; flex-direction: column; min-height: 0; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
        .table-header { padding: 14px 24px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--parchment); border-radius: 14px 14px 0 0; }
        .table-scroll { flex: 1; overflow-y: auto; min-height: 0; }
        .table-scroll::-webkit-scrollbar { width: 5px; }
        .table-scroll::-webkit-scrollbar-thumb { background: var(--border-dark); border-radius: 99px; }
        table { width: 100%; border-collapse: collapse; }
        thead { position: sticky; top: 0; background: white; z-index: 1; }
        thead tr { border-bottom: 1px solid var(--border); }
        th { text-align: left; padding: 10px 24px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--ink-faint); font-family: 'Inter', sans-serif; }
        tbody tr { border-bottom: 1px solid #f0ebe0; transition: background 0.15s; }
        tbody tr:last-child { border-bottom: none; }
        tbody tr:hover { background: var(--parchment); }
        tbody tr.clickable { cursor: pointer; }
        td { padding: 14px 24px; font-size: 13px; color: var(--ink-muted); font-family: 'Inter', sans-serif; }
        .td-name { font-weight: 600; color: var(--ink); font-size: 14px; }
        .status-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px; letter-spacing: 0.3px; font-family: 'Inter', sans-serif; }
        .status-live { background: var(--green-light); color: var(--green); border: 1px solid var(--green-border); }
        .status-other { background: var(--parchment); color: var(--ink-faint); border: 1px solid var(--border); }
        .td-date { font-size: 12px; color: var(--ink-faint); }
        .btn-start { padding: 7px 16px; background: linear-gradient(135deg, #2d7a4f, #3da066); color: white; font-size: 12px; font-weight: 700; border: none; border-radius: 7px; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s; }
        .btn-start:hover { transform: translateY(-1px); box-shadow: 0 3px 10px rgba(45,122,79,0.3); }
        .btn-open { padding: 7px 16px; background: var(--sky-light); color: var(--sky); border: 1px solid var(--sky-border); font-size: 12px; font-weight: 700; border-radius: 7px; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.15s; }
        .btn-open:hover { background: var(--sky); color: white; transform: translateY(-1px); }
        .empty-state { display: flex; align-items: center; justify-content: center; height: 100%; padding: 40px; }
        .empty-text { font-size: 13px; color: var(--ink-faint); font-style: italic; }
      `}</style>

      <div className="lobby-root">

        {/* NAV */}
        <header className="lobby-nav">
          <div className="nav-brand">
            <div className="nav-icon">🏏</div>
            <div>
              <div className="nav-title">Auction Lobby</div>
              <div className="nav-sub">Manage sessions &amp; participants</div>
            </div>
          </div>

          <div className="nav-actions">
            {/* Wallet for participants */}
            {!isAdmin && walletData?.balance != null && (
              <div className="chip">
                <span className="chip-label">Balance</span>
                <span className="chip-value">{fmt(Number(walletData.balance))}</span>
              </div>
            )}

            {/* Live indicator */}
            {liveAuctions.length > 0 && (
              <div className="live-chip">
                <span className="live-dot" />
                {liveAuctions.length > 1 ? `${liveAuctions.length} LIVE` : "LIVE"}
              </div>
            )}

            {/* View Players Pool */}
            <button className="btn-secondary"
              onClick={() => navigate({ to: "/auction/players", search: { page: 1, search: "" } })}>
              🏏 Players Pool
            </button>

            {/* Enter Live Auction */}
            {firstLiveId && (
              <button className="btn-primary"
                onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId: firstLiveId } })}>
                Enter Auction →
              </button>
            )}

            <div className="nav-divider" />

            <button className="btn-profile" onClick={() => navigate({ to: "/auction/profile", search: { q: "" } })}>
              <div className="btn-profile-avatar">{me?.name ? me.name.charAt(0).toUpperCase() : "?"}</div>
              <span>{me?.name ?? "Profile"}</span>
              <span style={{ color: "var(--ink-faint)", fontSize: 11 }}>›</span>
            </button>
            <button className="btn-logout" onClick={() => logout.mutate()}>↪ Logout</button>
          </div>
        </header>

        {/* BODY */}
        <div className="lobby-body">

          {/* Stats */}
          <div className="stat-strip">
            {[
              { label: "Live Auctions",  value: String(liveAuctions.length),  accent: "default" },
              { label: "Participants",   value: String(participantCount),      accent: "sky"     },
              { label: "Active Auction", value: liveAuctions[0]?.name ?? "—", accent: "green"   },
              { label: "Total Auctions", value: String(auctions?.length ?? 0), accent: "amber"  },
            ].map(({ label, value, accent }) => (
              <div key={label} className={`stat-card accent-${accent}`}>
                <div className="stat-label">{label}</div>
                <div className={`stat-value c-${accent}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Create auction (admin only) */}
          {isAdmin && (
            <div className="create-card">
              <div className="section-label">Create Auction</div>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="create-row">
                  <input {...form.register("name")} placeholder="Auction name…" className="create-input" />
                  <button type="submit" disabled={createAuction.isPending} className="btn-create">
                    {createAuction.isPending ? "Creating…" : "Create"}
                  </button>
                </div>
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
                    {(auctions as Auction[]).map(a => {
                      const isLive = a.status === "LIVE"
                      return (
                        <tr key={a.id}
                          onClick={() => { if (!isAdmin && isLive) navigate({ to: "/auction/$auctionId", params: { auctionId: a.id } }) }}
                          className={!isAdmin && isLive ? "clickable" : ""}>
                          <td className="td-name">{a.name}</td>
                          <td>
                            <span className={`status-badge ${isLive ? "status-live" : "status-other"}`}>
                              {isLive && <span className="live-dot" style={{ width: 5, height: 5 }} />}
                              {a.status}
                            </span>
                          </td>
                          <td className="td-date">{new Date(a.createdAt).toLocaleString()}</td>
                          {isAdmin && (
                            <td style={{ textAlign: "right" }}>
                              {a.status === "PRE_AUCTION" && (
                                <button className="btn-start" onClick={() => updateStatus.mutate({ id: a.id, status: "LIVE" })}>Start</button>
                              )}
                              {isLive && (
                                <button className="btn-open" onClick={() => navigate({ to: "/auction/$auctionId", params: { auctionId: a.id } })}>Open →</button>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state"><span className="empty-text">No auctions yet</span></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}