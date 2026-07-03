import { Link } from 'react-router-dom'

export default function Nav() {
  return (
    <nav
      style={{
        display: 'flex',
        gap: '1rem',
        padding: '1rem',
        justifyContent: 'center',
      }}
    >
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
      {/* Intentionally unknown route to demonstrate the SPA 404 fallback. */}
      <Link to="/this/route/does-not-exist">Broken link (404)</Link>
    </nav>
  )
}
