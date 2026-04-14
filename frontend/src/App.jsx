import { useState, useEffect, useRef } from "react";

const API = "https://linkedin-recommendation-1.onrender.com";

// ── API layer ─────────────────────────────────────────────────────────────────
const apiFetch = (url, opts = {}) =>
  fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...opts.headers } })
    .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); });

const api = {
  search:    (q)              => apiFetch(`${API}/profiles?q=${encodeURIComponent(q)}&limit=20`),
  profile:   (id)             => apiFetch(`${API}/profile/${id}`),
  recommend: (id, n, d, f)   => apiFetch(`${API}/recommend`, {
    method: "POST",
    body: JSON.stringify({ profile_id: id, top_n: n, diversity: d, fetch_n: f }),
  }),
  stats:     ()               => apiFetch(`${API}/stats`),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (n = "") => n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
const COLORS = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899"];
const avatarColor = (n = "") => COLORS[(n.charCodeAt(0) || 65) % COLORS.length];
const scoreGrade = (s) => s >= 72 ? { label: "Strong", color: "#10b981" }
  : s >= 55 ? { label: "Good",   color: "#f59e0b" }
  : { label: "Fair",   color: "#94a3b8" };

function useDebounce(val, ms) {
  const [dv, setDv] = useState(val);
  useEffect(() => { const t = setTimeout(() => setDv(val), ms); return () => clearTimeout(t); }, [val, ms]);
  return dv;
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg:      #0b0f1a;
  --bg2:     #111827;
  --bg3:     #1a2235;
  --bg4:     #1f2d42;
  --bdr:     rgba(255,255,255,0.07);
  --bdr2:    rgba(255,255,255,0.12);
  --p:       #6366f1;
  --p2:      #818cf8;
  --p-dim:   rgba(99,102,241,0.12);
  --p-glow:  rgba(99,102,241,0.25);
  --tx:      #f1f5f9;
  --tx2:     #94a3b8;
  --tx3:     #475569;
  --green:   #10b981;
  --amber:   #f59e0b;
  --red:     #ef4444;
  --cyan:    #06b6d4;
  --f:       'Inter', system-ui, sans-serif;
  --fh:      'Space Grotesk', system-ui, sans-serif;
  --fm:      'JetBrains Mono', monospace;
  --hh:      60px;
  --sw:      300px;
}

*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
html { scroll-behavior:smooth; }
body {
  font-family:var(--f); background:var(--bg); color:var(--tx);
  font-size:14px; line-height:1.6; -webkit-font-smoothing:antialiased;
  min-height:100vh; overflow-x:hidden;
}
::-webkit-scrollbar { width:4px; }
::-webkit-scrollbar-thumb { background:var(--bg4); border-radius:4px; }

/* ─── HEADER ─── */
.hdr {
  height:var(--hh); position:sticky; top:0; z-index:300;
  background:rgba(11,15,26,0.85); backdrop-filter:blur(20px);
  border-bottom:1px solid var(--bdr);
  display:flex; align-items:center; gap:16px; padding:0 20px;
}
.logo {
  display:flex; align-items:center; gap:10px;
  font-family:var(--fh); font-size:18px; font-weight:700;
  color:var(--tx); text-decoration:none; flex-shrink:0;
}
.logo-icon {
  width:34px; height:34px; border-radius:9px;
  background:linear-gradient(135deg,var(--p) 0%,var(--cyan) 100%);
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 0 16px var(--p-glow);
}
.logo-icon svg { fill:#fff; }
.logo-sub {
  font-size:11px; font-weight:400; color:var(--tx3);
  border-left:1px solid var(--bdr2); padding-left:10px; margin-left:2px;
  display:none;
}
@media(min-width:600px){ .logo-sub { display:block; } }

.hdr-right { margin-left:auto; display:flex; align-items:center; gap:10px; }
.status-pill {
  display:flex; align-items:center; gap:6px;
  padding:5px 12px; border-radius:20px;
  background:var(--bg3); border:1px solid var(--bdr);
  font-size:12px; color:var(--tx2);
}
.dot-live {
  width:6px; height:6px; border-radius:50%;
  background:var(--green); box-shadow:0 0 8px var(--green);
  animation:blink 2s ease-in-out infinite;
}
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.4} }

