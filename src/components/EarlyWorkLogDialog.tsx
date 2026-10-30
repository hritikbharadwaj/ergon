import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, Lock } from 'lucide-react';
import { isCheckoutWindow, minutesUntilCheckout, getIndiaNow, workLogWindowLabel } from '@/lib/timeWindow';
import { useTimeWindows } from '@/hooks/useTimeWindows';

interface Props {
  open: boolean;
  onClose: () => void;
  /** kept for API compat, but the dialog now blocks early entry. */
  onContinueAnyway?: () => void;
}

const EarlyWorkLogDialog: React.FC<Props> = ({ open, onClose }) => {
  useTimeWindows();
  const inWindow = isCheckoutWindow();
  const mins = minutesUntilCheckout();
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  const now = getIndiaNow();
  const windowLabel = workLogWindowLabel();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md border border-white/10 bg-black p-0 overflow-hidden">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 220, damping: 22 }}
              className="relative p-6"
            >
              {/* Auth-style orbs */}
              <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full bg-[#5B8DEF]/30 blur-3xl" />
              <div className="absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-[#E94CC4]/25 blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full bg-[#A06CFF]/20 blur-3xl" />

              <DialogHeader className="relative">
                <div className="mb-4 flex items-center justify-center">
                  <motion.div
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity }}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-gradient-to-br from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4] shadow-[0_0_40px_rgba(160,108,255,0.45)]"
                  >
                    {inWindow ? (
                      <CheckCircle2 className="h-8 w-8 text-white" />
                    ) : (
                      <Lock className="h-8 w-8 text-white" />
                    )}
                  </motion.div>
                </div>
                    <DialogTitle className="text-center text-xl text-white">
                  {inWindow ? 'Checkout Window is Live' : 'Work Log Locked'}
                </DialogTitle>
              </DialogHeader>

              <div className="relative mt-4 space-y-4 text-sm">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  {inWindow ? (
                    <p className="text-white/85">
                      You're inside the official window ({windowLabel}). Submitting your work log now will also save your <strong>checkout attendance</strong>.
                    </p>
                  ) : (
                    <>
                      <p className="text-white/85">
                        Work log can <strong>only</strong> be submitted between
                        <span className="mx-1 rounded bg-white/10 px-1.5 py-0.5 font-mono bg-gradient-to-r from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4] bg-clip-text text-transparent font-semibold">{windowLabel}</span>
                        , from a <strong>desktop/laptop only</strong>.
                      </p>
                      <p className="mt-2 text-xs text-white/60 flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        Current IST <span className="font-mono text-white/90">{now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                        {' · '}Opens in <span className="font-mono text-white/90">{hours > 0 ? `${hours}h ` : ''}{remMins}m</span>
                      </p>
                    </>
                  )}
                </div>

                <Button
                  className="w-full bg-gradient-to-r from-[#5B8DEF] via-[#A06CFF] to-[#E94CC4] text-white font-semibold hover:opacity-95"
                  onClick={onClose}
                >
                  {inWindow ? 'Continue to log' : 'Back to Dashboard'}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};

export default EarlyWorkLogDialog;