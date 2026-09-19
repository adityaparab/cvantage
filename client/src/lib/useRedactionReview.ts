import { useEffect, useState } from 'react';
import { api, ApiError } from './api';

export interface PreparedJob {
  source: string;
  revision: number;
  piiConfirmed?: boolean;
  status?: string;
}
export interface PreparedUpload extends PreparedJob {
  jobId: string;
}
function isReady(job?: PreparedJob): boolean {
  return (
    !!job &&
    (job.piiConfirmed === true ||
      (typeof job.source === 'string' &&
        job.source.trim().length > 0 &&
        Number.isInteger(job.revision) &&
        job.revision >= 0))
  );
}

export function useRedactionReview(id: string, initial?: PreparedUpload) {
  const prepared =
    initial?.jobId === id && isReady(initial) ? initial : undefined;
  const [job, setJob] = useState<PreparedJob | null>(prepared ?? null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setError('');
    setJob(prepared ?? null);
    if (prepared) return;
    let active = true;
    let poll: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    function fail(message: string) {
      if (!active) return;
      active = false;
      clearTimeout(poll);
      clearTimeout(deadline);
      controller.abort();
      setError(message);
    }
    const deadline = setTimeout(
      () =>
        fail(
          'Preparing your redacted text is taking longer than expected. Retry to check again.',
        ),
      30_000,
    );
    async function load() {
      try {
        const value = await api<PreparedJob>(`/parsing-jobs/${id}`, {
          signal: controller.signal,
        });
        if (!active) return;
        if (isReady(value)) {
          active = false;
          clearTimeout(deadline);
          setJob(value);
        } else if (value.status === 'failed') {
          fail(
            'This upload could not be prepared. Return to your workspace and upload it again.',
          );
        } else {
          poll = setTimeout(() => void load(), 1000);
        }
      } catch (reason) {
        if (!active) return;
        fail(
          reason instanceof ApiError && reason.status === 404
            ? 'This upload may have expired or been deleted. Return to your workspace to upload it again.'
            : 'Could not load your redacted text. Retry to continue reviewing this upload.',
        );
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
      clearTimeout(poll);
      clearTimeout(deadline);
    };
  }, [id, prepared, attempt]);
  return { job, error, retry: () => setAttempt((value) => value + 1) };
}