.btn-primary {
  display:inline-flex; align-items:center; gap:7px;
  padding:8px 18px; border-radius:8px;
  background:var(--p); color:#fff;
  border:none; cursor:pointer;
  font-family:var(--f); font-size:13px; font-weight:600;
  box-shadow:0 0 20px var(--p-glow);
  transition:all .15s; white-space:nowrap;
}
.btn-primary:hover:not(:disabled) { background:var(--p2); box-shadow:0 0 28px var(--p-glow); }
.btn-primary:active:not(:disabled) { transform:scale(.98); }
.btn-primary:disabled { opacity:.4; cursor:not-allowed; box-shadow:none; }

/* ─── LAYOUT ─── */
.layout {
  max-width:1200px; margin:0 auto;
  padding:20px 16px 60px;
  display:grid; grid-template-columns:1fr; gap:16px;
}
@media(min-width:768px){
  .layout { grid-template-columns:var(--sw) 1fr; }
}
@media(min-width:1100px){
  .layout { grid-template-columns:var(--sw) 1fr 260px; }
}

/* ─── CARD ─── */
.card {
  background:var(--bg2); border:1px solid var(--bdr);
  border-radius:14px; overflow:hidden;
  transition:border-color .2s;
}
.card-hdr {
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 18px; border-bottom:1px solid var(--bdr);
}
.card-title {
  font-family:var(--fh); font-size:13px; font-weight:600;
  color:var(--tx); display:flex; align-items:center; gap:8px;
  text-transform:uppercase; letter-spacing:.5px;
}
.card-icon {
  width:26px; height:26px; border-radius:7px;
  background:var(--p-dim); display:flex; align-items:center; justify-content:center;
}
.card-body { padding:18px; }

/* ─── SEARCH ─── */
.search-wrap { position:relative; }
.search-field {
  display:flex; align-items:center; gap:10px;
  background:var(--bg3); border:1px solid var(--bdr2);
  border-radius:9px; padding:10px 14px;
  transition:border-color .2s, box-shadow .2s;
}
.search-field:focus-within {
  border-color:var(--p); box-shadow:0 0 0 3px var(--p-dim);
}
.search-field svg { color:var(--tx3); flex-shrink:0; }
.sinput {
  flex:1; background:none; border:none; outline:none;
  font-family:var(--f); font-size:14px; color:var(--tx);
}
.sinput::placeholder { color:var(--tx3); }

