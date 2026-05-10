import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Student from './pages/Student.jsx'
import TA from './pages/TA.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<Student />} />
          <Route path="/student" element={<Student />} />
          <Route path="/ta" element={<TA />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
