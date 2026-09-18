export interface FieldSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  title?: string;
  properties?: Record<string, FieldSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: FieldSchema;
  $schema?: string;
}
export function emptyValue(schema: FieldSchema): unknown {
  if (schema.type === 'object')
    return Object.fromEntries(
      Object.entries(schema.properties ?? {})
        .filter(([key]) => schema.required?.includes(key))
        .map(([key, field]) => [key, emptyValue(field)]),
    );
  return schema.type === 'array'
    ? []
    : schema.type === 'number'
      ? 0
      : schema.type === 'boolean'
        ? false
        : '';
}
export function labelFor(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase());
}