.dropdown {
  position:absolute; top:calc(100% + 6px); left:0; right:0; z-index:400;
  background:var(--bg3); border:1px solid var(--bdr2);
  border-radius:10px; overflow:hidden;
  box-shadow:0 16px 40px rgba(0,0,0,.5);
  max-height:280px; overflow-y:auto;
  animation:pop .14s ease;
}
@keyframes pop { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
.drow {
  display:flex; align-items:center; gap:11px;
  width:100%; padding:10px 14px;
  background:none; border:none; border-bottom:1px solid var(--bdr);
  cursor:pointer; text-align:left; font-family:var(--f);
  transition:background .12s;
}
.drow:last-child { border-bottom:none; }
.drow:hover { background:var(--bg4); }
.drow-name { font-size:13px; font-weight:500; color:var(--tx); }
.drow-sub  { font-size:11px; color:var(--tx3); margin-top:1px; }

/* ─── AVATAR ─── */
.av {
  border-radius:50%; display:flex; align-items:center; justify-content:center;
  font-family:var(--fh); font-weight:700; flex-shrink:0; letter-spacing:.5px;
}

/* ─── PROFILE PANEL ─── */
.profile-cover { height:48px; }
.profile-av-wrap { padding:0 18px; margin-top:-22px; margin-bottom:10px; }
.profile-info { padding:0 18px 14px; }
.profile-name { font-family:var(--fh); font-size:16px; font-weight:700; color:var(--tx); }
.profile-role { font-size:12px; color:var(--p2); margin-top:2px; }
.profile-co   { font-size:12px; color:var(--tx2); }
.xbtn {
  position:absolute; top:10px; right:12px;
  background:rgba(0,0,0,.3); border:1px solid var(--bdr);
  border-radius:6px; width:26px; height:26px;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:var(--tx3); transition:all .15s;
}
.xbtn:hover { color:var(--tx); border-color:var(--bdr2); }
.xbtn svg { pointer-events:none; }

.meta-rows { padding:0 18px 14px; display:flex; flex-direction:column; gap:6px; }
.mrow { display:flex; justify-content:space-between; align-items:center; }
.mk { font-size:12px; color:var(--tx3); }
.mv { font-size:12px; font-weight:500; color:var(--tx2); text-align:right; max-width:55%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mv-accent { color:var(--p2); font-family:var(--fm); }

.tags-sec { padding:10px 18px 14px; border-top:1px solid var(--bdr); }
.tlabel { font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:var(--tx3); margin-bottom:7px; }
.tags { display:flex; flex-wrap:wrap; gap:5px; }
.tag {
  padding:3px 9px; border-radius:20px; font-size:11px; font-weight:500;
  background:var(--bg4); border:1px solid var(--bdr2); color:var(--tx2);
}
.tag-p { background:var(--p-dim); border-color:rgba(99,102,241,.3); color:var(--p2); }
.tag-g { background:rgba(16,185,129,.1); border-color:rgba(16,185,129,.25); color:var(--green); }
.tag-a { background:rgba(245,158,11,.1); border-color:rgba(245,158,11,.25); color:var(--amber); }
.tag-c { background:rgba(6,182,212,.1); border-color:rgba(6,182,212,.25); color:var(--cyan); }

/* ─── CONTROLS ─── */
.ctrl-group { margin-bottom:16px; }
.ctrl-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:7px; }
.ctrl-label { font-size:12px; color:var(--tx3); }
.ctrl-val { font-family:var(--fm); font-size:12px; color:var(--p2); font-weight:500; }
input[type=range] {
  width:100%; appearance:none; height:3px; border-radius:2px;
  background:var(--bg4); outline:none; cursor:pointer;
}
input[type=range]::-webkit-slider-thumb {
  appearance:none; width:14px; height:14px; border-radius:50%;
  background:var(--p); border:2px solid var(--bg2);
  box-shadow:0 0 8px var(--p-glow); cursor:pointer;
  transition:transform .15s;
}
input[type=range]::-webkit-slider-thumb:hover { transform:scale(1.2); }
.range-hint { display:flex; justify-content:space-between; font-size:10px; color:var(--tx3); margin-top:3px; }

/* ─── FILTER CHIPS ─── */
.chips { display:flex; gap:6px; flex-wrap:wrap; }
.chip {
  padding:4px 12px; border-radius:20px; border:1px solid var(--bdr2);
  background:var(--bg3); font-family:var(--f); font-size:12px;
  font-weight:500; cursor:pointer; color:var(--tx2);
  transition:all .15s; white-space:nowrap;
}
.chip:hover { border-color:var(--p); color:var(--p2); }
.chip.on { background:var(--p-dim); border-color:var(--p); color:var(--p2); font-weight:600; }

/* ─── STEPS ─── */
.steps { display:flex; align-items:center; gap:7px; flex-wrap:wrap; }
.step { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--tx3); }
.step-n {
  width:18px; height:18px; border-radius:5px;
  background:var(--bg4); border:1px solid var(--bdr2);
  color:var(--tx3); font-size:10px; font-weight:700;
  display:flex; align-items:center; justify-content:center; flex-shrink:0;
}
.step.done { color:var(--tx2); }
.step.done .step-n { background:var(--p-dim); border-color:var(--p); color:var(--p2); }
.step-arr { color:var(--bdr2); font-size:14px; }

/* ─── EMPTY / LOADING ─── */
.empty {
  display:flex; flex-direction:column; align-items:center;
  text-align:center; padding:64px 24px; gap:12px;
}
.empty-icon { font-size:44px; }
.empty-title { font-family:var(--fh); font-size:20px; font-weight:700; color:var(--tx); }
.empty-sub { font-size:13px; color:var(--tx3); max-width:320px; line-height:1.7; }

.loading { display:flex; flex-direction:column; align-items:center; padding:72px 24px; gap:14px; }
.spinner {
  width:36px; height:36px; border:3px solid var(--bg4);
  border-top-color:var(--p); border-radius:50%;
  animation:spin .8s linear infinite;
  box-shadow:0 0 16px var(--p-glow);
}
.spin-sm {
  width:13px; height:13px; border-radius:50%;
  border:2px solid rgba(255,255,255,.3); border-top-color:#fff;
  animation:spin .7s linear infinite; display:inline-block;
}
@keyframes spin { to { transform:rotate(360deg); } }
.loading-lbl { font-family:var(--fh); font-size:16px; color:var(--tx); font-weight:600; }
.loading-sub { font-size:11px; color:var(--tx3); }

/* ─── SKELETON ─── */
.skel {
  background:linear-gradient(90deg,var(--bg3) 25%,var(--bg4) 50%,var(--bg3) 75%);
  background-size:500px 100%; border-radius:6px;
  animation:shim 1.3s infinite;
}
@keyframes shim { from{background-position:-500px 0} to{background-position:500px 0} }

