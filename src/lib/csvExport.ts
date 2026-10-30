/**
 * Lightweight and secure CSV export utility.
 * Handles CSV formula injection mitigation, proper escaping, and UTF-8 BOM encoding.
 */

export interface CsvExportOptions {
  filename: string;
  rows: Record<string, unknown>[];
  columns?: string[];
  columnLabels?: Record<string, string>;
}

/**
 * Escapes values and prevents CSV Injection (CWE-1236)
 * Prefixes potentially dangerous formula characters with a single quote.
 */
const sanitizeAndEscape = (v: unknown): string => {
  if (v === null || v === undefined) return '';

  let s: string;
  if (typeof v === 'object') {
    if (v instanceof Date) {
      s = v.toISOString();
    } else {
      try {
        s = JSON.stringify(v);
      } catch {
        s = String(v);
      }
    }
  } else {
    s = String(v);
  }

  // Prevent CSV Formula Injection in spreadsheet tools (Excel, Calc)
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }

  // Enclose in double quotes if it contains commas, double quotes, or newlines
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export function downloadCsv(
  filenameOrOptions: string | CsvExportOptions,
  rowsData?: Record<string, unknown>[],
  columnsList?: string[]
): void {
  let filename: string;
  let rows: Record<string, unknown>[];
  let columns: string[] | undefined;
  let columnLabels: Record<string, string> | undefined;

  if (typeof filenameOrOptions === 'object') {
    filename = filenameOrOptions.filename;
    rows = filenameOrOptions.rows;
    columns = filenameOrOptions.columns;
    columnLabels = filenameOrOptions.columnLabels;
  } else {
    filename = filenameOrOptions;
    rows = rowsData || [];
    columns = columnsList;
  }

  if (!rows || !rows.length) {
    const emptyBlob = new Blob(['\uFEFF(no data)'], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(emptyBlob, filename);
    return;
  }

  const cols =
    columns ??
    Array.from(
      rows.reduce((set, row) => {
        Object.keys(row).forEach((k) => set.add(k));
        return set;
      }, new Set<string>())
    );

  const header = cols.map((col) => sanitizeAndEscape(columnLabels?.[col] ?? col)).join(',');
  const body = rows
    .map((row) => cols.map((col) => sanitizeAndEscape(row[col])).join(','))
    .join('\r\n');

  // \uFEFF is UTF-8 Byte Order Mark for Excel recognition
  const blob = new Blob(['\uFEFF' + header + '\r\n' + body], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    console.error('Failed to trigger CSV download:', err);
  }
}
