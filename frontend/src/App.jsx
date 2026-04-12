import { useState, useEffect, useRef } from 'react'

const API = 'https://linkedin-recommendation-1.onrender.com'

async function apiSearchProfiles(q) {
  const r = await fetch(`${API}/profiles?q=${encodeURIComponent(q)}&limit=20`)
  const d = await r.json()
  return d.profiles || []
}
async function apiGetProfile(id) {
  const r = await fetch(`${API}/profile/${id}`)
  return r.json()
}
async function apiRecommend(profileId, topN, diversity) {
  const r = await fetch(`${API}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_id: profileId, top_n: topN, diversity }),
  })
  return r.json()
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
const PALETTE = ['#0a66c2', '#057642', '#b24020', '#8b5cf6', '#0891b2', '#b45309', '#be185d', '#1d4ed8']
function avatarColor(name = '') { return PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length] }

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #f3f2ef; font-family: 'Source Sans Pro', system-ui, sans-serif; color: #000000e6; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #0000001a; border-radius: 99px; }

  @keyframes liSlideUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes liFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes liShimmer {
    0%   { background-position: -600px 0; }
    100% { background-position:  600px 0; }
  }
  @keyframes liSpin { to { transform: rotate(360deg); } }

  .li-shimmer {
    background: linear-gradient(90deg, #ebebeb 25%, #f5f5f5 50%, #ebebeb 75%);
    background-size: 600px 100%;
    animation: liShimmer 1.5s infinite;
    border-radius: 4px;
  }
  .li-card {
    background: #fff;
    border: 1px solid #e0ddd8;
    border-radius: 8px;
    overflow: hidden;
  }
  .li-btn-primary {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 6px 20px; border-radius: 16px;
    background: #0a66c2; color: #fff;
    border: none; cursor: pointer;
    font-family: 'Source Sans Pro', system-ui, sans-serif;
    font-size: 16px; font-weight: 600;
    transition: background 0.15s, transform 0.1s;
    white-space: nowrap;
  }
  .li-btn-primary:hover:not(:disabled) { background: #004182; }
  .li-btn-primary:active:not(:disabled) { transform: scale(0.98); }
  .li-btn-primary:disabled { background: #c8c8c8; cursor: not-allowed; }

  .li-btn-outline {
    display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    padding: 5px 16px; border-radius: 16px;
    background: transparent; color: #0a66c2;
    border: 1.5px solid #0a66c2; cursor: pointer;
    font-family: 'Source Sans Pro', system-ui, sans-serif;
    font-size: 14px; font-weight: 600;
    transition: background 0.15s;
  }
  .li-btn-outline:hover { background: #e8f0fe; }
  .li-btn-outline.connected { background: #0a66c2; color: #fff; border-color: #0a66c2; }

  .li-input {
    width: 100%; padding: 9px 12px 9px 36px;
    border: 1px solid #c8c8c8; border-radius: 4px;
    font-family: 'Source Sans Pro', system-ui, sans-serif;
    font-size: 15px; color: #000000e6; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    background: #fff;
  }
  .li-input:focus { border-color: #0a66c2; box-shadow: 0 0 0 2px #0a66c220; }

  .filter-chip {
    padding: 4px 14px; border-radius: 16px;
    border: 1px solid #c8c8c8; background: #fff;
    font-family: 'Source Sans Pro', system-ui, sans-serif;
    font-size: 14px; cursor: pointer;
    transition: all 0.15s; white-space: nowrap; color: #000000cc;
  }
  .filter-chip:hover { background: #f3f2ef; border-color: #a8a5a0; }
  .filter-chip.active { background: #e8f0fe; border-color: #0a66c2; color: #0a66c2; font-weight: 600; }

  .rec-row {
    display: flex; gap: 12px; padding: 16px;
    border-bottom: 1px solid #e0ddd8; cursor: pointer;
    transition: background 0.12s;
    animation: liSlideUp 0.32s ease both;
  }
  .rec-row:hover { background: #f9f8f6; }
  .rec-row:last-child { border-bottom: none; }

  .drop-item {
    display: flex; gap: 10px; align-items: center;
    padding: 10px 14px; cursor: pointer;
    border-bottom: 1px solid #f3f2ef;
    transition: background 0.1s;
    background: none; border-left: none; border-right: none;
    text-align: left; width: 100%;
    font-family: 'Source Sans Pro', system-ui, sans-serif;
  }
  .drop-item:hover { background: #f3f2ef; }
  .drop-item:last-child { border-bottom: none; }

  .nav-item {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 0 12px; height: 52px; justify-content: center;
    color: #666; font-size: 12px; cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
    font-family: 'Source Sans Pro', system-ui, sans-serif;
    white-space: nowrap;
  }
  .nav-item:hover { color: #000000e6; }
  .nav-item.active { color: #000000e6; border-bottom-color: #000000e6; }

  .sidebar-tag {
    display: inline-block; padding: 4px 10px;
    background: #f3f2ef; border: 1px solid #e0ddd8;
    border-radius: 14px; font-size: 13px; cursor: pointer;
    transition: background 0.1s; margin: 3px; color: #000000cc;
  }
  .sidebar-tag:hover { background: #e0ddd8; }

  .score-track { width: 64px; height: 4px; background: #e0ddd8; border-radius: 99px; overflow: hidden; }
  .score-fill  { height: 100%; background: #0a66c2; border-radius: 99px; transition: width 0.5s ease; }

  .profile-stat { display: flex; justify-content: space-between; padding: 5px 16px; cursor: pointer; }
  .profile-stat:hover .stat-label { color: #0a66c2; }

  input[type=range] {
    -webkit-appearance: none; width: 100%; height: 3px;
    background: #d0d0d0; border-radius: 99px; outline: none; cursor: pointer;
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%;
    background: #0a66c2; cursor: pointer;
    box-shadow: 0 0 0 3px #0a66c220; transition: box-shadow 0.15s;
  }
  input[type=range]::-webkit-slider-thumb:hover { box-shadow: 0 0 0 5px #0a66c230; }

  .notif-dot {
    width: 8px; height: 8px; background: #cc1016; border-radius: 50%;
    position: absolute; top: 0; right: 0; border: 1.5px solid #fff;
  }
  .step-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #666; }
  .step-num {
    width: 22px; height: 22px; border-radius: 50%;
    background: #f3f2ef; border: 1px solid #e0ddd8;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; flex-shrink: 0;
  }
  .step-item.done .step-num { background: #0a66c2; border-color: #0a66c2; color: #fff; }
  .step-item.done { color: #000000cc; }
`

function Avatar({ name, size = 48 }) {
  const c = avatarColor(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: c + '18', border: `2px solid ${c}44`, color: c,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: Math.round(size * 0.32),
      fontFamily: 'Source Sans Pro, system-ui, sans-serif',
    }}>
      {initials(name)}
    </div>
  )
}

