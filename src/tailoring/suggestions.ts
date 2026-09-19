import { BadRequestException } from '@nestjs/common';
import type { ResumeData, JsonValue } from '../contracts/resume-schema';
export interface Suggestion {
  id: string;
  label: string;
  before: string;
  after: string;
}
export function suggestions(
  source: ResumeData,
  proposal: ResumeData,
): Suggestion[] {
  const result: Suggestion[] = [];
  function walk(before: JsonValue, after: JsonValue, path: string) {
    if (
      typeof before === 'string' &&
      typeof after === 'string' &&
      before !== after &&
      /^(\/basics\/summary|\/professionalSummary|\/(work|workExperience)\/\d+\/highlights\/\d+)$/.test(
        path,
      )
    ) {
      const parts = path.split('/');
      const label =
        path.endsWith('Summary') || path.endsWith('/summary')
          ? 'Professional summary'
          : `Experience ${Number(parts[2]) + 1} · Highlight ${Number(parts[4]) + 1}`;
      result.push({ id: path, label, before, after });
    } else if (
      before &&
      after &&
      typeof before === 'object' &&
      typeof after === 'object'
    ) {
      for (const [key, value] of Object.entries(before)) {
        if (Object.hasOwn(after, key))
          walk(
            value,
            (after as Record<string, JsonValue>)[key],
            `${path}/${key}`,
          );
      }
    }
  }
  walk(source, proposal, '');
  return result;
}
export function applySuggestions(
  source: ResumeData,
  proposal: ResumeData,
  selected: string[],
) {
  const changes = suggestions(source, proposal);
  if (
    new Set(selected).size !== selected.length ||
    selected.some((id) => !changes.some((change) => change.id === id))
  )
    throw new BadRequestException('Select valid suggestions from this version');
  const result = structuredClone(source);
  for (const change of changes.filter((item) => selected.includes(item.id))) {
    const keys = change.id.slice(1).split('/');
    let parent: JsonValue = result;
    for (const key of keys.slice(0, -1))
      parent = (parent as Record<string, JsonValue>)[key];
    (parent as Record<string, JsonValue>)[keys.at(-1)!] = change.after;
  }
  return result;
}
