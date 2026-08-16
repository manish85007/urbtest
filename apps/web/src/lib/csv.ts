export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  downloadCsvGrid(
    filename,
    headers,
    rows.map((r) =>
      headers.map((h) => {
        const v = r[h];
        return typeof v === 'number' ? v : String(v ?? '');
      }),
    ),
  );
}

export function downloadCsvGrid(filename: string, head: string[], rows: Array<Array<string | number>>) {
  if (!head.length) return;
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
