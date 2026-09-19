import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Variant } from '../lib/tailoring';
import { ResumeFields } from '../components/ResumeFields';
import ExportControls from '../components/ExportControls';
import { useTailoringVersion } from '../lib/tailoringContext';
export default function TailoringResult() {
  const { variant, schema, base, setVariant } = useTailoringVersion();
  const [data, setData] = useState(variant.data);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(data) !== JSON.stringify(variant.data);
  // New variants must pass through explicit suggestion selection first.
  if (
    variant.appliedSuggestionIds === undefined &&
    variant.status !== 'reviewed'
  )
    return <Navigate replace to={`${base}/suggestions`} />;
  async function save(approve: boolean) {
    if (busy || editing) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const result = await api<Variant>(
        `/resumes/${variant.resumeId}/variants/${variant._id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ revision: variant.revision, data, approve }),
        },
      );
      setVariant({ ...variant, ...result });
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not save this version',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">UPDATED RESUME</p>
      <h1>Review your tailored version</h1>
      <p className="muted">
        Your selected changes are applied below. Use a field’s pencil for final
        wording edits, then approve this version for download.
      </p>
      <Link to={`${base}/suggestions`}>Revisit suggestions</Link>
      {variant.judge?.issues.map((issue, index) => (
        <p key={index} className="error">
          {issue.message} — {issue.suggestedFix}
        </p>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(true);
        }}
      >
        <ResumeFields
          schema={schema}
          value={data}
          onChange={(value) => {
            setData(value);
            setConfirmed(false);
            setSaved(false);
          }}
          label="Tailored resume"
          allowDelete={false}
          onEditingChange={setEditing}
          disabled={busy}
        />
        <label className="confirmation">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            required
            disabled={busy || editing}
          />
          I checked these changes against my experience and approve this
          version.
        </label>
        <div className="inline-actions">
          <button
            type="button"
            className="secondary"
            disabled={busy || editing}
            onClick={() => void save(false)}
          >
            Save draft
          </button>
          <button disabled={busy || editing}>Approve tailored version</button>
        </div>
      </form>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {saved && variant.status !== 'reviewed' && (
        <p role="status">Draft saved.</p>
      )}
      {variant.status === 'reviewed' && (
        <>
          <p role="status">This saved version is approved.</p>
          <ExportControls
            resumeId={variant.resumeId}
            variantId={variant._id}
            disabled={busy || editing || dirty}
          />
        </>
      )}
    </>
  );
}