/* ─── ERROR ─── */
.err {
  margin-top:12px; padding:11px 14px;
  background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.25);
  border-radius:8px; font-size:13px; color:var(--red); line-height:1.5;
}

/* ─── RESULTS HEADER ─── */
.res-hdr {
  display:flex; align-items:flex-start; justify-content:space-between;
  padding:18px 20px 14px; border-bottom:1px solid var(--bdr);
  flex-wrap:wrap; gap:8px;
}
.res-title { font-family:var(--fh); font-size:17px; font-weight:700; color:var(--tx); }
.res-name  { color:var(--p2); }
.res-meta  { font-size:11px; color:var(--tx3); font-family:var(--fm); margin-top:3px; }
.model-tag {
  display:inline-flex; align-items:center; gap:5px;
  padding:3px 10px; border-radius:20px;
  background:var(--p-dim); border:1px solid rgba(99,102,241,.3);
  font-size:11px; font-weight:600; color:var(--p2);
}

/* ─── REC CARD ─── */
.rec {
  display:flex; align-items:flex-start; gap:12px;
  padding:16px 20px; border-bottom:1px solid var(--bdr);
  transition:background .14s;
  animation:up .35s ease both; animation-delay:var(--d,0ms);
}
.rec:last-child { border-bottom:none; }
.rec:hover { background:var(--bg3); }
@keyframes up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

