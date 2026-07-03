import Nav from '../components/Nav'
import ApiStatus from '../components/ApiStatus'

export default function About() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
      <Nav />
      <h1>About</h1>
      <p>
        This page lives entirely in the React SPA. Reload this URL directly
        (<code>/about</code>) — NestJS has no <code>/about</code> route, so it
        returns <code>index.html</code> and React Router renders this page. That
        is the single-page-app deep-link fallback working end to end.
      </p>
      <ApiStatus />
    </main>
  )
}
