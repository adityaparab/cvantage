import { useId, useState } from 'react'
import { emptyValue, labelFor } from '../lib/schema'
import type { FieldSchema } from '../lib/schema'
export function ResumeFields({
  schema,
  value,
  onChange,
  label = 'Resume',
}: {
  schema: FieldSchema
  value: unknown
  onChange: (value: unknown) => void
  label?: string
}) {
  const id = useId()
  if (schema.type === 'object') {
    const object =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {}
    return (
      <fieldset>
        <legend>{label}</legend>
        {Object.entries(schema.properties ?? {}).map(([key, field]) => (
          <ResumeFields
            key={key}
            schema={field}
            value={object[key]}
            onChange={(next) => onChange({ ...object, [key]: next })}
            label={field.title || labelFor(key)}
          />
        ))}
      </fieldset>
    )
  }
  if (schema.type === 'array' && schema.items) {
    const items = Array.isArray(value) ? value : []
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
    )
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
  )
}
function definition(type: FieldSchema['type']): FieldSchema {
  return type === 'object'
    ? { type, additionalProperties: false, properties: {} }
    : type === 'array'
      ? { type, items: { type: 'string' } }
      : { type }
}
export function SchemaFields({
  schema,
  base,
  onChange,
  label = 'Resume fields',
}: {
  schema: FieldSchema
  base?: FieldSchema
  onChange: (value: FieldSchema) => void
  label?: string
}) {
  const [key, setKey] = useState('')
  const [type, setType] = useState<FieldSchema['type']>('string')
  return (
    <fieldset>
      <legend>{label}</legend>
      <label>
        Field type
        <select
          value={schema.type}
          disabled={!!base}
          onChange={(event) =>
            onChange(definition(event.target.value as FieldSchema['type']))
          }
        >
          {['string', 'number', 'boolean', 'object', 'array'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      {schema.type === 'array' && schema.items && (
        <SchemaFields
          schema={schema.items}
          base={base?.items}
          onChange={(items) => onChange({ ...schema, items })}
          label="List item"
        />
      )}
      {schema.type === 'object' && (
        <>
          {Object.entries(schema.properties ?? {}).map(([name, field]) => (
            <div key={name}>
              <SchemaFields
                label={labelFor(name)}
                schema={field}
                base={base?.properties?.[name]}
                onChange={(next) =>
                  onChange({
                    ...schema,
                    properties: { ...schema.properties, [name]: next },
                  })
                }
              />
              {!base?.properties?.[name] && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    onChange({
                      ...schema,
                      properties: Object.fromEntries(
                        Object.entries(schema.properties ?? {}).filter(
                          ([k]) => k !== name,
                        ),
                      ),
                      required: schema.required?.filter((k) => k !== name),
                    })
                  }
                >
                  Remove {labelFor(name)}
                </button>
              )}
            </div>
          ))}
          <div className="field-grid">
            <label>
              New field key
              <input
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="e.g. education"
              />
            </label>
            <label>
              New field type
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as FieldSchema['type'])
                }
              >
                {['string', 'number', 'boolean', 'object', 'array'].map(
                  (item) => (
                    <option key={item}>{item}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="secondary"
            disabled={
              !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) ||
              Object.hasOwn(schema.properties ?? {}, key)
            }
            onClick={() => {
              onChange({
                ...schema,
                properties: { ...schema.properties, [key]: definition(type) },
              })
              setKey('')
            }}
          >
            Add field definition
          </button>
        </>
      )}
    </fieldset>
  )
}