.rec-rank {
  font-family:var(--fm); font-size:11px; font-weight:500;
  color:var(--tx3); min-width:22px; text-align:center; padding-top:3px;
}
.rec-body { flex:1; min-width:0; }
.rec-name { font-size:15px; font-weight:600; color:var(--tx); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rec-role { font-size:12px; color:var(--tx2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
.rec-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:8px; }
.rec-meta-row { display:flex; align-items:center; gap:10px; margin-top:7px; flex-wrap:wrap; }
.rec-meta-item { display:flex; align-items:center; gap:4px; font-size:11px; color:var(--tx3); }
.rec-meta-item svg { flex-shrink:0; }

/* Benefit label */
.benefit {
  display:inline-flex; align-items:center; gap:5px; margin-top:8px;
  padding:4px 10px; border-radius:20px; font-size:11px; font-weight:500;
  background:rgba(16,185,129,.08); border:1px solid rgba(16,185,129,.2); color:var(--green);
}
.benefit.mentorship { background:rgba(6,182,212,.08); border-color:rgba(6,182,212,.2); color:var(--cyan); }
.benefit.growth     { background:rgba(245,158,11,.08); border-color:rgba(245,158,11,.2); color:var(--amber); }

.conn-btn {
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 13px; border-radius:20px;
  border:1px solid var(--p); background:transparent;
  color:var(--p2); font-family:var(--f); font-size:12px; font-weight:600;
  cursor:pointer; transition:all .15s; margin-top:10px;
}
.conn-btn:hover { background:var(--p-dim); }
.conn-btn.done { background:var(--p); color:#fff; border-color:var(--p); }

/* ─── SCORE COL ─── */
.score-col {
  display:flex; flex-direction:column; align-items:flex-end; gap:4px;
  min-width:68px; flex-shrink:0;
}
.score-num { font-family:var(--fm); font-size:22px; font-weight:500; line-height:1; }
.score-bar { width:60px; height:3px; background:var(--bg4); border-radius:2px; overflow:hidden; }
.score-fill { height:100%; border-radius:2px; animation:grow .6s ease both; }
@keyframes grow { from{width:0} to{width:var(--w)} }
.score-lbl { font-size:9px; color:var(--tx3); text-transform:uppercase; letter-spacing:.5px; }
.score-grade {
  font-size:10px; font-weight:600; padding:2px 8px; border-radius:20px;
}

/* ─── RIGHT STATS ─── */
.stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.stat-cell {
  padding:12px 10px; border-radius:10px; text-align:center;
  background:var(--bg3); border:1px solid var(--bdr);
}
.stat-num { font-family:var(--fm); font-size:20px; font-weight:500; color:var(--p2); line-height:1; }
.stat-lbl { font-size:11px; color:var(--tx3); margin-top:4px; }

.feat-row {
  display:flex; align-items:center; gap:9px;
  padding:6px 0; border-bottom:1px solid var(--bdr); font-size:12px; color:var(--tx2);
}
.feat-row:last-child { border-bottom:none; }
.feat-n {
  width:19px; height:19px; border-radius:5px; flex-shrink:0;
  background:var(--p-dim); border:1px solid rgba(99,102,241,.3);
  color:var(--p2); font-size:10px; font-weight:700;
  display:flex; align-items:center; justify-content:center;
}

/* ─── RESPONSIVE ─── */
.right-col { display:none; }
@media(min-width:1100px){ .right-col { display:flex; flex-direction:column; gap:14px; } }
.mobile-stats { display:block; }
@media(min-width:1100px){ .mobile-stats { display:none; } }
@media(max-width:767px){
  .hdr { padding:0 12px; }
  .layout { padding:14px 10px 50px; }
  .rec { padding:13px 14px; }
  .card-body { padding:14px; }
  .meta-rows,.profile-info { padding-left:14px; padding-right:14px; }
  .profile-av-wrap { padding-left:14px; padding-right:14px; }
  .tags-sec { padding-left:14px; padding-right:14px; }
  .res-hdr { padding:14px 14px 12px; }
}
`;

// ── Avatar ────────────────────────────────────────────────────────────────────
function Av({ name, size = 48 }) {
  const c = avatarColor(name);
  return (
    <div className="av" style={{ width: size, height: size, background: c + "18", border: `2px solid ${c}30`, color: c, fontSize: Math.round(size * 0.33) }}>
      {initials(name)}
    </div>
  );
}

// ── Tag ───────────────────────────────────────────────────────────────────────
function Tag({ children, type = "" }) {
  const m = { industry: "tag-p", level: "tag-a", remote: "tag-c", skill: "tag-g" };
  return <span className={`tag ${m[type] || ""}`}>{children}</span>;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkelRow() {
  return (
    <div className="rec">
      <div className="skel" style={{ width: 20, height: 12, marginTop: 4 }} />
      <div className="skel" style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}>
        <div className="skel" style={{ height: 13, width: "35%" }} />
        <div className="skel" style={{ height: 11, width: "58%" }} />
        <div style={{ display: "flex", gap: 5, marginTop: 4 }}>
          {[75, 65, 55].map((w, i) => <div key={i} className="skel" style={{ height: 20, width: w }} />)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
        <div className="skel" style={{ height: 22, width: 44 }} />
        <div className="skel" style={{ height: 3, width: 60 }} />
      </div>
    </div>
  );
}

// ── Profile panel ─────────────────────────────────────────────────────────────
function ProfilePanel({ profile, onClear }) {
  if (!profile) return (
    <div className="card">
      <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "36px 18px", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--bg3)", border: "2px dashed var(--bdr2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--tx3)", fontSize: 22 }}>?</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--tx)" }}>No profile selected</div>
        <div style={{ fontSize: 12, color: "var(--tx3)", lineHeight: 1.7 }}>Search a professional above to begin</div>
      </div>
    </div>
  );

  const c = avatarColor(profile.name);
  return (
    <div className="card" style={{ position: "relative", animation: "up .3s ease" }}>
      <div className="profile-cover" style={{ background: `linear-gradient(135deg,${c}22,${c}08)` }} />
      <div className="profile-av-wrap">
        <div className="av" style={{ width: 52, height: 52, background: c + "18", border: `3px solid var(--bg2)`, color: c, fontSize: 18 }}>{initials(profile.name)}</div>
      </div>
      <div className="profile-info">
        <div className="profile-name">{profile.name}</div>
        <div className="profile-role">{profile.current_role}</div>
        {profile.current_company && <div className="profile-co">{profile.current_company}</div>}
      </div>
      <button className="xbtn" onClick={onClear}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
      </button>

      <div className="meta-rows">
        {[["Industry",    profile.industry],
          ["Seniority",   profile.seniority_level],
          ["Experience",  profile.years_experience ? `${profile.years_experience} yrs` : ""],
          ["Location",    profile.location],
          ["Remote",      profile.remote_preference],
          ["Connections", profile.connections],
        ].map(([k, v]) => v !== undefined && v !== "" && (
          <div className="mrow" key={k}>
            <span className="mk">{k}</span>
            <span className={`mv${k === "Connections" ? " mv-accent" : ""}`}>{String(v)}</span>
          </div>
        ))}
      </div>

      {profile.skills?.length > 0 && (
        <div className="tags-sec">
          <div className="tlabel">Skills</div>
          <div className="tags">{profile.skills.slice(0, 8).map((s) => <span key={s} className="tag">{s}</span>)}</div>
        </div>
      )}
      {profile.goals?.length > 0 && (
        <div className="tags-sec">
          <div className="tlabel">Goals</div>
          <div className="tags">{profile.goals.slice(0, 4).map((g) => <span key={g} className="tag tag-p">{g}</span>)}</div>
        </div>
      )}
      {profile.can_offer?.length > 0 && (
        <div className="tags-sec">
          <div className="tlabel">Can offer</div>
          <div className="tags">{profile.can_offer.slice(0, 4).map((o) => <span key={o} className="tag tag-g">{o}</span>)}</div>
        </div>
      )}
    </div>
  );
}

// ── Rec card ──────────────────────────────────────────────────────────────────
function RecCard({ rec, index, queryProfile, onConnect, connected }) {
  const grade = scoreGrade(rec.score);
  const pct   = `${rec.score}%`;
  const expGap = queryProfile
    ? Math.abs((queryProfile.years_experience || 0) - rec.years_experience).toFixed(1)
    : null;

  const benefitClass = rec.benefit?.toLowerCase().includes("mentor") ? "mentorship"
    : rec.benefit?.toLowerCase().includes("growth") ? "growth" : "";

  return (
    <div className="rec" style={{ "--d": `${index * 38}ms` }}>
      <div className="rec-rank">#{rec.rank}</div>
      <Av name={rec.name} size={48} />
      <div className="rec-body">
        <div className="rec-name">{rec.name}</div>
        <div className="rec-role">{rec.current_role}{rec.current_company ? ` · ${rec.current_company}` : ""}</div>
        <div className="rec-tags">
          <Tag type="industry">{rec.industry}</Tag>
          <Tag type="level">{rec.seniority_level}</Tag>
          {rec.remote_preference && <Tag type="remote">{rec.remote_preference}</Tag>}
          <Tag>{rec.years_experience} yrs</Tag>
          {rec.industry_match && <span className="tag tag-g">Same industry</span>}
        </div>
        <div className="rec-meta-row">
          {rec.location && (
            <span className="rec-meta-item">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
              {rec.location}
            </span>
          )}
          {expGap !== null && (
            <span className="rec-meta-item">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-4h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z"/></svg>
              {expGap} yr gap
            </span>
          )}
          {rec.connections > 0 && (
            <span className="rec-meta-item">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
              {rec.connections.toLocaleString()}
            </span>
          )}
        </div>
        {rec.benefit && (
          <div className={`benefit ${benefitClass}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            {rec.benefit}
          </div>
        )}
        <button className={`conn-btn${connected ? " done" : ""}`} onClick={() => onConnect(rec.profile_id)}>
          {connected
            ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>Pending</>
            : <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>Connect</>
          }
        </button>
      </div>

      <div className="score-col">
        <div className="score-num" style={{ color: grade.color }}>{rec.score}</div>
        <div className="score-bar">
          <div className="score-fill" style={{ "--w": pct, width: pct, background: grade.color }} />
        </div>
        <div className="score-grade" style={{ color: grade.color, background: grade.color + "15", border: `1px solid ${grade.color}30` }}>
          {grade.label}
        </div>
        <div className="score-lbl">match</div>
      </div>
    </div>
  );
}

