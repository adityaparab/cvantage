import { useEffect, useState } from 'react';
import { api } from '../lib/api';
interface PreparedJob {
  source: string;
  revision: number;
}
export default function PrivacyReview({
  id,
  onPrepared,
}: {
  id: string;
  onPrepared: () => void;
}) {
  const [job, setJob] = useState<PreparedJob | null>(null);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<PreparedJob>(`/parsing-jobs/${id}`)
      .then((value) => {
        if (active) {
          setJob(value);
          setSource(value.source);
        }
      })
      .catch(() => {
        if (active) setError('Could not load redacted text. Refresh to retry.');
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function prepare() {
    if (!job) return;
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
      onPrepared();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Could not confirm review',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Review before AI processing</h2>
      <p className="muted">
        Check that your name, phone, email, and location are removed everywhere.
        Edit anything we missed. Your contact details are stored separately for
        your final download.
      </p>
      {job ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void prepare();
          }}
        >
          <label>
            Redacted resume text
            <textarea
              rows={12}
              value={source}
              onChange={(event) => setSource(event.target.value)}
              required
            />
          </label>
          <label className="confirmation">
            <input type="checkbox" required />I checked the text and removed
            identifying details.
          </label>
          <button disabled={busy}>
            {busy ? 'Saving…' : 'Confirm redacted text'}
          </button>
        </form>
      ) : (
        !error && <p role="status">Loading text…</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
