import { useCallback, useId, useRef, useState } from 'react';
import type { FieldSchema } from '../lib/schema';

function Icon({ kind }: { kind: 'edit' | 'accept' | 'cancel' }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === 'edit' ? (
        <path d="m16 3 5 5M3 21l5-1L21 7a2.1 2.1 0 0 0-5-5L3 15z" />
      ) : kind === 'accept' ? (
        <path d="m5 12 4 4L19 6" />
      ) : (
        <path d="m6 6 12 12M6 18 18 6" />
      )}
    </svg>
  );
}

export default function InlineResumeField({
  schema,
  value,
  label,
  onChange,
  editing,
  disabled,
  onStart,
  onFinish,
}: {
  schema: FieldSchema;
  value: unknown;
  label: string;
  onChange: (value: unknown) => void;
  editing: boolean;
  disabled: boolean;
  onStart: (trigger: HTMLButtonElement) => void;
  onFinish: () => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | boolean>('');
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const focusInput = useCallback(
    (element: HTMLInputElement | HTMLTextAreaElement | null) => {
      input.current = element;
      element?.focus();
    },
    [],
  );
  const display =
    value === undefined || value === null || value === ''
      ? 'Not provided'
      : typeof value === 'boolean'
        ? value
          ? 'Yes'
          : 'No'
        : String(value);
  const wide =
    /summary|description|highlights/i.test(label) || display.length > 100;
  function accept() {
    if (disabled) return;
    if (schema.type === 'number' && !input.current?.reportValidity()) return;
    onChange(schema.type === 'number' ? Number(draft) : draft);
    onFinish();
  }
  return (
    <div
      className={`resume-field${wide ? ' resume-field-wide' : ''}${editing ? ' is-editing' : ''}`}
      onKeyDown={(event) => {
        if (!editing || event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onFinish();
        } else if (
          event.key === 'Enter' &&
          event.target instanceof HTMLInputElement
        ) {
          event.preventDefault();
          accept();
        }
      }}
    >
      <div className="resume-field-content">
        {editing ? (
          <label htmlFor={id}>{label}</label>
        ) : (
          <span className="resume-field-label">{label}</span>
        )}
        {editing ? (
          schema.type === 'boolean' ? (
            <input
              id={id}
              type="checkbox"
              checked={draft === true}
              disabled={disabled}
              ref={focusInput}
              onChange={(event) => setDraft(event.target.checked)}
            />
          ) : schema.type === 'number' ? (
            <input
              id={id}
              type="number"
              step="any"
              required
              value={String(draft)}
              disabled={disabled}
              ref={focusInput}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : (
            <textarea
              id={id}
              rows={wide ? 4 : 2}
              value={String(draft)}
              disabled={disabled}
              ref={focusInput}
              onChange={(event) => setDraft(event.target.value)}
            />
          )
        ) : (
          <p className={display === 'Not provided' ? 'muted' : undefined}>
            {display}
          </p>
        )}
      </div>
      <div className="resume-field-actions">
        {editing && (
          <>
            <button
              type="button"
              className="resume-icon resume-accept"
              aria-label={`Accept ${label} change`}
              title="Accept change"
              disabled={disabled}
              onClick={accept}
            >
              <Icon kind="accept" />
            </button>
            <button
              type="button"
              className="resume-icon"
              aria-label={`Cancel ${label} change`}
              title="Cancel change"
              disabled={disabled}
              onClick={onFinish}
            >
              <Icon kind="cancel" />
            </button>
          </>
        )}
        <button
          type="button"
          hidden={editing}
          className="resume-icon resume-pencil"
          aria-label={`Edit ${label}`}
          title={`Edit ${label}`}
          disabled={disabled}
          onClick={(event) => {
            setDraft(
              schema.type === 'boolean' ? value === true : String(value ?? ''),
            );
            onStart(event.currentTarget);
          }}
        >
          <Icon kind="edit" />
        </button>
      </div>
    </div>
  );
}
