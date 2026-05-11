import { useEffect, useRef, useState } from 'react'

const SESSION_ID = '00000000-0000-0000-0000-000000000001'
const API_URL = import.meta.env.VITE_API_URL || ''
const POLL_INTERVAL_MS = 4000

async function extractServerError(res) {
  let body = ''
  try {
    const text = await res.text()
    if (text) {
      try {
        const json = JSON.parse(text)
        body =
          (typeof json.error === 'string' && json.error) ||
          (typeof json.message === 'string' && json.message) ||
          text
      } catch {
        body = text
      }
    }
  } catch {
    // ignore body read failures
  }
  const trimmed = body && body.length > 200 ? `${body.slice(0, 200)}…` : body
  const statusLine = `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`
  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after') || res.headers.get('RateLimit-Reset')
    const wait = retryAfter ? ` Try again in ${retryAfter}s.` : ' Try again shortly.'
    return `Rate limit exceeded (${statusLine}).${wait}`
  }
  return trimmed ? `${statusLine} — ${trimmed}` : statusLine
}

function CheckIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function AlertIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function SparkleIcon({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M6.34 6.34l-2.12-2.12M19.78 19.78l-2.12-2.12M17.66 6.34l2.12-2.12M4.22 19.78l2.12-2.12" />
    </svg>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function TrashIcon({ size = 14 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function TA() {
  const [clusters, setClusters] = useState([])
  const [unclustered, setUnclustered] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [reclustering, setReclustering] = useState(false)
  const [reclusterError, setReclusterError] = useState('')

  const [exporting, setExporting] = useState(false)

  const [resolveState, setResolveState] = useState({})
  const [expandedClusters, setExpandedClusters] = useState({})

  const [resetting, setResetting] = useState(false)
  const [toast, setToast] = useState('')

  const intervalRef = useRef(null)
  const toastTimerRef = useRef(null)

  const fetchClusters = async ({ isInitial = false } = {}) => {
    try {
      const res = await fetch(`${API_URL}/api/clusters/${SESSION_ID}`)
      if (!res.ok) {
        const detail = await extractServerError(res)
        console.warn(`[TA] poll /api/clusters failed: ${detail}`)
        if (isInitial) setFetchError(`Failed to load clusters — ${detail}`)
        return
      }
      const data = await res.json()
      setClusters(Array.isArray(data.clusters) ? data.clusters : [])
      setUnclustered(Array.isArray(data.unclustered) ? data.unclustered : [])
      setFetchError('')
    } catch (err) {
      console.warn('[TA] poll network error:', err)
      if (isInitial) {
        const message = err instanceof Error && err.message ? err.message : String(err)
        setFetchError(`Failed to load clusters — Network error: ${message}`)
      }
    } finally {
      if (isInitial) setInitialLoading(false)
    }
  }

  useEffect(() => {
    const initialFetchId = setTimeout(() => fetchClusters({ isInitial: true }), 0)
    intervalRef.current = setInterval(() => fetchClusters(), POLL_INTERVAL_MS)
    return () => {
      clearTimeout(initialFetchId)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current)
        toastTimerRef.current = null
      }
    }
  }, [])

  const handleExportSummary = async () => {
    setExporting(true)
    try {
      const res = await fetch(`${API_URL}/api/sessions/${SESSION_ID}/summary`)
      if (!res.ok) {
        const detail = await extractServerError(res)
        showToast(`Export failed — ${detail}`)
        return
      }
      const { markdown } = await res.json()
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `office-hours-summary-${new Date().toISOString().slice(0, 10)}.md`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Summary downloaded.')
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : String(err)
      showToast(`Export failed — ${message}`)
    } finally {
      setExporting(false)
    }
  }

  const showToast = (message) => {
    setToast(message)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(''), 3500)
  }

  const handleResetDemo = async () => {
    const confirmed = window.confirm(
      'This will reset all questions and clusters for the demo. Continue?'
    )
    if (!confirmed) return
    setResetting(true)
    try {
      const res = await fetch(`${API_URL}/api/sessions/${SESSION_ID}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const detail = await extractServerError(res)
        console.error('[TA] reset demo failed:', detail)
        showToast(`Reset failed — ${detail}`)
        return
      }
      showToast('Demo reset — ready to go.')
      fetchClusters()
    } catch (err) {
      console.error('[TA] reset demo network error:', err)
      const message = err instanceof Error && err.message ? err.message : String(err)
      showToast(`Reset failed — Network error: ${message}`)
    } finally {
      setResetting(false)
    }
  }

  const handleRetry = () => {
    setInitialLoading(true)
    setFetchError('')
    fetchClusters({ isInitial: true })
  }

  const handleRecluster = async () => {
    setReclustering(true)
    setReclusterError('')
    try {
      const res = await fetch(`${API_URL}/api/sessions/${SESSION_ID}/cluster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const detail = await extractServerError(res)
        console.error('[TA] re-cluster failed:', detail)
        setReclusterError(`Re-clustering failed — ${detail}`)
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data?.error) {
        const message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
        console.error('[TA] re-cluster returned error:', message)
        setReclusterError(`Re-clustering failed — ${message}`)
      }
    } catch (err) {
      console.error('[TA] re-cluster network error:', err)
      const message = err instanceof Error && err.message ? err.message : String(err)
      setReclusterError(`Re-clustering failed — Network error: ${message}`)
    } finally {
      setReclustering(false)
    }
  }

  const updateResolveState = (clusterId, patch) => {
    setResolveState((prev) => ({
      ...prev,
      [clusterId]: { ...(prev[clusterId] || {}), ...patch },
    }))
  }

  const toggleExpanded = (clusterId) => {
    setExpandedClusters((prev) => ({ ...prev, [clusterId]: !prev[clusterId] }))
  }

  const openResolve = (clusterId) => {
    updateResolveState(clusterId, { open: true, answer: '', error: '', submitting: false })
  }

  const cancelResolve = (clusterId) => {
    updateResolveState(clusterId, { open: false, answer: '', error: '' })
  }

  const handleResolveChange = (clusterId, value) => {
    updateResolveState(clusterId, { answer: value, error: '' })
  }

  const handleConfirmAnswer = async (cluster) => {
    const current = resolveState[cluster.id] || {}
    const answer = (current.answer || '').trim()
    if (!answer) {
      updateResolveState(cluster.id, { error: 'Please enter an answer.' })
      return
    }
    updateResolveState(cluster.id, { submitting: true, error: '' })
    try {
      const res = await fetch(`${API_URL}/api/clusters/${cluster.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
      if (!res.ok) {
        const detail = await extractServerError(res)
        console.error(`[TA] resolve cluster ${cluster.id} failed:`, detail)
        updateResolveState(cluster.id, {
          submitting: false,
          error: `Failed to resolve cluster — ${detail}`,
        })
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data?.error) {
        const message = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
        console.error(`[TA] resolve cluster ${cluster.id} returned error:`, message)
        updateResolveState(cluster.id, {
          submitting: false,
          error: `Failed to resolve cluster — ${message}`,
        })
        return
      }
      setClusters((prev) =>
        prev.map((c) =>
          c.id === cluster.id ? { ...c, is_resolved: true, answer } : c
        )
      )
      updateResolveState(cluster.id, { submitting: false, open: false, answer: '', error: '' })
      fetchClusters()
    } catch (err) {
      console.error(`[TA] resolve cluster ${cluster.id} network error:`, err)
      const message = err instanceof Error && err.message ? err.message : String(err)
      updateResolveState(cluster.id, {
        submitting: false,
        error: `Failed to resolve cluster — Network error: ${message}`,
      })
    }
  }

  const skeletonLine = (width, height = 14, marginBottom = 10) => (
    <div
      className="oh-skeleton"
      style={{ width, height, marginBottom }}
      aria-hidden="true"
    />
  )

  const renderSkeleton = () => (
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            border: '1px solid var(--gray-200)',
            background: '#fff',
            borderRadius: 'var(--radius-lg)',
            padding: '22px 24px',
            marginBottom: 14,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {skeletonLine('55%', 18, 14)}
          {skeletonLine('28%', 12, 16)}
          {skeletonLine('100%', 12)}
          {skeletonLine('92%', 12, 0)}
        </div>
      ))}
    </div>
  )

  const resolvedClusters = clusters.filter((c) => c.is_resolved)
  const activeClusters = clusters.filter((c) => !c.is_resolved)
  const showActiveCount = !initialLoading && !fetchError && activeClusters.length > 0
  const showUnclusteredCount = !initialLoading && !fetchError && unclustered.length > 0
  const showResolvedCount = !initialLoading && !fetchError && resolvedClusters.length > 0

  return (
    <div className="oh-container">
      <div className="oh-ta-header">
        <div>
          <h1 className="oh-page-header__title">TA Dashboard</h1>
          <p className="oh-page-header__desc">Group questions with AI, then post one answer for the whole cluster.</p>
        </div>
        <div className="oh-ta-header__actions">
          <span className="oh-live-pill" title={`Polling every ${POLL_INTERVAL_MS / 1000}s`}>
            <span className="oh-live-pill__dot" />
            Live
          </span>
          <button
            type="button"
            onClick={handleExportSummary}
            disabled={exporting || resolvedClusters.length === 0}
            className="oh-btn oh-btn--secondary oh-btn--sm"
            title={resolvedClusters.length === 0 ? 'Resolve some clusters first' : 'Download AI-generated session summary'}
          >
            {exporting ? (
              <>
                <span className="oh-spinner oh-spinner--accent" aria-hidden="true" />
                <span>Generating…</span>
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Export summary</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleRecluster}
            disabled={reclustering}
            className="oh-btn oh-btn--primary oh-btn--sm"
          >
            {reclustering ? (
              <>
                <span className="oh-spinner" aria-hidden="true" />
                <span>Grouping…</span>
              </>
            ) : (
              <>
                <SparkleIcon size={14} />
                <span>Re-cluster</span>
              </>
            )}
          </button>
        </div>
      </div>

      {reclusterError && (
        <div role="alert" className="oh-alert oh-alert--danger" style={{ marginBottom: 20 }}>
          <span className="oh-alert__icon"><AlertIcon size={14} /></span>
          <span>{reclusterError}</span>
        </div>
      )}

      <div className="oh-section-head">
        <h2 className="oh-section-head__title">Active clusters</h2>
        {showActiveCount && (
          <span className="oh-section-head__count">{activeClusters.length}</span>
        )}
        <span className="oh-section-head__line" />
      </div>

      {initialLoading && renderSkeleton()}

      {!initialLoading && fetchError && (
        <div role="alert" className="oh-alert oh-alert--danger" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span className="oh-alert__icon">
              <AlertIcon />
            </span>
            <span>{fetchError}</span>
          </div>
          <button type="button" onClick={handleRetry} className="oh-btn oh-btn--secondary oh-btn--sm" style={{ alignSelf: 'flex-start' }}>
            Retry
          </button>
        </div>
      )}

      {!initialLoading && !fetchError && activeClusters.length === 0 && (
        <div className="oh-empty">
          <div className="oh-empty__icon" aria-hidden="true">
            <SparkleIcon size={18} />
          </div>
          No active clusters. Submit questions then hit Re-cluster.
        </div>
      )}

      {!initialLoading &&
        !fetchError &&
        activeClusters.map((cluster) => {
          const state = resolveState[cluster.id] || {}
          const isExpanded = !!expandedClusters[cluster.id]
          const count = cluster.questionCount ?? cluster.questions?.length ?? 0
          const studentLabel = `${count} ${count === 1 ? 'student' : 'students'}`

          return (
            <div
              key={cluster.id}
              className={`oh-cluster${cluster.is_resolved ? ' oh-cluster--resolved' : ''}`}
            >
              <div className="oh-cluster__header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="oh-cluster__title">{cluster.label || 'Untitled cluster'}</h3>
                  <div className="oh-cluster__meta">
                    <span className={`oh-badge ${cluster.is_resolved ? 'oh-badge--success' : 'oh-badge--brand'}`}>
                      <span className="oh-badge__dot" />
                      {studentLabel}
                    </span>
                    {cluster.totalUpvotes > 0 && (
                      <span className="oh-badge oh-badge--neutral" title="Total upvotes across questions in this cluster">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>
                        {cluster.totalUpvotes}
                      </span>
                    )}
                    {cluster.is_resolved && (
                      <span className="oh-badge oh-badge--success">
                        <CheckIcon size={12} />
                        Resolved
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openResolve(cluster.id)}
                  disabled={cluster.is_resolved || state.open}
                  className={`oh-btn ${cluster.is_resolved ? 'oh-btn--secondary' : 'oh-btn--primary'} oh-btn--sm`}
                >
                  {cluster.is_resolved ? 'Resolved' : 'Resolve'}
                </button>
              </div>

              {cluster.questions && cluster.questions.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(cluster.id)}
                    className="oh-toggle-link"
                  >
                    <ChevronIcon open={isExpanded} />
                    <span className="oh-toggle-link__text">
                      {isExpanded
                        ? 'Hide questions'
                        : `Show ${count} ${count === 1 ? 'question' : 'questions'}`}
                    </span>
                  </button>
                  {isExpanded && (
                    <ul className="oh-question-list oh-fade-in">
                      {cluster.questions.map((q) => (
                        <li key={q.id} className="oh-question-list__item">
                          <span className="oh-question-list__name">{q.student_name}:</span>
                          <span>{q.question_text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {state.open && !cluster.is_resolved && (
                <div style={{ marginTop: 16 }} className="oh-fade-in">
                  <label className="oh-label" htmlFor={`answer-${cluster.id}`}>
                    Your answer
                  </label>
                  <textarea
                    id={`answer-${cluster.id}`}
                    className="oh-textarea"
                    rows={4}
                    placeholder="Write a clear, concise answer for the whole cluster…"
                    value={state.answer || ''}
                    onChange={(e) => handleResolveChange(cluster.id, e.target.value)}
                    disabled={state.submitting}
                  />
                  {state.error && (
                    <div role="alert" className="oh-alert oh-alert--danger" style={{ marginTop: 10 }}>
                      <span className="oh-alert__icon">
                        <AlertIcon size={14} />
                      </span>
                      <span>{state.error}</span>
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleConfirmAnswer(cluster)}
                      disabled={state.submitting}
                      className="oh-btn oh-btn--success"
                    >
                      {state.submitting ? (
                        <>
                          <span className="oh-spinner" aria-hidden="true" />
                          <span>Saving…</span>
                        </>
                      ) : (
                        <>
                          <CheckIcon size={14} />
                          <span>Confirm answer</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelResolve(cluster.id)}
                      disabled={state.submitting}
                      className="oh-btn oh-btn--ghost"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {cluster.is_resolved && cluster.answer && (
                <div className="oh-answer-block" style={{ marginTop: 14 }}>
                  <span className="oh-answer-block__icon">
                    <CheckIcon size={16} />
                  </span>
                  <span>{cluster.answer}</span>
                </div>
              )}
            </div>
          )
        })}

      <div className="oh-section-head">
        <h2 className="oh-section-head__title">Unclustered questions</h2>
        {showUnclusteredCount && (
          <span className="oh-section-head__count">{unclustered.length}</span>
        )}
        <span className="oh-section-head__line" />
      </div>

      {!initialLoading && !fetchError && unclustered.length === 0 && (
        <div className="oh-empty">No unclustered questions — everything is grouped.</div>
      )}

      {!initialLoading &&
        !fetchError &&
        unclustered.map((q) => (
          <div key={q.id} className="oh-unclustered">
            <span className="oh-question-list__name">{q.student_name}:</span>
            <span>{q.question_text}</span>
          </div>
        ))}

      <div className="oh-section-head">
        <h2 className="oh-section-head__title">Session log — resolved</h2>
        {showResolvedCount && (
          <span className="oh-section-head__count">{resolvedClusters.length}</span>
        )}
        <span className="oh-section-head__line" />
      </div>

      {!initialLoading && !fetchError && resolvedClusters.length === 0 && (
        <div className="oh-empty">No resolved clusters yet.</div>
      )}

      {!initialLoading &&
        !fetchError &&
        resolvedClusters.map((cluster) => (
          <div key={cluster.id} className="oh-cluster oh-cluster--resolved">
            <div style={{ fontWeight: 600, color: 'var(--gray-900)', marginBottom: 6, letterSpacing: '-0.012em' }}>
              {cluster.label || 'Untitled cluster'}
            </div>
            <div className="oh-answer-block">
              <span className="oh-answer-block__icon">
                <CheckIcon size={16} />
              </span>
              <span>{cluster.answer}</span>
            </div>
          </div>
        ))}

      <button
        type="button"
        onClick={handleResetDemo}
        disabled={resetting}
        className="oh-reset-fab"
        title="Reset all questions for this demo session"
      >
        {resetting ? (
          <>
            <span className="oh-spinner oh-spinner--accent" aria-hidden="true" />
            <span>Resetting…</span>
          </>
        ) : (
          <>
            <TrashIcon />
            <span>Reset demo</span>
          </>
        )}
      </button>

      {toast && (
        <div role="status" className="oh-toast">
          <span>{toast}</span>
        </div>
      )}
    </div>
  )
}

export default TA
