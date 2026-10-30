import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, FileDown, Calendar as CalendarIcon } from 'lucide-react';
import { differenceInCalendarDays, format } from 'date-fns';
import { PERIOD_LABELS, periodToRange, THEME_LABELS, type PdfPeriod, type PdfTheme } from '@/lib/pdfReport';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  onGenerate: (
    range: { from: Date; to: Date },
    period: PdfPeriod,
    theme: PdfTheme,
  ) => Promise<void> | void;
}

const PERIODS: PdfPeriod[] = ['1m', '3m', '4m', '6m', 'custom'];
const THEMES: { id: PdfTheme; swatch: string[] }[] = [
  { id: 'classic', swatch: ['#0066FF', '#FF9900', '#F5F7FB'] },
  { id: 'dark', swatch: ['#6366F1', '#EC4899', '#0F1226'] },
  { id: 'minimal', swatch: ['#111111', '#787878', '#FAFAFA'] },
];

const PdfExportDialog: React.FC<Props> = ({ open, onOpenChange, title, description, onGenerate }) => {
  const [period, setPeriod] = useState<PdfPeriod>('1m');
  const today = useMemo(() => new Date(), []);
  const [customFrom, setCustomFrom] = useState<Date | undefined>(today);
  const [customTo, setCustomTo] = useState<Date | undefined>(today);
  const [theme, setTheme] = useState<PdfTheme>('classic');
  const [busy, setBusy] = useState(false);

  const effectiveRange = useMemo(() => {
    if (period === 'custom') {
      if (!customFrom || !customTo) return null;
      return { from: customFrom, to: customTo };
    }
    return periodToRange(period);
  }, [period, customFrom, customTo]);

  const dayCount = effectiveRange
    ? Math.max(1, differenceInCalendarDays(effectiveRange.to, effectiveRange.from) + 1)
    : 0;

  const run = async () => {
    if (!effectiveRange) return;
    if (Number.isNaN(effectiveRange.from.getTime()) || Number.isNaN(effectiveRange.to.getTime())) return;
    setBusy(true);
    try {
      await onGenerate(effectiveRange, period, theme);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Time range</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`rounded-md border px-2 py-2 text-xs font-medium transition-all ${
                    period === p
                      ? 'border-primary bg-primary/15 text-primary shadow-[0_0_0_1px_hsl(var(--primary))]'
                      : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  }`}
                >
                  {PERIOD_LABELS[p].replace('Last ', '')}
                </button>
              ))}
            </div>
          </div>

          {period === 'custom' && (
            <div className="grid grid-cols-2 gap-3 animate-fade-in">
              <div>
                <Label className="text-xs text-muted-foreground">Start date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !customFrom && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customFrom ? format(customFrom, 'dd MMM yyyy') : 'Pick start'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={(d) => d && setCustomFrom(d)}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !customTo && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customTo ? format(customTo, 'dd MMM yyyy') : 'Pick end'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={(d) => d && setCustomTo(d)}
                      disabled={(d) => (customFrom ? d < customFrom : false)}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Theme selector */}
          <div>
            <Label className="text-sm text-muted-foreground">Report theme</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`group rounded-md border p-2 text-left transition-all ${
                    theme === t.id
                      ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex gap-1 mb-1.5">
                    {t.swatch.map((c) => (
                      <span
                        key={c}
                        className="h-4 w-4 rounded-sm border border-black/10"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="text-xs font-medium text-foreground">{THEME_LABELS[t.id]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Live preview */}
          {effectiveRange && (
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Selected range preview
                  </div>
                  <div className="mt-1 text-sm font-semibold text-foreground">
                    {format(effectiveRange.from, 'dd MMM yyyy')} → {format(effectiveRange.to, 'dd MMM yyyy')}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {dayCount} day{dayCount === 1 ? '' : 's'} · {THEME_LABELS[theme]} theme
                  </div>
                </div>
                <div className="flex gap-1">
                  {THEMES.find((t) => t.id === theme)!.swatch.map((c) => (
                    <span
                      key={c}
                      className="h-6 w-6 rounded-md border border-black/10 shadow-sm"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
            Output is a branded, multi-section PDF with KPIs, full tables and per-section summaries.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy || !effectiveRange} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PdfExportDialog;