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
    </nav>
  )
}
