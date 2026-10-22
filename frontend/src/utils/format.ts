export function shortId(id?: string) {
  return id ? id.slice(0, 8) : '—';
}
export function date(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
export function percent(value?: number | null) {
  return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—';
}
export function duration(value?: number) {
  return typeof value === 'number'
    ? value < 60
      ? `${value.toFixed(1)}s`
      : `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`
    : '—';
}
export function bytes(value?: number) {
  return typeof value === 'number'
    ? value < 1024 * 1024
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1024 / 1024).toFixed(1)} MB`
    : '—';
}
export function title(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
