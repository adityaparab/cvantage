import { useEffect, useState } from 'react'

// Calls the NestJS backend. In dev the request is proxied by Vite to
// http://localhost:3000/api/hello; in production it hits the same NestJS
// server that served this page. Either way the URL is the same.
export default function ApiStatus() {
  const [message, setMessage] = useState('loading…')

  useEffect(() => {
    fetch('/api/hello')
      .then((res) =>
        res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`)),
      )
      .then(setMessage)
      .catch((err: Error) => setMessage(`error: ${err.message}`))
  }, [])

  return (
    <p style={{ textAlign: 'center' }}>
      <code>GET /api/hello</code> → <strong>{message}</strong>
    </p>
  )
}
