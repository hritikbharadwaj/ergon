import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Loader2 as Loader, MapPin, Mail, ArrowLeft, Heart, CheckCircle2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  checkGeolocationAccess,
  getGeolocationErrorMessage,
  requestGeolocation,
  setGeolocationGrantedFlag,
} from '@/utils/geolocation';

type LoginStep = 'location' | 'email' | 'otp';

// ─── OTP Cell ────────────────────────────────────────────────────────────────

interface OtpCellProps {
  value: string;
  focused: boolean;
  loading: boolean;
  loadingProgress: number; // 0..1 rotating arc
  verified: boolean;
  mergeProgress: number;   // 0..1 cells collapsing
  cellIndex: number;
  totalCells: number;
  inputRef: React.RefObject<HTMLInputElement>;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const OtpCell: React.FC<OtpCellProps> = ({
  value,
  focused,
  loading,
  loadingProgress,
  mergeProgress,
  cellIndex,
  totalCells,
  inputRef,
  onFocus,
  onKeyDown,
  onChange,
}) => {
  const hasValue = value.length > 0;
  const ORANGE = '#ff8a3d';

  // During merge, cells slide toward center and shrink
  const centerIndex = (totalCells - 1) / 2;
  const distFromCenter = cellIndex - centerIndex;
  const translateX = -distFromCenter * mergeProgress * 60;
  const scale = 1 - mergeProgress * 0.08;

  return (
    <div
      style={{
        position: 'relative',
        transform: `translateX(${translateX}px) scale(${scale})`,
        transition: mergeProgress > 0 ? 'none' : 'transform 0.18s ease',
        zIndex: 10,
      }}
    >
      {/* Orange glow under focused cell */}
      {focused && !loading && mergeProgress === 0 && (
        <div
          style={{
            position: 'absolute',
            inset: '-4px',
            borderRadius: '18px',
            background: `radial-gradient(ellipse at center, ${ORANGE}33 0%, transparent 70%)`,
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* SVG spinning border arc (loading state) */}
      {loading && (
        <svg
          style={{
            position: 'absolute',
            inset: '-2px',
            width: 'calc(100% + 4px)',
            height: 'calc(100% + 4px)',
            borderRadius: '16px',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
          viewBox="0 0 66 66"
        >
          <rect
            x="1" y="1" width="64" height="64" rx="14" ry="14"
            fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2"
          />
          <rect
            x="1" y="1" width="64" height="64" rx="14" ry="14"
            fill="none"
            stroke={ORANGE}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={`${0.28 * 256} ${256}`}
            strokeDashoffset={`${-(loadingProgress * 256)}`}
            style={{ transition: 'stroke-dashoffset 0ms linear' }}
          />
        </svg>
      )}

      {/* Cell body */}
      <div
        style={{
          width: '62px',
          height: '62px',
          borderRadius: '14px',
          background: '#1e1e22',
          border: `2px solid ${
            loading
              ? 'rgba(255,255,255,0.06)'
              : focused
              ? ORANGE
              : 'rgba(255,255,255,0.10)'
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'border-color 0.18s ease',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Hidden real input */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          maxLength={1}
          value={value}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          onChange={onChange}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            width: '100%',
            height: '100%',
            cursor: 'text',
            fontSize: '26px',
          }}
          autoComplete="one-time-code"
        />

        {/* Display: digit or blinking cursor */}
        {hasValue ? (
          <span
            key={value}
            style={{
              color: '#fff',
              fontSize: '26px',
              fontWeight: 700,
              lineHeight: 1,
              animation: 'otpDigitPop 0.16s ease',
              fontFamily: 'monospace',
            }}
          >
            {value}
          </span>
        ) : focused ? (
          <BlinkingCursor />
        ) : null}
      </div>
    </div>
  );
};

// ─── Blinking cursor ──────────────────────────────────────────────────────────

const BlinkingCursor: React.FC = () => (
  <div
    style={{
      width: '2px',
      height: '28px',
      borderRadius: '1px',
      background: '#fff',
      animation: 'otpCursorBlink 0.6s ease-in-out infinite alternate',
    }}
  />
);

// ─── Success checkmark ────────────────────────────────────────────────────────

const SuccessCheckmark: React.FC<{ progress: number }> = ({ progress }) => {
  const scale = Math.max(0, progress);
  return (
    <div
      style={{
        width: '66px',
        height: '66px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${scale})`,
        opacity: progress,
        transition: 'none',
      }}
    >
      <svg viewBox="0 0 66 66" width="66" height="66">
        <rect x="1" y="1" width="64" height="64" rx="14" ry="14"
          fill="#0f2418"
          stroke="rgba(74,222,128,0.8)"
          strokeWidth="2"
        />
        <path
          d="M20 34 L29 43 L46 24"
          fill="none"
          stroke="#fff"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 40,
            strokeDashoffset: Math.max(0, 40 - progress * 40),
            transition: 'stroke-dashoffset 0.4s ease',
          }}
        />
      </svg>
    </div>
  );
};

// ─── Custom OTP Input Row ─────────────────────────────────────────────────────

const OTP_LENGTH = 6;

interface CustomOtpInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete: (val: string) => void;
  disabled?: boolean;
}

const CustomOtpInput: React.FC<CustomOtpInputProps & {
  phase: 'idle' | 'loading' | 'merging' | 'success';
  loadingProgress: number;
  mergeProgress: number;
  successProgress: number;
}> = ({ value, onChange, onComplete, disabled, phase, loadingProgress, mergeProgress, successProgress }) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRefs = useRef<Array<React.RefObject<HTMLInputElement>>>(
    Array.from({ length: OTP_LENGTH }, () => React.createRef<HTMLInputElement>())
  );

  // Auto-focus first empty cell
  useEffect(() => {
    if (!disabled) {
      const firstEmpty = Math.min(value.length, OTP_LENGTH - 1);
      const idx = value.length < OTP_LENGTH ? value.length : OTP_LENGTH - 1;
      setTimeout(() => inputRefs.current[idx]?.current?.focus(), 50);
    }
  }, []);

  const handleFocus = (index: number) => setFocusedIndex(index);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) return;

    // Handle paste of full code
    if (raw.length > 1) {
      const newVal = (value + raw).slice(0, OTP_LENGTH);
      onChange(newVal);
      const nextFocus = Math.min(newVal.length, OTP_LENGTH - 1);
      inputRefs.current[nextFocus]?.current?.focus();
      setFocusedIndex(nextFocus);
      if (newVal.length === OTP_LENGTH) onComplete(newVal);
      return;
    }

    const newVal = (value.slice(0, index) + raw + value.slice(index + 1)).slice(0, OTP_LENGTH);
    onChange(newVal);

    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.current?.focus();
      setFocusedIndex(index + 1);
    } else {
      inputRefs.current[index]?.current?.blur();
    }

