/* eslint-disable react-refresh/only-export-components */

import { createFileRoute, Link } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: RouteComponent,
})

/* ─────────────── STYLES ─────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=DM+Sans:wght@400;500;600;700&display=swap');

  :root {
    --cream:          #faf8f4;
    --parchment:      #f3efe6;
    --parchment-mid:  #ede8dc;
    --border:         #e8e0d0;
    --border-dark:    #d5c9b5;
    --ink:            #1a1410;
    --ink-muted:      #6b5e4e;
    --ink-faint:      #a89880;
    --green:          #2d7a4f;
    --green-mid:      #3a9463;
    --green-light:    #edf7f1;
    --green-border:   #b8dfc9;
    --amber:          #b06b00;
    --amber-light:    #fef8ed;
    --amber-border:   #f0d88a;
    --rose:           #c0392b;
    --sky:            #1a5fa8;
    --sky-light:      #eff5fd;
  }

  * { box-sizing: border-box; }

  .home-root {
    background-color: var(--cream);
    color: var(--ink);
    font-family: 'DM Sans', system-ui, sans-serif;
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* ── NAV ── */
  .home-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    height: 62px;
    background: rgba(250,248,244,0.88);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 0 rgba(255,255,255,0.9), 0 2px 16px rgba(0,0,0,0.04);
  }

  .home-nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
  }

  .home-nav-icon {
    width: 34px; height: 34px;
    background: linear-gradient(135deg, #2d7a4f, #3da066);
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 17px;
    box-shadow: 0 2px 8px rgba(45,122,79,0.3);
    flex-shrink: 0;
  }

  .home-nav-name {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    font-weight: 900;
    color: var(--ink);
    letter-spacing: -0.3px;
  }

  .home-nav-tagline {
    font-size: 10px;
    color: var(--ink-faint);
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-top: 1px;
  }

  .home-nav-links {
    display: flex;
    align-items: center;
    gap: 28px;
  }

  .home-nav-link {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-muted);
    text-decoration: none;
    transition: color 0.15s;
  }
  .home-nav-link:hover { color: var(--green); }

  .home-nav-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-ghost-nav {
    height: 36px;
    padding: 0 18px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 700;
    font-family: 'DM Sans', sans-serif;
    border: 1px solid var(--border);
    background: white;
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 0.15s;
    text-decoration: none;
    display: inline-flex; align-items: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .btn-ghost-nav:hover {
    border-color: var(--border-dark);
    color: var(--ink);
    transform: translateY(-1px);
  }

  .btn-green-nav {
    height: 36px;
    padding: 0 20px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 800;
    font-family: 'DM Sans', sans-serif;
    border: none;
    background: linear-gradient(135deg, #2d7a4f, #3da066);
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-flex; align-items: center;
    box-shadow: 0 2px 10px rgba(45,122,79,0.28);
  }
  .btn-green-nav:hover {
    background: linear-gradient(135deg, #256840, #339958);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(45,122,79,0.38);
  }

  /* ── HERO ── */
  .hero-section {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    padding: 120px 40px 80px;
    text-align: center;
  }

  /* Animated shader-style background mesh */
  .hero-canvas-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
  }

  .hero-mesh-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.45;
    animation: meshFloat linear infinite;
    pointer-events: none;
  }

  .blob-1 {
    width: 600px; height: 600px;
    background: radial-gradient(circle, #c8ebd8 0%, #a8d4bb 50%, transparent 70%);
    top: -150px; left: -150px;
    animation-duration: 18s;
    animation-delay: 0s;
  }
  .blob-2 {
    width: 500px; height: 500px;
    background: radial-gradient(circle, #fdecc8 0%, #f5d99a 50%, transparent 70%);
    top: 30%; right: -120px;
    animation-duration: 22s;
    animation-delay: -7s;
  }
  .blob-3 {
    width: 700px; height: 450px;
    background: radial-gradient(circle, #e8f0fb 0%, #ccddf5 50%, transparent 70%);
    bottom: -100px; left: 20%;
    animation-duration: 26s;
    animation-delay: -13s;
  }
  .blob-4 {
    width: 350px; height: 350px;
    background: radial-gradient(circle, #fdf0ec 0%, #f5c8bb 50%, transparent 70%);
    top: 15%; left: 55%;
    animation-duration: 20s;
    animation-delay: -5s;
  }

  @keyframes meshFloat {
    0%   { transform: translate(0px, 0px) scale(1); }
    25%  { transform: translate(30px, -25px) scale(1.04); }
    50%  { transform: translate(-20px, 20px) scale(0.97); }
    75%  { transform: translate(15px, 35px) scale(1.02); }
    100% { transform: translate(0px, 0px) scale(1); }
  }

  /* Grain overlay for texture */
  .hero-grain {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 200px 200px;
  }

  .hero-content {
    position: relative;
    z-index: 2;
    max-width: 780px;
    margin: 0 auto;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 14px;
    border-radius: 99px;
    background: var(--green-light);
    border: 1px solid var(--green-border);
    font-size: 11px;
    font-weight: 800;
    color: var(--green);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 24px;
    animation: fadeUp 0.6s ease both;
  }

  .hero-badge-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--green);
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.5; transform: scale(0.8); }
  }

  .hero-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(42px, 7vw, 80px);
    font-weight: 900;
    line-height: 1.05;
    letter-spacing: -2px;
    color: var(--ink);
    margin: 0 0 8px;
    animation: fadeUp 0.7s ease 0.1s both;
  }

  .hero-title-em {
    font-style: italic;
    color: var(--green);
    position: relative;
  }

  .hero-title-em::after {
    content: '';
    position: absolute;
    bottom: 4px; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--green), transparent);
    border-radius: 2px;
    opacity: 0.4;
  }

  .hero-sub {
    font-size: clamp(15px, 2vw, 18px);
    color: var(--ink-muted);
    font-weight: 500;
    line-height: 1.65;
    max-width: 560px;
    margin: 18px auto 36px;
    animation: fadeUp 0.7s ease 0.2s both;
  }

  .hero-cta {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
    animation: fadeUp 0.7s ease 0.3s both;
  }

  .btn-hero-primary {
    height: 50px;
    padding: 0 32px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 800;
    font-family: 'DM Sans', sans-serif;
    border: none;
    background: linear-gradient(135deg, #2d7a4f, #3da066);
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 20px rgba(45,122,79,0.32), 0 1px 0 rgba(255,255,255,0.15) inset;
    letter-spacing: 0.1px;
  }
  .btn-hero-primary:hover {
    background: linear-gradient(135deg, #256840, #339958);
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(45,122,79,0.42);
  }

  .btn-hero-secondary {
    height: 50px;
    padding: 0 32px;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 700;
    font-family: 'DM Sans', sans-serif;
    border: 1.5px solid var(--border-dark);
    background: white;
    color: var(--ink-muted);
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-flex; align-items: center; gap: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  }
  .btn-hero-secondary:hover {
    border-color: var(--green);
    color: var(--green);
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  }

  /* hero scroll hint */
  .hero-scroll-hint {
    position: absolute;
    bottom: 32px; left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: var(--ink-faint);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    animation: fadeUp 0.8s ease 0.6s both;
  }

  .scroll-mouse {
    width: 20px; height: 32px;
    border: 1.5px solid var(--border-dark);
    border-radius: 10px;
    display: flex;
    justify-content: center;
    padding-top: 5px;
  }

  .scroll-wheel {
    width: 3px; height: 6px;
    background: var(--ink-faint);
    border-radius: 2px;
    animation: scrollWheel 1.8s ease infinite;
  }

  @keyframes scrollWheel {
    0%   { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(10px); opacity: 0; }
  }

  /* hero stat band */
  .hero-stats-band {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: center;
    gap: 0;
    margin-top: 56px;
    animation: fadeUp 0.7s ease 0.4s both;
  }

  .hero-stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0 32px;
    border-right: 1px solid var(--border);
  }
  .hero-stat-item:last-child { border-right: none; }

  .hero-stat-num {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 28px;
    font-weight: 900;
    color: var(--ink);
    letter-spacing: -0.5px;
  }

  .hero-stat-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-faint);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── SECTION SHARED ── */
  .section {
    padding: 96px 40px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--green);
    margin-bottom: 14px;
  }

  .section-tag::before {
    content: '';
    display: block;
    width: 20px; height: 2px;
    background: var(--green);
    border-radius: 2px;
  }

  .section-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 900;
    color: var(--ink);
    letter-spacing: -0.8px;
    line-height: 1.1;
    margin: 0 0 16px;
  }

  .section-sub {
    font-size: 16px;
    color: var(--ink-muted);
    font-weight: 500;
    line-height: 1.65;
    max-width: 520px;
  }

  /* ── HOW IT WORKS ── */
  .hiw-section {
    background: var(--parchment);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 96px 40px;
  }

  .hiw-inner {
    max-width: 1200px;
    margin: 0 auto;
  }

  .hiw-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
    margin-top: 52px;
  }

  .hiw-card {
    background: white;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 28px 24px;
    position: relative;
    box-shadow: 0 2px 12px rgba(0,0,0,0.05);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .hiw-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 28px rgba(0,0,0,0.09);
  }

  .hiw-step-num {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 11px;
    font-weight: 800;
    color: var(--green);
    letter-spacing: 0.5px;
    margin-bottom: 14px;
    text-transform: uppercase;
  }

  .hiw-step-icon {
    font-size: 32px;
    margin-bottom: 14px;
    display: block;
  }

  .hiw-step-title {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
    margin: 0 0 8px;
    letter-spacing: -0.3px;
  }

  .hiw-step-desc {
    font-size: 13px;
    color: var(--ink-muted);
    line-height: 1.65;
    font-weight: 500;
  }

  .hiw-connector {
    position: absolute;
    top: 36px; right: -10px;
    width: 20px; height: 2px;
    background: var(--border-dark);
    display: none;
  }

  /* ── CRICKET INFO ── */
  .cricket-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    align-items: center;
    margin-top: 52px;
  }

  @media (max-width: 768px) {
    .cricket-grid { grid-template-columns: 1fr; }
  }

  .cricket-text-block {}

  .cricket-visual {
    background: white;
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 32px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
    position: relative;
    overflow: hidden;
  }

  .cricket-visual::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--green), #5bb88a, var(--amber));
    border-radius: 20px 20px 0 0;
  }

  .cricket-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 0;
    border-bottom: 1px solid var(--border);
  }
  .cricket-stat-row:last-child { border-bottom: none; padding-bottom: 0; }

  .cricket-stat-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--ink-muted);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cricket-stat-value {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 15px;
    font-weight: 800;
    color: var(--ink);
    letter-spacing: -0.3px;
  }

  .cricket-stat-value.green { color: var(--green); }
  .cricket-stat-value.amber { color: var(--amber); }

  .cricket-para {
    font-size: 15px;
    color: var(--ink-muted);
    line-height: 1.75;
    font-weight: 500;
    margin-bottom: 20px;
  }
  .cricket-para:last-child { margin-bottom: 0; }

  /* ── FEATURES ── */
  .features-section {
    background: var(--parchment);
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    padding: 96px 40px;
  }

  .features-inner {
    max-width: 1200px;
    margin: 0 auto;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-top: 52px;
  }

  @media (max-width: 900px) {
    .features-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 600px) {
    .features-grid { grid-template-columns: 1fr; }
  }

  .feat-card {
    background: white;
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .feat-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 6px 22px rgba(0,0,0,0.08);
  }

  .feat-icon-wrap {
    width: 44px; height: 44px;
    border-radius: 11px;
    display: flex;
    align-items: center; justify-content: center;
    font-size: 20px;
    margin-bottom: 16px;
    border: 1px solid transparent;
  }

  .feat-icon-wrap.green { background: var(--green-light); border-color: var(--green-border); }
  .feat-icon-wrap.amber { background: var(--amber-light); border-color: var(--amber-border); }
  .feat-icon-wrap.sky   { background: var(--sky-light);   border-color: #b8d0ee; }

  .feat-title {
    font-family: 'Playfair Display', serif;
    font-size: 17px;
    font-weight: 700;
    color: var(--ink);
    margin: 0 0 8px;
    letter-spacing: -0.2px;
  }

  .feat-desc {
    font-size: 13px;
    color: var(--ink-muted);
    line-height: 1.65;
    font-weight: 500;
  }

  /* ── TESTIMONIALS / JOY SECTION ── */
  .joy-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-top: 52px;
  }

  @media (max-width: 800px) {
    .joy-grid { grid-template-columns: 1fr; }
  }

  .joy-card {
    background: white;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.04);
    position: relative;
  }

  .joy-quote-mark {
    font-family: 'Playfair Display', serif;
    font-size: 56px;
    line-height: 1;
    color: var(--green-border);
    font-weight: 900;
    position: absolute;
    top: 12px; left: 20px;
    user-select: none;
  }

  .joy-text {
    font-size: 14px;
    color: var(--ink-muted);
    line-height: 1.7;
    font-weight: 500;
    font-style: italic;
    padding-top: 28px;
    margin-bottom: 20px;
  }

  .joy-author {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .joy-avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
    border: 1.5px solid var(--border);
  }

  .joy-author-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
  }

  .joy-author-role {
    font-size: 11px;
    color: var(--ink-faint);
    font-weight: 600;
  }

  /* ── AUCTION SPOTLIGHT ── */
  .spotlight-band {
    background: linear-gradient(135deg, #1e4d35 0%, #2d7a4f 50%, #1e4d35 100%);
    padding: 80px 40px;
    position: relative;
    overflow: hidden;
  }

  .spotlight-band::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    opacity: 0.04;
    background-size: 200px;
  }

  .spotlight-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.25;
    pointer-events: none;
  }

  .sblob-1 {
    width: 400px; height: 300px;
    background: #5bb88a;
    top: -80px; left: -80px;
  }
  .sblob-2 {
    width: 300px; height: 300px;
    background: #f5d99a;
    bottom: -60px; right: -60px;
  }

  .spotlight-inner {
    max-width: 900px;
    margin: 0 auto;
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 48px;
    flex-wrap: wrap;
  }

  .spotlight-text {
    flex: 1;
    min-width: 260px;
  }

  .spotlight-eyebrow {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: rgba(255,255,255,0.55);
    margin-bottom: 12px;
  }

  .spotlight-title {
    font-family: 'Playfair Display', serif;
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 900;
    color: white;
    letter-spacing: -0.8px;
    line-height: 1.1;
    margin: 0 0 16px;
  }

  .spotlight-sub {
    font-size: 15px;
    color: rgba(255,255,255,0.7);
    font-weight: 500;
    line-height: 1.65;
  }

  .spotlight-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-shrink: 0;
  }

  .btn-spotlight-primary {
    height: 48px;
    padding: 0 28px;
    border-radius: 11px;
    font-size: 14px;
    font-weight: 800;
    font-family: 'DM Sans', sans-serif;
    border: none;
    background: white;
    color: var(--green);
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    white-space: nowrap;
  }
  .btn-spotlight-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 24px rgba(0,0,0,0.2);
  }

  .btn-spotlight-secondary {
    height: 48px;
    padding: 0 28px;
    border-radius: 11px;
    font-size: 14px;
    font-weight: 700;
    font-family: 'DM Sans', sans-serif;
    border: 1.5px solid rgba(255,255,255,0.3);
    background: transparent;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-flex; align-items: center; gap: 8px;
    white-space: nowrap;
  }
  .btn-spotlight-secondary:hover {
    background: rgba(255,255,255,0.1);
    border-color: rgba(255,255,255,0.6);
    transform: translateY(-2px);
  }

  /* ── FOOTER ── */
  .home-footer {
    background: var(--parchment);
    border-top: 1px solid var(--border);
    padding: 40px 40px;
  }

  .footer-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 20px;
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
  }

  .footer-links {
    display: flex;
    gap: 24px;
    align-items: center;
  }

  .footer-link {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink-faint);
    text-decoration: none;
    transition: color 0.15s;
  }
  .footer-link:hover { color: var(--green); }

  .footer-copy {
    font-size: 12px;
    color: var(--ink-faint);
    font-weight: 500;
  }

  /* ── Divider strip ── */
  .gradient-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-dark), transparent);
    margin: 0;
  }

  /* player bid card floating decoration */
  .hero-floating-card {
    position: absolute;
    z-index: 2;
    background: white;
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    gap: 10px;
    animation: floatCard linear infinite alternate;
    pointer-events: none;
  }

  .hfc-left { display: flex; flex-direction: column; gap: 2px; }
  .hfc-name { font-size: 12px; font-weight: 800; color: var(--ink); }
  .hfc-role { font-size: 10px; color: var(--ink-faint); font-weight: 600; }
  .hfc-bid  {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px;
    font-weight: 900;
    color: var(--green);
    letter-spacing: -0.3px;
  }

  .hfc-flag { font-size: 22px; flex-shrink: 0; }

  .fc-1 {
    top: 22%; left: 5%;
    animation-duration: 4s;
    animation-delay: 0s;
  }
  .fc-2 {
    top: 35%; right: 4%;
    animation-duration: 5s;
    animation-delay: -2s;
  }
  .fc-3 {
    bottom: 25%; left: 8%;
    animation-duration: 4.5s;
    animation-delay: -1s;
  }

  @keyframes floatCard {
    from { transform: translateY(0px); }
    to   { transform: translateY(-12px); }
  }

  /* ── Responsive nav ── */
  @media (max-width: 640px) {
    .home-nav-links { display: none; }
    .home-nav { padding: 0 20px; }
    .hero-section { padding: 100px 24px 64px; }
    .section { padding: 64px 24px; }
    .fc-1, .fc-3 { display: none; }
    .spotlight-inner { flex-direction: column; text-align: center; }
  }
