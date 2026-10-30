import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { format } from 'date-fns';

export type PdfPeriod = '1m' | '3m' | '4m' | '6m' | 'custom';
export type PdfTheme = 'classic' | 'dark' | 'minimal';

export const THEME_LABELS: Record<PdfTheme, string> = {
  classic: 'Classic',
  dark: 'Dark Gradient',
  minimal: 'Minimal',
};

export const PERIOD_LABELS: Record<PdfPeriod, string> = {
  '1m': 'Last 1 Month',
  '3m': 'Last 3 Months',
  '4m': 'Last 4 Months',
  '6m': 'Last 6 Months',
  custom: 'Custom Range',
};

export const periodToRange = (period: Exclude<PdfPeriod, 'custom'>): { from: Date; to: Date } => {
  const to = new Date();
  const from = new Date();
  const months = { '1m': 1, '3m': 3, '4m': 4, '6m': 6 }[period];
  from.setMonth(from.getMonth() - months);
  return { from, to };
};

export interface ReportSection {
  title: string;
  subtitle?: string;
  head: string[][];
  body: RowInput[];
  summary?: { label: string; value: string }[];
}

export interface BuildReportOptions {
  title: string;
  subtitle?: string;
  range: { from: Date; to: Date };
  generatedBy?: string;
  sections: ReportSection[];
  /** Top KPI cards rendered under the header */
  kpis?: { label: string; value: string }[];
  theme?: PdfTheme;
}

type RGB = [number, number, number];
interface ThemeTokens {
  primary: RGB;
  accent: RGB;
  ink: RGB;
  muted: RGB;
  soft: RGB;
  line: RGB;
  headerBand: RGB;
  headerText: RGB;
  tableHeadFill: RGB;
  tableHeadText: RGB;
}

const THEMES: Record<PdfTheme, ThemeTokens> = {
  classic: {
    primary: [0, 102, 255],
    accent: [255, 153, 0],
    ink: [20, 22, 28],
    muted: [110, 116, 130],
    soft: [245, 247, 251],
    line: [225, 229, 238],
    headerBand: [0, 102, 255],
    headerText: [255, 255, 255],
    tableHeadFill: [20, 22, 28],
    tableHeadText: [255, 255, 255],
  },
  dark: {
    primary: [99, 102, 241],
    accent: [236, 72, 153],
    ink: [240, 244, 255],
    muted: [148, 163, 184],
    soft: [30, 33, 53],
    line: [55, 60, 90],
    headerBand: [15, 18, 38],
    headerText: [240, 244, 255],
    tableHeadFill: [40, 44, 70],
    tableHeadText: [240, 244, 255],
  },
  minimal: {
    primary: [17, 17, 17],
    accent: [120, 120, 120],
    ink: [17, 17, 17],
    muted: [120, 120, 120],
    soft: [250, 250, 250],
    line: [225, 225, 225],
    headerBand: [255, 255, 255],
    headerText: [17, 17, 17],
    tableHeadFill: [240, 240, 240],
    tableHeadText: [17, 17, 17],
  },
};

const drawHeader = (doc: jsPDF, opts: BuildReportOptions, BRAND: ThemeTokens) => {
  const w = doc.internal.pageSize.getWidth();
  // top brand band
  doc.setFillColor(...BRAND.headerBand);
  doc.rect(0, 0, w, 28, 'F');
  doc.setFillColor(...BRAND.accent);
  doc.rect(0, 28, w, 2, 'F');

  doc.setTextColor(...BRAND.headerText);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Ergon', 14, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Admin Operations · Report', 14, 20);

  doc.setFontSize(8);
  doc.text(
    `Generated ${format(new Date(), 'dd MMM yyyy · HH:mm')}`,
    w - 14,
    13,
    { align: 'right' },
  );
  doc.text(
    `Range ${format(opts.range.from, 'dd MMM yyyy')} – ${format(opts.range.to, 'dd MMM yyyy')}`,
    w - 14,
    20,
    { align: 'right' },
  );

  // title block
  doc.setTextColor(...BRAND.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(opts.title, 14, 44);
  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.muted);
    doc.text(opts.subtitle, 14, 51);
  }
};

const drawFooter = (doc: jsPDF, BRAND: ThemeTokens) => {
  const pageCount = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...BRAND.line);
    doc.setLineWidth(0.3);
    doc.line(14, h - 14, w - 14, h - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text('Confidential · Ergon Admin Suite', 14, h - 8);
    doc.text(`Page ${i} / ${pageCount}`, w - 14, h - 8, { align: 'right' });
  }
};

const drawKpis = (doc: jsPDF, kpis: { label: string; value: string }[], y: number, BRAND: ThemeTokens): number => {
  if (!kpis.length) return y;
  const w = doc.internal.pageSize.getWidth();
  const margin = 14;
  const gap = 4;
  const cardW = (w - margin * 2 - gap * (kpis.length - 1)) / kpis.length;
  const cardH = 22;
  kpis.forEach((k, i) => {
    const x = margin + i * (cardW + gap);
    doc.setFillColor(...BRAND.soft);
    doc.setDrawColor(...BRAND.line);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text(k.label.toUpperCase(), x + 4, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BRAND.ink);
    doc.text(k.value, x + 4, y + 16);
  });
  return y + cardH + 6;
};

const drawSectionHeading = (doc: jsPDF, section: ReportSection, y: number, BRAND: ThemeTokens): number => {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND.primary);
  doc.rect(14, y, 3, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.ink);
  doc.text(section.title, 20, y + 6);
  if (section.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.muted);
    doc.text(section.subtitle, w - 14, y + 6, { align: 'right' });
  }
  return y + 12;
};

export const buildReport = (opts: BuildReportOptions): jsPDF => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const BRAND = THEMES[opts.theme ?? 'classic'];
  drawHeader(doc, opts, BRAND);
  let y = 58;
  if (opts.kpis?.length) y = drawKpis(doc, opts.kpis, y, BRAND);

  opts.sections.forEach((section, idx) => {
    if (idx > 0) y += 4;
    if (y > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      drawHeader(doc, opts, BRAND);
      y = 58;
    }
    y = drawSectionHeading(doc, section, y, BRAND);
    autoTable(doc, {
      startY: y,
      head: section.head,
      body: section.body,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 2.5,
        textColor: BRAND.ink,
        lineColor: BRAND.line,
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: BRAND.tableHeadFill,
        textColor: BRAND.tableHeadText,
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: { fillColor: BRAND.soft },
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error autotable adds lastAutoTable
    y = doc.lastAutoTable.finalY + 4;

    if (section.summary?.length) {
      doc.setFillColor(...BRAND.soft);
      doc.setDrawColor(...BRAND.line);
      doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 12, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.muted);
      const parts = section.summary.map((s) => `${s.label}: `);
      const pieceW = (doc.internal.pageSize.getWidth() - 28) / section.summary.length;
      section.summary.forEach((s, i) => {
        const x = 18 + i * pieceW;
        doc.setTextColor(...BRAND.muted);
        doc.setFont('helvetica', 'normal');
        doc.text(parts[i], x, y + 7.5);
        const labelW = doc.getTextWidth(parts[i]);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...BRAND.ink);
        doc.text(s.value, x + labelW, y + 7.5);
      });
      y += 16;
    }
  });

  drawFooter(doc, BRAND);
  return doc;
};

export const downloadReport = (doc: jsPDF, filename: string) => {
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
};