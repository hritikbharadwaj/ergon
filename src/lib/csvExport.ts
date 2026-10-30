// Lightweight CSV export — converts an array of plain objects to a downloadable CSV.
const escape = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function downloadCsv(filename: string, rows: Record<string, unknown>[], columns?: string[]) {
  if (!rows.length) {
    const blob = new Blob(['(no data)'], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, filename);
    return;
  }
  const cols = columns ?? Array.from(
    rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set<string>())
  );
  const header = cols.map(escape).join(',');
  const body = rows.map(r => cols.map(c => escape(r[c])).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}