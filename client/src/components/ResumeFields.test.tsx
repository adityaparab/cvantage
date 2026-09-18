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
    education: [{ degree: 'Original' }, { degree: '' }],
  });
});