function Pill({ children, color }) {
  const map = {
    industry: { bg: '#e8f5e9', border: '#a5d6a7', text: '#1b5e20' },
    level:    { bg: '#fff3e0', border: '#ffcc80', text: '#e65100' },
    remote:   { bg: '#e3f2fd', border: '#90caf9', text: '#0d47a1' },
    exp:      { bg: '#fce4ec', border: '#f48fb1', text: '#880e4f' },
    goal:     { bg: '#ede7f6', border: '#b39ddb', text: '#4527a0' },
    offer:    { bg: '#e8f5e9', border: '#a5d6a7', text: '#1b5e20' },
    need:     { bg: '#e1f5fe', border: '#81d4fa', text: '#01579b' },
    skill:    { bg: '#f3f2ef', border: '#d0ccc7', text: '#000000cc' },
  }
  const s = map[color] || map.skill
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
      border: `1px solid ${s.border}`, background: s.bg, color: s.text,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function SkeletonCard() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: 16, borderBottom: '1px solid #e0ddd8' }}>
      <div className="li-shimmer" style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="li-shimmer" style={{ height: 14, width: '40%' }} />
        <div className="li-shimmer" style={{ height: 12, width: '65%' }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {[70, 80, 60].map((w, i) => <div key={i} className="li-shimmer" style={{ height: 22, width: w }} />)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div className="li-shimmer" style={{ height: 20, width: 40 }} />
        <div className="li-shimmer" style={{ height: 4, width: 64 }} />
      </div>
    </div>
  )
}