    if (newVal.length === OTP_LENGTH) onComplete(newVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[index]) {
        const newVal = value.slice(0, index) + '' + value.slice(index + 1);
        onChange(newVal);
      } else if (index > 0) {
        const newVal = value.slice(0, index - 1) + '' + value.slice(index);
        onChange(newVal);
        inputRefs.current[index - 1]?.current?.focus();
        setFocusedIndex(index - 1);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.current?.focus();
      setFocusedIndex(index - 1);
    } else if (e.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.current?.focus();
      setFocusedIndex(index + 1);
    }
  };

  const isLoading = phase === 'loading';
  const isMerging = phase === 'merging' || phase === 'success';
  const isSuccess = phase === 'success';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '90px', position: 'relative' }}>
      {/* Merged success state */}
      {isSuccess || (isMerging && mergeProgress > 0.85) ? (
        <div style={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: isSuccess ? 'none' : `blur(${(1 - successProgress) * 6}px)`,
        }}>
          <SuccessCheckmark progress={successProgress} />
        </div>
      ) : null}

      {/* OTP cells */}
      <div style={{
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
        opacity: isMerging && mergeProgress > 0.6 ? Math.max(0, 1 - (mergeProgress - 0.6) / 0.4) : 1,
        filter: isMerging ? `blur(${mergeProgress * 14}px)` : 'none',
        transition: isMerging ? 'none' : 'opacity 0.2s',
      }}>
        {Array.from({ length: OTP_LENGTH }).map((_, i) => {
          // separator dot between index 2 and 3
          return (
            <React.Fragment key={i}>
              {i === 3 && (
                <div style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: 'rgba(167,139,250,0.7)',
                  flexShrink: 0,
                  marginBottom: '0',
                }} />
              )}
              <OtpCell
                value={value[i] || ''}
                focused={focusedIndex === i && !disabled && !isMerging}
                loading={isLoading}
                loadingProgress={loadingProgress}
                verified={isSuccess}
                mergeProgress={isMerging ? mergeProgress : 0}
                cellIndex={i}
                totalCells={OTP_LENGTH}
                inputRef={inputRefs.current[i]}
                onFocus={() => handleFocus(i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onChange={(e) => handleChange(e, i)}
              />
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

type OtpPhase = 'idle' | 'loading' | 'merging' | 'success';

const RoleBasedLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<LoginStep>('location');
  const [isLoading, setIsLoading] = useState(false);
  const { user, session, loginWithOTP } = useAuth();
  const { toast } = useToast();

  const [locationGranted, setLocationGranted] = useState(false);
  const [locationChecking, setLocationChecking] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // OTP animation state
  const [otpPhase, setOtpPhase] = useState<OtpPhase>('idle');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [mergeProgress, setMergeProgress] = useState(0);
  const [successProgress, setSuccessProgress] = useState(0);
  const [cardSuccess, setCardSuccess] = useState(false);

  const loadingRafRef = useRef<number | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // ── Geolocation ──
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLocationChecking(true);
      setLocationError(null);
      const result = await checkGeolocationAccess({ attemptPosition: false });
      if (cancelled) return;
      if (result.allowed) {
        setLocationGranted(true);
        setGeolocationGrantedFlag(true);
        setStep('email');
      } else {
        setLocationGranted(false);
        if (result.state === 'denied') {
          setLocationError(result.message || 'Location is blocked in your browser settings.');
        }
      }
      setLocationChecking(false);
    };
    run();
    return () => { cancelled = true; };
  }, []);

  // Auto-focus email input on email step
  useEffect(() => {
    if (step === 'email') {
      setTimeout(() => emailInputRef.current?.focus(), 150);
    }
  }, [step]);

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  if (user && session) return <Navigate to="/dashboard" replace />;

  // ── OTP animation pipeline ──
  const runOtpAnimation = useCallback(async () => {
    // Phase 1: spinning arc (1.7s)
    setOtpPhase('loading');
    setLoadingProgress(0);
    const start = performance.now();
    const duration = 1700;

    await new Promise<void>((resolve) => {
      const animate = (now: number) => {
        const elapsed = now - start;
        const t = (elapsed % duration) / duration;
        setLoadingProgress(t);
        if (elapsed < duration) {
          loadingRafRef.current = requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      loadingRafRef.current = requestAnimationFrame(animate);
    });

    // Phase 2: merge cells (750ms)
    setOtpPhase('merging');
    setMergeProgress(0);
    const mergeStart = performance.now();
    const mergeDuration = 750;

    await new Promise<void>((resolve) => {
      const animate = (now: number) => {
        const t = Math.min((now - mergeStart) / mergeDuration, 1);
        // ease-in-quad
        setMergeProgress(t * t);
        if (t < 1) requestAnimationFrame(animate);
        else resolve();
      };
      requestAnimationFrame(animate);
    });

    // Phase 3: success pop (600ms)
    setCardSuccess(true);
    setOtpPhase('success');
    setSuccessProgress(0);

    const successStart = performance.now();
    const successDuration = 600;

    await new Promise<void>((resolve) => {
      const animate = (now: number) => {
        const t = Math.min((now - successStart) / successDuration, 1);
        // elastic out approximation
        const elastic = t === 0 ? 0 : t === 1 ? 1
          : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
        setSuccessProgress(Math.max(0, elastic));
        if (t < 1) requestAnimationFrame(animate);
        else resolve();
      };
      requestAnimationFrame(animate);
    });
  }, []);

  // ── Location ──
  const handleRequestLocation = async () => {
    setLocationChecking(true);
    setLocationError(null);
    try {
      await requestGeolocation({ enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
      setLocationGranted(true);
      setGeolocationGrantedFlag(true);
      setStep('email');
      toast({ title: 'Location enabled', description: 'You can now sign in.' });
    } catch (err: any) {
      setLocationGranted(false);
      setGeolocationGrantedFlag(false);
      const msg = getGeolocationErrorMessage(err);
      setLocationError(msg);
      toast({ title: 'Location required', description: msg, variant: 'destructive' });
    } finally {
      setLocationChecking(false);
    }
  };

  // ── Send OTP ──
  const handleSendOTP = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!email) {
      toast({ title: 'Error', description: 'Please enter your email', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', { body: { email } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStep('otp');
      setResendCooldown(60);
      // Reset animation state
      setOtpPhase('idle');
      setLoadingProgress(0);
      setMergeProgress(0);
      setSuccessProgress(0);
      setCardSuccess(false);
      setOtp('');
      toast({ title: 'OTP Sent', description: 'Verification code sent to your registered email' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send OTP', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Verify OTP ──
  const handleVerifyOTP = async (val?: string) => {
    const code = val || otp;
    if (code.length !== 6) {
      toast({ title: 'Error', description: 'Please enter the complete 6-digit OTP', variant: 'destructive' });
      return;
    }
    if (otpPhase !== 'idle') return;
    setIsLoading(true);

    // Start animation immediately (don't await API yet)
    const animPromise = runOtpAnimation();

    try {
      await loginWithOTP(email, code);
      await animPromise;
      // Small pause so user sees the success
      await new Promise(r => setTimeout(r, 600));
      toast({ title: 'Success', description: 'Logged in successfully!' });
    } catch (error: any) {
      // Cancel animation if verification fails
      if (loadingRafRef.current) cancelAnimationFrame(loadingRafRef.current);
      setOtpPhase('idle');
      setLoadingProgress(0);
      setMergeProgress(0);
      setSuccessProgress(0);
      setCardSuccess(false);
      toast({ title: 'Verification Failed', description: error.message || 'Invalid OTP', variant: 'destructive' });
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpComplete = (val: string) => {
    setOtp(val);
    handleVerifyOTP(val);
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    await handleSendOTP();
  };

  const handleBack = () => {
    if (step === 'otp') {
      if (loadingRafRef.current) cancelAnimationFrame(loadingRafRef.current);
      setStep('email');
      setOtp('');
      setOtpPhase('idle');
      setLoadingProgress(0);
      setMergeProgress(0);
      setSuccessProgress(0);
      setCardSuccess(false);
    }
  };

  const cardGlowColor = cardSuccess
    ? 'rgba(74,222,128,0.30)'
    : 'rgba(139,92,246,0.20)';

  const cardBg = cardSuccess
    ? 'rgba(13,31,20,0.88)'
    : 'rgba(0,0,0,0.72)';

   return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Character Background Image with Blinking Effect - Centered and Larger */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div 
          className="w-full h-full max-w-6xl max-h-6xl background-image-blink"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(34,211,238,.12), transparent 42%), linear-gradient(135deg, #05080d, #0b1420)',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: 0.25,
          }}
        ></div>
      </div>

      {/* Enhanced Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Rotating gradient orbs with blue-purple theme */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl animate-[spin_20s_linear_infinite]"></div>
        <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-600/15 to-indigo-600/15 rounded-full blur-3xl animate-[spin_25s_linear_infinite_reverse]"></div>
        <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-gradient-to-r from-indigo-500/25 to-cyan-500/25 rounded-full blur-3xl animate-[spin_15s_linear_infinite]"></div>
        
        {/* Enhanced floating animation orbs */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-2xl animate-[bounce_3s_ease-in-out_infinite] energy-glow"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-2xl animate-[bounce_4s_ease-in-out_infinite] energy-glow" style={{ animationDelay: '1s' }}></div>
        
        {/* Enhanced pulsating rings */}
        <div className="absolute top-1/3 right-1/3 w-80 h-80 border border-blue-400/20 rounded-full animate-ping"></div>
        <div className="absolute bottom-1/3 left-1/3 w-60 h-60 border border-purple-400/20 rounded-full animate-ping" style={{ animationDelay: '2s' }}></div>
        
        {/* Enhanced moving gradient lines */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent animate-[slide-in-right_4s_ease-in-out_infinite]"></div>
          <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent animate-[slide-in-right_5s_ease-in-out_infinite]" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-[slide-in-right_6s_ease-in-out_infinite]" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent animate-[slide-in-right_7s_ease-in-out_infinite]" style={{ animationDelay: '3s' }}></div>
        </div>
        
        {/* Enhanced diagonal moving lines */}
        <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-blue-400/25 to-transparent animate-[slide-down_8s_ease-in-out_infinite]"></div>
        <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-purple-400/25 to-transparent animate-[slide-down_9s_ease-in-out_infinite]" style={{ animationDelay: '2s' }}></div>
        
        {/* Enhanced floating particles with increased quantity and faster movement */}
        {Array.from({ length: 120 }, (_, i) => (
          <div
            key={i}
            className={`absolute rounded-full ${
              i % 5 === 0 ? 'w-2 h-2 bg-blue-400/50 floating-particles-fast' : 
              i % 5 === 1 ? 'w-1 h-1 bg-purple-400/50 floating-particles' : 
              i % 5 === 2 ? 'w-3 h-3 bg-cyan-400/40 floating-particles-medium' : 
              i % 5 === 3 ? 'w-1.5 h-1.5 bg-indigo-400/45 floating-particles-fast' :
              'w-2.5 h-2.5 bg-pink-400/35 floating-particles'
            }`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
            }}
          ></div>
        ))}
        
        {/* Enhanced morphing shapes with movement */}
        <div className="absolute top-20 right-20 w-20 h-20 bg-gradient-to-r from-blue-500/15 to-purple-500/15 rounded-full animate-morph energy-glow"></div>
        <div className="absolute bottom-20 left-20 w-16 h-16 bg-gradient-to-r from-purple-500/15 to-cyan-500/15 rounded-lg animate-morph energy-glow" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute top-1/2 right-1/4 w-12 h-12 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 rounded-full animate-morph energy-glow" style={{ animationDelay: '3s' }}></div>
        <div className="absolute bottom-1/3 left-1/3 w-18 h-18 bg-gradient-to-r from-indigo-500/15 to-pink-500/15 rounded-lg animate-morph energy-glow" style={{ animationDelay: '4.5s' }}></div>
        
        {/* Additional energy effects */}
        <div className="absolute top-1/2 left-10 w-4 h-4 bg-blue-400/60 rounded-full animate-ping" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute top-1/3 right-10 w-3 h-3 bg-purple-400/60 rounded-full animate-ping" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute bottom-1/4 left-1/2 w-5 h-5 bg-cyan-400/60 rounded-full animate-ping" style={{ animationDelay: '2.5s' }}></div>
      </div>
      
      <div className="w-full max-w-md mx-auto space-y-6 relative z-10 pt-20">
        {/* Logo/Header with enhanced faster animation */}
        <div className="text-center">
          <div
            className="text-4xl font-extrabold tracking-wide text-transparent bg-clip-text"
            style={{ 
              fontFamily: "'Nixmat', sans-serif",
              backgroundImage: 'linear-gradient(90deg, #f97316 0%, #ec4899 50%, #3b82f6 100%)',
              backgroundSize: '100%',
            }}
          >
            Ergon
          </div>
          <p className="text-muted-foreground mt-2 text-lg typewriter">Admin Dashboard Access</p>
        </div>

          {/* ── STEP: Location ── */}
          {step === 'location' && !locationGranted ? (
            <div className="relative w-full max-w-md">
              {/* Animated background elements */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="animate-gradient-shift w-full h-full" style={{
                  background: 'linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.03) 50%, transparent)',
                  backgroundSize: '200% 200%',
                }}>
                  <div className="absolute inset-0" style={{
                    background: 'radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.1) 0%, transparent 20%)',
                    backgroundRepeat: 'no-repeat',
                  }}/>
                  <div className="absolute inset-0" style={{
                    background: 'radial-gradient(circle at 80% 70%, rgba(234, 179, 8, 0.1) 0%, transparent 20%)',
                    backgroundRepeat: 'no-repeat',
                  }}/>
                </div>
              </div>

              <Card className="w-full glass-effect-dark backdrop-blur-lg border border-white/10 shadow-[0_0_30px_rgba(59,130,246,0.1)] animate-scale-in">
                <CardHeader className="space-y-4 text-center pt-10 pb-6">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full" style={{
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(234,179,8,0.2) 100%)',
                    }}/>
                    <div className="relative rounded-full w-full h-full flex items-center justify-center bg-black/60 backdrop-blur" style={{
                      border: '1px solid rgba(59,130,246,0.3)',
                    }}>
                      <MapPin className="w-10 h-10 text-white/90 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold tracking-tight text-white bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent"
                    style={{ fontFamily: "'Nixmat', sans-serif", letterSpacing: '-0.5px' }}
                  >
                    Ergon
                  </h3>
                  <p className="text-sm text-muted-foreground/80">
                    Admin Dashboard
                  </p>
                </CardHeader>

                <CardContent className="space-y-6 pb-8">
                  <div className="space-y-5 text-center">
                    <h3 className="font-semibold text-white text-lg">Location Access Required</h3>
                    <p className="text-muted-foreground/70 max-w-xl">
                      For enhanced security, we require location access to verify admin login attempts. This helps protect your account from unauthorized access.
                    </p>
                  </div>

                  {locationError && (
                    <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                      <AlertTriangle className="w-5 h-5 text-destructive/80 shrink-0 mt-0.5" />
                      <div className="text-sm text-destructive">{locationError}</div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <Button
                      className="w-full gradient-primary hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02]"
                      onClick={handleRequestLocation}
                      disabled={locationChecking}
                    >
                      {locationChecking ? (
                        <>
                          <Loader className="mr-3 h-4 w-4 animate-spin" />
                          <span className="flex-1">Verifying Location...</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="mr-3 h-4 w-4" />
                          <span className="flex-1">Grant Location Access</span>
                        </>
                      )}
                    </Button>

                    <div className="text-xs text-muted-foreground/60">
                      By continuing, you agree to our{' '}
                      <Link to="/security-policy" className="text-blue-400 hover:text-blue-300 underline">
                        Security Policy
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )
          : step === 'email' ? (
            <div className="relative w-full max-w-md">
              {/* Animated background elements */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="animate-gradient-shift w-full h-full" style={{
                  background: 'linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.03) 50%, transparent)',
                  backgroundSize: '200% 200%',
                }}>
                  <div className="absolute inset-0" style={{
                    background: 'radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.1) 0%, transparent 20%)',
                    backgroundRepeat: 'no-repeat',
                  }}/>
                  <div className="absolute inset-0" style={{
                    background: 'radial-gradient(circle at 80% 70%, rgba(234, 179, 8, 0.1) 0%, transparent 20%)',
                    backgroundRepeat: 'no-repeat',
                  }}/>
                </div>
              </div>

              <Card className="w-full glass-effect-dark backdrop-blur-lg border border-white/10 shadow-[0_0_30px_rgba(59,130,246,0.1)] animate-scale-in">
                <CardHeader className="space-y-4 text-center pt-10 pb-6">
                  <div className="relative w-24 h-24 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full" style={{
                      background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(234,179,8,0.2) 100%)',
                    }}/>
                    <div className="relative rounded-full w-full h-full flex items-center justify-center bg-black/60 backdrop-blur" style={{
                      border: '1px solid rgba(59,130,246,0.3)',
                    }}>
                      <Mail className="w-8 h-8 text-white/90 drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold tracking-tight text-white bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent"
                    style={{ fontFamily: "'Nixmat', sans-serif", letterSpacing: '-0.5px' }}
                  >
                    Sign In with OTP
                  </h3>
                  <p className="text-sm text-muted-foreground/80 max-w-xl">
                    Enter your admin email to receive a one-time password
                  </p>
                </CardHeader>

                <CardContent className="space-y-6 pb-8">
                  <div className="flex items-center gap-2 text-xs text-green-400 justify-center mb-4">
                    <MapPin className="w-3 h-3" />
                    <span>Location access granted</span>
                  </div>

                  <form onSubmit={handleSendOTP} className="space-y-5">
                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-muted-foreground/60 text-sm font-medium">Email</Label>
                      <div className="relative">
                        <Input
                          id="email"
                          ref={emailInputRef}
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your admin email"
                          className={"email-input-typewriter bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-transparent focus:ring-2 focus:ring-blue-400 focus:ring-outline/20 transition-all duration-300 hover:border-white/20 text-lg"}
                          required
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSendOTP();
                            }
                          }}
                          style={{
                            caretColor: '#a78bfa',
                          }}
                        />
                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                          {email.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setEmail('')}
                              className="text-muted-foreground/50 hover:text-muted-foreground/70 transition-colors duration-200"
                            >
                              <MapPin className="w-4 h-4" /> {/* Using MapPin as a clear icon */}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className={"w-full gradient-primary hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02]"}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader className="mr-3 h-4 w-4 animate-spin" />
                          <span className="flex-1">Sending OTP...</span>
                        </>
                      ) : (
                        <>
                          <Mail className="mr-3 h-4 w-4" />
                          <span className="flex-1">Send Verification Code</span>
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

          /* ── STEP: OTP ── */
          ) : (
            <div className="relative w-full max-w-md">
              {/* Animated background elements */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="animate-gradient-shift w-full h-full" style={{
                  background: 'linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.03) 50%, transparent)',
                  backgroundSize: '200% 200%',
                }}>
                  <div className="absolute inset-0" style={{
                    background: 'radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.1) 0%, transparent 20%)',
                    backgroundRepeat: 'no-repeat',
                  }}/>
                  <div className="absolute inset-0" style={{
                    background: 'radial-gradient(circle at 80% 70%, rgba(234, 179, 8, 0.1) 0%, transparent 20%)',
                    backgroundRepeat: 'no-repeat',
                  }}/>
                </div>
              </div>

              <Card
                className={`w-full glass-effect-dark backdrop-blur-lg border border-white/10 shadow-[0_0_30px_rgba(59,130,246,0.1)] ${cardSuccess ? 'otp-card-success' : ''}`}
                style={{
                  background: cardBg,
                  boxShadow: cardSuccess
                    ? `0 0 60px 12px ${cardGlowColor}`
                    : undefined,
                  borderColor: cardSuccess ? 'rgba(74,222,128,0.30)' : undefined,
                  transition: 'background 0.6s ease, box-shadow 0.6s ease, border-color 0.6s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <CardContent className="pt-6 pb-8">
                  <div className="space-y-6">
                    {/* Back button — hidden during animation */}
                    {otpPhase === 'idle' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleBack}
                        className="text-muted-foreground/60 hover:text-white/80 hover:bg-white/5 -ml-2 transition-all duration-200"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                      </Button>
                    )}

                    {/* Header */}
                    <div className="text-center mb-4" style={{ minHeight: '90px', position: 'relative' }}>
                      {/* Default header — fades out on success */}
                      <div style={{
                        opacity: otpPhase === 'success' ? 0 : 1,
                        transform: otpPhase === 'success' ? 'translateY(-8px)' : 'translateY(0)',
                        transition: 'opacity 0.25s ease, transform 0.25s ease',
                        position: otpPhase === 'success' ? 'absolute' : 'relative',
                        width: '100%',
                      }}>
                        <div className="relative w-20 h-20 mx-auto mb-4">
                          <div className="absolute inset-0 rounded-full" style={{
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(234,179,8,0.1) 100%)',
                          }}/>
                          <div className="relative rounded-full w-full h-full flex items-center justify-center bg-black/60 backdrop-blur" style={{
                            border: '1px solid rgba(59,130,246,0.2)',
                          }}>
                            <img src="/ergon-mark.svg" alt="Ergon" className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-white bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent"
                          style={{ fontFamily: "'Nixmat', sans-serif", letterSpacing: '-0.5px' }}
                        >
                          Verify OTP
                        </h3>
                        <p className="text-sm text-muted-foreground/80 max-w-xl">
                          Enter the 6-digit code sent to{' '}
                          <span className="text-blue-400 font-medium">{email}</span>
                        </p>
                      </div>

                      {/* Success header — slides in */}
                      <div style={{
                        opacity: otpPhase === 'success' ? successProgress : 0,
                        transform: otpPhase === 'success'
                          ? `translateY(${(1 - successProgress) * -16}px)`
                          : 'translateY(-16px)',
                        transition: 'none',
                        position: otpPhase === 'success' ? 'relative' : 'absolute',
                        width: '100%',
                      }}>
                        <div className="flex flex-col items-center gap-3">
                          <div className="relative w-16 h-16 mx-auto mb-3">
                            <div className="absolute inset-0 rounded-full" style={{
                              background: 'linear-gradient(135deg, rgba(74,222,128,0.1) 0%, rgba(74,222,128,0.2) 100%)',
                            }}/>
                            <div className="relative rounded-full w-full h-full flex items-center justify-center bg-black/60 backdrop-blur" style={{
                              border: '1px solid rgba(74,222,128,0.2)',
                            }}>
                            <CheckCircle2
                              className="w-8 h-8 text-green-400"
                              style={{
                                filter: 'drop-shadow(0 0 8px rgba(74,222,128,0.4))',
                                transform: `scale(${otpPhase === 'success' ? successProgress : 0})`,
                                transition: 'none',
                              }}
                            />
                            </div>
                          </div>
                          <h3 className="text-xl font-bold text-white bg-gradient-to-r from-green-400 to-green-500 bg-clip-text text-transparent"
                            style={{ fontFamily: "'Nixmat', sans-serif" }}
                          >
                            Verified!
                          </h3>
                          <p className="text-sm text-green-400/80 max-w-md">
                            Access granted. Redirecting…
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ── Custom OTP boxes ── */}
                    <div className="space-y-4">
                      <CustomOtpInput
                        value={otp}
                        onChange={setOtp}
                        onComplete={handleOtpComplete}
                        disabled={otpPhase !== 'idle'}
                        phase={otpPhase}
                        loadingProgress={loadingProgress}
                        mergeProgress={mergeProgress}
                        successProgress={successProgress}
                      />
                    </div>

                    {/* Verify button — hidden during animation */}
                    {otpPhase === 'idle' && (
                      <div className="space-y-4">
                        <Button
                          type="button"
                          className={"w-full gradient-primary hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02]"}
                          onClick={() => handleVerifyOTP()}
                          disabled={isLoading || otp.length !== 6}
                        >
                          {isLoading ? (
                            <>
                              <Loader className="mr-3 h-4 w-4 animate-spin" />
                              <span className="flex-1">Verifying...</span>
                            </>
                          ) : (
                            <>
                              <Shield className="mr-3 h-4 w-4" />
                              <span className="flex-1">Verify & Sign In</span>
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Resend section — hidden during animation */}
                    {otpPhase === 'idle' && (
                      <div className="space-y-4">
                        <p className="text-center text-sm text-muted-foreground/60">
                          Didn't receive the code?
                        </p>
                        {resendCooldown > 0 ? (
                          <div className="space-y-3">
                            <Button
                              disabled
                              className="w-full max-w-xs mx-auto rounded-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-800/20 to-blue-700/15 border border-white/5 text-white cursor-not-allowed shadow-inner hover:opacity-90"
                            >
                              <span className="text-sm">
                                Resend OTP in <span className="font-semibold">{resendCooldown}s</span>
                              </span>
                            </Button>
                            <div className="w-full max-w-xs h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-blue-400"
                                style={{
                                  width: `${(resendCooldown / 60) * 100}%`,
                                  transition: 'width 1s linear',
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            onClick={handleResendOTP}
                            className="w-full max-w-xs mx-auto rounded-full bg-gradient-to-r from-purple-600 to-blue-500 text-white px-6 py-2 shadow-lg hover:scale-105 hover:shadow-2xl transition-transform duration-200"
                          >
                            Resend OTP
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-muted-foreground text-sm animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <span className="flex justify-center items-center gap-2">
              <span>Secure admin access for</span>
              <span
                className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 text-transparent bg-clip-text"
                style={{ fontFamily: "'Nixmat', sans-serif" }}
              >
                Ergon
              </span>
              <span>Admins</span>
            </span>
          </div>

          <div className="text-center text-muted-foreground text-sm animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center justify-center gap-3 mt-6">
              <span className="text-lg text-foreground font-normal" style={{ fontFamily: 'taberna' }}>A</span>
              <span
                className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 text-transparent bg-clip-text"
                style={{ fontFamily: "'Merlin', cursive" }}
              >
                misterutsav
              </span>
              <span className="text-lg text-foreground font-normal" style={{ fontFamily: 'taberna' }}>PRODUCT</span>
              <Heart className="h-4 w-4 text-destructive fill-destructive animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    
  );
};

export default RoleBasedLogin;
