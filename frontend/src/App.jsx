import { useState, useEffect, useRef, useCallback } from 'react'

const API = 'https://linkedin-recommendation-1.onrender.com'

// ── API helpers ───────────────────────────────────────────────────────────────
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

// ── utils ─────────────────────────────────────────────────────────────────────
function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}
const PALETTE = ['#38bdf8','#818cf8','#f472b6','#fb923c','#34d399','#60a5fa','#a78bfa','#facc15']
function avatarColor(name = '') { return PALETTE[name.charCodeAt(0) % PALETTE.length] }

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name, size = 44 }) {
  const c = avatarColor(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: c + '22', border: `1.5px solid ${c}55`,
      color: c, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.34, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0,
      letterSpacing: '-0.02em',
    }}>
      {initials(name)}
    </div>
  )
}

function Tag({ children, variant = 'default' }) {
  const colors = {
    default:  ['#38bdf820','#38bdf8'],
    goal:     ['#a78bfa20','#a78bfa'],
    industry: ['#fb923c20','#fb923c'],
    level:    ['#34d39920','#34d399'],
    remote:   ['#f472b620','#f472b6'],
  }
  const [bg, fg] = colors[variant] || colors.default
  return (
    <span style={{
      background: bg, color: fg, border: `1px solid ${fg}40`,
      borderRadius: 6, padding: '2px 8px', fontSize: 11,
      fontWeight: 600, letterSpacing: '0.03em', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

function ScoreBar({ score, max = 8 }) {
  const pct = Math.min((score / max) * 100, 100)
  return (
    <div style={{ height: 3, background: '#ffffff0a', borderRadius: 99, overflow: 'hidden', marginTop: 4 }}>
      <div style={{
        height: '100%', width: `${pct}%`,
        background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
        borderRadius: 99, transition: 'width 0.6s cubic-bezier(.22,1,.36,1)',
      }} />
    </div>
  )
}

// Skeleton shimmer for cards while loading
function CardSkeleton({ i }) {
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '16px 18px',
      background: '#ffffff05', borderRadius: 12, border: '1px solid #ffffff08',
      animation: `pulse 1.4s ease-in-out ${i * 80}ms infinite`,
    }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#ffffff0a', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 13, width: '45%', background: '#ffffff0a', borderRadius: 6 }} />
        <div style={{ height: 11, width: '70%', background: '#ffffff07', borderRadius: 6 }} />
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          {[60, 72, 55].map((w, j) => (
            <div key={j} style={{ height: 20, width: w, background: '#ffffff07', borderRadius: 6 }} />
          ))}
        </div>
      </div>
      <div style={{ width: 52, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ height: 16, width: 40, background: '#ffffff0a', borderRadius: 6 }} />
        <div style={{ height: 3, width: 52, background: '#ffffff07', borderRadius: 99 }} />
      </div>
    </div>
  )
}

function RecCard({ rec, index }) {
  const c = avatarColor(rec.name)
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '16px 18px',
      background: '#ffffff05', borderRadius: 12,
      border: '1px solid #ffffff08',
      animation: `slideUp 0.35s cubic-bezier(.22,1,.36,1) ${index * 55}ms both`,
      transition: 'background 0.15s, border-color 0.15s',
      cursor: 'default',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.background = '#ffffff09'
        e.currentTarget.style.borderColor = '#ffffff15'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = '#ffffff05'
        e.currentTarget.style.borderColor = '#ffffff08'
      }}
    >
      <div style={{ color: c, fontWeight: 800, fontSize: 12, minWidth: 24, paddingTop: 2, opacity: 0.7 }}>
        #{rec.rank}
      </div>
      <Avatar name={rec.name} size={42} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#f1f5f9', lineHeight: 1.3 }}>{rec.name}</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rec.current_role} · {rec.current_company}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
          <Tag variant="industry">{rec.industry}</Tag>
          <Tag variant="level">{rec.seniority_level}</Tag>
          {rec.remote_preference && <Tag variant="remote">{rec.remote_preference}</Tag>}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
          {rec.years_experience} yrs exp · {rec.location}
        </div>
      </div>
      <div style={{ minWidth: 56, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#38bdf8', fontVariantNumeric: 'tabular-nums' }}>
          {rec.score.toFixed(2)}
        </div>
        <ScoreBar score={rec.score} />
        <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>match</div>
      </div>
    </div>
  )
}

function ProfilePanel({ profile, onClear }) {
  if (!profile) return null
  return (
    <div style={{
      background: '#ffffff05', borderRadius: 12, border: '1px solid #ffffff0d',
      padding: '16px 18px', animation: 'fadeIn 0.3s ease both',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        <Avatar name={profile.name} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9' }}>{profile.name}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile.current_role}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{profile.current_company}</div>
        </div>
        <button onClick={onClear} style={{
          background: 'none', border: 'none', color: '#475569', cursor: 'pointer',
          fontSize: 16, lineHeight: 1, padding: '2px 4px',
        }}>✕</button>
      </div>

      <div style={{ height: 1, background: '#ffffff08', margin: '12px 0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
        {[
          ['Industry',    profile.industry],
          ['Level',       profile.seniority_level],
          ['Experience',  `${profile.years_experience} yrs`],
          ['Location',    profile.location],
          ['Remote',      profile.remote_preference],
          ['Connections', profile.connections?.toLocaleString()],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{k}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>{v || '—'}</div>
          </div>
        ))}
      </div>

      {profile.skills?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Skills</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {profile.skills.slice(0, 10).map(s => <Tag key={s}>{s}</Tag>)}
          </div>
        </div>
      )}

      {profile.goals?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: '#475569', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Goals</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {profile.goals.slice(0, 4).map(g => <Tag key={g} variant="goal">{g}</Tag>)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [query, setQuery]             = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showDrop, setShowDrop]       = useState(false)
  const [selectedProfile, setSelected]= useState(null)
  const [profileDetail, setDetail]    = useState(null)
  const [recs, setRecs]               = useState([])
  const [loading, setLoading]         = useState(false)
  const [searching, setSearching]     = useState(false)
  const [diversity, setDiversity]     = useState(0.3)
  const [topN, setTopN]               = useState(10)
  const [error, setError]             = useState(null)
  const [skeletonCount, setSkeletonCount] = useState(0)

  const debounceRef = useRef(null)
  const dropdownRef = useRef(null)
  const abortRef    = useRef(null)

  // debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setSuggestions([]); setShowDrop(false); return }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await apiSearchProfiles(query)
        setSuggestions(results)
        setShowDrop(true)
      } finally {
        setSearching(false)
      }
    }, 250)
  }, [query])

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
    setDetail(null)
    const detail = await apiGetProfile(p.profile_id)
    setDetail(detail)
  }

  async function handleRecommend() {
    if (!selectedProfile) return
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort()

    setLoading(true)
    setError(null)
    setRecs([])
    setSkeletonCount(topN)

    try {
      const data = await apiRecommend(selectedProfile.profile_id, topN, diversity)
      setRecs(data.recommendations || [])
    } catch {
      setError('Could not reach the API. Make sure the backend is running.')
    } finally {
      setLoading(false)
      setSkeletonCount(0)
    }
  }

  function clearProfile() {
    setSelected(null); setDetail(null); setRecs([])
    setQuery(''); setSuggestions([]); setError(null)
  }

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #060b14; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #ffffff15; border-radius: 99px; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
    @keyframes spin { to { transform: rotate(360deg); } }

    input[type=range] {
      -webkit-appearance: none; width: 100%; height: 3px;
      background: #ffffff10; border-radius: 99px; outline: none;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
      background: #38bdf8; cursor: pointer; box-shadow: 0 0 0 3px #38bdf820;
      transition: box-shadow 0.15s;
    }
    input[type=range]::-webkit-slider-thumb:hover { box-shadow: 0 0 0 5px #38bdf830; }
  `

  return (
    <>
      <style>{styles}</style>
      <div style={{
        minHeight: '100vh', background: '#060b14',
        fontFamily: "'Syne', system-ui, sans-serif",
        color: '#cbd5e1',
      }}>

        {/* ── Header ── */}
        <header style={{
          borderBottom: '1px solid #ffffff08',
          padding: '0 28px',
          display: 'flex', alignItems: 'center', gap: 24,
          height: 56, position: 'sticky', top: 0, zIndex: 100,
          background: '#060b14cc', backdropFilter: 'blur(20px)',
        }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#f1f5f9', letterSpacing: '-0.03em' }}>NEXUS</span>
            <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600, letterSpacing: '0.12em', marginLeft: 8 }}>INTELLIGENCE</span>
          </div>
          <div style={{ flex: 1 }} />
          {['50K profiles', 'LambdaRank', 'MMR diversity'].map(t => (
            <div key={t} style={{
              fontSize: 11, color: '#475569', fontFamily: "'DM Mono', monospace",
              background: '#ffffff05', border: '1px solid #ffffff08',
              borderRadius: 6, padding: '4px 10px',
            }}>{t}</div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
            <span style={{ fontSize: 11, color: '#475569' }}>live</span>
          </div>
        </header>

        {/* ── Layout ── */}
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 56px)' }}>

          {/* ── Sidebar ── */}
          <aside style={{
            width: 320, flexShrink: 0, borderRight: '1px solid #ffffff08',
            padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16,
            position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto',
          }}>
            <div>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                Search profile
              </div>

              {/* Search box */}
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: '#ffffff05', border: '1px solid #ffffff0d',
                  borderRadius: 10, padding: '0 12px', height: 40,
                  transition: 'border-color 0.15s',
                }}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ color: '#475569', flexShrink: 0 }}>
                    <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <input
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none',
                      color: '#f1f5f9', fontSize: 13, fontFamily: 'inherit',
                    }}
                    placeholder="Name, role, company, industry…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => suggestions.length && setShowDrop(true)}
                  />
                  {searching && (
                    <div style={{
                      width: 12, height: 12, border: '2px solid #38bdf840',
                      borderTopColor: '#38bdf8', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                  )}
                </div>

                {showDrop && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                    background: '#0d1520', border: '1px solid #ffffff12',
                    borderRadius: 10, overflow: 'hidden', zIndex: 200,
                    boxShadow: '0 16px 48px #00000060',
                  }}>
                    {suggestions.map(p => (
                      <button key={p.profile_id} onMouseDown={() => selectProfile(p)} style={{
                        display: 'flex', gap: 10, alignItems: 'center',
                        width: '100%', padding: '10px 12px', background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid #ffffff06',
                        transition: 'background 0.1s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = '#ffffff06'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >
                        <Avatar name={p.name} size={30} />
                        <div>
                          <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{p.current_role} · {p.industry}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <ProfilePanel profile={profileDetail} onClear={clearProfile} />

            {selectedProfile && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ height: 1, background: '#ffffff08' }} />
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Parameters
                </div>

                {/* Results slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Results</span>
                    <span style={{ fontSize: 12, color: '#38bdf8', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{topN}</span>
                  </div>
                  <input type="range" min="5" max="20" step="1" value={topN}
                    onChange={e => setTopN(+e.target.value)} />
                </div>

                {/* Diversity slider */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Diversity</span>
                    <span style={{ fontSize: 12, color: '#38bdf8', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{diversity.toFixed(1)}</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.1" value={diversity}
                    onChange={e => setDiversity(+e.target.value)} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: '#334155' }}>Pure score</span>
                    <span style={{ fontSize: 10, color: '#334155' }}>Max diverse</span>
                  </div>
                </div>

                {/* CTA button */}
                <button onClick={handleRecommend} disabled={loading} style={{
                  height: 42, borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  background: loading ? '#1e293b' : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                  color: '#fff', fontWeight: 700, fontSize: 13, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.15s, transform 0.1s',
                  opacity: loading ? 0.7 : 1,
                  letterSpacing: '0.02em',
                }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = loading ? '0.7' : '1' }}
                >
                  {loading ? (
                    <>
                      <div style={{ width: 13, height: 13, border: '2px solid #ffffff40', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      Analysing…
                    </>
                  ) : 'Find connections'}
                </button>

                {error && (
                  <div style={{ fontSize: 12, color: '#f87171', background: '#f8717110', border: '1px solid #f8717130', borderRadius: 8, padding: '10px 12px' }}>
                    {error}
                  </div>
                )}
              </div>
            )}
          </aside>

          {/* ── Main panel ── */}
          <main style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>

            {!selectedProfile && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', animation: 'fadeIn 0.5s ease' }}>
                <div style={{ fontSize: 48, marginBottom: 20, opacity: 0.3 }}>◈</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.03em', marginBottom: 10 }}>
                  Discover your next connection
                </div>
                <div style={{ fontSize: 14, color: '#475569', maxWidth: 380, lineHeight: 1.6 }}>
                  Search 50,000 professionals. The model ranks and diversifies matches using LambdaRank + MMR.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 32 }}>
                  {['Search a profile', 'Set diversity', 'Find connections'].map((s, i) => (
                    <>
                      <div key={s} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: '#ffffff05', border: '1px solid #ffffff08',
                        borderRadius: 8, padding: '8px 14px',
                      }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#38bdf8' }}>0{i + 1}</span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{s}</span>
                      </div>
                      {i < 2 && <span style={{ color: '#334155', fontSize: 14 }}>→</span>}
                    </>
                  ))}
                </div>
              </div>
            )}

            {selectedProfile && recs.length === 0 && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', textAlign: 'center', animation: 'fadeIn 0.4s ease' }}>
                <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.2 }}>⟡</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Profile loaded</div>
                <div style={{ fontSize: 13, color: '#475569' }}>
                  Adjust the sliders and click <strong style={{ color: '#94a3b8' }}>Find connections</strong>
                </div>
              </div>
            )}

            {/* Skeleton loading cards */}
            {loading && skeletonCount > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ height: 16, width: 240, background: '#ffffff08', borderRadius: 6, marginBottom: 8 }} />
                    <div style={{ height: 11, width: 160, background: '#ffffff05', borderRadius: 6 }} />
                  </div>
                </div>
                {Array.from({ length: skeletonCount }).map((_, i) => (
                  <CardSkeleton key={i} i={i} />
                ))}
              </div>
            )}

            {/* Results */}
            {recs.length > 0 && (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                      Top connections for <span style={{ color: '#38bdf8' }}>{selectedProfile?.name}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
                      {recs.length} results · diversity {diversity.toFixed(1)} · {topN} requested
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recs.map((rec, i) => <RecCard key={rec.profile_id} rec={rec} index={i} />)}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  )
}