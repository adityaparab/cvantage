import { useId } from 'react';
import { emptyValue, labelFor } from '../lib/schema';
import type { FieldSchema } from '../lib/schema';
export function ResumeFields({
  schema,
  value,
  onChange,
  label = 'Resume',
}: {
  schema: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  label?: string;
}) {
  const id = useId();
  if (schema.type === 'object') {
    const object =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return (
      <fieldset>
        <legend>{label}</legend>
        {Object.entries(schema.properties ?? {}).map(([key, field]) => (
          <ResumeFields
            key={key}
            schema={field}
            value={object[key]}
            onChange={(next) => {
              const updated = { ...object, [key]: next };
              if (next === '' && !schema.required?.includes(key))
                delete updated[key];
              onChange(updated);
            }}
            label={field.title || labelFor(key)}
          />
        ))}
      </fieldset>
    );
  }
  if (schema.type === 'array' && schema.items) {
    const items = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend>{label}</legend>
        {items.map((item, index) => (
          <div className="array-item" key={index}>
            <ResumeFields
              schema={schema.items!}
              value={item}
              label={`${label} ${index + 1}`}
              onChange={(next) =>
                onChange(items.map((old, i) => (i === index ? next : old)))
              }
            />
            <button
              type="button"
              className="text-button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              Remove {label.toLowerCase()} {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() => onChange([...items, emptyValue(schema.items!)])}
        >
          Add {label.toLowerCase()}
        </button>
      </fieldset>
    );
  }
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {schema.type === 'boolean' ? (
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(event) => onChange(event.target.checked)}
        />
      ) : schema.type === 'number' ? (
        <input
          id={id}
          type="number"
          step="any"
          value={typeof value === 'number' ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      ) : (
        <textarea
          id={id}
          rows={2}
          value={typeof value === 'string' ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
