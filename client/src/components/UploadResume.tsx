import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../lib/api';
interface Job {
  _id: string;
  status: string;
}
export default function UploadResume({
  onUploaded,
}: {
  onUploaded: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    let active = true;
    api<Job[]>('/parsing-jobs')
      .then((value) => {
        if (active) setJobs(value);
      })
      .catch(() => {
        if (active) setError('Could not load in-progress uploads.');
      });
    return () => {
      active = false;
    };
  }, []);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > 20_000_000) {
      setError('Choose a PDF, DOCX, or DOC file up to 20 MB.');
      setBusy(false);
      return;
    }
    const payload = new FormData();
    payload.set('file', file);
    payload.set(
      'pii',
      JSON.stringify({
        name: form.get('name') || '',
        contactNumber: form.get('contactNumber') || '',
        email: form.get('email') || '',
        location: form.get('location') || '',
      }),
    );
    try {
      const result = await api<{
        jobId: string;
        resumeId: string;
        source: string;
        revision: number;
        status: string;
      }>('/resumes/upload', { method: 'POST', body: payload });
      onUploaded(result.jobId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel upload-panel">
      <h2>Bring your experience</h2>
      <p className="muted">
        Add your contact details as written on your resume so we can keep them
        separate while preparing your application.
      </p>
      <form onSubmit={(event) => void upload(event)}>
        <div className="field-grid">
          <label>
            Full name
            <input name="name" maxLength={200} required />
          </label>
          <label>
            Location
            <input
              name="location"
              maxLength={200}
              placeholder="As written on your resume"
            />
          </label>
          <label>
            Contact email
            <input name="email" type="email" />
          </label>
          <label>
            Contact number
            <input name="contactNumber" maxLength={80} />
          </label>
        </div>
        <label>
          Resume file
          <input name="file" type="file" accept=".pdf,.docx,.doc" required />
        </label>
        <p className="hint">
          PDF, DOCX, or DOC · up to 20 MB. The original file is discarded after
          extraction.
        </p>
        <button disabled={busy}>
          {busy ? 'Reading your resume…' : 'Upload resume'}
        </button>
      </form>

      {jobs.length > 0 && (
        <>
          <h3>In progress</h3>
          {jobs.map((item) => (
            <button
              className="text-button"
              key={item._id}
              onClick={() => onUploaded(item._id)}
            >
              Resume upload · {item.status.replaceAll('_', ' ')}
            </button>
          ))}
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
