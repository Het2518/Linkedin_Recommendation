import { useState, useEffect, useRef, useCallback } from "react";

const API = "https://linkedin-recommendation-1.onrender.com";

// ── API ────────────────────────────────────────────────────────────────────
async function apiSearchProfiles(q) {
  const r = await fetch(`${API}/profiles?q=${encodeURIComponent(q)}&limit=20`);
  const d = await r.json();
  return d.profiles || [];
}
async function apiGetProfile(id) {
  const r = await fetch(`${API}/profile/${id}`);
  return r.json();
}
async function apiRecommend(profileId, topN, diversity) {
  const r = await fetch(`${API}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile_id: profileId, top_n: topN, diversity }),
  });
  return r.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function initials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}
const PALETTE = ["#6366f1","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#0284c7","#be185d"];
function avatarColor(name = "") {
  return PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length];
}
function scorePct(score) {
  return Math.min(Math.max((score / 8) * 100, 0), 100);
}
function scoreColor(score) {
  const pct = scorePct(score);
  if (pct >= 70) return "var(--green)";
  if (pct >= 45) return "var(--amber)";
  return "var(--text3)";
}

// ── Global CSS ─────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Sora:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');

:root {
  --bg:       #f7f8fc;
  --bg2:      #ffffff;
  --bg3:      #f1f3f9;
  --bg4:      #e8ebf4;
  --border:   #dde2ef;
  --border2:  #c8cfe8;
  --indigo:   #4f46e5;
  --indigo-l: #6366f1;
  --indigo-d: #3730a3;
  --indigo-g: #eef2ff;
  --indigo-t: #4f46e520;
  --teal:     #0891b2;
  --green:    #059669;
  --amber:    #d97706;
  --red:      #dc2626;
  --text:     #0f172a;
  --text2:    #475569;
  --text3:    #94a3b8;
  --shadow:   0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04);
  --shadow-md:0 4px 16px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06);
  --shadow-lg:0 20px 48px rgba(15,23,42,0.14), 0 8px 20px rgba(15,23,42,0.08);
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 18px;
  --r-xl: 24px;
  --font: 'DM Sans', system-ui, sans-serif;
  --font-h: 'Sora', system-ui, sans-serif;
  --font-m: 'DM Mono', monospace;
  --header-h: 64px;
}

*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
html { scroll-behavior:smooth; }
body {
  font-family:var(--font);
  background:var(--bg);
  color:var(--text);
  font-size:14px;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
  min-height:100vh;
}

::-webkit-scrollbar { width:5px; height:5px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--border2); border-radius:99px; }

/* ── Header ── */
.hdr {
  position:sticky; top:0; z-index:200;
  height:var(--header-h);
  background:rgba(255,255,255,0.88);
  backdrop-filter:blur(16px);
  border-bottom:1px solid var(--border);
  display:flex; align-items:center;
  padding:0 20px; gap:16px;
}
.hdr-brand {
  display:flex; align-items:center; gap:10px;
  text-decoration:none; flex-shrink:0;
}
.hdr-logo {
  width:36px; height:36px; border-radius:10px;
  background:linear-gradient(135deg,var(--indigo) 0%,var(--teal) 100%);
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 2px 8px var(--indigo-t);
}
.hdr-logo svg { fill:#fff; }
.hdr-name {
  font-family:var(--font-h);
  font-size:18px; font-weight:800;
  background:linear-gradient(135deg,var(--indigo) 0%,var(--teal) 100%);
  -webkit-background-clip:text;
  -webkit-text-fill-color:transparent;
  background-clip:text;
  letter-spacing:-0.3px;
}
.hdr-tag {
  font-size:10px; font-weight:600; letter-spacing:1px;
  text-transform:uppercase; color:var(--text3);
  border-left:1px solid var(--border); padding-left:10px;
  display:none;
}
@media(min-width:640px){ .hdr-tag { display:block; } }

.hdr-right { display:flex; align-items:center; gap:10px; margin-left:auto; }

.hdr-status {
  display:flex; align-items:center; gap:6px;
  padding:5px 12px; border-radius:20px;
  background:var(--bg3); border:1px solid var(--border);
  font-size:12px; color:var(--text2);
}
.pulse-dot {
  width:7px; height:7px; border-radius:50%;
  background:var(--green);
  box-shadow:0 0 0 2px #05966930;
  animation:pulse 2s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 2px #05966930} 50%{opacity:0.7;box-shadow:0 0 0 4px #05966920} }

.find-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  padding:9px 20px; border-radius:var(--r-md);
  background:linear-gradient(135deg,var(--indigo) 0%,var(--indigo-l) 100%);
  color:#fff; border:none; cursor:pointer;
  font-family:var(--font); font-size:14px; font-weight:600;
  box-shadow:0 2px 8px var(--indigo-t), 0 1px 2px rgba(0,0,0,0.08);
  transition:opacity 0.15s, transform 0.1s, box-shadow 0.15s;
  white-space:nowrap; flex-shrink:0;
}
.find-btn:hover:not(:disabled) { opacity:0.92; transform:translateY(-1px); box-shadow:0 4px 16px var(--indigo-t); }
.find-btn:active:not(:disabled) { transform:translateY(0); }
.find-btn:disabled { opacity:0.45; cursor:not-allowed; }

/* ── Layout ── */
.layout {
  max-width:1180px;
  margin:0 auto;
  padding:24px 16px 48px;
  display:grid;
  grid-template-columns:1fr;
  gap:20px;
}
@media(min-width:768px){
  .layout { grid-template-columns:300px 1fr; }
}
@media(min-width:1100px){
  .layout { grid-template-columns:300px 1fr 280px; }
}

/* ── Cards ── */
.card {
  background:var(--bg2);
  border:1px solid var(--border);
  border-radius:var(--r-lg);
  box-shadow:var(--shadow);
  overflow:hidden;
}
.card-body { padding:20px; }
.card-header {
  padding:16px 20px;
  border-bottom:1px solid var(--border);
  display:flex; align-items:center; justify-content:space-between;
}
.card-title {
  font-family:var(--font-h);
  font-size:15px; font-weight:700;
  color:var(--text);
  display:flex; align-items:center; gap:8px;
}
.card-icon {
  width:28px; height:28px; border-radius:7px;
  background:var(--indigo-g);
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}

/* ── Search box ── */
.search-wrap { position:relative; }
.search-box {
  display:flex; align-items:center; gap:10px;
  background:var(--bg3); border:1.5px solid var(--border);
  border-radius:var(--r-md); padding:10px 14px;
  transition:border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.search-box:focus-within {
  border-color:var(--indigo); background:#fff;
  box-shadow:0 0 0 3px var(--indigo-t);
}
.search-box svg { color:var(--text3); flex-shrink:0; transition:color 0.2s; }
.search-box:focus-within svg { color:var(--indigo); }
.search-input {
  flex:1; background:none; border:none; outline:none;
  font-family:var(--font); font-size:14px; color:var(--text);
}
.search-input::placeholder { color:var(--text3); }

.dropdown {
  position:absolute; top:calc(100% + 6px); left:0; right:0;
  background:#fff; border:1px solid var(--border);
  border-radius:var(--r-md);
  box-shadow:var(--shadow-lg);
  z-index:300; overflow:hidden;
  max-height:300px; overflow-y:auto;
  animation:dropIn 0.15s ease;
}
@keyframes dropIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
.drop-row {
  display:flex; align-items:center; gap:12px;
  width:100%; padding:11px 16px;
  background:none; border:none; cursor:pointer;
  border-bottom:1px solid var(--border);
  transition:background 0.1s; text-align:left;
  font-family:var(--font);
}
.drop-row:last-child { border-bottom:none; }
.drop-row:hover { background:var(--indigo-g); }
.drop-name { font-size:14px; font-weight:600; color:var(--text); }
.drop-meta { font-size:12px; color:var(--text3); margin-top:1px; }

/* ── Avatar ── */
.avatar {
  border-radius:50%; display:flex; align-items:center; justify-content:center;
  font-family:var(--font-h); font-weight:700; flex-shrink:0;
  letter-spacing:0.5px;
}

/* ── Profile hero ── */
.profile-hero {
  position:relative;
  border-bottom:1px solid var(--border);
}
.profile-cover {
  height:52px;
  background:linear-gradient(135deg,var(--indigo-g) 0%,#e0e7ff 50%,#f0f9ff 100%);
}
.profile-avatar-wrap { padding:0 20px; margin-top:-24px; margin-bottom:12px; }
.profile-info { padding:0 20px 16px; }
.profile-name {
  font-family:var(--font-h);
  font-size:17px; font-weight:700; color:var(--text);
  margin-bottom:2px;
}
.profile-role { font-size:13px; color:var(--text2); }
.profile-company { font-size:13px; color:var(--indigo); font-weight:500; }
.clear-btn {
  position:absolute; top:10px; right:12px;
  background:rgba(255,255,255,0.8); border:1px solid var(--border);
  border-radius:var(--r-sm); width:28px; height:28px;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:var(--text3);
  transition:color 0.15s, background 0.15s;
}
.clear-btn:hover { color:var(--text); background:#fff; }

.meta-list { padding:0 20px 16px; display:flex; flex-direction:column; gap:7px; }
.meta-row { display:flex; justify-content:space-between; align-items:center; }
.meta-k { font-size:12px; color:var(--text3); }
.meta-v { font-size:12px; font-weight:500; color:var(--text2); text-align:right; max-width:56%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.tags-section { padding:12px 20px 16px; border-top:1px solid var(--border); }
.tags-label { font-size:10px; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:var(--text3); margin-bottom:8px; }
.tags-wrap { display:flex; flex-wrap:wrap; gap:5px; }
.tag {
  display:inline-flex; padding:3px 10px;
  border-radius:20px; font-size:12px; font-weight:500;
  background:var(--bg3); border:1px solid var(--border);
  color:var(--text2);
}
.tag-indigo { background:var(--indigo-g); border-color:#c7d2fe; color:var(--indigo-d); }
.tag-teal   { background:#f0fdfa; border-color:#99f6e4; color:#0f766e; }
.tag-amber  { background:#fffbeb; border-color:#fde68a; color:#92400e; }

/* ── Controls ── */
.ctrl-group { margin-bottom:18px; }
.ctrl-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
.ctrl-label { font-size:12px; font-weight:500; color:var(--text2); }
.ctrl-val { font-family:var(--font-m); font-size:13px; color:var(--indigo); font-weight:600; }
input[type=range] {
  width:100%; appearance:none; background:var(--bg4);
  height:4px; border-radius:2px; outline:none; cursor:pointer;
}
input[type=range]::-webkit-slider-thumb {
  appearance:none; width:16px; height:16px; border-radius:50%;
  background:var(--indigo); border:2px solid #fff;
  box-shadow:0 1px 4px rgba(79,70,229,0.3);
  cursor:pointer; transition:transform 0.15s;
}
input[type=range]::-webkit-slider-thumb:hover { transform:scale(1.15); }
.range-hint { display:flex; justify-content:space-between; font-size:10px; color:var(--text3); margin-top:4px; }

/* ── Filters ── */
.filters { display:flex; gap:6px; flex-wrap:wrap; }
.chip {
  padding:5px 14px; border-radius:20px;
  border:1.5px solid var(--border); background:#fff;
  font-family:var(--font); font-size:13px; font-weight:500;
  cursor:pointer; color:var(--text2);
  transition:all 0.15s; white-space:nowrap;
}
.chip:hover { border-color:var(--border2); color:var(--text); }
.chip.on {
  background:var(--indigo-g); border-color:var(--indigo);
  color:var(--indigo); font-weight:600;
}

/* ── Error ── */
.error-box {
  padding:12px 14px; border-radius:var(--r-sm);
  background:#fef2f2; border:1px solid #fecaca;
  font-size:13px; color:#b91c1c; line-height:1.5;
  margin-top:14px;
}

/* ── Empty / loading ── */
.empty {
  display:flex; flex-direction:column; align-items:center;
  justify-content:center; text-align:center;
  padding:64px 24px; gap:12px;
}
.empty-icon { font-size:48px; margin-bottom:4px; }
.empty-title {
  font-family:var(--font-h);
  font-size:20px; font-weight:700; color:var(--text);
}
.empty-sub { font-size:14px; color:var(--text3); max-width:340px; line-height:1.7; }
.empty-steps {
  display:flex; align-items:center; gap:12px; margin-top:16px;
  flex-wrap:wrap; justify-content:center;
}
.estep { display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text2); }
.estep-n {
  width:22px; height:22px; border-radius:6px;
  background:var(--indigo-g); border:1px solid #c7d2fe;
  color:var(--indigo); font-size:11px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
}
.estep-arrow { color:var(--border2); font-size:18px; }

.loading {
  display:flex; flex-direction:column;
  align-items:center; justify-content:center;
  padding:80px 24px; gap:16px;
}
.spinner-ring {
  width:40px; height:40px; border-radius:50%;
  border:3px solid var(--border);
  border-top-color:var(--indigo);
  animation:spin 0.85s linear infinite;
}
.spinner-sm {
  width:13px; height:13px; border-radius:50%;
  border:2px solid rgba(255,255,255,0.4);
  border-top-color:#fff;
  animation:spin 0.7s linear infinite;
  display:inline-block;
}
@keyframes spin { to { transform:rotate(360deg); } }
.loading-label {
  font-family:var(--font-h);
  font-size:17px; font-weight:700; color:var(--text);
}
.loading-sub { font-size:12px; color:var(--text3); letter-spacing:0.5px; }

/* ── Skeleton ── */
.skel {
  background:linear-gradient(90deg,#f1f3f9 25%,#e8ebf4 50%,#f1f3f9 75%);
  background-size:600px 100%;
  animation:shimmer 1.4s infinite;
  border-radius:6px;
}
@keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }

/* ── Results header ── */
.results-hdr {
  display:flex; align-items:flex-start; justify-content:space-between;
  padding:20px 24px 16px; border-bottom:1px solid var(--border);
  flex-wrap:wrap; gap:8px;
}
.results-title {
  font-family:var(--font-h);
  font-size:18px; font-weight:700; color:var(--text);
}
.results-name { color:var(--indigo); }
.results-meta { font-size:12px; color:var(--text3); font-family:var(--font-m); margin-top:3px; }

.model-badge {
  display:inline-flex; align-items:center; gap:5px;
  padding:4px 10px; border-radius:20px;
  background:var(--indigo-g); border:1px solid #c7d2fe;
  font-size:11px; font-weight:600; color:var(--indigo);
  white-space:nowrap;
}

/* ── Rec card ── */
.rec-card {
  display:flex; align-items:flex-start; gap:14px;
  padding:16px 24px;
  border-bottom:1px solid var(--border);
  transition:background 0.15s;
  animation:slideUp 0.35s ease both;
  animation-delay:var(--delay, 0ms);
}
.rec-card:last-child { border-bottom:none; }
.rec-card:hover { background:var(--bg3); }
@keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }

.rec-rank {
  font-family:var(--font-m);
  font-size:12px; font-weight:500;
  color:var(--text3); min-width:22px;
  padding-top:3px; text-align:center;
}

.rec-body { flex:1; min-width:0; }
.rec-name {
  font-size:15px; font-weight:600; color:var(--text);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.rec-role {
  font-size:13px; color:var(--text2); margin-top:1px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.rec-tags { display:flex; flex-wrap:wrap; gap:5px; margin-top:9px; }
.rec-loc { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--text3); margin-top:8px; }

.connect-btn {
  display:inline-flex; align-items:center; gap:5px;
  padding:6px 14px; border-radius:20px;
  border:1.5px solid var(--indigo); background:transparent;
  color:var(--indigo); font-family:var(--font);
  font-size:13px; font-weight:600;
  cursor:pointer; transition:all 0.15s;
  margin-top:10px;
}
.connect-btn:hover { background:var(--indigo-g); }
.connect-btn.done { background:var(--indigo); color:#fff; }

.rec-score { display:flex; flex-direction:column; align-items:flex-end; gap:4px; min-width:76px; flex-shrink:0; }
.score-num {
  font-family:var(--font-m);
  font-size:21px; font-weight:500; line-height:1;
}
.score-track { width:68px; height:4px; background:var(--bg4); border-radius:2px; overflow:hidden; }
.score-fill {
  height:100%; background:var(--indigo); border-radius:2px;
  transition:width 0.6s cubic-bezier(0.34,1.56,0.64,1);
}
.score-lbl { font-size:10px; color:var(--text3); text-transform:uppercase; letter-spacing:0.5px; }

/* ── Right panel stats ── */
.stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.stat-cell {
  padding:10px; border-radius:var(--r-sm);
  background:var(--bg3); border:1px solid var(--border);
  text-align:center;
}
.stat-num {
  font-family:var(--font-m);
  font-size:18px; font-weight:500; color:var(--indigo);
  line-height:1;
}
.stat-lbl { font-size:11px; color:var(--text3); margin-top:4px; }

.feat-row {
  display:flex; align-items:center; gap:10px;
  padding:7px 0; border-bottom:1px solid var(--border);
  font-size:13px; color:var(--text2);
}
.feat-row:last-child { border-bottom:none; }
.feat-n {
  width:20px; height:20px; border-radius:5px;
  background:var(--indigo-g); border:1px solid #c7d2fe;
  color:var(--indigo); font-size:10px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
  flex-shrink:0;
}

/* ── Right sidebar collapsible on mobile ── */
.right-col { display:none; }
@media(min-width:1100px){ .right-col { display:flex; flex-direction:column; gap:16px; } }

/* ── Mobile bottom card ── */
.mobile-stats { display:block; }
@media(min-width:1100px){ .mobile-stats { display:none; } }

/* ── Responsive tweaks ── */
@media(max-width:767px){
  .hdr { padding:0 14px; gap:10px; }
  .hdr-name { font-size:16px; }
  .hdr-status { display:none; }
  .layout { padding:14px 12px 40px; gap:14px; }
  .rec-card { padding:14px 16px; gap:10px; }
  .results-hdr { padding:16px 16px 12px; }
  .card-body { padding:16px; }
  .meta-list { padding:0 16px 14px; }
  .profile-info { padding:0 16px 14px; }
  .tags-section { padding:10px 16px 14px; }
  .profile-avatar-wrap { padding:0 16px; }
  .find-btn { padding:8px 14px; font-size:13px; }
  .score-num { font-size:17px; }
}

/* ── Progress steps ── */
.steps-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.step-i { display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text3); }
.step-n {
  width:20px; height:20px; border-radius:5px;
  background:var(--bg4); border:1px solid var(--border);
  color:var(--text3); font-size:10px; font-weight:700;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.step-i.done { color:var(--text2); }
.step-i.done .step-n { background:var(--indigo-g); border-color:#c7d2fe; color:var(--indigo); }
.step-arr { color:var(--border2); font-size:14px; }
`;

// ── Avatar component ───────────────────────────────────────────────────────
function Avatar({ name, size = 48 }) {
  const c = avatarColor(name);
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size,
        background: c + "14", border: `2px solid ${c}30`,
        color: c, fontSize: Math.round(size * 0.33),
      }}
    >
      {initials(name)}
    </div>
  );
}

