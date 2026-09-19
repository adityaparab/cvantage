import { useLayoutEffect, useRef, useState } from 'react';
import { emptyValue, labelFor } from '../lib/schema';
import type { FieldSchema } from '../lib/schema';
import InlineResumeField from './InlineResumeField';
import ResumeDeleteButton from './ResumeDeleteButton';
import './ResumeFields.css';

interface FieldProps {
  schema: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  label: string;
  onRemove?: () => void;
  required?: boolean;
}
interface Editing {
  allowDelete: boolean;
  path: string | null;
  disabled: boolean;
  start: (path: string, trigger: HTMLButtonElement) => void;
  finish: () => void;
  remove: (label: string, action: () => void) => void;
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
      required={schema.required?.includes(key)}
      onRemove={
        editing.allowDelete && Object.hasOwn(object, key)
          ? () => {
              const updated = { ...object };
              delete updated[key];
              editing.remove(
                field.title || (key === 'basics' ? 'Profile' : labelFor(key)),
                () => onChange(updated),
              );
            }
          : undefined
      }
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
  const { schema, value, onChange, label, path, editing, onRemove, required } =
    props;
  const heading = (
    <div className="resume-section-heading">
      <h4>{label}</h4>
      {onRemove && (
        <ResumeDeleteButton
          label={label}
          onClick={onRemove}
          disabled={editing.disabled || editing.path !== null}
          required={required}
        />
      )}
    </div>
  );
  if (schema.type === 'object')
    return (
      <section className="resume-section" aria-label={label}>
        {heading}
        <ObjectFields {...props} />
      </section>
    );
  if (schema.type === 'array' && schema.items) {
    const items = Array.isArray(value) ? value : [];
    return (
      <section className="resume-section" aria-label={label}>
        {heading}
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
              {editing.allowDelete && (
                <ResumeDeleteButton
                  className="resume-remove"
                  label={`${label} ${index + 1}`}
                  disabled={editing.disabled || editing.path !== null}
                  onClick={() =>
                    editing.remove(`${label} ${index + 1}`, () =>
                      onChange(items.filter((_, i) => i !== index)),
                    )
                  }
                />
              )}
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
      onRemove={onRemove}
      required={required}
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
  allowDelete = true,
}: Omit<FieldProps, 'label'> & {
  label?: string;
  onEditingChange?: (editing: boolean) => void;
  disabled?: boolean;
  allowDelete?: boolean;
}) {
  const [path, setPath] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{
    label: string;
    value: unknown;
  } | null>(null);
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
    allowDelete,
    path,
    disabled,
    start: (nextPath, button) => {
      trigger.current = button;
      setPath(nextPath);
      onEditingChange?.(true);
    },
    remove: (removedLabel, action) => {
      action();
      setRemoved({ label: removedLabel, value });
      document.current?.focus();
    },
    finish: () => {
      setPath(null);
      onEditingChange?.(false);
    },
  };
  const props = {
    schema,
    value,
    label,
    path: '',
    editing,
    onChange: (next: unknown) => {
      setRemoved(null);
      onChange(next);
    },
  };
  return (
    <article
      className="resume-document"
      aria-label={label}
      ref={document}
      tabIndex={-1}
    >
      <p className="resume-edit-hint">
        {path === null
          ? allowDelete
            ? 'Use the pencil to edit a detail or the trash bin to delete it.'
            : 'Use the pencil beside any detail to edit it.'
          : 'Accept or cancel this field’s edit before continuing.'}
      </p>
      {removed && (
        <div className="resume-deletion" role="status">
          <span>Deleted {removed.label}.</span>
          <button
            type="button"
            className="resume-undo"
            disabled={disabled || path !== null}
            onClick={() => {
              onChange(removed.value);
              setRemoved(null);
              document.current?.focus();
            }}
          >
            Undo deletion
          </button>
        </div>
      )}
      {schema.type === 'object' ? (
        <ObjectFields {...props} />
      ) : (
        <ResumeNode {...props} />
      )}
    </article>
  );
}