function RecCard({ rec, index, selectedProfile, onConnect, connected }) {
  const pct = Math.min((rec.score / 8) * 100, 100).toFixed(1)
  const expGap = selectedProfile?.years_experience
    ? Math.abs(parseFloat(selectedProfile.years_experience) - parseFloat(rec.years_experience)).toFixed(1)
    : null
  return (
    <div className="rec-row" style={{ animationDelay: `${index * 45}ms` }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0a66c2', minWidth: 24, paddingTop: 4 }}>
        #{rec.rank}
      </div>
      <Avatar name={rec.name} size={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#000000e6' }}>{rec.name}</div>
        <div style={{ fontSize: 14, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rec.current_role} · <strong style={{ color: '#000000cc' }}>{rec.current_company}</strong>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
          <Pill color="industry">{rec.industry}</Pill>
          <Pill color="level">{rec.seniority_level}</Pill>
          {rec.remote_preference && <Pill color="remote">{rec.remote_preference}</Pill>}
          <Pill color="exp">{rec.years_experience} yrs exp</Pill>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#666">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span style={{ fontSize: 13, color: '#666' }}>{rec.location}</span>
          {expGap !== null && <span style={{ fontSize: 13, color: '#666' }}>· {expGap} yr exp gap</span>}
        </div>
        <div style={{ marginTop: 10 }}>
          <button
            className={`li-btn-outline${connected ? ' connected' : ''}`}
            onClick={e => { e.stopPropagation(); onConnect(rec.profile_id) }}
          >
            {connected
              ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>Pending</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.11 0-2 .89-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>Connect</>
            }
          </button>
        </div>
      </div>
      <div style={{ minWidth: 72, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0a66c2', fontVariantNumeric: 'tabular-nums' }}>
          {rec.score.toFixed(2)}
        </div>
        <div className="score-track"><div className="score-fill" style={{ width: `${pct}%` }} /></div>
        <div style={{ fontSize: 12, color: '#666' }}>match score</div>
      </div>
    </div>
  )
}

function LeftProfileCard({ profile, onClear }) {
  const c = profile ? avatarColor(profile.name) : '#c8c8c8'
  return (
    <div className="li-card" style={{ animation: 'liFadeIn 0.3s ease' }}>
      <div style={{ height: 56, background: profile ? `linear-gradient(135deg, ${c}66, ${c}33)` : 'linear-gradient(135deg, #a0c4e0, #7fb3d3)' }} />
      <div style={{ padding: '0 16px 0', marginTop: -24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          {profile ? (
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #fff', background: c + '22', color: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, fontFamily: 'Source Sans Pro, sans-serif' }}>
              {initials(profile.name)}
            </div>
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: '50%', border: '3px solid #fff', background: '#c8c8c8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#fff', fontWeight: 700 }}>?</div>
          )}
          {profile && (
            <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 18, padding: '4px 6px', marginTop: 4 }}>✕</button>
          )}
        </div>
        <div style={{ marginTop: 6, paddingBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#000000e6', lineHeight: 1.3 }}>
            {profile ? profile.name : 'Select a profile'}
          </div>
          <div style={{ fontSize: 14, color: '#000000cc', marginTop: 2 }}>
            {profile ? profile.current_role : 'Search above to get started'}
          </div>
          {profile && <div style={{ fontSize: 13, color: '#666', marginTop: 1 }}>{profile.current_company}</div>}
        </div>
      </div>

      {profile && (
        <>
          <div style={{ height: 1, background: '#e0ddd8' }} />
          <div style={{ padding: '4px 0' }}>
            <div className="profile-stat">
              <span className="stat-label" style={{ fontSize: 13, color: '#666' }}>Industry</span>
              <span style={{ fontSize: 13, color: '#000000cc', fontWeight: 600, maxWidth: 150, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.industry}</span>
            </div>
            <div className="profile-stat">
              <span className="stat-label" style={{ fontSize: 13, color: '#666' }}>Seniority</span>
              <span style={{ fontSize: 13, color: '#000000cc', fontWeight: 600 }}>{profile.seniority_level}</span>
            </div>
            <div className="profile-stat">
              <span className="stat-label" style={{ fontSize: 13, color: '#666' }}>Experience</span>
              <span style={{ fontSize: 13, color: '#000000cc', fontWeight: 600 }}>{profile.years_experience} yrs</span>
            </div>
            <div className="profile-stat">
              <span className="stat-label" style={{ fontSize: 13, color: '#666' }}>Location</span>
              <span style={{ fontSize: 13, color: '#000000cc', maxWidth: 140, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.location}</span>
            </div>
            <div className="profile-stat">
              <span className="stat-label" style={{ fontSize: 13, color: '#666' }}>Remote</span>
              <span style={{ fontSize: 13, color: '#000000cc' }}>{profile.remote_preference}</span>
            </div>
            <div className="profile-stat">
              <span className="stat-label" style={{ fontSize: 13, color: '#666' }}>Connections</span>
              <span style={{ fontSize: 13, color: '#0a66c2', fontWeight: 600 }}>{profile.connections?.toLocaleString()}</span>
            </div>
          </div>

          {profile.skills?.length > 0 && (
            <>
              <div style={{ height: 1, background: '#e0ddd8', margin: '0 16px' }} />
              <div style={{ padding: '8px 12px 8px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#666', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {profile.skills.slice(0, 8).map(s => <span key={s} className="sidebar-tag">{s}</span>)}
                </div>
              </div>
            </>
          )}

          {profile.goals?.length > 0 && (
            <>
              <div style={{ height: 1, background: '#e0ddd8', margin: '0 16px' }} />
              <div style={{ padding: '8px 12px 8px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#666', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>Goals</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {profile.goals.slice(0, 4).map(g => <span key={g} className="sidebar-tag" style={{ borderColor: '#b39ddb55', color: '#4527a0' }}>{g}</span>)}
                </div>
              </div>
            </>
          )}

          {profile.can_offer?.length > 0 && (
            <>
              <div style={{ height: 1, background: '#e0ddd8', margin: '0 16px' }} />
              <div style={{ padding: '8px 12px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#666', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>Can Offer</div>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {profile.can_offer.slice(0, 4).map(o => <span key={o} className="sidebar-tag" style={{ borderColor: '#a5d6a755', color: '#1b5e20' }}>{o}</span>)}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'same_industry', label: 'Same industry' },
  { key: 'senior', label: 'Senior+' },
  { key: 'remote', label: 'Remote' },
  { key: 'mentor', label: 'Mentors' },
]

export default function App() {
  const [query, setQuery]             = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showDrop, setShowDrop]       = useState(false)
  const [selectedProfile, setSelected]= useState(null)
  const [profileDetail, setDetail]    = useState(null)
  const [recs, setRecs]               = useState([])
  const [allRecs, setAllRecs]         = useState([])
  const [loading, setLoading]         = useState(false)
  const [searching, setSearching]     = useState(false)
  const [diversity, setDiversity]     = useState(0.3)
  const [topN, setTopN]               = useState(10)
  const [error, setError]             = useState(null)
  const [skeletonCount, setSkelCount] = useState(0)
  const [activeFilter, setFilter]     = useState('all')
  const [connected, setConnected]     = useState(new Set())
  const [step, setStep]               = useState(1)

  const debounceRef = useRef(null)
  const dropdownRef = useRef(null)

  function applyFilter(list, f) {
    if (f === 'all') return list
    if (f === 'same_industry') return list.filter(r => r.industry === selectedProfile?.industry)
    if (f === 'senior') return list.filter(r => ['senior','lead','principal','director','vp','c-suite'].some(s => r.seniority_level?.toLowerCase().includes(s)))
    if (f === 'remote') return list.filter(r => r.remote_preference?.toLowerCase() === 'remote')
    if (f === 'mentor') return list.filter(r => r.years_experience > 8)
    return list
  }

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setSuggestions([]); setShowDrop(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await apiSearchProfiles(query)
        setSuggestions(results); setShowDrop(true)
      } finally { setSearching(false) }
    }, 250)
  }, [query])

  useEffect(() => {
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  useEffect(() => { setRecs(applyFilter(allRecs, activeFilter)) }, [activeFilter, allRecs])

  async function selectProfile(p) {
    setShowDrop(false); setQuery(p.name)
    setSelected(p); setRecs([]); setAllRecs([])
    setError(null); setDetail(null); setStep(2)
    try { const d = await apiGetProfile(p.profile_id); setDetail(d) } catch {}
  }

  async function handleRecommend() {
    if (!selectedProfile) return
    setLoading(true); setError(null)
    setRecs([]); setAllRecs([]); setSkelCount(topN); setStep(3)
    try {
      const data = await apiRecommend(selectedProfile.profile_id, topN, diversity)
      const results = data.recommendations || []
      setAllRecs(results); setRecs(applyFilter(results, activeFilter))
    } catch { setError('Could not reach the API. Make sure the backend is running.') }
    finally { setLoading(false); setSkelCount(0) }
  }

  function clearProfile() {
    setSelected(null); setDetail(null); setRecs([]); setAllRecs([])
    setQuery(''); setSuggestions([]); setError(null); setStep(1)
  }

  function toggleConnect(pid) {
    setConnected(prev => { const n = new Set(prev); n.has(pid) ? n.delete(pid) : n.add(pid); return n })
  }

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* ── Nav ── */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e0ddd8', position: 'sticky', top: 0, zIndex: 200, padding: '0 20px', display: 'flex', alignItems: 'center', height: 52, gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 8, flexShrink: 0 }}>
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <rect width="34" height="34" rx="4" fill="#0a66c2"/>
            <path d="M7 13h4v14H7V13zm2-6.5a2.3 2.3 0 110 4.6 2.3 2.3 0 010-4.6zM15 13h3.8v1.9h.05c.53-1 1.83-2.05 3.76-2.05 4.02 0 4.76 2.65 4.76 6.1V27h-4v-7.2c0-1.72-.03-3.93-2.4-3.93-2.4 0-2.77 1.87-2.77 3.8V27H15V13z" fill="white"/>
          </svg>
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: '#eef3f8', borderRadius: 4, padding: '6px 10px', minWidth: 200, gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ color: '#666', flexShrink: 0 }}>
            <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            placeholder="Search"
            style={{ background: 'none', border: 'none', outline: 'none', fontFamily: 'Source Sans Pro, sans-serif', fontSize: 14, color: '#000000e6', width: 140 }}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => suggestions.length && setShowDrop(true)}
          />
        </div>

        <div style={{ width: 1, height: 32, background: '#e0ddd8', margin: '0 8px' }} />

        {[
          { label: 'Home', path: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', active: true },
          { label: 'My Network', path: 'M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z', notif: true },
          { label: 'Jobs', path: 'M20 6H16V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm-6 0h-4V4h4v2z' },
          { label: 'Messaging', path: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z' },
        ].map(({ label, path, active, notif }) => (
          <div key={label} className={`nav-item${active ? ' active' : ''}`}>
            <div style={{ position: 'relative' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d={path} /></svg>
              {notif && <div className="notif-dot" />}
            </div>
            <span>{label}</span>
          </div>
        ))}

        <div style={{ marginLeft: 'auto' }}>
          <button className="li-btn-primary" onClick={handleRecommend} disabled={!selectedProfile || loading}>
            {loading
              ? <><div style={{ width: 14, height: 14, border: '2px solid #ffffff50', borderTopColor: '#fff', borderRadius: '50%', animation: 'liSpin 0.7s linear infinite' }} />Analysing…</>
              : 'Find connections'
            }
          </button>
        </div>
      </nav>

      {/* ── 3-col layout ── */}
      <div style={{ maxWidth: 1128, margin: '20px auto', padding: '0 16px', display: 'grid', gridTemplateColumns: '280px 1fr 300px', gap: 20 }}>

        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LeftProfileCard profile={profileDetail} onClear={clearProfile} />
          <div className="li-card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>How it works</div>
            <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
              <strong style={{ color: '#000000cc' }}>LambdaRank</strong> scores every candidate on 9 features: skill overlap, goals similarity, experience gap, industry match, seniority gap, network ratio, combined experience, mentorship potential, and remote preference match.
              <br /><br />
              <strong style={{ color: '#000000cc' }}>MMR</strong> re-ranks the top 60 to balance relevance vs. diversity — preventing an echo chamber.
            </div>
          </div>
        </div>

        {/* CENTER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div className="li-card" style={{ padding: 16 }}>
            {/* Search row */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div ref={dropdownRef} style={{ flex: 1, position: 'relative' }}>
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#666' }}>
                  <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  className="li-input"
                  placeholder="Search by name, role, company or industry…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => suggestions.length && setShowDrop(true)}
                />
                {searching && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid #c8c8c8', borderTopColor: '#0a66c2', borderRadius: '50%', animation: 'liSpin 0.7s linear infinite' }} />}
                {showDrop && suggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #e0ddd8', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', zIndex: 300, maxHeight: 300, overflowY: 'auto' }}>
                    {suggestions.map(p => (
                      <button key={p.profile_id} className="drop-item" onMouseDown={() => selectProfile(p)}>
                        <Avatar name={p.name} size={36} />
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: '#000000e6' }}>{p.name}</div>
                          <div style={{ fontSize: 13, color: '#666' }}>{p.current_role} · {p.industry}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="li-btn-primary" onClick={handleRecommend} disabled={!selectedProfile || loading}>
                {loading
                  ? <><div style={{ width: 13, height: 13, border: '2px solid #ffffff50', borderTopColor: '#fff', borderRadius: '50%', animation: 'liSpin 0.7s linear infinite' }} />Analysing…</>
                  : 'Find connections'
                }
              </button>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#666' }}>Filter:</span>
              {FILTERS.map(f => (
                <button key={f.key} className={`filter-chip${activeFilter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>

            {/* Sliders */}
            <div style={{ display: 'flex', gap: 20, marginTop: 12, paddingTop: 12, borderTop: '1px solid #e0ddd8', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 160 }}>
                <span style={{ fontSize: 14, color: '#666', whiteSpace: 'nowrap' }}>Results</span>
                <input type="range" min="5" max="20" step="1" value={topN} onChange={e => setTopN(+e.target.value)} style={{ flex: 1 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0a66c2', minWidth: 24 }}>{topN}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 180 }}>
                <span style={{ fontSize: 14, color: '#666', whiteSpace: 'nowrap' }}>Diversity</span>
                <input type="range" min="0" max="1" step="0.1" value={diversity} onChange={e => setDiversity(+e.target.value)} style={{ flex: 1 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#0a66c2', minWidth: 28 }}>{diversity.toFixed(1)}</span>
              </div>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
              {['Search profile', 'Set parameters', 'Find connections'].map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className={`step-item${step > i ? ' done' : ''}`}>
                    <div className="step-num">{step > i ? '✓' : i + 1}</div>
                    <span>{s}</span>
                  </div>
                  {i < 2 && <span style={{ color: '#c8c8c8', fontSize: 16 }}>›</span>}
                </div>
              ))}
            </div>

            {error && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#fdecea', border: '1px solid #f5c6cb', borderRadius: 4, fontSize: 14, color: '#b71c1c' }}>
                {error}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="li-card">
            {!selectedProfile && !loading && recs.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 24px', textAlign: 'center', animation: 'liFadeIn 0.4s ease' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="#c8c8c8" style={{ marginBottom: 16 }}>
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#000000cc', marginBottom: 6 }}>Discover your next high-value connection</div>
                <div style={{ fontSize: 15, color: '#666', maxWidth: 360, lineHeight: 1.6 }}>
                  Search for any of the 50,000 professionals. LambdaRank + MMR finds and diversifies the best matches.
                </div>
              </div>
            )}

            {selectedProfile && recs.length === 0 && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', animation: 'liFadeIn 0.3s ease' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#000000cc', marginBottom: 6 }}>Profile loaded ✓</div>
                <div style={{ fontSize: 14, color: '#666' }}>Adjust the sliders and click <strong>Find connections</strong></div>
              </div>
            )}

            {loading && Array.from({ length: skeletonCount }).map((_, i) => <SkeletonCard key={i} />)}

            {recs.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #e0ddd8' }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    Connections for <span style={{ color: '#0a66c2' }}>{selectedProfile?.name}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#666' }}>{recs.length} results · diversity {diversity.toFixed(1)}</div>
                </div>
                {recs.map((rec, i) => (
                  <RecCard key={rec.profile_id} rec={rec} index={i} selectedProfile={profileDetail} onConnect={toggleConnect} connected={connected.has(rec.profile_id)} />
                ))}
              </>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="li-card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Model stats</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[['50K', 'Profiles'], ['LBR', 'LambdaRank'], ['MMR', 'Diversity'], ['9', 'Features']].map(([num, label]) => (
                <div key={label} style={{ textAlign: 'center', padding: '8px 4px', background: '#f3f2ef', borderRadius: 6 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0a66c2' }}>{num}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="li-card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Features used</div>
            {['Skill overlap (Jaccard)', 'Goals similarity (TF-IDF)', 'Experience gap', 'Industry match', 'Seniority gap', 'Network ratio', 'Combined experience', 'Mentorship potential', 'Remote preference'].map((f, i) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#e8f0fe', color: '#0a66c2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ fontSize: 13, color: '#000000cc' }}>{f}</span>
              </div>
            ))}
          </div>

          {profileDetail?.needs?.length > 0 && (
            <div className="li-card" style={{ padding: '12px 16px', animation: 'liFadeIn 0.3s ease' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Looking for</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {profileDetail.needs.slice(0, 6).map(n => <Pill key={n} color="need">{n}</Pill>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}