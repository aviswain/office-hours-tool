import { useEffect, useRef, useState } from 'react'

const SESSION_ID = '00000000-0000-0000-0000-000000000001'
const API_URL = import.meta.env.VITE_API_URL || ''
const MAX_QUESTION_LENGTH = 1000
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

function SendIcon({ size = 16 }) {
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
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  )
}

function Student() {
  const [studentName, setStudentName] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedQuestionId, setSubmittedQuestionId] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [questions, setQuestions] = useState([])
  const [clusters, setClusters] = useState([])

  const intervalRef = useRef(null)

  const fetchStatus = async () => {
    try {
      const [questionsRes, clustersRes] = await Promise.all([
        fetch(`${API_URL}/api/questions/${SESSION_ID}`),
        fetch(`${API_URL}/api/clusters/${SESSION_ID}`),
      ])
      if (questionsRes.ok) {
        const data = await questionsRes.json()
        setQuestions(Array.isArray(data.questions) ? data.questions : [])
      } else {
        console.warn(
          `[Student] poll /api/questions failed: ${questionsRes.status} ${questionsRes.statusText}`
        )
      }
      if (clustersRes.ok) {
        const data = await clustersRes.json()
        setClusters(Array.isArray(data.clusters) ? data.clusters : [])
      } else {
        console.warn(
          `[Student] poll /api/clusters failed: ${clustersRes.status} ${clustersRes.statusText}`
        )
      }
    } catch (err) {
      console.warn('[Student] poll network error:', err)
    }
  }

  useEffect(() => {
    const initialFetchId = setTimeout(fetchStatus, 0)
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS)
    return () => {
      clearTimeout(initialFetchId)
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setErrorMessage('')
    try {
      const res = await fetch(`${API_URL}/api/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: SESSION_ID,
          studentName,
          questionText,
        }),
      })
      if (!res.ok) {
        const detail = await extractServerError(res)
        console.error('[Student] submit failed:', detail)
        setErrorMessage(`Something went wrong — ${detail}`)
        return
      }
      const data = await res.json()
      if (!data?.questionId) {
        console.error('[Student] submit response missing questionId:', data)
        setErrorMessage('Something went wrong — server did not return a questionId.')
        return
      }
      setSubmittedQuestionId(data.questionId)
      fetchStatus()
    } catch (err) {
      console.error('[Student] submit network error:', err)
      const message = err instanceof Error && err.message ? err.message : String(err)
      setErrorMessage(`Network error — ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const submittedQuestion = submittedQuestionId
    ? questions.find((q) => q.id === submittedQuestionId)
    : null

  const submittedCluster = submittedQuestion?.cluster_id
    ? clusters.find((c) => c.id === submittedQuestion.cluster_id)
    : null

  const resolvedQuestions = questions.filter((q) => q.is_resolved)
  const atMaxLength = questionText.length >= MAX_QUESTION_LENGTH

  return (
    <div className="oh-container oh-container--narrow">
      <header className="oh-hero">
        <div className="oh-hero__copy">
          <span className="oh-hero__eyebrow">
            <span aria-hidden="true">✦</span> Live office-hours queue
          </span>
          <h1 className="oh-hero__title">Ask a question.</h1>
          <p className="oh-hero__subtitle">
            Your TA will see it instantly. Similar questions are grouped together so
            you get answers faster.
          </p>
        </div>
      </header>

      {!submittedQuestionId && (
        <section className="oh-card oh-card--padded oh-fade-up" aria-label="Submit question">
          <form onSubmit={handleSubmit} noValidate={false}>
            <div className="oh-field">
              <label className="oh-label" htmlFor="studentName">
                Your name
              </label>
              <input
                id="studentName"
                type="text"
                className="oh-input"
                placeholder="e.g. Alex Chen"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                required
                disabled={submitting}
                autoComplete="name"
              />
            </div>

            <div className="oh-field">
              <label className="oh-label" htmlFor="questionText">
                Your question
              </label>
              <textarea
                id="questionText"
                className="oh-textarea"
                placeholder="Be specific about what you tried and where you got stuck…"
                value={questionText}
                onChange={(e) =>
                  setQuestionText(e.target.value.slice(0, MAX_QUESTION_LENGTH))
                }
                maxLength={MAX_QUESTION_LENGTH}
                required
                disabled={submitting}
                rows={6}
              />
              <div className={`oh-counter${atMaxLength ? ' oh-counter--max' : ''}`}>
                {questionText.length} / {MAX_QUESTION_LENGTH}
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="oh-btn oh-btn--primary oh-btn--lg"
            >
              {submitting ? (
                <>
                  <span className="oh-spinner" aria-hidden="true" />
                  <span>Submitting…</span>
                </>
              ) : (
                <>
                  <SendIcon />
                  <span>Submit question</span>
                </>
              )}
            </button>

            {errorMessage && (
              <div role="alert" className="oh-alert oh-alert--danger" style={{ marginTop: 16 }}>
                <span className="oh-alert__icon">
                  <AlertIcon />
                </span>
                <span>{errorMessage}</span>
              </div>
            )}
          </form>
        </section>
      )}

      {submittedQuestionId && (
        <div className="oh-fade-up">
          <div className="oh-confirmation">
            <span className="oh-confirmation__icon" aria-hidden="true">
              <CheckIcon size={20} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="oh-confirmation__title">Your question has been submitted</div>
              <div className="oh-confirmation__id">ID: {submittedQuestionId}</div>
            </div>
          </div>

          <div className="oh-status-panel">
            {!submittedQuestion && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--gray-500)', fontSize: 14 }}>
                <span className="oh-spinner oh-spinner--accent" aria-hidden="true" />
                <span>Loading status…</span>
              </div>
            )}

            {submittedQuestion &&
              submittedQuestion.cluster_id == null &&
              !submittedQuestion.is_resolved && (
                <div>
                  <span className="oh-badge oh-badge--warning">
                    <span className="oh-badge__dot oh-badge__dot--pulse" />
                    Waiting to be grouped
                  </span>
                  <p style={{ marginTop: 12, fontSize: 14, color: 'var(--gray-600)' }}>
                    Your TA is about to organize the queue — hang tight.
                  </p>
                </div>
              )}

            {submittedQuestion &&
              submittedQuestion.cluster_id != null &&
              !submittedQuestion.is_resolved && (
                <div>
                  <span className="oh-badge oh-badge--info">
                    <span className="oh-badge__dot oh-badge__dot--pulse" />
                    In queue — TA will answer soon
                  </span>
                  <p style={{ marginTop: 12, fontSize: 14, color: 'var(--gray-600)' }}>
                    We grouped your question with similar ones so everyone gets a faster reply.
                  </p>
                </div>
              )}

            {submittedQuestion && submittedQuestion.is_resolved && (
              <div>
                <span className="oh-badge oh-badge--success">
                  <CheckIcon size={12} />
                  Answered
                </span>
                {submittedCluster?.answer ? (
                  <div className="oh-answer-block" style={{ marginTop: 14 }}>
                    <span className="oh-answer-block__icon">
                      <CheckIcon size={16} />
                    </span>
                    <span>{submittedCluster.answer}</span>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, color: 'var(--gray-500)', fontSize: 14 }}>
                    Loading answer…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="oh-section-head">
        <h2 className="oh-section-head__title">Already answered</h2>
        <span className="oh-section-head__count">{resolvedQuestions.length}</span>
        <span className="oh-section-head__line" />
      </div>

      {resolvedQuestions.length === 0 ? (
        <div className="oh-empty">
          <div className="oh-empty__icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          No answered questions yet. Check back after your TA responds.
        </div>
      ) : (
        resolvedQuestions.map((q) => {
          const cluster = clusters.find((c) => c.id === q.cluster_id)
          return (
            <div key={q.id} className="oh-resolved-card">
              <div className="oh-resolved-card__question">{q.question_text}</div>
              {cluster?.answer ? (
                <div className="oh-answer-block" style={{ marginTop: 12 }}>
                  <span className="oh-answer-block__icon">
                    <CheckIcon size={16} />
                  </span>
                  <span>{cluster.answer}</span>
                </div>
              ) : (
                <div style={{ marginTop: 8, color: 'var(--gray-500)', fontSize: 13 }}>
                  Answer not yet available.
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

export default Student
