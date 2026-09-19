import { useLayoutEffect, useRef, useState } from 'react';
import { emptyValue, labelFor } from '../lib/schema';
import type { FieldSchema } from '../lib/schema';
import InlineResumeField from './InlineResumeField';
import './ResumeFields.css';

interface FieldProps {
  schema: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
}
interface Editing {
  path: string | null;
  disabled: boolean;
  start: (path: string, trigger: HTMLButtonElement) => void;
  finish: () => void;
}

function hasContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object')
    return Object.values(value).some(hasContent);
  return value !== undefined && value !== null && value !== '';
}

function ObjectFields({
  schema,
  value,
  onChange,
  label,
  path,
  editing,
}: FieldProps & { path: string; editing: Editing }) {
  const object =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const entries = Object.entries(schema.properties ?? {});
  const visible = ([key]: [string, FieldSchema]) =>
    hasContent(object[key]) || schema.required?.includes(key);
  const render = ([key, field]: [string, FieldSchema]) => (
    <ResumeNode
      key={key}
      schema={field}
      value={object[key]}
      label={field.title || (key === 'basics' ? 'Profile' : labelFor(key))}
      path={`${path}/${key}`}
      editing={editing}
      onChange={(next) => {
        const updated = { ...object, [key]: next };
        if (next === '' && !schema.required?.includes(key)) delete updated[key];
        onChange(updated);
      }}
    />
  );
  const missing = entries.filter((entry) => !visible(entry));
  return (
    <div className="resume-object-content">
      {entries.filter(visible).map(render)}
      {missing.length > 0 && (
        <details className="resume-missing">
          <summary
            onClick={(event) => {
              if (editing.path !== null || editing.disabled)
                event.preventDefault();
            }}
          >
            {path === ''
              ? 'Add a section or detail'
              : `Add details to ${label.toLowerCase()}`}
          </summary>
          <div className="resume-object-content">{missing.map(render)}</div>
        </details>
      )}
    </div>
  );
}

function ResumeNode(props: FieldProps & { path: string; editing: Editing }) {
  const { schema, value, onChange, label, path, editing } = props;
  if (schema.type === 'object')
    return (
      <section className="resume-section" aria-label={label}>
        <h4>{label}</h4>
        <ObjectFields {...props} />
      </section>
    );
  if (schema.type === 'array' && schema.items) {
    const items = Array.isArray(value) ? value : [];
    return (
      <section className="resume-section" aria-label={label}>
        <h4>{label}</h4>
        <ul
          className={`resume-items ${schema.items.type === 'object' ? 'resume-entries' : ''}`}
        >
          {items.map((item, index) => (
            <li key={index}>
              {schema.items!.type === 'object' ? (
                <ObjectFields
                  schema={schema.items!}
                  value={item}
                  label={`${label} ${index + 1}`}
                  path={`${path}/${index}`}
                  editing={editing}
                  onChange={(next) =>
                    onChange(items.map((old, i) => (i === index ? next : old)))
                  }
                />
              ) : (
                <ResumeNode
                  schema={schema.items!}
                  value={item}
                  label={`${label} ${index + 1}`}
                  path={`${path}/${index}`}
                  editing={editing}
                  onChange={(next) =>
                    onChange(items.map((old, i) => (i === index ? next : old)))
                  }
                />
              )}
              <button
                type="button"
                className="resume-remove"
                aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
                title={`Remove ${label.toLowerCase()} ${index + 1}`}
                disabled={editing.disabled || editing.path !== null}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="resume-add"
          disabled={editing.disabled || editing.path !== null}
          onClick={() => onChange([...items, emptyValue(schema.items!)])}
        >
          + Add {label.toLowerCase()}
        </button>
      </section>
    );
  }
  return (
    <InlineResumeField
      schema={schema}
      value={value}
      label={label}
      onChange={onChange}
      editing={editing.path === path}
      disabled={
        editing.disabled || (editing.path !== null && editing.path !== path)
      }
      onStart={(trigger) => editing.start(path, trigger)}
      onFinish={editing.finish}
    />
  );
}

export function ResumeFields({
  schema,
  value,
  onChange,
  label = 'Resume',
  onEditingChange,
  disabled = false,
}: Omit<FieldProps, 'label'> & {
  label?: string;
  onEditingChange?: (editing: boolean) => void;
  disabled?: boolean;
}) {
  const [path, setPath] = useState<string | null>(null);
  const document = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    if (path === null && trigger.current) {
      if (trigger.current.isConnected) trigger.current.focus();
      else document.current?.focus();
      trigger.current = null;
    }
  }, [path]);
  const editing: Editing = {
    path,
    disabled,
    start: (nextPath, button) => {
      trigger.current = button;
      setPath(nextPath);
      onEditingChange?.(true);
    },
    finish: () => {
      setPath(null);
      onEditingChange?.(false);
    },
  };
  const props = { schema, value, onChange, label, path: '', editing };
  return (
    <article
      className="resume-document"
      aria-label={label}
      ref={document}
      tabIndex={-1}
    >
      <p className="resume-edit-hint">
        {path === null
          ? 'Use the pencil beside any detail to edit it.'
          : 'Accept or cancel this field’s edit before continuing.'}
      </p>
      {schema.type === 'object' ? (
        <ObjectFields {...props} />
      ) : (
        <ResumeNode {...props} />
      )}
    </article>
  );
}
