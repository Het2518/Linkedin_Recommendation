import { useState, useEffect, useRef } from 'react'
import './App.css'

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

const AVATAR_COLORS = [
  '#2dd4bf','#818cf8','#f472b6','#fb923c','#34d399','#60a5fa','#a78bfa','#facc15',
]
function avatarColor(name = '') {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length
  return AVATAR_COLORS[i]
}

// ── sub-components ─────────────────────────────────────────────────────────

function Avatar({ name, size = 44 }) {
  const color = avatarColor(name)
  return (
    <div className="avatar" style={{ width: size, height: size, background: color + '22', border: `1.5px solid ${color}55`, color }}>
      {initials(name)}
    </div>
  )
}

function Tag({ children, variant = 'default' }) {
  return <span className={`tag tag-${variant}`}>{children}</span>
}

function ScoreBar({ score, max = 8 }) {
  const pct = Math.min((score / max) * 100, 100).toFixed(1)
  return (
    <div className="score-bar-track">
      <div className="score-bar-fill" style={{ '--pct': `${pct}%` }} />
    </div>
  )
}

function ProfilePanel({ profile, onClear }) {
  if (!profile) return null
  return (
    <div className="profile-panel fade-in">
      <div className="profile-panel-header">
        <Avatar name={profile.name} size={52} />
        <div>
          <div className="profile-name">{profile.name}</div>
          <div className="profile-role">{profile.current_role}</div>
          <div className="profile-company">{profile.current_company}</div>
        </div>
        <button className="clear-btn" onClick={onClear} title="Clear">✕</button>
      </div>

      <div className="divider" />

      <div className="meta-grid">
        {[
          ['Industry',    profile.industry],
          ['Level',       profile.seniority_level],
          ['Experience',  `${profile.years_experience} yrs`],
          ['Location',    profile.location],
          ['Remote',      profile.remote_preference],
          ['Connections', profile.connections?.toLocaleString()],
        ].map(([k, v]) => (
          <div key={k} className="meta-row">
            <span className="meta-key">{k}</span>
            <span className="meta-val">{v || '—'}</span>
          </div>
        ))}
      </div>

      {profile.skills?.length > 0 && (
        <div className="skills-section">
          <div className="micro-label">Skills</div>
          <div className="tags-wrap">
            {profile.skills.slice(0, 10).map(s => <Tag key={s}>{s}</Tag>)}
          </div>
        </div>
      )}

      {profile.goals?.length > 0 && (
        <div className="skills-section">
          <div className="micro-label">Goals</div>
          <div className="tags-wrap">
            {profile.goals.slice(0, 4).map(g => <Tag key={g} variant="goal">{g}</Tag>)}
          </div>
        </div>
      )}
    </div>
  )
}

function RecCard({ rec, index }) {
  const color = avatarColor(rec.name)
  return (
    <div className="rec-card slide-up" style={{ '--delay': `${index * 55}ms` }}>
      <div className="rec-rank" style={{ color }}>#{rec.rank}</div>

      <div className="rec-left">
        <Avatar name={rec.name} size={42} />
      </div>

      <div className="rec-body">
        <div className="rec-name">{rec.name}</div>
        <div className="rec-role">{rec.current_role} · {rec.current_company}</div>
        <div className="rec-tags">
          <Tag variant="industry">{rec.industry}</Tag>
          <Tag variant="level">{rec.seniority_level}</Tag>
          {rec.remote_preference && <Tag variant="remote">{rec.remote_preference}</Tag>}
        </div>
        <div className="rec-footer">
          <span className="rec-meta">{rec.years_experience} yrs exp</span>
          <span className="rec-dot">·</span>
          <span className="rec-meta">{rec.location}</span>
        </div>
      </div>

      <div className="rec-score-col">
        <div className="rec-score-num">{rec.score.toFixed(2)}</div>
        <ScoreBar score={rec.score} />
        <div className="rec-score-label">match score</div>
      </div>
    </div>
  )
}

// ── main app ───────────────────────────────────────────────────────────────

