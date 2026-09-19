import { useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useRedactionReview } from '../lib/useRedactionReview';
import type { PreparedUpload } from '../lib/useRedactionReview';
import LoadingProgress from './LoadingProgress';
const markers = [
  ['PII_NAME', 'name'],
  ['PII_EMAIL', 'email'],
  ['PII_PHONE', 'phone number'],
  ['PII_LOCATION', 'location or address'],
];
export default function PrivacyReview({
  id,
  initial,
}: {
  id: string;
  initial?: PreparedUpload;
}) {
  const { job, error: loadError, retry } = useRedactionReview(id, initial);
  const [source, setSource] = useState(job?.source ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [selection, setSelection] = useState([0, 0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  useLayoutEffect(() => {
    if (!job) return;
    if (job.piiConfirmed) {
      navigate(`/resumes/activity/${id}`, { replace: true });
      return;
    }
    setSource(job.source);
    setConfirmed(false);
    setSelection([0, 0]);
  }, [job, id, navigate]);
  function edit(value: string) {
    setSource(value);
    setConfirmed(false);
  }
  function redact(marker: string) {
    const [start, end] = selection;
    if (start === end) return;
    edit(source.slice(0, start) + marker + source.slice(end));
    setSelection([0, 0]);
    textarea.current?.focus();
  }
  async function prepare() {
    if (!job || !confirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/parsing-jobs/${id}/prepare`, {
        method: 'POST',
        body: JSON.stringify({
          source,
          revision: job.revision,
          confirmed: true,
        }),
      });
      navigate(`/resumes/activity/${id}`, { replace: true });
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not confirm review',
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    setError('');
    try {
      await api(`/parsing-jobs/${id}/cancel`, { method: 'POST', body: '{}' });
      navigate('/resumes');
    } catch {
      setError('Could not delete this upload. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="upload-review-page">
      <Link className="text-button" to="/resumes">
        ← Back to resumes
      </Link>
      <p className="eyebrow">UPLOAD · YOUR REVIEW REQUIRED</p>
      <h1>Review your redacted resume</h1>
      <p className="muted">
        Edit the text below before continuing. No resume text is sent to AI
        until you approve this review.
      </p>
      <section className="panel" aria-busy={!job && !loadError}>
        <h2>Check for personal details</h2>
        <p>
          We replace your supplied name, location and contact details, plus
          detected emails and phone numbers. Edit any identifying details we
          missed. Contact details stay separate for export.
        </p>
        {job ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void prepare();
            }}
          >
            <p id="redaction-help" className="hint">
              Select text to redact, or edit directly. Markers like [EMAIL
              REMOVED] normalize locally before AI processing; unknown markers
              stay unchanged.
            </p>
            <div
              className="redaction-tools"
              role="group"
              aria-label="Replace selected text with a redaction marker"
            >
              {markers.map(([marker, label]) => (
                <button
                  key={marker}
                  type="button"
                  className="secondary"
                  disabled={busy || selection[0] === selection[1]}
                  aria-label={`Redact ${label}`}
                  onClick={() => redact(marker)}
                >
                  <code>{marker}</code>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <label>
              Redacted resume text
              <textarea
                ref={textarea}
                rows={16}
                value={source}
                disabled={busy}
                aria-describedby="redaction-help"
                onChange={(event) => edit(event.target.value)}
                onSelect={(event) =>
                  setSelection([
                    event.currentTarget.selectionStart,
                    event.currentTarget.selectionEnd,
                  ])
                }
                required
              />
            </label>
            <label className="confirmation">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(event) => setConfirmed(event.target.checked)}
                required
              />
              I checked the text and removed identifying details.
            </label>
            <button disabled={busy || !confirmed}>
              {busy ? 'Saving…' : 'Approve redaction and start parsing'}
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => void cancel()}
            >
              Cancel and delete this upload
            </button>
          </form>
        ) : loadError ? (
          <div>
            <p role="alert" className="error">
              {loadError}
            </p>
            <button type="button" className="secondary" onClick={retry}>
              Retry loading text
            </button>
          </div>
        ) : (
          <LoadingProgress message="Preparing your redacted text… It will appear here automatically." />
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
