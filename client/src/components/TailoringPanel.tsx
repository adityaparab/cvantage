import { useNavigate, useSearchParams } from 'react-router-dom';
import ExportControls from './ExportControls';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ResumeFields } from './ResumeFields';
import type { FieldSchema } from '../lib/schema';
import type { Resume } from './ResumeEditor';
interface Variant {
  _id: string;
  revision: number;
  data: unknown;
  sourceData: unknown;
  sourceRevision: number;
  status: string;
  stale?: boolean;
  judge?: {
    confidence: number;
    issues: { message: string; suggestedFix: string }[];
  };
}
function changes(
  before: unknown,
  after: unknown,
  path = '',
): { path: string; before: string; after: string }[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (after && typeof after === 'object')
    return Object.entries(after).flatMap(([key, value]) =>
      changes(
        before && typeof before === 'object'
          ? (before as Record<string, unknown>)[key]
          : undefined,
        value,
        path ? `${path} / ${key}` : key,
      ),
    );
  return [{ path, before: String(before ?? ''), after: String(after ?? '') }];
}
export default function TailoringPanel({
  resume,
  schema,
  unsaved,
}: {
  resume: Resume;
  schema: FieldSchema;
  unsaved: boolean;
}) {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const selectedId = search.get('variant');
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variant, setVariant] = useState<Variant | null>(null);
  const [data, setData] = useState<unknown>({});
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api<Variant[]>(`/resumes/${resume._id}/variants`)
      .then((value) => {
        setVariants(value);
        const selected = value.find((item) => item._id === selectedId);
        if (selected) {
          setVariant(selected);
          setData(selected.data);
        }
      })
      .catch(() => setError('Could not load tailored versions.'));
  }, [resume._id, resume.revision, selectedId]);
  async function create() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ workflowId: string }>(
        `/resumes/${resume._id}/tailor`,
        {
          method: 'POST',
          body: JSON.stringify({
            revision: resume.revision,
            jobDescription: description,
            piiConfirmed: true,
          }),
        },
      );
      navigate(`/activity/${result.workflowId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Tailoring failed');
    } finally {
      setBusy(false);
    }
  }
  async function save(approve: boolean) {
    if (!variant) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<Variant>(
        `/resumes/${resume._id}/variants/${variant._id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ revision: variant.revision, data, approve }),
        },
      );
      setVariant(result);
      setVariants((old) =>
        old.map((item) => (item._id === result._id ? result : item)),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tailoring">
      <h3>Make it relevant</h3>
      <p className="muted">
        Tailor the summary and experience highlights to an opportunity. Factual
        details stay tied to your saved resume.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label>
          Job description
          <textarea
            rows={7}
            minLength={20}
            maxLength={30000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>
        <label className="confirmation">
          <input type="checkbox" required />I removed names, contact
          information, and locations from this description.
        </label>
        {unsaved && <p>Save your resume changes before tailoring.</p>}
        <button disabled={busy || unsaved}>
          {busy ? 'Preparing your version…' : 'Create tailored version'}
        </button>
      </form>
      {variants.length > 0 && (
        <>
          <h4>Tailored versions</h4>
          {variants.map((item, index) => (
            <button
              key={item._id}
              type="button"
              className="text-button"
              onClick={() => {
                setVariant(item);
                setData(item.data);
                setError('');
              }}
            >
              Version {variants.length - index} ·{' '}
              {item.status.replaceAll('_', ' ')}
              {item.sourceRevision !== resume.revision ? ' · older source' : ''}
            </button>
          ))}
        </>
      )}
      {variant && (
        <>
          <h4>Review your tailored version</h4>
          {variant.sourceRevision !== resume.revision && (
            <p className="error">
              This version uses an older source resume. Create a new version to
              include your latest changes.
            </p>
          )}
          <p>
            Check every change for factual accuracy. Model confidence is an
            assessment, not proof. Correct factual details in your source resume
            before tailoring again.
          </p>
          <div className="changes">
            {changes(variant.sourceData, data).map((change) => (
              <article key={change.path}>
                <strong>{change.path}</strong>
                <p>
                  <span className="muted">Original: </span>
                  {change.before}
                </p>
                <p>
                  <span className="muted">Proposed: </span>
                  {change.after}
                </p>
              </article>
            ))}
          </div>
          {variant.judge?.issues.map((issue, i) => (
            <p className="error" key={i}>
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
              onChange={setData}
              label="Tailored resume"
            />
            <label className="confirmation">
              <input type="checkbox" required />I checked these changes against
              my experience and approve this version.
            </label>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => void save(false)}
            >
              Save draft
            </button>
            <button disabled={busy}>Approve tailored version</button>
          </form>
          {variant.status === 'reviewed' && (
            <>
              <p role="status">This saved version is approved.</p>
              <ExportControls
                resumeId={resume._id}
                variantId={variant._id}
                disabled={JSON.stringify(data) !== JSON.stringify(variant.data)}
              />
            </>
          )}
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
