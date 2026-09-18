import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ResumeFields } from './ResumeFields';
afterEach(cleanup);
it('edits nested arrays and newly discovered fields', () => {
  const change = vi.fn();
  render(
    <ResumeFields
      schema={{
        type: 'object',
        properties: {
          education: {
            type: 'array',
            items: {
              type: 'object',
              properties: { degree: { type: 'string' } },
            },
          },
        },
      }}
      value={{ education: [{ degree: 'Original' }] }}
      onChange={change}
    />,
  );
  fireEvent.change(screen.getByLabelText('Degree'), {
    target: { value: 'Corrected' },
  });
  expect(change).toHaveBeenCalledWith({ education: [{ degree: 'Corrected' }] });
  fireEvent.click(screen.getByText('Add education'));
  expect(change).toHaveBeenCalledWith({
    education: [{ degree: 'Original' }, {}],
  });
});

it('omits cleared optional fields instead of saving invalid blank dates or URLs', () => {
  const change = vi.fn();
  render(
    <ResumeFields
      schema={{
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['summary'],
      }}
      value={{ startDate: '2024-02', summary: 'Engineer' }}
      onChange={change}
    />,
  );
  fireEvent.change(screen.getByLabelText('Start Date'), {
    target: { value: '' },
  });
  expect(change).toHaveBeenLastCalledWith({ summary: 'Engineer' });
  fireEvent.change(screen.getByLabelText('Summary'), { target: { value: '' } });
  expect(change).toHaveBeenLastCalledWith({
    startDate: '2024-02',
    summary: '',
  });
});
