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

function TA() {
  const [clusters, setClusters] = useState([])
  const [unclustered, setUnclustered] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')

  const [reclustering, setReclustering] = useState(false)
  const [reclusterError, setReclusterError] = useState('')

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

  const containerStyle = {
    maxWidth: 880,
    margin: '0 auto',
    textAlign: 'left',
  }

  const sectionHeadingStyle = {
    fontSize: 20,
    fontWeight: 600,
    margin: '32px 0 12px',
    color: '#333',
  }

  const primaryButtonStyle = (disabled) => ({
    padding: '10px 18px',
    fontSize: 15,
    background: disabled ? '#c98bff' : '#aa3bff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  })

  const secondaryButtonStyle = (disabled) => ({
    padding: '8px 14px',
    fontSize: 14,
    background: disabled ? '#eee' : '#fff',
    color: '#333',
    border: '1px solid #ccc',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })

  const resolveButtonStyle = (disabled) => ({
    padding: '8px 16px',
    background: disabled ? '#bdbdbd' : '#aa3bff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 14,
  })

  const clusterCardStyle = (resolved) => ({
    border: `1.5px solid ${resolved ? '#7fc97f' : '#9ec0f4'}`,
    background: resolved ? '#f3fbf3' : '#f6faff',
    borderRadius: 8,
    padding: '16px 20px',
    marginBottom: 14,
  })

  const cardHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  }

  const labelStyle = {
    fontSize: 17,
    fontWeight: 600,
    color: '#1a1a1a',
    margin: 0,
  }

  const badgeStyle = {
    display: 'inline-block',
    padding: '3px 10px',
    background: '#e6f0ff',
    color: '#1e4fa3',
    border: '1px solid #9ec0f4',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }

  const resolvedBadgeStyle = {
    ...badgeStyle,
    background: '#e6f7e6',
    color: '#1d6f1d',
    border: '1px solid #8fd28f',
  }

  const questionListStyle = {
    margin: '12px 0 0',
    padding: '12px 14px',
    background: '#fff',
    border: '1px solid #e5e4e7',
    borderRadius: 4,
    listStyle: 'none',
  }

  const questionItemStyle = {
    padding: '6px 0',
    borderBottom: '1px solid #f0eef3',
    fontSize: 14,
    color: '#333',
  }

  const studentNameStyle = {
    fontWeight: 600,
    color: '#555',
    marginRight: 8,
  }

  const toggleLinkStyle = {
    background: 'none',
    border: 'none',
    color: '#1e4fa3',
    cursor: 'pointer',
    fontSize: 13,
    padding: 0,
    marginTop: 8,
  }

  const textareaStyle = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 15,
    border: '1px solid #ccc',
    borderRadius: 4,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
  }

  const resolvedAnswerBoxStyle = {
    marginTop: 12,
    padding: '12px 14px',
    background: '#fff',
    border: '1px solid #d6f5d6',
    borderRadius: 4,
    color: '#1d6f1d',
    whiteSpace: 'pre-wrap',
  }

  const errorTextStyle = {
    color: '#c0392b',
    fontSize: 14,
    marginTop: 8,
  }

  const unclusteredCardStyle = {
    border: '1px solid #e5e4e7',
    borderRadius: 6,
    padding: '12px 16px',
    marginBottom: 10,
    background: '#fff',
    fontSize: 14,
  }

  const sessionLogCardStyle = {
    border: '1px solid #d6f5d6',
    background: '#f3fbf3',
    borderRadius: 6,
    padding: '14px 18px',
    marginBottom: 12,
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
      {skeletonLine(220, 24, 18)}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            border: '1px solid #ececef',
            borderRadius: 8,
            padding: '16px 20px',
            marginBottom: 14,
          }}
        >
          {skeletonLine('60%', 18)}
          {skeletonLine('30%', 12)}
          {skeletonLine('100%', 12)}
          {skeletonLine('90%', 12, 0)}
        </div>
      ))}
    </div>
  )

  const resolvedClusters = clusters.filter((c) => c.is_resolved)

  return (
    <div style={containerStyle}>
      <h1 style={{ marginTop: 0 }}>TA Dashboard</h1>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleRecluster}
          disabled={reclustering}
          style={primaryButtonStyle(reclustering)}
        >
          {reclustering && <span className="oh-spinner" aria-hidden="true" />}
          <span>{reclustering ? 'AI is grouping questions...' : 'Re-cluster Questions'}</span>
        </button>
        {reclusterError && (
          <span role="alert" style={{ color: '#c0392b', fontSize: 14 }}>
            {reclusterError}
          </span>
        )}
      </div>

      <h2 style={sectionHeadingStyle}>Active Clusters</h2>

      {initialLoading && renderSkeleton()}

      {!initialLoading && fetchError && (
        <div
          role="alert"
          style={{
            border: '1px solid #f5c6cb',
            background: '#fdecea',
            borderRadius: 6,
            padding: '14px 18px',
            color: '#c0392b',
          }}
        >
          <p style={{ margin: '0 0 10px' }}>{fetchError}</p>
          <button type="button" onClick={handleRetry} style={secondaryButtonStyle(false)}>
            Retry
          </button>
        </div>
      )}

      {!initialLoading && !fetchError && clusters.length === 0 && (
        <p style={{ color: '#888' }}>No clusters yet.</p>
      )}

      {!initialLoading &&
        !fetchError &&
        clusters.map((cluster) => {
          const state = resolveState[cluster.id] || {}
          const isExpanded = !!expandedClusters[cluster.id]
          const count = cluster.questionCount ?? cluster.questions?.length ?? 0
          const studentLabel = `${count} ${count === 1 ? 'student' : 'students'}`

          return (
            <div key={cluster.id} style={clusterCardStyle(cluster.is_resolved)}>
              <div style={cardHeaderStyle}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={labelStyle}>{cluster.label || 'Untitled cluster'}</h3>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={cluster.is_resolved ? resolvedBadgeStyle : badgeStyle}>
                      {studentLabel}
                    </span>
                    {cluster.is_resolved && (
                      <span style={resolvedBadgeStyle}>Resolved</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openResolve(cluster.id)}
                  disabled={cluster.is_resolved || state.open}
                  style={resolveButtonStyle(cluster.is_resolved || state.open)}
                >
                  {cluster.is_resolved ? 'Resolved' : 'Resolve'}
                </button>
              </div>

              {cluster.questions && cluster.questions.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleExpanded(cluster.id)}
                    style={toggleLinkStyle}
                  >
                    {isExpanded ? 'Hide questions' : `Show ${count} ${count === 1 ? 'question' : 'questions'}`}
                  </button>
                  {isExpanded && (
                    <ul style={questionListStyle}>
                      {cluster.questions.map((q, idx) => (
                        <li
                          key={q.id}
                          style={{
                            ...questionItemStyle,
                            borderBottom:
                              idx === cluster.questions.length - 1 ? 'none' : questionItemStyle.borderBottom,
                          }}
                        >
                          <span style={studentNameStyle}>{q.student_name}:</span>
                          <span>{q.question_text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {state.open && !cluster.is_resolved && (
                <div style={{ marginTop: 14 }}>
                  <label
                    htmlFor={`answer-${cluster.id}`}
                    style={{ display: 'block', fontWeight: 500, marginBottom: 6, color: '#333' }}
                  >
                    Your answer:
                  </label>
                  <textarea
                    id={`answer-${cluster.id}`}
                    rows={4}
                    value={state.answer || ''}
                    onChange={(e) => handleResolveChange(cluster.id, e.target.value)}
                    disabled={state.submitting}
                    style={textareaStyle}
                  />
                  {state.error && <p style={errorTextStyle}>{state.error}</p>}
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => handleConfirmAnswer(cluster)}
                      disabled={state.submitting}
                      style={primaryButtonStyle(state.submitting)}
                    >
                      {state.submitting && <span className="oh-spinner" aria-hidden="true" />}
                      <span>{state.submitting ? 'Saving…' : 'Confirm Answer'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelResolve(cluster.id)}
                      disabled={state.submitting}
                      style={secondaryButtonStyle(state.submitting)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {cluster.is_resolved && cluster.answer && (
                <div style={resolvedAnswerBoxStyle}>
                  <span style={{ marginRight: 8, fontWeight: 700 }}>✓</span>
                  {cluster.answer}
                </div>
              )}
            </div>
          )
        })}

      <h2 style={sectionHeadingStyle}>Unclustered Questions</h2>
      {!initialLoading && !fetchError && unclustered.length === 0 && (
        <p style={{ color: '#888' }}>No unclustered questions</p>
      )}
      {!initialLoading &&
        !fetchError &&
        unclustered.map((q) => (
          <div key={q.id} style={unclusteredCardStyle}>
            <span style={studentNameStyle}>{q.student_name}:</span>
            <span>{q.question_text}</span>
          </div>
        ))}

      <h2 style={sectionHeadingStyle}>Session Log — Resolved Questions</h2>
      {!initialLoading && !fetchError && resolvedClusters.length === 0 && (
        <p style={{ color: '#888' }}>No resolved clusters yet.</p>
      )}
      {!initialLoading &&
        !fetchError &&
        resolvedClusters.map((cluster) => (
          <div key={cluster.id} style={sessionLogCardStyle}>
            <div style={{ fontWeight: 600, color: '#1a1a1a', marginBottom: 6 }}>
              {cluster.label || 'Untitled cluster'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', color: '#1d6f1d' }}>
              <span style={{ marginRight: 8, fontWeight: 700 }}>✓</span>
              {cluster.answer}
            </div>
          </div>
        ))}

      <button
        type="button"
        onClick={handleResetDemo}
        disabled={resetting}
        style={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          padding: '6px 12px',
          fontSize: 12,
          color: '#666',
          background: '#f1f1f1',
          border: '1px solid #d6d6d6',
          borderRadius: 4,
          cursor: resetting ? 'not-allowed' : 'pointer',
          opacity: resetting ? 0.7 : 0.9,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
      >
        {resetting ? 'Resetting…' : 'Reset Demo'}
      </button>

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 60,
            right: 16,
            padding: '10px 16px',
            background: '#1a1a1a',
            color: '#fff',
            borderRadius: 6,
            fontSize: 14,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            maxWidth: 320,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}

export default TA