export default function App() {
  const [query, setQuery]               = useState('')
  const [suggestions, setSuggestions]   = useState([])
  const [showDrop, setShowDrop]         = useState(false)
  const [selectedProfile, setSelected]  = useState(null)
  const [profileDetail, setDetail]      = useState(null)
  const [recs, setRecs]                 = useState([])
  const [loading, setLoading]           = useState(false)
  const [searching, setSearching]       = useState(false)
  const [diversity, setDiversity]       = useState(0.3)
  const [topN, setTopN]                 = useState(10)
  const [error, setError]               = useState(null)

  const debounceRef  = useRef(null)
  const dropdownRef  = useRef(null)

  // debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setSuggestions([]); setShowDrop(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const results = await apiSearchProfiles(query)
      setSuggestions(results)
      setShowDrop(true)
      setSearching(false)
    }, 280)
  }, [query])

  // click outside closes dropdown
  useEffect(() => {
    function handle(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  async function selectProfile(p) {
    setShowDrop(false)
    setQuery(p.name)
    setSelected(p)
    setRecs([])
    setError(null)
    const detail = await apiGetProfile(p.profile_id)
    setDetail(detail)
  }

  async function handleRecommend() {
    if (!selectedProfile) return
    setLoading(true)
    setError(null)
    setRecs([])
    try {
      const data = await apiRecommend(selectedProfile.profile_id, topN, diversity)
      setRecs(data.recommendations || [])
    } catch {
      setError('Could not reach the API. Make sure the backend is running on port 8000.')
    }
    setLoading(false)
  }

  function clearProfile() {
    setSelected(null); setDetail(null); setRecs([])
    setQuery(''); setSuggestions([]); setError(null)
  }

  return (
    <div className="app">

      {/* ── header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="logo">NEXUS</div>
          <div className="logo-sub">Professional Intelligence</div>
        </div>
        <div className="header-pills">
          <div className="hpill"><span className="hpill-num">50K</span> profiles</div>
          <div className="hpill"><span className="hpill-num">LambdaRank</span> model</div>
          <div className="hpill"><span className="hpill-num">MMR</span> diversity</div>
        </div>
        <div className="header-status">
          <span className="status-dot" />
          <span className="status-text">API connected</span>
        </div>
      </header>

      {/* ── body ── */}
      <div className="body-layout">

        {/* ── sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <p className="section-label">Search profile</p>
            <div className="search-wrap" ref={dropdownRef}>
              <div className="search-box">
                <svg className="search-icon" viewBox="0 0 20 20" fill="none">
                  <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  className="search-input"
                  placeholder="Name, role, company, industry…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => suggestions.length && setShowDrop(true)}
                />
                {searching && <div className="search-spinner" />}
              </div>

              {showDrop && suggestions.length > 0 && (
                <div className="dropdown">
                  {suggestions.map(p => (
                    <button key={p.profile_id} className="drop-item" onMouseDown={() => selectProfile(p)}>
                      <Avatar name={p.name} size={32} />
                      <div>
                        <div className="drop-name">{p.name}</div>
                        <div className="drop-meta">{p.current_role} · {p.industry}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <ProfilePanel profile={profileDetail} onClear={clearProfile} />

          {selectedProfile && (
            <div className="controls-section">
              <div className="divider" />
              <p className="section-label">Parameters</p>

              <div className="control-group">
                <div className="control-header">
                  <span className="control-label">Results</span>
                  <span className="control-val">{topN}</span>
                </div>
                <input type="range" min="5" max="20" step="1" value={topN}
                  onChange={e => setTopN(+e.target.value)} className="range-input" />
              </div>

              <div className="control-group">
                <div className="control-header">
                  <span className="control-label">Diversity</span>
                  <span className="control-val">{diversity.toFixed(1)}</span>
                </div>
                <input type="range" min="0" max="1" step="0.1" value={diversity}
                  onChange={e => setDiversity(+e.target.value)} className="range-input" />
                <div className="range-legend">
                  <span>Pure score</span>
                  <span>Max diverse</span>
                </div>
              </div>

              <button className="find-btn" onClick={handleRecommend} disabled={loading}>
                {loading
                  ? <><span className="btn-spinner" /> Analysing…</>
                  : <>Find connections</>
                }
              </button>

              {error && <div className="error-msg">{error}</div>}
            </div>
          )}
        </aside>

        {/* ── main panel ── */}
        <main className="main-panel">

          {!selectedProfile && (
            <div className="empty-state">
              <div className="empty-glyph">◈</div>
              <div className="empty-title">Discover your next high-value connection</div>
              <div className="empty-body">
                Search for any of the 50,000 professionals in the dataset.
                The model will rank and diversify the best matches using LambdaRank + MMR.
              </div>
              <div className="empty-steps">
                <div className="estep"><span className="estep-num">01</span>Search a profile</div>
                <div className="estep-arrow">→</div>
                <div className="estep"><span className="estep-num">02</span>Set diversity</div>
                <div className="estep-arrow">→</div>
                <div className="estep"><span className="estep-num">03</span>Find connections</div>
              </div>
            </div>
          )}

          {selectedProfile && recs.length === 0 && !loading && (
            <div className="empty-state soft">
              <div className="empty-glyph small">⟡</div>
              <div className="empty-title">Profile ready</div>
              <div className="empty-body">
                Adjust the diversity slider and click <strong>Find connections</strong> to run the model.
              </div>
            </div>
          )}

          {loading && (
            <div className="loading-state">
              <div className="loader-ring" />
              <div className="loader-text">Scoring 50,000 profiles…</div>
              <div className="loader-sub">Running LambdaRank · Applying MMR diversity</div>
            </div>
          )}

          {recs.length > 0 && (
            <div className="results-section">
              <div className="results-header">
                <div>
                  <div className="results-title">
                    Top connections for <span className="accent-text">{selectedProfile?.name}</span>
                  </div>
                  <div className="results-meta">
                    {recs.length} results · diversity {diversity.toFixed(1)} · {topN} requested
                  </div>
                </div>
              </div>

              <div className="cards-list">
                {recs.map((rec, i) => <RecCard key={rec.profile_id} rec={rec} index={i} />)}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}