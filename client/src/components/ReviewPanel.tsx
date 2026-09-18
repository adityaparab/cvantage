import { emptyValue } from '../lib/schema'
import { useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { ResumeFields, SchemaFields } from './ResumeFields'
import type { FieldSchema } from '../lib/schema'
interface Review {
  job: {
    _id: string
    resumeId: string
    stage: 'schema' | 'mapping'
    status: string
    revision: number
    candidate?: unknown
    failureCode?: string
    judge?: {
      confidence: number
      issues: { message: string; suggestedFix: string }[]
    }
  }
  schema: FieldSchema
}
export default function ReviewPanel({
  id,
  onComplete,
  onClose,
}: {
  id: string
  onComplete: () => void
  onClose: () => void
}) {
  const [review, setReview] = useState<Review | null>(null)
  const [candidate, setCandidate] = useState<unknown>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const value = await api<Review>(`/parsing-jobs/${id}/review`)
        if (!active) return
        setReview(value)
        if (['review_required', 'failed'].includes(value.job.status)) {
          setCandidate(
            value.job.stage === 'schema'
              ? value.job.candidate &&
                typeof value.job.candidate === 'object' &&
                '$schema' in value.job.candidate
                ? value.job.candidate
                : value.schema
              : (value.job.candidate ?? emptyValue(value.schema)),
          )
        } else {
          timer = setTimeout(() => void load(), 2000)
        }
      } catch (reason) {
        if (!active) return
        if (reason instanceof ApiError && reason.status === 404) {
          onComplete()
          onClose()
        } else setError('Could not load review. Close and reopen to retry.')
      }
    }
    void load()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [id, onComplete, onClose])
  async function approve() {
    if (!review) return
    setBusy(true)
    setError('')
    try {
      await api(`/parsing-jobs/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          revision: review.job.revision,
          stage: review.job.stage,
          candidate,
          approve: true,
        }),
      })
      onComplete()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Approval failed')
    } finally {
      setBusy(false)
    }
  }
  async function cancel() {
    try {
      await api(`/parsing-jobs/${id}/cancel`, { method: 'POST', body: '{}' })
      onClose()
    } catch {
      setError('Could not cancel this upload.')
    }
  }
  const needsReview =
    review && ['review_required', 'failed'].includes(review.job.status)
  return (
    <section>
      <button className="text-button" onClick={onClose}>
        ← Back to uploads
      </button>
      {review ? (
        <>
          <h3>
            {needsReview ? 'Your review is needed' : 'Preparing your resume…'}
          </h3>
          <p role="status">
            {review.job.stage === 'schema'
              ? 'Defining resume fields'
              : 'Mapping your experience'}{' '}
            · {review.job.status.replaceAll('_', ' ')}
          </p>
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
                  event.preventDefault()
                  void approve()
                }}
              >
                {review.job.stage === 'schema' ? (
                  <SchemaFields
                    schema={candidate as FieldSchema}
                    base={review.schema}
                    onChange={setCandidate}
                  />
                ) : (
                  <ResumeFields
                    schema={review.schema}
                    value={candidate}
                    onChange={setCandidate}
                  />
                )}
                <label className="confirmation">
                  <input type="checkbox" required />I reviewed these fields for
                  accuracy and removed identifying details.
                </label>
                <button disabled={busy}>
                  {busy ? 'Saving…' : 'Approve reviewed result'}
                </button>
              </form>
            </>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => void cancel()}
          >
            Cancel and delete this upload draft
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
  )
}
