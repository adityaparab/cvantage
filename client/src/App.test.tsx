import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import App from './App'
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
it('signs in and loads the private resume workspace', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response({ message: 'Sign in' }, 401))
    .mockResolvedValueOnce(
      response({ id: 'owner', email: 'test@example.test', csrfToken: 'token' }),
    )
    .mockResolvedValueOnce(response([]))
    .mockResolvedValueOnce(response([]))
  vi.stubGlobal('fetch', fetcher)
  render(<App />)
  fireEvent.change(await screen.findByLabelText('Email'), {
    target: { value: 'test@example.test' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'synthetic-password-123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByText('Your resumes')).toBeTruthy()
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4))
  expect(fetcher.mock.calls[1][0]).toBe('/api/auth/login')
  expect(fetcher.mock.calls[2][1].headers['X-CSRF-Token']).toBe('token')
})
it('shows server errors without entering the workspace', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(response({}, 401))
      .mockResolvedValueOnce(
        response({ message: 'Invalid email or password' }, 401),
      ),
  )
  render(<App />)
  fireEvent.change(await screen.findByLabelText('Email'), {
    target: { value: 'test@example.test' },
  })
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'synthetic-password-123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Invalid email or password',
  )
  expect(screen.queryByText('Your resumes')).toBeNull()
})
