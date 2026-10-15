type ParamValue = string | number | boolean | undefined | null;

export function queryString(params: object): string {
  const entries = Object.entries(params as Record<string, ParamValue>).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  const search = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `?${search}`;
}
