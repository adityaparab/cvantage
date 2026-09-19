import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Variant } from '../lib/tailoring';
import { useTailoringVersion } from '../lib/tailoringContext';
export default function TailoringSuggestions() {
  const { variant, base, setVariant } = useTailoringVersion();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(
    () =>
      variant.appliedSuggestionIds ??
      variant.suggestions.map((item) => item.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function apply() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const saved = await api<Variant>(
        `/resumes/${variant.resumeId}/variants/${variant._id}/apply`,
        {
          method: 'POST',
          body: JSON.stringify({
            revision: variant.revision,
            suggestionIds: selected,
          }),
        },
      );
      setVariant({ ...variant, ...saved });
      navigate(`${base}/resume`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not apply suggestions',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">REVIEW SUGGESTIONS</p>
      <h1>Choose your changes</h1>
      <p className="muted">
        Select the wording changes you want to keep. Unselected fields retain
        their original text, and your source resume stays unchanged.
      </p>
      {variant.analyses && (
        <details className="panel analysis-summary">
          <summary>Resume and job analysis</summary>
          {(['resume', 'job'] as const).map((kind) => (
            <section key={kind}>
              <h2>
                {kind === 'resume' ? 'Resume strengths' : 'Job priorities'}
              </h2>
              <p>{variant.analyses![kind].summary}</p>
              <ul>
                {variant.analyses![kind].findings.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
        </details>
      )}
      {variant.judge?.issues.map((issue, index) => (
        <p key={index} className="error">
          {issue.message} — {issue.suggestedFix}
        </p>
      ))}
      <p>
        Check suggestions against your experience. Correct factual details in
        your source resume before tailoring again.
      </p>
      {variant.suggestions.length ? (
        <>
          <div className="inline-actions">
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() =>
                setSelected(variant.suggestions.map((item) => item.id))
              }
            >
              Select all
            </button>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => setSelected([])}
            >
              Clear selection
            </button>
          </div>
          <div className="suggestions-list">
            {variant.suggestions.map((change) => (
              <article className="panel suggestion" key={change.id}>
                <label className="confirmation">
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={selected.includes(change.id)}
                    onChange={(event) =>
                      setSelected((old) =>
                        event.target.checked
                          ? [...old, change.id]
                          : old.filter((id) => id !== change.id),
                      )
                    }
                  />
                  {change.label}
                </label>
                <div className="suggestion-comparison">
                  <div>
                    <h3>Original</h3>
                    <p>{change.before}</p>
                  </div>
                  <div>
                    <h3>Suggested</h3>
                    <p>{change.after}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="panel">
          No wording changes were suggested. Continue to review a copy of your
          source resume.
        </p>
      )}
      {variant.appliedSuggestionIds && (
        <p className="hint">
          Applying again rebuilds this version from the original source and your
          selection, replacing any later manual edits. It will require approval
          again.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="selection-summary">
        <p aria-live="polite">
          {selected.length} of {variant.suggestions.length} suggestions selected
        </p>
        <button disabled={busy} onClick={() => void apply()}>
          {busy
            ? 'Applying suggestions…'
            : selected.length
              ? 'Apply selected suggestions'
              : 'Continue without changes'}
        </button>
      </div>
    </>
  );
}
