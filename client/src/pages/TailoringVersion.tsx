import { useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import type { FieldSchema } from '../lib/schema';
import type { Variant } from '../lib/tailoring';
import { analysisPath, variantPath } from '../lib/tailoring';
import { api } from '../lib/api';
import TailoringStages from '../components/TailoringStages';
import LoadingProgress from '../components/LoadingProgress';
import type { TailoringContext } from '../lib/tailoringContext';
export default function TailoringVersion() {
  const { resumeId = '', variantId = '' } = useParams();
  const [variant, setVariant] = useState<Variant | null>(null);
  const [schema, setSchema] = useState<FieldSchema | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setVariant(null);
    setSchema(null);
    setError('');
    void (async () => {
      try {
        const item = await api<Variant>(
          `/resumes/${resumeId}/variants/${variantId}`,
        );
        const definition = await api<{ definition: FieldSchema }>(
          `/resume-schemas/${item.schemaVersion}`,
        );
        if (active) {
          setVariant(item);
          setSchema(definition.definition);
        }
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load this version.',
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [resumeId, variantId, retry]);
  const base = variantPath(resumeId, variantId);
  return (
    <section className="tailoring-page">
      <TailoringStages
        analysis={
          variant?.workflowId ? analysisPath(variant.workflowId) : undefined
        }
        version={base}
      />
      <Link className="text-button" to={`/tailoring?resume=${resumeId}`}>
        ← Back to tailoring
      </Link>
      {error ? (
        <>
          <p role="alert" className="error">
            {error}
          </p>
          <button onClick={() => setRetry((value) => value + 1)}>
            Retry loading version
          </button>
        </>
      ) : variant && schema ? (
        <>
          {variant.stale && (
            <p className="error">
              This version uses an older source resume. Start a new tailoring
              workflow to include your latest changes.
            </p>
          )}
          <Outlet
            context={
              { variant, schema, base, setVariant } satisfies TailoringContext
            }
          />
        </>
      ) : (
        <LoadingProgress message="Loading tailored version…" />
      )}
    </section>
  );
}
