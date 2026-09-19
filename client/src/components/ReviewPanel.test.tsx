import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ReviewPanel from './ReviewPanel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
  });

it('never renders a schema editor when background preparation fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        response({ job: { _id: 'job', stage: 'schema', status: 'failed' } }),
      ),
  );
  render(<ReviewPanel id="job" onComplete={vi.fn()} onClose={vi.fn()} />);
  expect(
    await screen.findByText('Resume processing could not finish'),
  ).toBeTruthy();
  expect(screen.queryByText('Field type')).toBeNull();
  expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull();
});

it('lets users reject a parsed resume without accepting it', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      response({
        job: {
          _id: 'job',
          stage: 'mapping',
          status: 'review_required',
          revision: 4,
          candidate: { professionalSummary: 'Engineer' },
        },
        schema: {
          type: 'object',
          properties: { professionalSummary: { type: 'string' } },
        },
      }),
    )
    .mockResolvedValueOnce(response({ cancelled: true }));
  vi.stubGlobal('fetch', fetcher);
  const complete = vi.fn();
  render(<ReviewPanel id="job" onComplete={complete} onClose={vi.fn()} />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Reject parsed resume' }),
  );
  await waitFor(() => expect(complete).toHaveBeenCalled());
  expect(fetcher.mock.calls[1][0]).toBe('/api/parsing-jobs/job/cancel');
});

it('blocks approval of an active draft and submits only accepted field changes', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      response({
        job: {
          _id: 'job',
          stage: 'mapping',
          status: 'review_required',
          revision: 4,
          candidate: { professionalSummary: 'Engineer' },
        },
        schema: {
          type: 'object',
          properties: { professionalSummary: { type: 'string' } },
        },
      }),
    )
    .mockResolvedValueOnce(response({ accepted: true }));
  vi.stubGlobal('fetch', fetcher);
  const complete = vi.fn();
  render(<ReviewPanel id="job" onComplete={complete} onClose={vi.fn()} />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Edit Professional Summary' }),
  );
  fireEvent.change(screen.getByLabelText('Professional Summary'), {
    target: { value: 'Reviewed engineer' },
  });
  const approval = screen.getByRole('button', {
    name: 'Approve parsed resume',
  }) as HTMLButtonElement;
  expect(approval.disabled).toBe(true);
  fireEvent.submit(approval.closest('form')!);
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.click(
    screen.getByRole('button', { name: 'Accept Professional Summary change' }),
  );
  expect(approval.disabled).toBe(false);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(approval);
  await waitFor(() => expect(complete).toHaveBeenCalled());
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
    revision: 4,
    stage: 'mapping',
    candidate: { professionalSummary: 'Reviewed engineer' },
    approve: true,
  });
});
