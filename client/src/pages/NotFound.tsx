import { Link } from 'react-router-dom'
import Nav from '../components/Nav'

export default function NotFound() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '0 auto',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <Nav />
      <h1>404 — Page not found</h1>
      <p>
        The server returned <code>index.html</code> for this unknown path and the
        client-side router rendered this 404 page. API routes under{' '}
        <code>/api</code> return a real JSON 404 instead.
      </p>
      <Link to="/">Go home</Link>
    </main>
  )
}
