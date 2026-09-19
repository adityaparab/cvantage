import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import WorkflowNotifications from './components/WorkflowNotifications';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError, setCsrfToken } from './lib/api';
import './App.css';
import ThemeSelect from './components/ThemeSelect';
interface User {
  id: string;
  email: string;
  csrfToken: string;
}
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);
  useEffect(() => {
    let active = true;
    api<User>('/auth/me')
      .then((value) => {
        if (active) {
          setUser(value);
          setCsrfToken(value.csrfToken);
        }
      })
      .catch((reason: unknown) => {
        if (active && (!(reason instanceof ApiError) || reason.status !== 401))
          setError('Could not reach the server. Refresh to retry.');
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const value = await api<User>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({
          email: data.get('email'),
          password: data.get('password'),
        }),
      });
      setCsrfToken(value.csrfToken);
      setUser(value);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api('/auth/logout', { method: 'POST', body: '{}' });
      setUser(null);
      navigate('/');
      setCsrfToken('');
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <header>
        <Link to="/" className="brand">
          CVantage<span>Make your experience count.</span>
        </Link>
        {user && (
          <nav className="primary-navigation" aria-label="Primary navigation">
            <NavLink to="/resumes">Resumes</NavLink>
            <NavLink to="/tailoring">Tailoring</NavLink>
          </nav>
        )}
        <div className="header-actions">
          <ThemeSelect />
          {user && <WorkflowNotifications />}
          {user && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void logout()}
            >
              Sign out
            </button>
          )}
        </div>
      </header>
      <main ref={main} tabIndex={-1}>
        {!ready ? (
          <p role="status">Loading your workspace…</p>
        ) : user ? (
          <Outlet />
        ) : (
          <section className="auth-layout">
            <div>
              <p className="eyebrow">A CLEARER WAY FORWARD</p>
              <h1>
                Your experience.
                <br />
                The right words.
              </h1>
              <p className="intro">
                Build a resume that reflects your experience and speaks to your
                next opportunity.
              </p>
            </div>
            <form
              className="panel"
              onSubmit={(event) => void authenticate(event)}
            >
              <h2>
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  minLength={12}
                  maxLength={128}
                  required
                />
              </label>
              <p className="hint">Use at least 12 characters.</p>
              <button disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create account'}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
              >
                {mode === 'login'
                  ? 'New here? Create an account'
                  : 'Already registered? Sign in'}
              </button>
            </form>
          </section>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </main>
      <footer>CVantage · Thoughtful applications begin with you.</footer>
    </div>
  );
}
