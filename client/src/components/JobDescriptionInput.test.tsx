import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import JobDescriptionInput from './JobDescriptionInput';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Form() {
  const [description, setDescription] = useState(
    'A sufficiently long job description.',
  );
  return (
    <JobDescriptionInput
      resumeId="resume"
      description={description}
      onChange={setDescription}
      disabled={false}
      onImportingChange={() => {}}
    />
  );
}
it('imports reviewed text without starting a workflow and resets privacy confirmation after edits', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ text: 'Imported description for a software role.' }),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  render(<Form />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Job URL (optional)'), {
    target: { value: 'https://example.com/jobs' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Import job description' }),
  );
  await screen.findByText(
    'Job text imported. Review and edit it below before analysis.',
  );
  expect(
    (screen.getByLabelText('Job description') as HTMLTextAreaElement).value,
  ).toContain('Imported description');
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
    false,
  );
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Job description'), {
    target: { value: 'Edited description with enough detail.' },
  });
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
    false,
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('/api/resumes/resume/job-description');
});
it('preserves pasted text when importing fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'Paste the description instead.' }),
          { status: 400 },
        ),
      ),
  );
  render(<Form />);
  fireEvent.change(screen.getByLabelText('Job URL (optional)'), {
    target: { value: 'https://example.com/jobs' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Import job description' }),
  );
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(
    (screen.getByLabelText('Job description') as HTMLTextAreaElement).value,
  ).toBe('A sufficiently long job description.');
});
