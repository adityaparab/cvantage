import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { resumeTitle } from '../lib/resume';
import type { Resume } from '../components/ResumeEditor';
import LoadingProgress from '../components/LoadingProgress';
export default function ResumeLibrary() {
  const [resumes, setResumes] = useState<Resume[] | null>(null);
  const [pending, setPending] = useState<Resume | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setResumes(await api<Resume[]>('/resumes'));
      setError('');
    } catch {
      setError('Could not load resumes. Refresh the list to try again.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function remove() {
    if (!pending || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/resumes/${pending._id}`, {
        method: 'DELETE',
        body: JSON.stringify({ revision: pending.revision }),
      });
      setResumes(
        (old) => old?.filter((item) => item._id !== pending._id) ?? [],
      );
      setPending(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not delete resume',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <p className="eyebrow">RESUME LIBRARY</p>
      <div className="page-heading">
        <div>
          <h1>Your resumes</h1>
          <p className="muted">
            Upload, review and manage your source resumes.
          </p>
        </div>
        <Link className="action-link" to="/resumes/upload">
          Upload resume
        </Link>
      </div>
      <button type="button" className="text-button" onClick={() => void load()}>
        Refresh list
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {pending && (
        <section
          className="panel deletion-confirmation"
          role="alertdialog"
          aria-labelledby="delete-resume-title"
        >
          <h2 id="delete-resume-title">Delete this resume?</h2>
          <p>{resumeTitle(pending)}</p>
          <p>
            This also deletes its contact details, tailored versions and
            workflow history.
          </p>
          <div className="inline-actions">
            <button disabled={busy} onClick={() => void remove()}>
              Confirm delete resume
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Keep resume
            </button>
          </div>
        </section>
      )}
      {resumes ? (
        resumes.length ? (
          <ul className="resume-library">
            {resumes.map((resume) => (
              <li className="panel" key={resume._id}>
                <h2>{resumeTitle(resume)}</h2>
                <p className="muted">
                  Updated {new Date(resume.updatedAt).toLocaleString()}
                </p>
                <div className="inline-actions">
                  <Link className="action-link" to={`/resumes/${resume._id}`}>
                    Open and edit
                  </Link>
                  <button
                    className="secondary"
                    onClick={() => setPending(resume)}
                  >
                    Delete resume
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="panel">
            No resumes yet. Upload a resume to get started.
          </p>
        )
      ) : (
        <LoadingProgress message="Loading resumes…" />
      )}
    </section>
  );
}
