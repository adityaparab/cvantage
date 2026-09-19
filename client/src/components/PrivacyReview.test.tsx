import { afterEach, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import PrivacyReview from './PrivacyReview';
import type { PreparedUpload } from '../lib/useRedactionReview';
import UploadReviewProvider from './UploadReviewProvider';
import { usePreparedUpload } from '../lib/uploadReviewContext';
import WorkflowActivity from './WorkflowActivity';
import { api } from '../lib/api';
vi.mock('../lib/api', async (original) => ({
  ...(await original<object>()),
  api: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.mocked(api).mockReset();
  vi.useRealTimers();
});
function renderReview(initial?: PreparedUpload) {
  render(
    <MemoryRouter initialEntries={['/resumes/uploads/job/review']}>
      <Routes>
        <Route
          path="/resumes/uploads/job/review"
          element={<PrivacyReview id="job" initial={initial} />}
        />
        <Route
          path="/resumes/activity/job"
          element={<h1>Parsing activity</h1>}
        />
      </Routes>
    </MemoryRouter>,
  );
}
it('lets users edit and redact selected text, then requires approval before navigation', async () => {
  vi.mocked(api)
    .mockResolvedValueOnce({
      source: 'Missed Person writes TypeScript',
      revision: 2,
    })
    .mockResolvedValueOnce({});
  renderReview();
  const field = await screen.findByLabelText<HTMLTextAreaElement>(
    'Redacted resume text',
  );
  const approve = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Approve redaction and start parsing',
  });
  expect(approve.disabled).toBe(true);
  field.setSelectionRange(0, 13);
  fireEvent.select(field);
  fireEvent.click(screen.getByRole('button', { name: /^Redact name$/ }));
  expect(field.value).toBe('PII_NAME writes TypeScript');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(field, {
    target: { value: 'PII_NAME writes TypeScript. [email removed]' },
  });
  expect(approve.disabled).toBe(true);
  expect(api).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Extract resume content')).toBeNull();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(approve);
  await screen.findByText('Parsing activity');
  expect(api).toHaveBeenLastCalledWith('/parsing-jobs/job/prepare', {
    method: 'POST',
    body: JSON.stringify({
      source: 'PII_NAME writes TypeScript. [email removed]',
      revision: 2,
      confirmed: true,
    }),
  });
});
it('keeps edited text on failed approval instead of entering parsing', async () => {
  vi.mocked(api)
    .mockResolvedValueOnce({ source: 'PII_NAME engineer', revision: 0 })
    .mockRejectedValueOnce(
      new Error('Review changed; reload before confirming'),
    );
  renderReview();
  const field = await screen.findByLabelText<HTMLTextAreaElement>(
    'Redacted resume text',
  );
  fireEvent.change(field, { target: { value: 'PII_NAME edited engineer' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Approve redaction and start parsing' }),
  );
  await screen.findByRole('alert');
  expect(field.value).toBe('PII_NAME edited engineer');
  expect(screen.queryByText('Parsing activity')).toBeNull();
});
it('reopens already-approved uploads on their activity page', async () => {
  vi.mocked(api).mockResolvedValueOnce({
    source: 'PII_NAME',
    revision: 1,
    piiConfirmed: true,
  });
  renderReview();
  await screen.findByText('Parsing activity');
  expect(api).toHaveBeenCalledTimes(1);
});
it('redirects an unapproved activity link to upload review before showing parsing steps', async () => {
  vi.mocked(api).mockResolvedValue({
    id: 'job',
    kind: 'parsing',
    status: 'review_required',
    piiConfirmed: false,
    steps: [],
  });
  render(
    <MemoryRouter initialEntries={['/resumes/activity/job']}>
      <Routes>
        <Route
          path="/resumes/activity/job"
          element={<WorkflowActivity id="job" onComplete={() => {}} />}
        />
        <Route
          path="/resumes/uploads/job/review"
          element={<h1>Upload privacy review</h1>}
        />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.getByText('Upload privacy review')).toBeTruthy(),
  );
  expect(screen.queryByText('Extract resume content')).toBeNull();
});

it('displays the upload response immediately without a redundant request', () => {
  renderReview({
    jobId: 'job',
    source: 'PII_NAME immediate engineer',
    revision: 0,
  });
  expect(
    screen.getByLabelText<HTMLTextAreaElement>('Redacted resume text').value,
  ).toBe('PII_NAME immediate engineer');
  expect(api).not.toHaveBeenCalled();
  expect(screen.queryByRole('progressbar')).toBeNull();
});

it('shows progress for unavailable text and replaces it automatically without overwriting later edits', async () => {
  vi.useFakeTimers();
  vi.mocked(api)
    .mockResolvedValueOnce({ source: '', revision: 0 })
    .mockResolvedValueOnce({ source: 'PII_NAME ready engineer', revision: 1 });
  renderReview();
  expect(screen.getByRole('progressbar')).toBeTruthy();
  expect(screen.queryByLabelText('Redacted resume text')).toBeNull();
  expect(
    screen.queryByRole('button', {
      name: 'Approve redaction and start parsing',
    }),
  ).toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.queryByRole('progressbar')).toBeNull();
  const field = screen.getByLabelText<HTMLTextAreaElement>(
    'Redacted resume text',
  );
  expect(field.value).toBe('PII_NAME ready engineer');
  fireEvent.change(field, { target: { value: 'PII_NAME user correction' } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(field.value).toBe('PII_NAME user correction');
  expect(api).toHaveBeenCalledTimes(2);
});

it('recovers failed loads from the review page using Retry', async () => {
  vi.mocked(api)
    .mockRejectedValueOnce(new Error('Network unavailable'))
    .mockResolvedValueOnce({
      source: 'PII_NAME recovered engineer',
      revision: 3,
    });
  renderReview();
  await screen.findByRole('alert');
  expect(screen.queryByRole('progressbar')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading text' }));
  const field = await screen.findByLabelText<HTMLTextAreaElement>(
    'Redacted resume text',
  );
  expect(field.value).toBe('PII_NAME recovered engineer');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('bounds stalled requests, aborts them, and ignores late responses after retry', async () => {
  vi.useFakeTimers();
  let resolveOld!: (value: unknown) => void;
  vi.mocked(api)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce({ source: 'PII_NAME fresh engineer', revision: 2 });
  renderReview();
  const signal = vi.mocked(api).mock.calls[0][1]?.signal;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(screen.getByRole('alert').textContent).toContain('taking longer');
  expect(signal?.aborted).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading text' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  const field = screen.getByLabelText<HTMLTextAreaElement>(
    'Redacted resume text',
  );
  fireEvent.change(field, { target: { value: 'PII_NAME manual correction' } });
  await act(async () => {
    resolveOld({ source: 'Old response', revision: 0 });
  });
  expect(field.value).toBe('PII_NAME manual correction');
});

it('aborts requests and cancels refreshes when leaving the screen', async () => {
  vi.useFakeTimers();
  vi.mocked(api).mockResolvedValue({ revision: 0 });
  renderReview();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  const signal = vi.mocked(api).mock.calls[0][1]?.signal;
  cleanup();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(signal?.aborted).toBe(true);
  expect(api).toHaveBeenCalledTimes(1);
});

it('does not display preloaded text belonging to another upload', async () => {
  vi.mocked(api).mockResolvedValueOnce({
    source: 'PII_NAME correct upload',
    revision: 0,
  });
  renderReview({ jobId: 'other-job', source: 'Wrong upload', revision: 0 });
  const field = await screen.findByLabelText<HTMLTextAreaElement>(
    'Redacted resume text',
  );
  expect(field.value).toBe('PII_NAME correct upload');
});

it('hands off text across route remounts and clears it when leaving review', async () => {
  vi.mocked(api).mockResolvedValue({
    source: 'PII_NAME stored source',
    revision: 0,
  });
  function UploadStep() {
    const navigate = useNavigate();
    const { preparedUpload, setPreparedUpload } = usePreparedUpload();
    return (
      <>
        <p>{preparedUpload?.source ?? 'No cached text'}</p>
        <button
          onClick={() => {
            setPreparedUpload({
              jobId: 'job',
              source: 'PII_NAME fresh source',
              revision: 0,
            });
            navigate('/resumes/uploads/job/review');
          }}
        >
          Finish upload
        </button>
        <Link to="/resumes/uploads/job/review">Reopen upload</Link>
      </>
    );
  }
  function ReviewStep() {
    const { preparedUpload } = usePreparedUpload();
    return <PrivacyReview id="job" initial={preparedUpload} />;
  }
  render(
    <MemoryRouter initialEntries={['/resumes']}>
      <UploadReviewProvider>
        <Routes>
          <Route path="/resumes" element={<UploadStep />} />
          <Route path="/resumes/uploads/job/review" element={<ReviewStep />} />
        </Routes>
      </UploadReviewProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Finish upload' }));
  expect(
    screen.getByLabelText<HTMLTextAreaElement>('Redacted resume text').value,
  ).toBe('PII_NAME fresh source');
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('link', { name: '← Back to resumes' }));
  await screen.findByText('No cached text');
  fireEvent.click(screen.getByRole('link', { name: 'Reopen upload' }));
  const field = await screen.findByLabelText<HTMLTextAreaElement>(
    'Redacted resume text',
  );
  expect(field.value).toBe('PII_NAME stored source');
  expect(api).toHaveBeenCalledTimes(1);
});
