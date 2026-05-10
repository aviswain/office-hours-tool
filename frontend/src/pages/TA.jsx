function TA() {
  const containerStyle = {
    maxWidth: 800,
    margin: '0 auto',
    textAlign: 'left',
  }

  const cardStyle = {
    border: '1px solid #e5e4e7',
    borderRadius: 6,
    padding: '16px 20px',
    marginBottom: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff',
  }

  const resolveButtonStyle = {
    padding: '8px 16px',
    background: '#bdbdbd',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
  }

  const sectionHeadingStyle = {
    fontSize: 20,
    fontWeight: 600,
    margin: '24px 0 12px',
    color: '#333',
  }

  const clusters = [
    { id: 1, title: 'Memory allocation in Part 3', count: 5 },
    { id: 2, title: 'Segfault on line 42', count: 3 },
  ]

  return (
    <div style={containerStyle}>
      <h1 style={{ marginTop: 0 }}>TA Dashboard</h1>

      <h2 style={sectionHeadingStyle}>Active Clusters</h2>
      {clusters.map((c) => (
        <div key={c.id} style={cardStyle}>
          <span>{c.title} — {c.count} students</span>
          <button style={resolveButtonStyle}>Resolve</button>
        </div>
      ))}

      <h2 style={sectionHeadingStyle}>Answered Questions</h2>
      <p style={{ color: '#888' }}>No questions resolved yet.</p>
    </div>
  )
}

export default TA
