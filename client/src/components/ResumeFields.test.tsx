import { useState } from 'react';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ResumeFields } from './ResumeFields';
import type { FieldSchema } from '../lib/schema';
afterEach(cleanup);

function setup(schema: FieldSchema, initial: unknown) {
  const change = vi.fn();
  const editing = vi.fn();
  function Form() {
    const [value, setValue] = useState(initial);
    return (
      <ResumeFields
        schema={schema}
        value={value}
        onEditingChange={editing}
        onChange={(next) => {
          change(next);
          setValue(next);
        }}
      />
    );
  }
  render(<Form />);
  return { change, editing };
}
const simpleSchema: FieldSchema = {
  type: 'object',
  properties: { summary: { type: 'string' }, role: { type: 'string' } },
};

it('shows readable content and edits only the selected field until explicitly accepted', () => {
  const { change, editing } = setup(simpleSchema, {
    summary: 'Engineer',
    role: 'Lead',
  });
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByText('Engineer')).toBeTruthy();
  const pencil = screen.getByRole('button', { name: 'Edit Summary' });
  fireEvent.click(pencil);
  expect(screen.getAllByRole('textbox')).toHaveLength(1);
  expect(screen.getByLabelText('Summary')).toBe(document.activeElement);
  expect(screen.queryByRole('button', { name: 'Edit Summary' })).toBeNull();
  expect(
    (screen.getByRole('button', { name: 'Edit Role' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Summary'), {
    target: { value: 'Corrected engineer' },
  });
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Accept Summary change' }),
  );
  expect(change).toHaveBeenCalledWith({
    summary: 'Corrected engineer',
    role: 'Lead',
  });
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(pencil).toBe(document.activeElement);
  expect(editing.mock.calls).toEqual([[true], [false]]);
});

it('cancels with the cross or Escape, restoring the saved value and pencil focus', () => {
  const { change } = setup(simpleSchema, { summary: 'Original' });
  for (const escape of [false, true]) {
    const pencil = screen.getByRole('button', { name: 'Edit Summary' });
    fireEvent.click(pencil);
    fireEvent.change(screen.getByLabelText('Summary'), {
      target: { value: 'Discard this' },
    });
    if (escape)
      fireEvent.keyDown(screen.getByLabelText('Summary'), { key: 'Escape' });
    else
      fireEvent.click(
        screen.getByRole('button', { name: 'Cancel Summary change' }),
      );
    expect(screen.getByText('Original')).toBeTruthy();
    expect(pencil).toBe(document.activeElement);
    expect(change).not.toHaveBeenCalled();
  }
});

it('edits discovered nested fields and adds/removes array entries without disturbing siblings', () => {
  const { change } = setup(
    {
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
    },
    { education: [{ degree: 'Original' }, { degree: 'Second' }] },
  );
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit Degree' })[0]);
  fireEvent.change(screen.getByLabelText('Degree'), {
    target: { value: 'Corrected' },
  });
  expect(
    (
      screen.getByRole('button', {
        name: 'Remove education 1',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Accept Degree change' }));
  expect(change).toHaveBeenLastCalledWith({
    education: [{ degree: 'Corrected' }, { degree: 'Second' }],
  });
  fireEvent.click(screen.getByRole('button', { name: '+ Add education' }));
  expect(change).toHaveBeenLastCalledWith({
    education: [{ degree: 'Corrected' }, { degree: 'Second' }, {}],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Remove education 1' }));
  expect(change).toHaveBeenLastCalledWith({
    education: [{ degree: 'Second' }, {}],
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'Edit Degree' })[0]);
  expect((screen.getByLabelText('Degree') as HTMLTextAreaElement).value).toBe(
    'Second',
  );
});

it('keeps absent optional fields available in a collapsed details control', () => {
  const { change } = setup(simpleSchema, { summary: 'Engineer' });
  expect(
    screen.getByText('Add a section or detail').closest('details')?.open,
  ).toBe(false);
  fireEvent.click(screen.getByText('Add a section or detail'));
  fireEvent.click(screen.getByRole('button', { name: 'Edit Role' }));
  fireEvent.change(screen.getByLabelText('Role'), {
    target: { value: 'Lead' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Accept Role change' }));
  expect(change).toHaveBeenLastCalledWith({
    summary: 'Engineer',
    role: 'Lead',
  });
  expect(screen.getByText('Lead')).toBeTruthy();
});

it('omits cleared optional fields while preserving required empty strings', () => {
  const { change } = setup(
    { ...simpleSchema, required: ['summary'] },
    { summary: 'Engineer', role: 'Lead' },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit Role' }));
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Accept Role change' }));
  expect(change).toHaveBeenLastCalledWith({ summary: 'Engineer' });
  fireEvent.click(screen.getByRole('button', { name: 'Edit Summary' }));
  fireEvent.change(screen.getByLabelText('Summary'), { target: { value: '' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Accept Summary change' }),
  );
  expect(change).toHaveBeenLastCalledWith({ summary: '' });
});

it('preserves false and zero, validates numbers, and accepts scalar values with the correct types', () => {
  const { change } = setup(
    {
      type: 'object',
      properties: {
        years: { type: 'number' },
        available: { type: 'boolean' },
      },
    },
    { years: 0, available: false },
  );
  expect(screen.getByText('0')).toBeTruthy();
  expect(screen.getByText('No')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Years' }));
  fireEvent.change(screen.getByLabelText('Years'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Accept Years change' }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Years'), {
    target: { value: '2.5' },
  });
  fireEvent.keyDown(screen.getByLabelText('Years'), { key: 'Enter' });
  expect(change).toHaveBeenLastCalledWith({ years: 2.5, available: false });
  fireEvent.click(screen.getByRole('button', { name: 'Edit Available' }));
  fireEvent.click(screen.getByLabelText('Available'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Accept Available change' }),
  );
  expect(change).toHaveBeenLastCalledWith({ years: 2.5, available: true });
});

it('edits primitive array items and safely renders multiline text as text', () => {
  const { change } = setup(
    {
      type: 'object',
      properties: {
        highlights: { type: 'array', items: { type: 'string' } },
      },
    },
    { highlights: ['First\nSecond', '<script>example</script>'] },
  );
  expect(screen.getByText('<script>example</script>')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Highlights 1' }));
  fireEvent.change(screen.getByLabelText('Highlights 1'), {
    target: { value: 'Updated\nSecond' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Accept Highlights 1 change' }),
  );
  expect(change).toHaveBeenLastCalledWith({
    highlights: ['Updated\nSecond', '<script>example</script>'],
  });
});
