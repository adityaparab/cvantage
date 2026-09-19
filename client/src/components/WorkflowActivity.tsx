import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { activityStatus, activityTitle } from '../lib/activity';
import type { Activity, StepRun } from '../lib/activity';
import ReviewPanel from './ReviewPanel';
const parsingSteps = [
  ['preparation_worker', 'Prepare document'],
  ['preparation_judge', 'Check document preparation'],
  ['mapping_worker', 'Extract resume content'],
  ['mapping_judge', 'Review extracted content'],
  ['approval', 'Your approval'],
];
const tailoringSteps = [
  ['tailoring_worker', 'Tailor resume wording'],
  ['tailoring_judge', 'Review tailored content'],
  ['approval', 'Your approval'],
];
type Indicator = 'inactive' | 'active' | 'success' | 'failure';
function indicator(activity: Activity, key: string, run?: StepRun): Indicator {
  if (activity.status === 'completed') return 'success';
  if (key === 'approval')
    return activity.status === 'review_required' ? 'active' : 'inactive';
  if (run) return run.status;
  if (
    activity.kind === 'parsing' &&
    key.startsWith('preparation') &&
    activity.stage === 'mapping'
  )
    return 'success';
  return 'inactive';
}
export function ActivitySteps({ activity }: { activity: Activity }) {
  return (
    <ol className="activity-steps">
      {(activity.kind === 'parsing' ? parsingSteps : tailoringSteps).map(
        ([key, label]) => {
          const runs = activity.steps.filter((step) => step.step === key);
          const latest = runs.at(-1);
          const state = indicator(activity, key, latest);
          const hidden = key.startsWith('preparation');
          const attemptLimit = key.startsWith('mapping') ? 5 : 1;
          return (
            <li className={`activity-step ${state}`} key={key}>
              <span className={`step-indicator ${state}`} aria-hidden="true">
                {state === 'success'
                  ? '✓'
                  : state === 'failure'
                    ? '!'
                    : state === 'active'
                      ? '●'
                      : '○'}
              </span>
              <div className="step-content">
                <div className="step-heading">
                  <h3>{label}</h3>
                  <span className={`step-state ${state}`}>{state}</span>
                </div>
                {latest && (
                  <p className="step-meta">
                    Attempt {latest.attempt} of {attemptLimit} · Transport
                    retries {latest.retries} of 2
                    {latest.status === 'active' ? ' · Receiving output…' : ''}
                  </p>
                )}
                {hidden && latest && (
                  <p className="hint">
                    Preparing your document in the background ·{' '}
                    {latest.received.toLocaleString()} characters received
                  </p>
                )}
                {!hidden && latest?.output && (
                  <>
                    <p className="hint">
                      {state === 'active'
                        ? 'Live model output · provisional'
                        : 'Model output · check against your resume'}
                    </p>
                    <pre
                      className="stream-output"
                      aria-label={`${label} output`}
                    >
                      {latest.output}
                    </pre>
                    {latest.output.length >= 8000 && (
                      <p className="hint">
                        Preview limited to the first 8,000 characters. Review
                        the full resume below when ready.
                      </p>
                    )}
                  </>
                )}
                {latest?.outcome === 'revision_requested' && (
                  <p className="hint">
                    Revision requested
                    {latest.attempt < attemptLimit
                      ? ' · another loop attempt will run.'
                      : ' · attempt limit reached.'}
                  </p>
                )}
                {latest?.outcome === 'interrupted' && (
                  <p className="error">This attempt was interrupted.</p>
                )}
                {runs.length > 1 && (
                  <details>
                    <summary>Previous attempts ({runs.length - 1})</summary>
                    {runs.slice(0, -1).map((run) => (
                      <p key={run.attempt}>
                        Attempt {run.attempt} · {run.status} · {run.retries}{' '}
                        transport retries
                        {run.outcome
                          ? ` · ${run.outcome.replaceAll('_', ' ')}`
                          : ''}
                      </p>
                    ))}
                  </details>
                )}
                {key === 'approval' && state === 'active' && (
                  <p className="hint">
                    Your resume is ready below. Approve it only after checking
                    the content.
                  </p>
                )}
              </div>
            </li>
          );
        },
      )}
    </ol>
  );
}
export default function WorkflowActivity({
  id,
  onComplete,
}: {
  id: string;
  onComplete: () => void;
}) {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [connection, setConnection] = useState('Connecting…');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const close = useCallback(() => {
    onComplete();
    navigate('/');
  }, [navigate, onComplete]);
  useEffect(() => {
    let active = true;
    let stream: EventSource | undefined;
    let fallback: ReturnType<typeof setInterval> | undefined;
    function apply(value: Activity) {
      if (!active) return;
      setActivity(value);
      setError('');
      if (value.status === 'completed') {
        stream?.close();
        clearInterval(fallback);
        setConnection('Completed');
      }
    }
    async function snapshot() {
      try {
        apply(await api<Activity>(`/workflows/${id}`));
      } catch (reason) {
        if (!active) return;
        if (reason instanceof ApiError && [401, 404].includes(reason.status)) {
          stream?.close();
          clearInterval(fallback);
          setActivity(null);
          setError(reason.message);
        } else setConnection('Connection interrupted. Reconnecting…');
      }
    }
    void api<Activity>(`/workflows/${id}`)
      .then((value) => {
        if (!active) return;
        apply(value);
        if (
          value.status === 'completed' ||
          (value.kind === 'parsing' && !value.piiConfirmed)
        )
          return;
        stream = new EventSource(`/api/workflows/${id}/events`);
        stream.onopen = () => {
          if (active) setConnection('Live updates connected');
        };
        stream.onmessage = (event) => {
          try {
            apply(JSON.parse(event.data) as Activity);
          } catch {
            setConnection('Reconnecting…');
          }
        };
        stream.onerror = () => {
          if (active) setConnection('Connection interrupted. Reconnecting…');
        };
        stream.addEventListener('unavailable', () => {
          setConnection('Live stream unavailable. Refreshing snapshots…');
          stream?.close();
          void snapshot();
        });
        fallback = setInterval(() => {
          if (stream?.readyState !== EventSource.OPEN) void snapshot();
        }, 2500);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load this workflow.',
          );
      });
    return () => {
      active = false;
      stream?.close();
      clearInterval(fallback);
    };
  }, [id]);
  async function cancel() {
    try {
      await api(`/parsing-jobs/${id}/cancel`, { method: 'POST', body: '{}' });
      close();
    } catch {
      setError('Could not delete this draft. Try again.');
    }
  }
  const review =
    activity?.kind === 'parsing' &&
    activity.piiConfirmed &&
    ['review_required', 'failed'].includes(activity.status);
  if (
    activity?.kind === 'parsing' &&
    !activity.piiConfirmed &&
    activity.status !== 'completed'
  )
    return <Navigate to={`/uploads/${id}/review`} replace />;
  return (
    <div className="workflow-page">
      <Link className="text-button" to="/">
        ← Back to workspace
      </Link>
      <p className="eyebrow">WORKFLOW ACTIVITY</p>
      <h1>{activity ? activityTitle(activity) : 'Workflow activity'}</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {activity ? (
        <>
          <div className="activity-summary" role="status">
            <strong>{activityStatus(activity)}</strong>
            <span>{connection}</span>
          </div>
          {activity.kind === 'parsing' &&
            activity.piiConfirmed &&
            activity.status !== 'completed' && (
              <p className="muted">
                Preparation pass {activity.preparationAttempts ?? 0}/1 ·
                Extraction loop {activity.mappingAttempts ?? 0}/5. Each model
                call can retry a temporary connection failure twice.
              </p>
            )}
          <ActivitySteps activity={activity} />
          {activity.status === 'failed' && (
            <p className="error">
              Processing could not finish. Review any available resume content
              below, or return to your workspace to try again.
            </p>
          )}
          {review && (
            <section className="panel">
              <ReviewPanel id={id} onComplete={onComplete} onClose={close} />
            </section>
          )}
          {activity.kind === 'parsing' &&
            !review &&
            activity.status !== 'completed' && (
              <button className="text-button" onClick={() => void cancel()}>
                Cancel and delete this upload draft
              </button>
            )}
          {activity.variantId && (
            <Link
              className="action-link"
              to={`/resumes/${activity.resumeId}?variant=${activity.variantId}`}
            >
              Review tailored resume
            </Link>
          )}
          {activity.status === 'completed' && activity.kind === 'parsing' && (
            <Link className="action-link" to={`/resumes/${activity.resumeId}`}>
              Open saved resume
            </Link>
          )}
        </>
      ) : (
        !error && <p role="status">Loading workflow…</p>
      )}
    </div>
  );
}
