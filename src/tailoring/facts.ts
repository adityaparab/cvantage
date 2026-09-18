import type { JsonValue, ResumeData } from '../contracts/resume-schema';
function numbers(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)?/g) ?? [];
}
export function preservesFacts(
  source: ResumeData,
  proposal: ResumeData,
): boolean {
  function compare(before: JsonValue, after: JsonValue, key = ''): boolean {
    if (
      key === 'professionalSummary' &&
      typeof before === 'string' &&
      typeof after === 'string'
    )
      return numbers(after).every((value) =>
        numbers(JSON.stringify(source)).includes(value),
      );
    if (
      key === 'highlights' &&
      Array.isArray(before) &&
      Array.isArray(after) &&
      before.every((x) => typeof x === 'string') &&
      after.every((x) => typeof x === 'string')
    )
      return (
        before.length === after.length &&
        numbers(JSON.stringify(after)).every((value) =>
          numbers(JSON.stringify(before)).includes(value),
        )
      );
    if (Array.isArray(before))
      return (
        Array.isArray(after) &&
        before.length === after.length &&
        before.every((item, i) => compare(item, after[i]))
      );
    if (before && typeof before === 'object')
      return (
        !!after &&
        typeof after === 'object' &&
        !Array.isArray(after) &&
        Object.keys(before).length === Object.keys(after).length &&
        Object.entries(before).every(
          ([name, value]) =>
            Object.hasOwn(after, name) && compare(value, after[name], name),
        )
      );
    return before === after;
  }
  return compare(source, proposal);
}
