/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { playerApi } from "@/lib/playerApi"
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
import { api } from "@/lib/api"

export const Route = createFileRoute("/auction/players")({
  validateSearch: z.object({
    page:   z.number().catch(1),
    search: z.string().catch(""),
  }),
  component: PlayersPoolPage,
})

// ── Types ─────────────────────────────────────────────────────────────────────
type UploadResult = {
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
  .pp-body { padding: 32px 32px 64px; }
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
  .pp-sub { font-size: 13px; color: var(--ink-faint); margin: 0; font-weight: 500; }
  .pp-header > div:first-child { min-width: 0; }
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

  /* ── Upload button ── */
  .btn-upload {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 0 16px; height: 36px; border-radius: 9px;
    font-size: 12px; font-weight: 700; font-family: 'DM Sans', sans-serif;
    background: var(--green); color: white; border: none;
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
    box-shadow: 0 2px 8px rgba(45,122,79,0.25);
    flex-shrink: 0;
  }
  .btn-upload:hover:not(:disabled) {
    background: #256b43; transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(45,122,79,0.35);
  }
  .btn-upload:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

  /* ── Uploading overlay ── */
  .pp-uploading-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(26,20,16,0.45);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: pp-fade-in 0.2s ease;
  }
  .pp-uploading-card {
    background: white; border-radius: 18px;
    padding: 32px 40px;
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    min-width: 260px;
  }
  .pp-uploading-spinner {
    width: 44px; height: 44px;
    border: 3px solid var(--border);
    border-top-color: var(--green);
    border-radius: 50%;
    animation: pp-spin 0.8s linear infinite;
  }
  @keyframes pp-spin { to { transform: rotate(360deg); } }
  .pp-uploading-label {
    font-size: 15px; font-weight: 700; color: var(--ink);
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
  .pp-uploading-sub {
    font-size: 12px; color: var(--ink-faint); font-weight: 500; margin-top: -8px;
  }

  /* ── Result banner ── */
  .pp-upload-result {
    display: flex; align-items: flex-start; gap: 14px;
    border-radius: 14px; padding: 16px 20px; margin-bottom: 18px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08);
    animation: pp-slide-in 0.3s cubic-bezier(0.16,1,0.3,1);
    border: 1.5px solid transparent;
  }
  @keyframes pp-slide-in {
    from { opacity: 0; transform: translateY(-10px) scale(0.98); }
    to   { opacity: 1; transform: none; }
  }
  .pp-upload-result.success { background: var(--green-light); border-color: var(--green-border); }
  .pp-upload-result.error   { background: var(--rose-light);  border-color: var(--rose-border); }
  .pp-upload-result-icon { font-size: 24px; flex-shrink: 0; line-height: 1; margin-top: 1px; }
  .pp-upload-result-body { flex: 1; min-width: 0; }
  .pp-upload-result-title {
    font-size: 14px; font-weight: 800; color: var(--ink); margin-bottom: 8px;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }
  .pp-upload-result-stats { display: flex; flex-wrap: wrap; gap: 6px; }
  .pp-upload-stat-chip {
    display: inline-flex; align-items: center; gap: 5px;
    background: white; border: 1px solid var(--border);
    border-radius: 7px; padding: 3px 10px;
    font-size: 12px; font-weight: 600; color: var(--ink-muted);
  }
  .pp-upload-stat-chip strong {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13px; font-weight: 800; color: var(--ink);
  }
  .pp-upload-result-errors { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
  .pp-upload-result-errors li {
    font-size: 12px; color: var(--rose); font-weight: 600;
    list-style: none; display: flex; align-items: center; gap: 6px;
  }
  .pp-upload-result-errors li::before { content: '⚠️'; font-size: 11px; }
  .pp-upload-error-msg { font-size: 13px; color: var(--rose); font-weight: 600; }
  .pp-upload-dismiss {
    background: none; border: none; cursor: pointer;
    font-size: 18px; color: var(--ink-faint); padding: 2px; line-height: 1;
    flex-shrink: 0; border-radius: 6px; transition: all 0.12s;
  }
  .pp-upload-dismiss:hover { color: var(--ink); background: rgba(0,0,0,0.06); }

  .pp-csv-hint {
    font-size: 11px; color: var(--ink-faint); font-weight: 500;
    margin-bottom: 16px; padding: 10px 14px;
    background: var(--parchment); border: 1px solid var(--border);
    border-radius: 8px; display: flex; align-items: flex-start; gap: 8px;
  }
  .pp-csv-hint code {
    font-family: monospace; font-size: 10px; color: var(--ink-muted);
    background: var(--parchment-mid); padding: 1px 5px; border-radius: 4px;
  }
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
  .pp-cell-iplteam { color: var(--ink-muted) !important; font-size: 12px !important; font-weight: 600 !important; }
  .pp-cell-price {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
    font-size: 13px !important; font-weight: 800 !important;
    color: var(--green) !important; text-align: right !important;
    letter-spacing: -0.2px !important; font-variant-numeric: tabular-nums;
  }
  .pp-badge-role {
    background: var(--parchment-mid) !important; border: 1px solid var(--border) !important;
    color: var(--ink-muted) !important; font-size: 10px !important; font-weight: 700 !important;
    letter-spacing: 0.4px !important; padding: 2px 8px !important; border-radius: 6px !important;
    text-transform: uppercase; font-family: 'DM Sans', sans-serif;
  }
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
  .pp-skel {
    border-radius: 5px;
    background: linear-gradient(90deg, var(--parchment) 25%, var(--border) 50%, var(--parchment) 75%);
    background-size: 400% 100%; animation: pp-shimmer 1.6s ease infinite;
  }
  @keyframes pp-shimmer {
    0%   { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
  .pp-empty-inner {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 64px 20px; color: var(--ink-faint); gap: 10px;
  }
  .pp-empty-icon { font-size: 36px; opacity: 0.35; }
  .pp-empty-text { font-size: 14px; font-weight: 600; color: var(--ink-faint); }
  .pp-empty-hint { font-size: 12px; color: var(--ink-faint); opacity: 0.7; }
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
  @keyframes pp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @media (max-width: 600px) {
    .pp-nav { padding: 0 14px !important; height: 52px !important; }
    .pp-nav-icon { width: 30px !important; height: 30px !important; font-size: 14px !important; }
    .pp-nav-title { font-size: 14px !important; }
    .pp-nav-sub { display: none !important; }
    .pp-body { padding: 16px 12px 48px !important; }
    .pp-header { margin-bottom: 14px !important; gap: 8px !important; }
    .pp-title { font-size: 20px !important; }
    .pp-sub { font-size: 12px !important; }
    .pp-eyebrow { font-size: 9px !important; margin-bottom: 4px !important; }
    .pp-stat-pill { padding: 6px 10px !important; gap: 6px !important; }
    .pp-stat-label { font-size: 10px !important; }
    .pp-stat-value { font-size: 12px !important; }
    .pp-toolbar { padding: 10px 12px !important; gap: 8px !important; margin-bottom: 12px !important; }
    .pp-toolbar-search { min-width: 0 !important; flex: 1 !important; }
    .pp-toolbar-perpage { display: none !important; }
    .pp-table-shell { border-radius: 10px !important; }
    .pp-table-shell thead th { padding: 9px 10px !important; font-size: 9px !important; }
    .pp-table-shell tbody td { padding: 10px 10px !important; }
    .pp-col-role, .pp-col-iplteam, .pp-col-status { display: none !important; }
    .pp-cell-name { font-size: 12px !important; }
    .pp-mobile-sub { display: flex !important; align-items: center; gap: 5px; margin-top: 2px; }
    .pp-mobile-role-dot { display: inline-block !important; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
    .pp-mobile-sold-chip {
      display: inline-flex !important; align-items: center;
      font-size: 9px; font-weight: 800; letter-spacing: 0.4px;
      padding: 1px 6px; border-radius: 4px;
      background: var(--green-light); border: 1px solid var(--green-border);
      color: var(--green); text-transform: uppercase;
    }
    .pp-cell-price { font-size: 12px !important; }
    .pp-cell-num { width: 28px !important; font-size: 10px !important; padding: 10px 6px !important; }
    .pp-pager-btn { height: 32px !important; padding: 0 12px !important; font-size: 12px !important; }
    .pp-pager-label { font-size: 12px !important; min-width: 56px !important; }
    .btn-upload span.btn-upload-label { display: none !important; }
    .pp-uploading-card { padding: 24px 28px !important; min-width: 200px !important; }
  }
  @media (min-width: 601px) and (max-width: 900px) {
    .pp-nav { padding: 0 20px !important; }
    .pp-body { padding: 20px 20px 48px !important; }
    .pp-title { font-size: 22px !important; }
    .pp-table-shell thead th { padding: 10px 14px !important; }
    .pp-table-shell tbody td { padding: 11px 14px !important; }
  }
  .pp-mobile-sub       { display: none; }
  .pp-mobile-role-dot  { display: none; }
  .pp-mobile-sold-chip { display: none; }

  /* ── Add player button ── */
  .btn-add {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 0 16px; height: 36px; border-radius: 9px;
    font-size: 12px; font-weight: 700; font-family: 'DM Sans', sans-serif;
    background: white; color: var(--green); border: 1px solid var(--green-border);
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    flex-shrink: 0;
  }
  .btn-add:hover:not(:disabled) {
    background: var(--green-light); border-color: var(--green);
    transform: translateY(-1px);
  }
  .btn-add:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── Modal ── */
  .pp-modal-overlay {
    position: fixed; inset: 0; z-index: 220;
    background: rgba(26,20,16,0.45);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: pp-fade-in 0.15s ease;
    padding: 20px;
  }
  .pp-modal {
    background: white; border-radius: 16px;
    width: 100%; max-width: 560px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 24px 60px rgba(0,0,0,0.25);
    animation: pp-slide-in 0.25s cubic-bezier(0.16,1,0.3,1);
  }
  .pp-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 24px; border-bottom: 1px solid var(--border);
  }
  .pp-modal-title {
    font-family: 'Playfair Display', serif;
    font-size: 20px; font-weight: 900; color: var(--ink);
    letter-spacing: -0.3px;
  }
  .pp-modal-body {
    padding: 20px 24px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
  }
  .pp-modal-body .pp-field-full { grid-column: 1 / -1; }
  .pp-field-label {
    display: block;
    font-size: 11px; font-weight: 700; letter-spacing: 0.4px;
    text-transform: uppercase; color: var(--ink-faint);
    margin-bottom: 6px;
  }
  .pp-field-input, .pp-field-select {
    width: 100%; height: 38px;
    padding: 0 12px; border-radius: 8px;
    background: var(--parchment);
    border: 1px solid var(--border);
    color: var(--ink);
    font-size: 13px; font-family: 'DM Sans', sans-serif;
    box-sizing: border-box;
    transition: all 0.15s;
  }
  .pp-field-input:focus, .pp-field-select:focus {
    outline: none;
    border-color: var(--green);
    background: white;
    box-shadow: 0 0 0 3px rgba(45,122,79,0.1);
  }
  .pp-modal-footer {
    display: flex; justify-content: flex-end; gap: 10px;
    padding: 16px 24px; border-top: 1px solid var(--border);
    background: var(--parchment);
    border-radius: 0 0 16px 16px;
  }
  .pp-modal-error {
    grid-column: 1 / -1;
    background: var(--rose-light); border: 1px solid var(--rose-border);
    border-radius: 8px; padding: 10px 12px;
    font-size: 12px; font-weight: 600; color: var(--rose);
  }
  .btn-secondary {
    height: 36px; padding: 0 16px; border-radius: 9px;
    font-size: 12px; font-weight: 700; font-family: 'DM Sans', sans-serif;
    background: white; color: var(--ink-muted);
    border: 1px solid var(--border);
    cursor: pointer; transition: all 0.15s;
  }
  .btn-secondary:hover:not(:disabled) { border-color: var(--border-dark); color: var(--ink); }
  .btn-primary {
    height: 36px; padding: 0 18px; border-radius: 9px;
    font-size: 12px; font-weight: 700; font-family: 'DM Sans', sans-serif;
    background: var(--green); color: white; border: none;
    cursor: pointer; transition: all 0.15s;
    box-shadow: 0 2px 8px rgba(45,122,79,0.25);
  }
  .btn-primary:hover:not(:disabled) {
    background: #256b43; transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(45,122,79,0.35);
  }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  @media (max-width: 600px) {
    .pp-modal-body { grid-template-columns: 1fr !important; }
    .btn-add span.btn-add-label { display: none !important; }
  }
`

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────
function PlayersPoolPage() {
  const { page, search } = Route.useSearch()
  const navigate         = Route.useNavigate()
  const globalNavigate   = useNavigate()
  const queryClient      = useQueryClient()
  const fileInputRef     = useRef<HTMLInputElement>(null)
  const size = 10

  const [showAddModal, setShowAddModal] = useState(false)
  const emptyForm = {
    name: "",
    country: "",
    age: "",
    specialism: "",
    battingStyle: "",
    bowlingStyle: "",
    iplTeam: "",
    basePrice: "50",
  }
  const [form, setForm] = useState(emptyForm)

  const createMutation = useMutation({
    mutationFn: (payload: any) => playerApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] })
      setShowAddModal(false)
      setForm(emptyForm)
    },
  })

  function openAddModal() {
    createMutation.reset()
    setForm(emptyForm)
    setShowAddModal(true)
  }

  function submitNewPlayer() {
    if (!form.name.trim()) return
    const basePriceLakhs = Number(form.basePrice)
    if (!Number.isFinite(basePriceLakhs) || basePriceLakhs <= 0) return
    createMutation.mutate({
      name: form.name.trim(),
      country: form.country.trim() || null,
      age: form.age ? Number(form.age) : null,
      specialism: form.specialism || null,
      battingStyle: form.battingStyle.trim() || null,
      bowlingStyle: form.bowlingStyle.trim() || null,
      iplTeam: form.iplTeam.trim() || null,
      testCaps: 0,
      odiCaps: 0,
      t20Caps: 0,
      basePrice: basePriceLakhs * 100_000,
    })
  }

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      return api
        .post<UploadResult>("/admin/players/upload-csv", formData)
        .then((r) => r.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["players"] })
    },
  })

  const { data: allPlayers, isLoading } = usePlayers(search ? { search } : {})

  const filtered   = allPlayers ?? []
  const startRow   = (page - 1) * size + 1
  const paginated  = filtered.slice((page - 1) * size, page * size)
  const totalShown = paginated.length

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = ""
    if (!file) return
    uploadMutation.mutate(file)
  }

  return (
    <div className="pp-root">
      <style>{styles}</style>

      {uploadMutation.isPending && (
        <div className="pp-uploading-overlay">
          <div className="pp-uploading-card">
            <div className="pp-uploading-spinner" />
            <div className="pp-uploading-label">Uploading file…</div>
            <div className="pp-uploading-sub">Please wait, processing your CSV</div>
          </div>
        </div>
      )}

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

      <div className="pp-body">

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

        {uploadMutation.isSuccess && uploadMutation.data && (
          <div className="pp-upload-result success">
            <span className="pp-upload-result-icon">✅</span>
            <div className="pp-upload-result-body">
              <div className="pp-upload-result-title">Upload successful!</div>
              <div className="pp-upload-result-stats">
                <span className="pp-upload-stat-chip">
                  🆕 <strong>{uploadMutation.data.inserted}</strong> inserted
                </span>
                <span className="pp-upload-stat-chip">
                  ✏️ <strong>{uploadMutation.data.updated}</strong> updated
                </span>
                <span className="pp-upload-stat-chip">
                  ⏭️ <strong>{uploadMutation.data.skipped}</strong> skipped
                </span>
              </div>
              {uploadMutation.data.errors.length > 0 && (
                <ul className="pp-upload-result-errors">
                  {uploadMutation.data.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
            <button className="pp-upload-dismiss" onClick={() => uploadMutation.reset()}>✕</button>
          </div>
        )}

        {uploadMutation.isError && (
          <div className="pp-upload-result error">
            <span className="pp-upload-result-icon">❌</span>
            <div className="pp-upload-result-body">
              <div className="pp-upload-result-title">Upload failed</div>
              <div className="pp-upload-error-msg">
                {(uploadMutation.error as any)?.response?.data?.message
                  ?? (uploadMutation.error as any)?.message
                  ?? "Something went wrong"}
              </div>
            </div>
            <button className="pp-upload-dismiss" onClick={() => uploadMutation.reset()}>✕</button>
          </div>
        )}

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
          <span
            className="pp-toolbar-perpage"
            style={{ fontSize: 11, color: "var(--ink-faint)", fontWeight: 600 }}
          >
            {size} per page
          </span>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <button
            className="btn-add"
            onClick={openAddModal}
          >
            <span style={{ fontSize: 14 }}>➕</span>
            <span className="btn-add-label">Add Player</span>
          </button>

          <button
            className="btn-upload"
            disabled={uploadMutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <span style={{ fontSize: 14 }}>📤</span>
            <span className="btn-upload-label">Upload CSV / Excel</span>
          </button>
        </div>

        <div className="pp-table-shell">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 48, textAlign: "center" }}>#</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="pp-col-role">Role</TableHead>
                <TableHead className="pp-col-iplteam">IPL Team</TableHead>
                <TableHead style={{ textAlign: "right" }}>Base Price</TableHead>
                <TableHead className="pp-col-status">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>

              {isLoading && Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="pp-cell-num">
                    <div className="pp-skel" style={{ height: 12, width: 20, margin: "0 auto" }} />
                  </TableCell>
                  <TableCell>
                    <div className="pp-skel" style={{ height: 13, width: 160 }} />
                  </TableCell>
                  <TableCell className="pp-col-role">
                    <div className="pp-skel" style={{ height: 22, width: 90, borderRadius: 6 }} />
                  </TableCell>
                  <TableCell className="pp-col-iplteam">
                    <div className="pp-skel" style={{ height: 13, width: 90 }} />
                  </TableCell>
                  <TableCell style={{ textAlign: "right" }}>
                    <div className="pp-skel" style={{ height: 13, width: 70, marginLeft: "auto" }} />
                  </TableCell>
                  <TableCell className="pp-col-status">
                    <div className="pp-skel" style={{ height: 22, width: 80, borderRadius: 6 }} />
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && paginated.map((player: any, i: number) => (
                <TableRow key={player.id}>
                  <TableCell className="pp-cell-num">{startRow + i}</TableCell>
                  <TableCell className="pp-cell-name">
                    {player.name}
                    <div className="pp-mobile-sub">
                      <span className="pp-mobile-role-dot" style={{ background: roleColor(player.specialism) }} />
                      {player.isSold && <span className="pp-mobile-sold-chip">Sold</span>}
                    </div>
                  </TableCell>
                  <TableCell className="pp-col-role">
                    <Badge className="pp-badge-role">{player.specialism ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="pp-col-iplteam pp-cell-iplteam">{player.iplTeam ?? "—"}</TableCell>
                  <TableCell className="pp-cell-price">{fmt(Number(player.basePrice))}</TableCell>
                  <TableCell className="pp-col-status">
                    {player.isSold
                      ? <Badge className="pp-badge-sold">Sold</Badge>
                      : <Badge className="pp-badge-available">Available</Badge>
                    }
                  </TableCell>
                </TableRow>
              ))}

              {!isLoading && paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} style={{ padding: 0 }}>
                    <div className="pp-empty-inner">
                      <span className="pp-empty-icon">🏏</span>
                      <span className="pp-empty-text">No players found</span>
                      <span className="pp-empty-hint">
                        {search
                          ? `No results for "${search}" — try a different name`
                          : "Upload a CSV or Excel file to add players to the pool"}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}

            </TableBody>
          </Table>
        </div>

        <div className="pp-pager">
          <button
            className="pp-pager-btn"
            disabled={page === 1}
            onClick={() => navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })}
          >
            ← Previous
          </button>
          <span className="pp-pager-label">Page <strong>{page}</strong></span>
          <button
            className="pp-pager-btn"
            disabled={page * size >= filtered.length}
            onClick={() => navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })}
          >
            Next →
          </button>
        </div>

      </div>

      {showAddModal && (
        <div className="pp-modal-overlay" onClick={() => !createMutation.isPending && setShowAddModal(false)}>
          <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pp-modal-header">
              <div className="pp-modal-title">Add Player</div>
              <button
                className="pp-upload-dismiss"
                disabled={createMutation.isPending}
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="pp-modal-body">
              <div className="pp-field-full">
                <label className="pp-field-label">Name *</label>
                <input
                  className="pp-field-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Virat Kohli"
                />
              </div>
              <div>
                <label className="pp-field-label">Country</label>
                <input
                  className="pp-field-input"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="India"
                />
              </div>
              <div>
                <label className="pp-field-label">Age</label>
                <input
                  className="pp-field-input"
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="28"
                />
              </div>
              <div>
                <label className="pp-field-label">Role</label>
                <select
                  className="pp-field-select"
                  value={form.specialism}
                  onChange={(e) => setForm({ ...form, specialism: e.target.value })}
                >
                  <option value="">—</option>
                  <option value="BATSMAN">Batsman</option>
                  <option value="BOWLER">Bowler</option>
                  <option value="ALLROUNDER">All-rounder</option>
                  <option value="WICKETKEEPER">Wicketkeeper</option>
                </select>
              </div>
              <div>
                <label className="pp-field-label">IPL Team</label>
                <input
                  className="pp-field-input"
                  value={form.iplTeam}
                  onChange={(e) => setForm({ ...form, iplTeam: e.target.value })}
                  placeholder="Mumbai Indians"
                />
              </div>
              <div>
                <label className="pp-field-label">Batting Style</label>
                <input
                  className="pp-field-input"
                  value={form.battingStyle}
                  onChange={(e) => setForm({ ...form, battingStyle: e.target.value })}
                  placeholder="Right-hand"
                />
              </div>
              <div>
                <label className="pp-field-label">Bowling Style</label>
                <input
                  className="pp-field-input"
                  value={form.bowlingStyle}
                  onChange={(e) => setForm({ ...form, bowlingStyle: e.target.value })}
                  placeholder="Right-arm fast"
                />
              </div>
              <div className="pp-field-full">
                <label className="pp-field-label">Base Price (in Lakhs ₹) *</label>
                <input
                  className="pp-field-input"
                  type="number"
                  min="1"
                  step="1"
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                  placeholder="50"
                />
              </div>
              {createMutation.isError && (
                <div className="pp-modal-error">
                  {(createMutation.error as any)?.response?.data?.message
                    ?? (createMutation.error as any)?.response?.data?.error
                    ?? (createMutation.error as any)?.message
                    ?? "Failed to create player"}
                </div>
              )}
            </div>
            <div className="pp-modal-footer">
              <button
                className="btn-secondary"
                disabled={createMutation.isPending}
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={createMutation.isPending || !form.name.trim() || !form.basePrice}
                onClick={submitNewPlayer}
              >
                {createMutation.isPending ? "Adding…" : "Add Player"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}