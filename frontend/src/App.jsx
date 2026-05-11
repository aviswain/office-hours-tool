import { NavLink, Outlet, useLocation } from 'react-router-dom'
import './App.css'

function BrandMark() {
  return (
    <span className="oh-brand__mark" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H12.6l-4.2 3.36A.75.75 0 0 1 7.2 19.78v-2.79A2.5 2.5 0 0 1 5 14.5v-8Z"
          fill="white"
          fillOpacity="0.95"
        />
        <circle cx="9" cy="10.5" r="1.15" fill="#2563eb" />
        <circle cx="12" cy="10.5" r="1.15" fill="#2563eb" />
        <circle cx="15" cy="10.5" r="1.15" fill="#2563eb" />
      </svg>
    </span>
  )
}

function App() {
  const { pathname } = useLocation()
  const isStudent = pathname === '/' || pathname.startsWith('/student')
  const isTA = pathname.startsWith('/ta')

  return (
    <div className="oh-shell">
      <nav className="oh-nav">
        <div className="oh-nav__inner">
          <NavLink to="/student" className="oh-brand" aria-label="OfficeHours home">
            <BrandMark />
            <span className="oh-brand__name">OfficeHours</span>
            <span className="oh-brand__tag">Beta</span>
          </NavLink>
          <div className="oh-nav__spacer" />
          <div className="oh-nav__links" role="tablist" aria-label="Primary">
            <NavLink
              to="/student"
              className={`oh-nav-link${isStudent ? ' is-active' : ''}`}
              role="tab"
              aria-selected={isStudent}
            >
              Student
            </NavLink>
            <NavLink
              to="/ta"
              className={`oh-nav-link${isTA ? ' is-active' : ''}`}
              role="tab"
              aria-selected={isTA}
            >
              TA Dashboard
            </NavLink>
          </div>
        </div>
      </nav>
      <main className="oh-main">
        <Outlet />
      </main>
    </div>
  )
}

export default App
