const aliases: Record<string, string> = {
  NAME: 'PII_NAME',
  FULLNAME: 'PII_NAME',
  FIRSTNAME: 'PII_NAME',
  LASTNAME: 'PII_NAME',
  PERSON: 'PII_NAME',
  EMAIL: 'PII_EMAIL',
  EMAILADDRESS: 'PII_EMAIL',
  PHONE: 'PII_PHONE',
  PHONENUMBER: 'PII_PHONE',
  TELEPHONE: 'PII_PHONE',
  TELEPHONENUMBER: 'PII_PHONE',
  MOBILE: 'PII_PHONE',
  MOBILENUMBER: 'PII_PHONE',
  CONTACTNUMBER: 'PII_PHONE',
  LOCATION: 'PII_LOCATION',
  ADDRESS: 'PII_LOCATION',
  HOMEADDRESS: 'PII_LOCATION',
  POSTALADDRESS: 'PII_LOCATION',
  CITY: 'PII_LOCATION',
};
const decoration = 'PII|REDACTED|REMOVED|HIDDEN|MASKED|ANONYMISED|ANONYMIZED';
function marker(label: string): string | undefined {
  const key = label
    .toUpperCase()
    .replace(/[\s_-]+/g, '')
    .replace(new RegExp(`^(?:(?:${decoration}))+`), '')
    .replace(new RegExp(`(?:(?:${decoration}))+$`), '');
  return Object.hasOwn(aliases, key) ? aliases[key] : undefined;
}
// Only explicit placeholders are normalized. Ordinary resume prose stays intact;
// ambiguous/unknown placeholders are retained for the user to edit.
export function normalizeRedactionMarkers(text: string): string {
  const bracketed = text.replace(
    /\[([a-zA-Z][a-zA-Z _-]{0,79})\]|<([a-zA-Z][a-zA-Z _-]{0,79})>|\{([a-zA-Z][a-zA-Z _-]{0,79})\}|\(([a-zA-Z][a-zA-Z _-]{0,79})\)/g,
    (
      whole: string,
      square: string,
      angle: string,
      brace: string,
      round: string,
    ) => marker(square ?? angle ?? brace ?? round) ?? whole,
  );
  return bracketed.replace(
    new RegExp(
      `\\b(?:(?:${decoration})[_-][a-zA-Z_-]+|[a-zA-Z]+(?:[_-][a-zA-Z]+)*[_-](?:${decoration}))\\b`,
      'gi',
    ),
    (whole) => marker(whole) ?? whole,
  );
}
