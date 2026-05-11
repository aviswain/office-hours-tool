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

  const containerStyle = {
    maxWidth: 640,
    margin: '0 auto',
    textAlign: 'left',
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 16,
    border: '1px solid #ccc',
    borderRadius: 4,
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  }

  const labelStyle = {
    display: 'block',
    marginBottom: 6,
    fontWeight: 500,
    color: '#333',
  }

  const fieldStyle = { marginBottom: 16 }

  const buttonStyle = {
    padding: '10px 20px',
    fontSize: 16,
    background: submitting ? '#c98bff' : '#aa3bff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: submitting ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  }

  const counterStyle = {
    marginTop: 4,
    fontSize: 12,
    color: questionText.length >= MAX_QUESTION_LENGTH ? '#c0392b' : '#777',
    textAlign: 'right',
  }

  const errorStyle = {
    marginTop: 12,
    color: '#c0392b',
    fontSize: 14,
  }

  const sectionHeadingStyle = {
    fontSize: 20,
    fontWeight: 600,
    margin: '32px 0 12px',
    color: '#333',
  }

  const confirmationStyle = {
    border: '1px solid #d6f5d6',
    background: '#f3fbf3',
    borderRadius: 6,
    padding: '16px 20px',
    marginBottom: 20,
  }

  const questionIdStyle = {
    marginTop: 6,
    fontSize: 12,
    color: '#888',
    fontFamily: 'ui-monospace, Consolas, monospace',
  }

  const statusPanelStyle = {
    border: '1px solid #e5e4e7',
    borderRadius: 6,
    padding: '16px 20px',
    background: '#fff',
  }

  const baseBadgeStyle = {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
  }

  const yellowBadgeStyle = {
    ...baseBadgeStyle,
    background: '#fff8db',
    color: '#8a6d00',
    border: '1px solid #f5d76e',
  }

  const blueBadgeStyle = {
    ...baseBadgeStyle,
    background: '#e6f0ff',
    color: '#1e4fa3',
    border: '1px solid #9ec0f4',
  }

  const greenBadgeStyle = {
    ...baseBadgeStyle,
    background: '#e6f7e6',
    color: '#1d6f1d',
    border: '1px solid #8fd28f',
  }

  const answerBlockStyle = {
    marginTop: 12,
    padding: '12px 14px',
    background: '#fafafa',
    border: '1px solid #eee',
    borderRadius: 4,
    whiteSpace: 'pre-wrap',
  }

  const answeredCardStyle = {
    border: '1px solid #e5e4e7',
    borderRadius: 6,
    padding: '14px 18px',
    marginBottom: 12,
    background: '#fff',
  }

  return (
    <div style={containerStyle}>
      <h1 style={{ marginTop: 0 }}>Submit Your Question</h1>

      {!submittedQuestionId && (
        <form onSubmit={handleSubmit} noValidate={false}>
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="studentName">Name</label>
            <input
              id="studentName"
              type="text"
              placeholder="Your name"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              required
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="questionText">Question</label>
            <textarea
              id="questionText"
              placeholder="Type your question here... be specific about what you tried and where you got stuck"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
              maxLength={MAX_QUESTION_LENGTH}
              required
              disabled={submitting}
              rows={6}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
            <div style={counterStyle}>
              {questionText.length} / {MAX_QUESTION_LENGTH}
            </div>
          </div>

          <button type="submit" disabled={submitting} style={buttonStyle}>
            {submitting && <span className="oh-spinner" aria-hidden="true" />}
            <span>{submitting ? 'Submitting…' : 'Submit'}</span>
          </button>

          {errorMessage && (
            <p role="alert" style={errorStyle}>{errorMessage}</p>
          )}
        </form>
      )}

      {submittedQuestionId && (
        <div>
          <div style={confirmationStyle}>
            <p style={{ margin: 0, fontWeight: 500, color: '#1d6f1d' }}>
              Your question has been submitted.
            </p>
            <p style={questionIdStyle}>Question ID: {submittedQuestionId}</p>
          </div>

          <div style={statusPanelStyle}>
            {!submittedQuestion && (
              <span style={{ color: '#888', fontSize: 14 }}>Loading status…</span>
            )}

            {submittedQuestion &&
              submittedQuestion.cluster_id == null &&
              !submittedQuestion.is_resolved && (
                <span style={yellowBadgeStyle}>Waiting to be clustered</span>
              )}

            {submittedQuestion &&
              submittedQuestion.cluster_id != null &&
              !submittedQuestion.is_resolved && (
                <span style={blueBadgeStyle}>In queue — TA will answer soon</span>
              )}

            {submittedQuestion && submittedQuestion.is_resolved && (
              <div>
                <span style={greenBadgeStyle}>Answered</span>
                {submittedCluster?.answer ? (
                  <div style={answerBlockStyle}>{submittedCluster.answer}</div>
                ) : (
                  <div style={{ marginTop: 12, color: '#888', fontSize: 14 }}>
                    Loading answer…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <h2 style={sectionHeadingStyle}>Already Answered — Check Before Submitting</h2>
      {resolvedQuestions.length === 0 ? (
        <p style={{ color: '#888' }}>No answered questions yet.</p>
      ) : (
        resolvedQuestions.map((q) => {
          const cluster = clusters.find((c) => c.id === q.cluster_id)
          return (
            <div key={q.id} style={answeredCardStyle}>
              <div style={{ fontWeight: 600, color: '#333' }}>
                {q.question_text}
              </div>
              {cluster?.answer ? (
                <div style={answerBlockStyle}>{cluster.answer}</div>
              ) : (
                <div style={{ marginTop: 8, color: '#888', fontSize: 13 }}>
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
