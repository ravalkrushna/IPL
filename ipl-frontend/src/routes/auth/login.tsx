/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"
import { loginSchema, LoginFormData } from "@/schema/auth.schema"
import { Form } from "@/components/ui/form"
import { FormFieldInput } from "@/components/shared/FormFieldInput"
import { login } from "@/lib/auth"

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
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
  }

  .auth-root {
    min-height: 100vh;
    background-color: var(--cream);
    background-image:
      radial-gradient(ellipse at 85% 0%, #e8f4ef 0%, transparent 50%),
      radial-gradient(ellipse at 0% 90%, #f0ece3 0%, transparent 45%);
    font-family: 'DM Sans', system-ui, sans-serif;
    color: var(--ink);
    display: flex;
    flex-direction: column;
  }

  /* ── NAV ── */
  .auth-nav {
    display: flex; align-items: center;
    padding: 0 32px; height: 60px;
    background: rgba(250,248,244,0.88);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 0 rgba(255,255,255,0.8), 0 2px 12px rgba(0,0,0,0.04);
  }
  .auth-nav-brand { display: flex; align-items: center; gap: 10px; }
  .auth-nav-icon {
    width: 34px; height: 34px;
    background: linear-gradient(135deg, #2d7a4f, #3da066);
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 8px rgba(45,122,79,0.3);
  }
  .auth-nav-title {
    font-family: 'Playfair Display', serif;
    font-size: 17px; font-weight: 900; color: var(--ink); letter-spacing: -0.3px;
  }
  .auth-nav-sub { font-size: 11px; color: var(--ink-faint); margin-top: 1px; }

  /* ── CENTER ── */
  .auth-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
  }

  /* ── CARD ── */
  .auth-card {
    width: 100%;
    max-width: 420px;
    background: white;
    border: 1px solid var(--border);
    border-radius: 20px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.07);
    overflow: hidden;
  }

  .auth-card-top {
    background: var(--parchment);
    border-bottom: 1px solid var(--border);
    padding: 28px 32px 24px;
  }

  .auth-eyebrow {
    font-size: 10px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;
    color: var(--green); display: flex; align-items: center; gap: 6px; margin-bottom: 10px;
  }
  .auth-eyebrow::before {
    content: ''; display: block; width: 18px; height: 2px;
    background: var(--green); border-radius: 2px;
  }

  .auth-card-title {
    font-family: 'Playfair Display', serif;
    font-size: 24px; font-weight: 900; color: var(--ink);
    letter-spacing: -0.4px; line-height: 1.15; margin: 0 0 6px;
  }

  .auth-card-sub {
    font-size: 13px; color: var(--ink-faint); font-weight: 500; margin: 0;
  }

  .auth-card-body {
    padding: 28px 32px 32px;
  }

  /* Override shadcn inputs */
  .auth-card-body input {
    height: 42px;
    background: var(--parchment) !important;
    border: 1.5px solid var(--border) !important;
    border-radius: 10px !important;
    color: var(--ink) !important;
    font-size: 13px;
    font-family: 'DM Sans', sans-serif;
  }
  .auth-card-body input:focus {
    border-color: var(--green) !important;
    background: white !important;
    box-shadow: 0 0 0 3px rgba(45,122,79,0.1) !important;
    outline: none !important;
  }
  .auth-card-body input::placeholder { color: var(--ink-faint); }

  /* ── SUBMIT BTN ── */
  .auth-submit {
    width: 100%; height: 44px; margin-top: 8px;
    background: linear-gradient(135deg, #2d7a4f, #3da066);
    color: white; font-size: 13px; font-weight: 800;
    font-family: 'DM Sans', sans-serif;
    border: none; border-radius: 10px; cursor: pointer; transition: all 0.2s;
    box-shadow: 0 2px 10px rgba(45,122,79,0.25);
    letter-spacing: 0.1px;
  }
  .auth-submit:hover:not(:disabled) {
    background: linear-gradient(135deg, #256840, #339958);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(45,122,79,0.35);
  }
  .auth-submit:disabled { opacity: 0.55; cursor: not-allowed; }

  /* ── FOOTER LINK ── */
  .auth-footer {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    text-align: center;
    font-size: 13px;
    color: var(--ink-faint);
  }
  .auth-footer-link {
    color: var(--green);
    font-weight: 700;
    background: none;
    border: none;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    transition: color 0.15s;
    padding: 0;
  }
  .auth-footer-link:hover { color: #256840; }
`

function LoginPage() {
  const navigate = useNavigate()
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate({ to: "/auction" }),
  })

  return (
    <div className="auth-root">
      <style>{styles}</style>

      {/* ── NAV ── */}
      <nav className="auth-nav">
        <div className="auth-nav-brand">
          <div className="auth-nav-icon">🏏</div>
          <div>
            <div className="auth-nav-title">BidXI</div>
            <div className="auth-nav-sub">Fantasy Cricket Auction</div>
          </div>
        </div>
      </nav>

      {/* ── BODY ── */}
      <div className="auth-body">
        <div className="auth-card">

          <div className="auth-card-top">
            <div className="auth-eyebrow">Welcome Back</div>
            <h1 className="auth-card-title">Sign In</h1>
            <p className="auth-card-sub">Enter your credentials to continue</p>
          </div>

          <div className="auth-card-body">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))}>
                <FormFieldInput
                  control={form.control}
                  name="email"
                  label="Email Address"
                />
                <FormFieldInput
                  control={form.control}
                  name="password"
                  label="Password"
                  type="password"
                />
                <button
                  type="submit"
                  className="auth-submit"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "Signing in…" : "Sign In"}
                </button>
              </form>
            </Form>

            <div className="auth-footer">
              Don't have an account?{" "}
              <button
                className="auth-footer-link"
                onClick={() => navigate({ to: "/auth/signup" })}
              >
                Create account
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}