import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ResumeLibrary from './ResumeLibrary';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('confirms deletion and sends the displayed revision before removing a resume', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            _id: 'resume',
            revision: 3,
            data: { basics: { summary: 'Engineer' } },
            updatedAt: '2026-09-19',
          },
        ]),
      ),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ deleted: true })));
  vi.stubGlobal('fetch', fetcher);
  render(
    <MemoryRouter>
      <ResumeLibrary />
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Delete resume' }));
  expect(fetcher).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Keep resume' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Delete resume' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm delete resume' }),
  );
  expect(
    await screen.findByText('No resumes yet. Upload a resume to get started.'),
  ).toBeTruthy();
  expect(fetcher.mock.calls[1][0]).toBe('/api/resumes/resume');
  expect(fetcher.mock.calls[1][1].method).toBe('DELETE');
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ revision: 3 });
});
