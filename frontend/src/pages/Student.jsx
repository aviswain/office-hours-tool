import { useState } from 'react'

const sessionId = 'demo-session-1'

function Student() {
  const [question, setQuestion] = useState('')
  const [name, setName] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log({ sessionId, name, question })
    alert('Question submitted!')
  }

  const containerStyle = {
    maxWidth: 600,
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
    background: '#aa3bff',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
  }

  return (
    <div style={containerStyle}>
      <h1 style={{ marginTop: 0 }}>Submit Your Question</h1>
      <form onSubmit={handleSubmit}>
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="question">Question</label>
          <textarea
            id="question"
            placeholder="Type your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={6}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle} htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button type="submit" style={buttonStyle}>Submit</button>
      </form>
    </div>
  )
}

export default Student
