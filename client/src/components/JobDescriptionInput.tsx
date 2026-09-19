import { useState } from 'react';
import { api } from '../lib/api';
export default function JobDescriptionInput({
  resumeId,
  description,
  onChange,
  disabled,
  onImportingChange,
}: {
  resumeId: string;
  description: string;
  onChange: (value: string) => void;
  disabled: boolean;
  onImportingChange: (busy: boolean) => void;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [imported, setImported] = useState(false);
  function change(value: string) {
    setConfirmed(false);
    onChange(value);
  }
  async function importPage() {
    setLoading(true);
    onImportingChange(true);
    setError('');
    setImported(false);
    setConfirmed(false);
    try {
      const result = await api<{ text: string }>(
        `/resumes/${resumeId}/job-description`,
        { method: 'POST', body: JSON.stringify({ url }) },
      );
      change(result.text);
      setImported(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Import failed. Paste the job description instead.',
      );
    } finally {
      setLoading(false);
      onImportingChange(false);
    }
  }
  return (
    <fieldset disabled={disabled || loading} className="job-input">
      <legend>Job details</legend>
      <label>
        Job URL (optional)
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://company.example/jobs/role"
        />
      </label>
      <button
        type="button"
        className="secondary"
        disabled={!url.trim()}
        onClick={() => void importPage()}
      >
        Import job description
      </button>
      {loading && <p role="status">Importing job description…</p>}
      {imported && (
        <p role="status">
          Job text imported. Review and edit it below before analysis.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p className="hint">
        Paste a description, or import a public HTTPS page. Pages requiring
        sign-in or JavaScript may need to be pasted.
      </p>
      <label>
        Job description
        <textarea
          rows={9}
          minLength={20}
          maxLength={30000}
          required
          value={description}
          onChange={(event) => change(event.target.value)}
        />
      </label>
      <label className="confirmation">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          required
        />
        I removed names, contact information, and locations from this
        description.
      </label>
    </fieldset>
  );
}