`

/* ─────────────── DATA ─────────────── */

const HOW_IT_WORKS = [
  {
    step: "Step 01",
    icon: "🏟️",
    title: "Join the Auction",
    desc: "Sign up, get your wallet budget and enter a live auction room. Every participant starts on equal footing with the same spending power.",
  },
  {
    step: "Step 02",
    icon: "📋",
    title: "Browse the Pool",
    desc: "Explore hundreds of real cricket players — batters, bowlers, all-rounders and wicket-keepers — each with base prices and specialisms.",
  },
  {
    step: "Step 03",
    icon: "⚡",
    title: "Bid & Win",
    desc: "When a player goes LIVE, place your bid before anyone else. Outbid rivals, manage your budget and build the squad of your dreams.",
  },
  {
    step: "Step 04",
    icon: "🏆",
    title: "Build Your XI",
    desc: "Assemble your fantasy XI from players you won. Watch the leaderboard, celebrate your picks and show off your squad to friends.",
  },
]

const FEATURES = [
  {
    icon: "⚡",
    color: "amber",
    title: "Live Auction Rooms",
    desc: "Bid in real-time with friends and rivals. See every bid, every counter and every hammer drop as it happens.",
  },
  {
    icon: "💰",
    color: "green",
    title: "Smart Budget System",
    desc: "Each participant gets a wallet. Spend wisely — splash on your star player or spread your budget across a balanced squad.",
  },
  {
    icon: "🌍",
    color: "sky",
    title: "International Pool",
    desc: "Players from India, Australia, England, West Indies, Pakistan and beyond. All formats, all eras.",
  },
  {
    icon: "📊",
    color: "green",
    title: "Live Leaderboard",
    desc: "Track every participant's remaining balance in real time. Know who's flush and who's stretching thin.",
  },
  {
    icon: "🎯",
    color: "amber",
    title: "Multiple Auctions",
    desc: "Admins can run unlimited auction sessions. Run a T20 draft, an ODI special, or an all-time legends auction.",
  },
  {
    icon: "👥",
    color: "sky",
    title: "All Ages Welcome",
    desc: "From grandparents who watched the 1983 World Cup to kids glued to the IPL — BidXI brings everyone to the table.",
  },
]

const JOY_CARDS = [
  {
    text: "I've been a cricket fan for 40 years and BidXI made me feel like a real team owner for the first time. When I won the bidding war for my all-time favourite player, the whole family went wild!",
    name: "Ramesh Patel",
    role: "Fan since 1983",
    emoji: "🧓",
    bg: "#fef8ed",
  },
  {
    text: "Our office fantasy auction turned into the most competitive event of the year. People who barely watch cricket were suddenly glued to the live bidding. Absolute chaos, in the best way.",
    name: "Priya Mehta",
    role: "Office Organizer",
    emoji: "👩‍💼",
    bg: "#edf7f1",
  },
  {
    text: "My kids and I sat together bidding for players late into the night. My 12-year-old beat me to Rohit and I genuinely couldn't be prouder. This game is pure gold.",
    name: "Arun Sharma",
    role: "Dad & Cricket Tragic",
    emoji: "👨‍👦",
    bg: "#eff5fd",
  },
]

const CRICKET_STATS = [
  { label: "🌍  Countries represented", value: "16+", color: "green" },
  { label: "🎯  Playing roles available", value: "4 types", color: "" },
  { label: "⚡  Avg. auction session", value: "~90 min", color: "amber" },
  { label: "👥  Max participants", value: "Unlimited", color: "green" },
  { label: "💰  Starting budget", value: "₹100 Cr", color: "" },
]

/* ─────────────── COMPONENT ─────────────── */

function RouteComponent() {
  return (
    <div className="home-root">
      <style>{styles}</style>

      {/* ══════ NAV ══════ */}
      <nav className="home-nav">
        <Link to="/" className="home-nav-brand">
          <div className="home-nav-icon">🏏</div>
          <div>
            <div className="home-nav-name">BidXI</div>
            <div className="home-nav-tagline">Fantasy Cricket Auction</div>
          </div>
        </Link>

        <div className="home-nav-links">
          <a href="#how-it-works" className="home-nav-link">How it works</a>
          <a href="#cricket"       className="home-nav-link">The Game</a>
          <a href="#features"      className="home-nav-link">Features</a>
        </div>

        <div className="home-nav-actions">
          <Link to="/auth/login"  className="btn-ghost-nav">Log in</Link>
          <Link to="/auth/signup" className="btn-green-nav">Get started →</Link>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section className="hero-section">
        {/* Shader-inspired animated mesh background */}
        <div className="hero-canvas-bg">
          <div className="hero-mesh-blob blob-1" />
          <div className="hero-mesh-blob blob-2" />
          <div className="hero-mesh-blob blob-3" />
          <div className="hero-mesh-blob blob-4" />
          <div className="hero-grain" />
        </div>

        {/* Floating player cards */}
        <div className="hero-floating-card fc-1">
          <span className="hfc-flag">🇮🇳</span>
          <div className="hfc-left">
            <span className="hfc-name">V. Kohli</span>
            <span className="hfc-role">Batter</span>
          </div>
          <span className="hfc-bid">₹15 Cr</span>
        </div>

        <div className="hero-floating-card fc-2">
          <span className="hfc-flag">🇦🇺</span>
          <div className="hfc-left">
            <span className="hfc-name">P. Cummins</span>
            <span className="hfc-role">Fast Bowler</span>
          </div>
          <span className="hfc-bid">₹9.5 Cr</span>
        </div>

        <div className="hero-floating-card fc-3">
          <span className="hfc-flag">🏴󠁧󠁢󠁥󠁮󠁧󠁿</span>
          <div className="hfc-left">
            <span className="hfc-name">B. Stokes</span>
            <span className="hfc-role">All-Rounder</span>
          </div>
          <span className="hfc-bid">₹11 Cr</span>
        </div>

        {/* Hero content */}
        <div className="hero-content">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Fantasy Cricket Auction — Live Now
          </div>

          <h1 className="hero-title">
            Own the players<br />
            <span className="hero-title-em">you always dreamed of</span>
          </h1>

          <p className="hero-sub">
            BidXI brings the thrill of the IPL auction to your living room. Build your fantasy squad by
            bidding on real cricket stars, manage your budget and outsmart your rivals — all in real time.
          </p>

          <div className="hero-cta">
            <Link to="/auth/signup" className="btn-hero-primary">
              Start Bidding Free →
            </Link>
            <a href="#how-it-works" className="btn-hero-secondary">
              ▶ How it works
            </a>
          </div>

          {/* Stat band */}
          <div className="hero-stats-band">
            {[
              { num: "600+", label: "Players" },
              { num: "16",   label: "Nations" },
              { num: "∞",   label: "Auctions" },
              { num: "100%", label: "Free to Play" },
            ].map(({ num, label }) => (
              <div key={label} className="hero-stat-item">
                <span className="hero-stat-num">{num}</span>
                <span className="hero-stat-label">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-scroll-hint">
          <div className="scroll-mouse">
            <div className="scroll-wheel" />
          </div>
          Scroll
        </div>
      </section>

      <div className="gradient-divider" />

      {/* ══════ HOW IT WORKS ══════ */}
      <section id="how-it-works" className="hiw-section">
        <div className="hiw-inner">
          <div className="section-tag">How it works</div>
          <h2 className="section-title">From the lobby to your<br />dream XI in four steps</h2>
          <p className="section-sub" style={{ marginTop: 8 }}>
            No experience needed. Whether you're a seasoned fan or new to cricket,
            BidXI is intuitive, exciting and endlessly replayable.
          </p>

          <div className="hiw-grid">
            {HOW_IT_WORKS.map(({ step, icon, title, desc }) => (
              <div key={step} className="hiw-card">
                <div className="hiw-step-num">{step}</div>
                <span className="hiw-step-icon">{icon}</span>
                <h3 className="hiw-step-title">{title}</h3>
                <p className="hiw-step-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="gradient-divider" />

      {/* ══════ CRICKET INFO ══════ */}
      <section id="cricket" className="section">
        <div className="section-tag">The Game</div>
        <h2 className="section-title">Cricket — the sport that<br />unites a billion hearts</h2>

        <div className="cricket-grid">
          <div className="cricket-text-block">
            <p className="cricket-para">
              Cricket is more than a sport — it's a shared language spoken across India, Pakistan,
              Australia, England, the Caribbean and beyond. For over 150 years, it has brought
              communities together through centuries, hat-tricks and nail-biting last-over finishes.
            </p>
            <p className="cricket-para">
              The IPL auction made team ownership feel tangible — franchises fighting for their
              favourite players, bidding wars breaking the internet. BidXI distils that same electricity
              and puts it in your hands. You call the shots. You decide who wears your colours.
            </p>
            <p className="cricket-para">
              Whether your heart belongs to classic Test legends or the sixes-smashing stars of T20,
              our player pool spans every era and every nation. Your perfect XI is out there — go build it.
            </p>

            <div style={{ marginTop: 28, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span style={{
                background: "var(--green-light)", border: "1px solid var(--green-border)",
                color: "var(--green)", borderRadius: 8, padding: "5px 12px",
                fontSize: 12, fontWeight: 700
              }}>🏏 Batters</span>
              <span style={{
                background: "var(--amber-light)", border: "1px solid var(--amber-border)",
                color: "var(--amber)", borderRadius: 8, padding: "5px 12px",
                fontSize: 12, fontWeight: 700
              }}>⚡ Bowlers</span>
              <span style={{
                background: "var(--sky-light)", border: "1px solid #b8d0ee",
                color: "var(--sky)", borderRadius: 8, padding: "5px 12px",
                fontSize: 12, fontWeight: 700
              }}>🌟 All-Rounders</span>
              <span style={{
                background: "#fdf2f0", border: "1px solid #f5c4b8",
                color: "var(--rose)", borderRadius: 8, padding: "5px 12px",
                fontSize: 12, fontWeight: 700
              }}>🧤 Wicket-Keepers</span>
            </div>
          </div>

          <div className="cricket-visual">
            <p style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 16, color: "var(--ink)", marginBottom: 20, letterSpacing: "-0.2px" }}>
              BidXI at a Glance
            </p>
            {CRICKET_STATS.map(({ label, value, color }) => (
              <div key={label} className="cricket-stat-row">
                <span className="cricket-stat-label">{label}</span>
                <span className={`cricket-stat-value ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="gradient-divider" />

      {/* ══════ FEATURES ══════ */}
      <section id="features" className="features-section">
        <div className="features-inner">
          <div className="section-tag">Features</div>
          <h2 className="section-title">Everything you need for<br />the perfect auction</h2>

          <div className="features-grid">
            {FEATURES.map(({ icon, color, title, desc }) => (
              <div key={title} className="feat-card">
                <div className={`feat-icon-wrap ${color}`}>{icon}</div>
                <h3 className="feat-title">{title}</h3>
                <p className="feat-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="gradient-divider" />

      {/* ══════ JOY SECTION ══════ */}
      <section className="section">
        <div className="section-tag">The Joy</div>
        <h2 className="section-title">Bringing generations<br />together, one bid at a time</h2>
        <p className="section-sub" style={{ marginTop: 8 }}>
          From kids' birthday parties to office leagues to family reunions — BidXI creates moments
          that people talk about long after the gavel falls.
        </p>

        <div className="joy-grid">
          {JOY_CARDS.map(({ text, name, role, emoji, bg }) => (
            <div key={name} className="joy-card" style={{ background: bg }}>
              <span className="joy-quote-mark">"</span>
              <p className="joy-text">{text}</p>
              <div className="joy-author">
                <div className="joy-avatar" style={{ background: "white" }}>{emoji}</div>
                <div>
                  <div className="joy-author-name">{name}</div>
                  <div className="joy-author-role">{role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ CTA BAND ══════ */}
      <div className="spotlight-band">
        <div className="spotlight-blob sblob-1" />
        <div className="spotlight-blob sblob-2" />
        <div className="spotlight-inner">
          <div className="spotlight-text">
            <div className="spotlight-eyebrow">Ready to play?</div>
            <h2 className="spotlight-title">Your XI won't<br />build itself.</h2>
            <p className="spotlight-sub">
              Join BidXI for free, enter your first auction and experience the rush of winning
              your favourite player at the buzzer. It only takes a minute to sign up.
            </p>
          </div>
          <div className="spotlight-actions">
            <Link to="/auth/signup" className="btn-spotlight-primary">
              Create free account →
            </Link>
            <Link to="/auth/login" className="btn-spotlight-secondary">
              Already have an account
            </Link>
          </div>
        </div>
      </div>

      {/* ══════ FOOTER ══════ */}
      <footer className="home-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="home-nav-icon" style={{ width: 28, height: 28, fontSize: 14, borderRadius: 7 }}>🏏</div>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900, fontSize: 16, color: "var(--ink)" }}>
              BidXI
            </span>
          </div>

          <div className="footer-links">
            <a href="#how-it-works" className="footer-link">How it works</a>
            <a href="#cricket"       className="footer-link">The Game</a>
            <a href="#features"      className="footer-link">Features</a>
            <Link to="/auth/login"   className="footer-link">Login</Link>
            <Link to="/auth/signup"  className="footer-link">Sign up</Link>
          </div>

          <span className="footer-copy">© 2026 BidXI · Fantasy Cricket Auction</span>
        </div>
      </footer>
    </div>
  )
}