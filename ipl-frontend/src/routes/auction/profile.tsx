/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { authApi } from "@/lib/auth"


/* ─── Route ─── */
export const Route = createFileRoute("/auction/profile")({
  component: ProfilePage,
})

/* ─── helpers ─── */
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
  @media (max-width: 600px) {
    .prof-form-grid { grid-template-columns: 1fr !important; }
  }
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
`

/* ─────────────── COMPONENT ─────────────── */
function ProfilePage() {
  const navigate = useNavigate()

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
  })

  const isAdmin = me?.role === "ADMIN"

/* ─ read-only form ─ */
  const form = useForm<ProfileForm>({
    values: { name: me?.name ?? "", email: me?.email ?? "" },
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
          <div className="prof-eyebrow">My Account</div>
          <h1 className="prof-page-title">Your Profile</h1>
          <p className="prof-page-sub">View your personal details.</p>
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

        {/* profile details — read-only */}
        <div className="prof-card">
          <div className="prof-card-header">
            <span className="prof-card-title">Profile Details</span>
          </div>
          <div className="prof-card-body">
            <div className="prof-form-grid">
              <div className="prof-field">
                <label className="prof-label">Full name</label>
                <Input
                  {...form.register("name")}
                  disabled
                  className="prof-input"
                />
              </div>
              <div className="prof-field">
                <label className="prof-label">Email address</label>
                <Input
                  {...form.register("email")}
                  type="email"
                  disabled
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
          </div>
        </div>

      </div>
    </div>
  )
}