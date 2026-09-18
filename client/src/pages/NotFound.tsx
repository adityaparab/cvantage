import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
export default function NotFound() {
  return (
    <main className="app-shell">
      <Nav />
      <h1>Page not found</h1>
      <p>This address does not lead to a CVantage page.</p>
      <Link to="/">Return to your workspace</Link>
    </main>
  )
}
