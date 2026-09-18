import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import WorkflowActivity from './components/WorkflowActivity';
import WorkflowNotifications from './components/WorkflowNotifications';
import ResumeEditor from './components/ResumeEditor';
import UploadResume from './components/UploadResume';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError, setCsrfToken } from './lib/api';
import './App.css';
import ThemeSelect from './components/ThemeSelect';
interface User {
  id: string;
  email: string;
  csrfToken: string;
}
interface Resume {
  _id: string;
  schemaVersion: number;
  updatedAt: string;
}
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { workflowId, resumeId: selected } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const refreshResumes = useCallback(() => {
    api<Resume[]>('/resumes')
      .then(setResumes)
      .catch(() => setError('Could not refresh resumes.'));
  }, []);
  const [resumes, setResumes] = useState<Resume[]>([]);
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
  useEffect(() => {
    if (!user) return;
    let active = true;
    api<Resume[]>('/resumes')
      .then((value) => {
        if (active) setResumes(value);
      })
      .catch(() => {
        if (active) setError('Could not load resumes. Refresh to retry.');
      });
    return () => {
      active = false;
    };
  }, [user, location.pathname]);
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
      setResumes([]);
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
      <main>
        {!ready ? (
          <p role="status">Loading your workspace…</p>
        ) : user ? (
          workflowId ? (
            <WorkflowActivity
              key={workflowId}
              id={workflowId}
              onComplete={refreshResumes}
            />
          ) : (
            <>
              <p className="eyebrow">YOUR WORKSPACE</p>
              <h1>Your next chapter starts here.</h1>
              <p className="muted">Signed in as {user.email}</p>
              {selected ? (
                <ResumeEditor
                  key={selected}
                  id={selected}
                  onClose={() => {
                    navigate('/');
                    refreshResumes();
                  }}
                />
              ) : (
                <UploadResume
                  onUploaded={(id) => navigate(`/activity/${id}`)}
                />
              )}
              <section className="panel">
                <h2>Your resumes</h2>
                {resumes.length ? (
                  <ul>
                    {resumes.map((resume) => (
                      <li key={resume._id}>
                        <button
                          className="text-button"
                          onClick={() => navigate(`/resumes/${resume._id}`)}
                        >
                          Resume ·{' '}
                          {new Date(resume.updatedAt).toLocaleDateString()} ·
                          Open and edit
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">
                    No resumes yet. Your saved resumes will appear here.
                  </p>
                )}
              </section>
            </>
          )
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
