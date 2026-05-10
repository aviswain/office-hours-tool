import { NavLink, Outlet } from 'react-router-dom'
import './App.css'

function App() {
  const navStyle = {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    padding: '12px 24px',
    borderBottom: '1px solid #e5e4e7',
    background: '#fafafa',
  }

  const linkStyle = ({ isActive }) => ({
    textDecoration: 'none',
    color: isActive ? '#aa3bff' : '#333',
    fontWeight: isActive ? 600 : 500,
  })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav style={navStyle}>
        <span style={{ fontWeight: 700, marginRight: 12 }}>Office Hours</span>
        <NavLink to="/student" style={linkStyle}>Student</NavLink>
        <NavLink to="/ta" style={linkStyle}>TA</NavLink>
      </nav>
      <main style={{ padding: '24px', flex: 1 }}>
        <Outlet />
      </main>
    </div>
  )
}

export default App
