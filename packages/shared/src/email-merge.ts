export function mergeTemplate(template: string, vars: Record<string, unknown>): string {
  return String(template || '').replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const val = vars[key];
    return val !== undefined && val !== null ? String(val) : match;
  });
}