// ── Stats panel ───────────────────────────────────────────────────────────────
function StatsPanel({ profileDetail, serverStats }) {
  return (
    <>
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">
            <span className="card-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="var(--p2)"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg></span>
            System
          </span>
        </div>
        <div className="card-body">
          <div className="stat-grid">
            {[
              [serverStats?.profiles ? `${(serverStats.profiles/1000).toFixed(0)}K` : "50K", "Profiles"],
              ["Two-Tower", "Model"],
              ["FAISS", "Retrieval"],
              ["MMR", "Diversity"],
            ].map(([n, l]) => (
              <div className="stat-cell" key={l}>
                <div className="stat-num" style={{ fontSize: n.length > 4 ? 13 : 20 }}>{n}</div>
                <div className="stat-lbl">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-hdr">
          <span className="card-title">
            <span className="card-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="var(--p2)"><path d="M9.5 16.5l-4-4 1.41-1.41L9.5 13.67l8.09-8.09L19 7l-9.5 9.5z"/></svg></span>
            Features
          </span>
        </div>
        <div className="card-body" style={{ padding: "12px 18px" }}>
          {["Skill overlap (TF-IDF)","Goals similarity","Experience gap","Industry match","Seniority gap","Network ratio","Combined experience","Mentorship signal","Remote preference"].map((f, i) => (
            <div className="feat-row" key={f}>
              <span className="feat-n">{i + 1}</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      {profileDetail?.needs?.length > 0 && (
        <div className="card" style={{ animation: "up .3s ease" }}>
          <div className="card-hdr">
            <span className="card-title">
              <span className="card-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="var(--p2)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></span>
              Looking for
            </span>
          </div>
          <div className="card-body">
            <div className="tags">{profileDetail.needs.slice(0, 6).map((n) => <span key={n} className="tag tag-p">{n}</span>)}</div>
          </div>
        </div>
      )}
    </>
  );
}

// ── FILTERS ───────────────────────────────────────────────────────────────────
const FILTERS = [
  { key: "all",          label: "All" },
  { key: "same_industry",label: "Same industry" },
  { key: "senior",       label: "Senior+" },
  { key: "remote",       label: "Remote" },
  { key: "mentor",       label: "Mentors (8+ yrs)" },
  { key: "high_score",   label: "Score 70+" },
];

function applyFilter(list, f, sel) {
  if (f === "all") return list;
  if (f === "same_industry") return list.filter((r) => r.industry === sel?.industry);
  if (f === "senior") return list.filter((r) => ["senior","lead","principal","director","vp","chief","head"].some((s) => r.seniority_level?.toLowerCase().includes(s)));
  if (f === "remote") return list.filter((r) => r.remote_preference?.toLowerCase() === "remote");
  if (f === "mentor") return list.filter((r) => r.years_experience > 8);
  if (f === "high_score") return list.filter((r) => r.score >= 70);
  return list;
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [query,    setQuery]    = useState("");
  const [suggs,    setSuggs]    = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [selected, setSelected] = useState(null);   // from search dropdown
  const [detail,   setDetail]   = useState(null);   // full profile from /profile/{id}
  const [allRecs,  setAllRecs]  = useState([]);
  const [recs,     setRecs]     = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [searching,setSearching]= useState(false);
  const [diversity,setDiversity]= useState(0.3);
  const [topN,     setTopN]     = useState(10);
  const [fetchN,   setFetchN]   = useState(150);
  const [error,    setError]    = useState(null);
  const [skelN,    setSkelN]    = useState(0);
  const [filter,   setFilter]   = useState("all");
  const [connected,setConnected]= useState(new Set());
  const [step,     setStep]     = useState(1);
  const [srvStats, setSrvStats] = useState(null);

  const dq      = useDebounce(query, 240);
  const dropRef = useRef(null);

  // Fetch server stats once
  useEffect(() => { api.stats().then(setSrvStats).catch(() => {}); }, []);

  // Search
  useEffect(() => {
    if (!dq.trim()) { setSuggs([]); setShowDrop(false); return; }
    setSearching(true);
    api.search(dq)
      .then((r) => { setSuggs(r.profiles || r); setShowDrop(true); })
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [dq]);

  // Outside click
  useEffect(() => {
    const fn = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // Filter
  useEffect(() => { setRecs(applyFilter(allRecs, filter, detail)); }, [filter, allRecs, detail]);

  async function selectProfile(p) {
    setShowDrop(false);
    setQuery(p.name);
    setSelected(p);
    setRecs([]); setAllRecs([]);
    setError(null); setDetail(null); setStep(2);
    try { const d = await api.profile(p.profile_id); setDetail(d); } catch {}
  }

  async function handleFind() {
    if (!selected) return;
    setLoading(true); setError(null);
    setRecs([]); setAllRecs([]); setSkelN(topN); setStep(3);
    try {
      const data = await api.recommend(selected.profile_id, topN, diversity, fetchN);
      const results = data.recommendations || [];
      setAllRecs(results);
      setRecs(applyFilter(results, filter, detail));
    } catch (e) {
      setError("API unreachable. Check that the backend is running.");
    } finally {
      setLoading(false); setSkelN(0);
    }
  }

  function clear() {
    setSelected(null); setDetail(null); setRecs([]); setAllRecs([]);
    setQuery(""); setSuggs([]); setError(null); setStep(1);
  }

  function toggleConnect(pid) {
    setConnected((prev) => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n; });
  }

  return (
    <>
      <style>{CSS}</style>

      {/* HEADER */}
      <header className="hdr">
        <a className="logo" href="#">
          <div className="logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          </div>
          ConnectIQ
        </a>
        <span className="logo-sub">AI Recommendation Engine</span>

        <div className="hdr-right">
          <div className="status-pill">
            <div className="dot-live" />
            <span>{srvStats ? `${(srvStats.profiles/1000).toFixed(0)}K profiles` : "API live"}</span>
          </div>
          <button className="btn-primary" onClick={handleFind} disabled={!selected || loading}>
            {loading
              ? <><span className="spin-sm" />Analysing…</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>Find connections</>
            }
          </button>
        </div>
      </header>

      <div className="layout">
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <ProfilePanel profile={detail} onClear={clear} />
        </div>

        {/* CENTER */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Controls card */}
          <div className="card">
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Search */}
              <div ref={dropRef} className="search-wrap">
                <div className="search-field">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                  <input
                    className="sinput"
                    placeholder="Search by name, role, company or industry…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => suggs.length && setShowDrop(true)}
                  />
                  {searching && <div style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid var(--bg4)", borderTopColor: "var(--p)", animation: "spin .7s linear infinite", flexShrink: 0 }} />}
                </div>
                {showDrop && suggs.length > 0 && (
                  <div className="dropdown">
                    {suggs.map((p) => (
                      <button key={p.profile_id} className="drow" onMouseDown={() => selectProfile(p)}>
                        <Av name={p.name} size={34} />
                        <div>
                          <div className="drow-name">{p.name}</div>
                          <div className="drow-sub">{p.current_role} · {p.industry}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Filters */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: "var(--tx3)", marginBottom: 7 }}>Filter</div>
                <div className="chips">
                  {FILTERS.map((f) => (
                    <button key={f.key} className={`chip${filter === f.key ? " on" : ""}`} onClick={() => setFilter(f.key)}>{f.label}</button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="ctrl-group" style={{ marginBottom: 0 }}>
                  <div className="ctrl-hdr"><span className="ctrl-label">Results</span><span className="ctrl-val">{topN}</span></div>
                  <input type="range" min="5" max="20" step="1" value={topN} onChange={(e) => setTopN(+e.target.value)} />
                  <div className="range-hint"><span>5</span><span>20</span></div>
                </div>
                <div className="ctrl-group" style={{ marginBottom: 0 }}>
                  <div className="ctrl-hdr"><span className="ctrl-label">Diversity (MMR)</span><span className="ctrl-val">{diversity.toFixed(1)}</span></div>
                  <input type="range" min="0" max="1" step="0.1" value={diversity} onChange={(e) => setDiversity(+e.target.value)} />
                  <div className="range-hint"><span>Relevance</span><span>Diverse</span></div>
                </div>
              </div>

              {/* Steps + find btn */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div className="steps">
                  {["Search profile","Set parameters","Find matches"].map((s, i) => (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div className={`step${step > i ? " done" : ""}`}>
                        <span className="step-n">{step > i ? "✓" : i + 1}</span>
                        <span>{s}</span>
                      </div>
                      {i < 2 && <span className="step-arr">›</span>}
                    </div>
                  ))}
                </div>
              </div>

              {error && <div className="err">{error}</div>}
            </div>
          </div>

          {/* Results card */}
          <div className="card">
            {!selected && !loading && allRecs.length === 0 && (
              <div className="empty">
                <div className="empty-icon">🤝</div>
                <div className="empty-title">Find your next connection</div>
                <div className="empty-sub">Search from 50,000 professionals. Two-Tower neural network + FAISS retrieval + MMR diversity ranking.</div>
              </div>
            )}
            {selected && allRecs.length === 0 && !loading && (
              <div className="empty" style={{ padding: "48px 24px" }}>
                <div className="empty-icon" style={{ fontSize: 32 }}>✓</div>
                <div className="empty-title" style={{ fontSize: 16 }}>Profile ready</div>
                <div className="empty-sub">Adjust filters and click Find connections</div>
              </div>
            )}
            {loading && Array.from({ length: skelN }).map((_, i) => <SkelRow key={i} />)}
            {recs.length > 0 && (
              <>
                <div className="res-hdr">
                  <div>
                    <div className="res-title">Matches for <span className="res-name">{selected?.name}</span></div>
                    <div className="res-meta">{recs.length} results · diversity {diversity.toFixed(1)} · pool {fetchN}</div>
                  </div>
                  <div className="model-tag">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Two-Tower + FAISS
                  </div>
                </div>
                {recs.map((rec, i) => (
                  <RecCard key={rec.profile_id} rec={rec} index={i} queryProfile={detail}
                    onConnect={toggleConnect} connected={connected.has(rec.profile_id)} />
                ))}
              </>
            )}
          </div>

          {/* Mobile stats */}
          <div className="mobile-stats" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <StatsPanel profileDetail={detail} serverStats={srvStats} />
          </div>
        </div>

        {/* RIGHT */}
        <div className="right-col">
          <StatsPanel profileDetail={detail} serverStats={srvStats} />
        </div>
      </div>
    </>
  );
}