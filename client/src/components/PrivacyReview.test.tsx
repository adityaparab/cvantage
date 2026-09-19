import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PrivacyReview from './PrivacyReview';
import WorkflowActivity from './WorkflowActivity';
import { api } from '../lib/api';
vi.mock('../lib/api', async (original) => ({
  ...(await original<object>()),
  api: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function renderReview() {
  render(
    <MemoryRouter initialEntries={['/uploads/job/review']}>
      <Routes>
        <Route
          path="/uploads/job/review"
          element={<PrivacyReview id="job" />}
        />
        <Route path="/activity/job" element={<h1>Parsing activity</h1>} />
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
    <MemoryRouter initialEntries={['/activity/job']}>
      <Routes>
        <Route
          path="/activity/job"
          element={<WorkflowActivity id="job" onComplete={() => {}} />}
        />
        <Route
          path="/uploads/job/review"
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
