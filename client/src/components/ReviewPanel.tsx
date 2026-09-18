import { emptyValue } from '../lib/schema';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { ResumeFields } from './ResumeFields';
import type { FieldSchema } from '../lib/schema';
interface Review {
  job: {
    _id: string;
    resumeId: string;
    stage: 'schema' | 'mapping';
    status: string;
    revision: number;
    candidate?: unknown;
    failureCode?: string;
    judge?: {
      confidence: number;
      issues: { message: string; suggestedFix: string }[];
    };
  };
  schema?: FieldSchema;
}
export default function ReviewPanel({
  id,
  onComplete,
  onClose,
}: {
  id: string;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [candidate, setCandidate] = useState<unknown>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const value = await api<Review>(`/parsing-jobs/${id}/review`);
        if (!active) return;
        setReview(value);
        if (['review_required', 'failed'].includes(value.job.status)) {
          setCandidate(
            value.schema
              ? (value.job.candidate ?? emptyValue(value.schema))
              : {},
          );
        } else {
          timer = setTimeout(() => void load(), 2000);
        }
      } catch (reason) {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 404) {
          onComplete();
          onClose();
        } else setError('Could not load review. Close and reopen to retry.');
      }
    }
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, onComplete, onClose]);
  async function approve() {
    if (!review) return;
    setBusy(true);
    setError('');
    try {
      await api(`/parsing-jobs/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          revision: review.job.revision,
          stage: review.job.stage,
          candidate,
          approve: true,
        }),
      });
      onComplete();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Approval failed');
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    try {
      await api(`/parsing-jobs/${id}/cancel`, { method: 'POST', body: '{}' });
      onComplete();
      onClose();
    } catch {
      setError('Could not cancel this upload.');
    }
  }
  const needsReview =
    review &&
    review.job.stage === 'mapping' &&
    review.schema &&
    ['review_required', 'failed'].includes(review.job.status);
  return (
    <section>
      <button className="text-button" onClick={onClose}>
        ← Back to uploads
      </button>
      {review ? (
        <>
          <h3>
            {needsReview
              ? 'Review your parsed resume'
              : review.job.status === 'failed'
                ? 'Resume processing could not finish'
                : 'Preparing your resume…'}
          </h3>
          <p role="status">
            {review.job.stage === 'schema'
              ? 'Preparing your document'
              : 'Mapping your experience'}{' '}
            · {review.job.status.replaceAll('_', ' ')}
          </p>
          {review.job.stage === 'schema' &&
            ['failed', 'review_required'].includes(review.job.status) && (
              <p className="error">
                We could not prepare this document. Delete this draft and upload
                a clearer copy to try again.
              </p>
            )}
          {needsReview && (
            <>
              <p className="muted">
                Check the fields below before approving. Approval does not
                restart exhausted AI attempts.
              </p>
              {review.job.judge && (
                <p>
                  Model confidence:{' '}
                  {Math.round(review.job.judge.confidence * 100)}%
                </p>
              )}
              {review.job.judge?.issues.map((issue, i) => (
                <p key={i} className="error">
                  {issue.message} — {issue.suggestedFix}
                </p>
              ))}
              {review.job.failureCode === 'MODEL_OR_PROCESSING_FAILED' && (
                <p className="error">
                  AI processing could not finish. You can complete these fields
                  yourself.
                </p>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void approve();
                }}
              >
                <ResumeFields
                  schema={review.schema!}
                  value={candidate}
                  onChange={setCandidate}
                />
                <label className="confirmation">
                  <input type="checkbox" required />I reviewed these fields for
                  accuracy and removed identifying details.
                </label>
                <button disabled={busy}>
                  {busy ? 'Saving…' : 'Approve parsed resume'}
                </button>
              </form>
            </>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => void cancel()}
          >
            {needsReview
              ? 'Reject parsed resume'
              : 'Cancel and delete this upload draft'}
          </button>
        </>
      ) : (
        <p role="status">Loading review…</p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