// ── Tag pill ───────────────────────────────────────────────────────────────
function Tag({ children, type = "" }) {
  const map = { industry: "tag-indigo", level: "tag-amber", remote: "tag-teal" };
  return <span className={`tag ${map[type] || ""}`}>{children}</span>;
}

// ── Skeleton row ───────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="rec-card" style={{ animationDelay: "0ms" }}>
      <div className="skel" style={{ width: 22, height: 12, marginTop: 4 }} />
      <div className="skel" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        <div className="skel" style={{ height: 14, width: "38%" }} />
        <div className="skel" style={{ height: 12, width: "60%" }} />
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {[80, 70, 60].map((w, i) => <div key={i} className="skel" style={{ height: 22, width: w }} />)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <div className="skel" style={{ height: 24, width: 50 }} />
        <div className="skel" style={{ height: 4, width: 68 }} />
      </div>
    </div>
  );
}

// ── Left profile panel ─────────────────────────────────────────────────────
function ProfilePanel({ profile, onClear }) {
  if (!profile) {
    return (
      <div className="card" style={{ overflow: "visible" }}>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 20px", textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--bg3)", border: "2px dashed var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 24 }}>?</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>No profile selected</div>
          <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.6 }}>Search for a professional above to see their details here</div>
        </div>
      </div>
    );
  }

  const c = avatarColor(profile.name);

  return (
    <div className="card" style={{ animation: "slideUp 0.3s ease" }}>
      <div className="profile-hero">
        <div className="profile-cover" style={{ background: `linear-gradient(135deg, ${c}18 0%, ${c}08 100%)` }} />
        <div className="profile-avatar-wrap">
          <div style={{ width: 52, height: 52, borderRadius: "50%", border: "3px solid var(--bg2)", background: c + "14", color: c, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-h)", fontWeight: 700, fontSize: 18 }}>
            {initials(profile.name)}
          </div>
        </div>
        <div className="profile-info">
          <div className="profile-name">{profile.name}</div>
          <div className="profile-role">{profile.current_role}</div>
          {profile.current_company && <div className="profile-company">{profile.current_company}</div>}
        </div>
        <button className="clear-btn" onClick={onClear} aria-label="Clear profile">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>

      <div className="meta-list">
        {[
          ["Industry", profile.industry],
          ["Seniority", profile.seniority_level],
          ["Experience", `${profile.years_experience} yrs`],
          ["Location", profile.location],
          ["Remote", profile.remote_preference],
          ["Connections", profile.connections?.toLocaleString()],
        ].map(([k, v]) => v && (
          <div className="meta-row" key={k}>
            <span className="meta-k">{k}</span>
            <span className="meta-v" style={k === "Connections" ? { color: "var(--indigo)", fontFamily: "var(--font-m)" } : {}}>{v}</span>
          </div>
        ))}
      </div>

      {profile.skills?.length > 0 && (
        <div className="tags-section">
          <div className="tags-label">Skills</div>
          <div className="tags-wrap">
            {profile.skills.slice(0, 8).map((s) => <span key={s} className="tag">{s}</span>)}
          </div>
        </div>
      )}
      {profile.goals?.length > 0 && (
        <div className="tags-section">
          <div className="tags-label">Goals</div>
          <div className="tags-wrap">
            {profile.goals.slice(0, 4).map((g) => <span key={g} className="tag tag-indigo">{g}</span>)}
          </div>
        </div>
      )}
      {profile.can_offer?.length > 0 && (
        <div className="tags-section">
          <div className="tags-label">Can Offer</div>
          <div className="tags-wrap">
            {profile.can_offer.slice(0, 4).map((o) => <span key={o} className="tag tag-teal">{o}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Rec card ───────────────────────────────────────────────────────────────
function RecCard({ rec, index, selectedProfile, onConnect, isConnected }) {
  const pct = scorePct(rec.score);
  const sc  = scoreColor(rec.score);
  const expGap = selectedProfile?.years_experience
    ? Math.abs(parseFloat(selectedProfile.years_experience) - parseFloat(rec.years_experience)).toFixed(1)
    : null;

  return (
    <div className="rec-card" style={{ "--delay": `${index * 40}ms` }}>
      <div className="rec-rank">#{rec.rank}</div>
      <Avatar name={rec.name} size={48} />
      <div className="rec-body">
        <div className="rec-name">{rec.name}</div>
        <div className="rec-role">{rec.current_role}{rec.current_company ? ` · ${rec.current_company}` : ""}</div>
        <div className="rec-tags">
          <Tag type="industry">{rec.industry}</Tag>
          <Tag type="level">{rec.seniority_level}</Tag>
          {rec.remote_preference && <Tag type="remote">{rec.remote_preference}</Tag>}
          <Tag>{rec.years_experience} yrs exp</Tag>
        </div>
        {rec.location && (
          <div className="rec-loc">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            <span>{rec.location}</span>
            {expGap !== null && <span style={{ color: "var(--border2)" }}>·</span>}
            {expGap !== null && <span>{expGap} yr gap</span>}
          </div>
        )}
        <button
          className={`connect-btn${isConnected ? " done" : ""}`}
          onClick={() => onConnect(rec.profile_id)}
        >
          {isConnected
            ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>Pending</>
            : <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>Connect</>
          }
        </button>
      </div>
      <div className="rec-score">
        <div className="score-num" style={{ color: sc }}>{rec.score.toFixed(2)}</div>
        <div className="score-track">
          <div className="score-fill" style={{ width: `${pct}%`, background: sc }} />
        </div>
        <div className="score-lbl">match</div>
      </div>
    </div>
  );
}

// ── Right stats panel ──────────────────────────────────────────────────────
function StatsPanel({ profileDetail }) {
  return (
    <>
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--indigo)"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
            </span>
            Model stats
          </span>
        </div>
        <div className="card-body">
          <div className="stat-grid">
            {[["50K","Profiles"],["LBR","LambdaRank"],["MMR","Diversity"],["9","Features"]].map(([n, l]) => (
              <div className="stat-cell" key={l}>
                <div className="stat-num">{n}</div>
                <div className="stat-lbl">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <span className="card-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--indigo)"><path d="M9.5 16.5l-4-4 1.41-1.41L9.5 13.67l8.09-8.09L19 7l-9.5 9.5z"/></svg>
            </span>
            Features used
          </span>
        </div>
        <div className="card-body" style={{ padding: "12px 20px" }}>
          {["Skill overlap (Jaccard)","Goals similarity (TF-IDF)","Experience gap","Industry match","Seniority gap","Network ratio","Combined experience","Mentorship potential","Remote preference"].map((f, i) => (
            <div className="feat-row" key={f}>
              <span className="feat-n">{i + 1}</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {profileDetail?.needs?.length > 0 && (
        <div className="card" style={{ animation: "slideUp 0.3s ease" }}>
          <div className="card-header">
            <span className="card-title">
              <span className="card-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--indigo)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              </span>
              Looking for
            </span>
          </div>
          <div className="card-body">
            <div className="tags-wrap">
              {profileDetail.needs.slice(0, 6).map((n) => <span key={n} className="tag tag-indigo">{n}</span>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── FILTERS ───────────────────────────────────────────────────────────────
const FILTERS = [
  { key: "all", label: "All" },
  { key: "same_industry", label: "Same industry" },
  { key: "senior", label: "Senior+" },
  { key: "remote", label: "Remote" },
  { key: "mentor", label: "Mentors" },
];

function applyFilter(list, f, selectedProfile) {
  if (f === "all") return list;
  if (f === "same_industry") return list.filter((r) => r.industry === selectedProfile?.industry);
  if (f === "senior") return list.filter((r) => ["senior","lead","principal","director","vp"].some((s) => r.seniority_level?.toLowerCase().includes(s)));
  if (f === "remote") return list.filter((r) => r.remote_preference?.toLowerCase() === "remote");
  if (f === "mentor") return list.filter((r) => r.years_experience > 8);
  return list;
}

// ── APP ────────────────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery]         = useState("");
  const [suggestions, setSugg]    = useState([]);
  const [showDrop, setShowDrop]   = useState(false);
  const [selected, setSelected]   = useState(null);
  const [detail, setDetail]       = useState(null);
  const [allRecs, setAllRecs]     = useState([]);
  const [recs, setRecs]           = useState([]);
  const [loading, setLoading]     = useState(false);
  const [searching, setSearching] = useState(false);
  const [diversity, setDiversity] = useState(0.3);
  const [topN, setTopN]           = useState(10);
  const [error, setError]         = useState(null);
  const [skelN, setSkelN]         = useState(0);
  const [filter, setFilter]       = useState("all");
  const [connected, setConnected] = useState(new Set());
  const [step, setStep]           = useState(1);

  const debRef = useRef(null);
  const dropRef = useRef(null);

  // search debounce
  useEffect(() => {
    clearTimeout(debRef.current);
    if (!query.trim()) { setSugg([]); setShowDrop(false); return; }
    setSearching(true);
    debRef.current = setTimeout(async () => {
      try {
        const r = await apiSearchProfiles(query);
        setSugg(r); setShowDrop(true);
      } finally { setSearching(false); }
    }, 250);
  }, [query]);

  // close dropdown on outside click
  useEffect(() => {
    const fn = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // apply filter whenever allRecs or filter changes
  useEffect(() => { setRecs(applyFilter(allRecs, filter, selected)); }, [filter, allRecs, selected]);

  async function selectProfile(p) {
    setShowDrop(false); setQuery(p.name);
    setSelected(p); setRecs([]); setAllRecs([]);
    setError(null); setDetail(null); setStep(2);
    try { const d = await apiGetProfile(p.profile_id); setDetail(d); } catch {}
  }

  async function handleFind() {
    if (!selected) return;
    setLoading(true); setError(null);
    setRecs([]); setAllRecs([]); setSkelN(topN); setStep(3);
    try {
      const data = await apiRecommend(selected.profile_id, topN, diversity);
      const results = data.recommendations || [];
      setAllRecs(results);
      setRecs(applyFilter(results, filter, selected));
    } catch { setError("Could not reach the API. Make sure the backend is running."); }
    finally { setLoading(false); setSkelN(0); }
  }

  function clearProfile() {
    setSelected(null); setDetail(null); setRecs([]); setAllRecs([]);
    setQuery(""); setSugg([]); setError(null); setStep(1);
  }

  function toggleConnect(pid) {
    setConnected((prev) => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  }

  const canFind = !!selected && !loading;

  return (
    <>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <header className="hdr">
        <a className="hdr-brand" href="#">
          <div className="hdr-logo">
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          </div>
          <span className="hdr-name">Nexus</span>
        </a>
        <span className="hdr-tag">AI Recommendations</span>

        <div className="hdr-right">
          <div className="hdr-status">
            <div className="pulse-dot" />
            <span>API live</span>
          </div>
          <button className="find-btn" onClick={handleFind} disabled={!canFind}>
            {loading ? <><span className="spinner-sm" />Analysing…</> : <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              Find connections
            </>}
          </button>
        </div>
      </header>

      {/* ── 3-col layout ── */}
      <div className="layout">

        {/* LEFT — profile card */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ProfilePanel profile={detail} onClear={clearProfile} />

          {/* How it works — only on tablet+ left col */}
          <div className="card" style={{ display: "none" }} id="how-it-works-left">
            <div className="card-body" style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--text)" }}>LambdaRank</strong> scores candidates on 9 features. <strong style={{ color: "var(--text)" }}>MMR</strong> re-ranks top 60 for diversity.
            </div>
          </div>
        </div>

        {/* CENTER — search + results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Search & controls card */}
          <div className="card">
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Search */}
              <div ref={dropRef} className="search-wrap">
                <div className="search-box">
                  <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                  <input
                    className="search-input"
                    placeholder="Search by name, role, company or industry…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => suggestions.length && setShowDrop(true)}
                  />
                  {searching && <div style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--border2)", borderTopColor: "var(--indigo)", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />}
                </div>

                {showDrop && suggestions.length > 0 && (
                  <div className="dropdown">
                    {suggestions.map((p) => (
                      <button key={p.profile_id} className="drop-row" onMouseDown={() => selectProfile(p)}>
                        <Avatar name={p.name} size={36} />
                        <div>
                          <div className="drop-name">{p.name}</div>
                          <div className="drop-meta">{p.current_role} · {p.industry}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Filters */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 8 }}>Filter results</div>
                <div className="filters">
                  {FILTERS.map((f) => (
                    <button key={f.key} className={`chip${filter === f.key ? " on" : ""}`} onClick={() => setFilter(f.key)}>{f.label}</button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <div className="ctrl-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                  <div className="ctrl-header">
                    <span className="ctrl-label">Results</span>
                    <span className="ctrl-val">{topN}</span>
                  </div>
                  <input type="range" min="5" max="20" step="1" value={topN} onChange={(e) => setTopN(+e.target.value)} />
                  <div className="range-hint"><span>5</span><span>20</span></div>
                </div>
                <div className="ctrl-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                  <div className="ctrl-header">
                    <span className="ctrl-label">Diversity (MMR)</span>
                    <span className="ctrl-val">{diversity.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.1" value={diversity} onChange={(e) => setDiversity(+e.target.value)} />
                  <div className="range-hint"><span>Relevance</span><span>Diverse</span></div>
                </div>
              </div>

              {/* Steps + mobile find button */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div className="steps-row">
                  {["Search profile", "Set parameters", "Find matches"].map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div className={`step-i${step > i ? " done" : ""}`}>
                        <div className="step-n">{step > i ? "✓" : i + 1}</div>
                        <span>{s}</span>
                      </div>
                      {i < 2 && <span className="step-arr">›</span>}
                    </div>
                  ))}
                </div>
                <button className="find-btn" onClick={handleFind} disabled={!canFind} style={{ display: "none" }} id="mobile-find">
                  {loading ? <><span className="spinner-sm" />…</> : "Find"}
                </button>
              </div>

              {error && <div className="error-box">{error}</div>}
            </div>
          </div>

          {/* Results card */}
          <div className="card">
            {/* Empty — no profile */}
            {!selected && !loading && allRecs.length === 0 && (
              <div className="empty">
                <div className="empty-icon">🤝</div>
                <div className="empty-title">Discover high-value connections</div>
                <div className="empty-sub">Search any of 50,000 professionals. Our LambdaRank + MMR engine finds and diversifies the best matches for you.</div>
                <div className="empty-steps">
                  {["Search a profile", "Tune settings", "Find connections"].map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="estep"><span className="estep-n">{i + 1}</span>{s}</div>
                      {i < 2 && <span className="estep-arrow">›</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Profile loaded, waiting */}
            {selected && allRecs.length === 0 && !loading && (
              <div className="empty" style={{ padding: "48px 24px" }}>
                <div className="empty-icon" style={{ fontSize: 36 }}>✓</div>
                <div className="empty-title" style={{ fontSize: 17 }}>Profile ready</div>
                <div className="empty-sub">Adjust the sliders then click <strong>Find connections</strong></div>
              </div>
            )}

            {/* Loading skeletons */}
            {loading && Array.from({ length: skelN }).map((_, i) => <SkeletonRow key={i} />)}

            {/* Results */}
            {recs.length > 0 && (
              <>
                <div className="results-hdr">
                  <div>
                    <div className="results-title">
                      Matches for <span className="results-name">{selected?.name}</span>
                    </div>
                    <div className="results-meta">{recs.length} results · diversity {diversity.toFixed(1)}</div>
                  </div>
                  <div className="model-badge">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
                    LambdaRank + MMR
                  </div>
                </div>
                {recs.map((rec, i) => (
                  <RecCard key={rec.profile_id} rec={rec} index={i} selectedProfile={detail} onConnect={toggleConnect} isConnected={connected.has(rec.profile_id)} />
                ))}
              </>
            )}
          </div>

          {/* Mobile stats accordion */}
          <div className="mobile-stats" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <StatsPanel profileDetail={detail} />
          </div>
        </div>

        {/* RIGHT — stats */}
        <div className="right-col">
          <StatsPanel profileDetail={detail} />
        </div>

      </div>
    </>
  );
}