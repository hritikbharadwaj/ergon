import { useCallback, useRef, useEffect } from 'react';

// Shared audio context for button click sounds
let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
  } catch {
    return null;
  }
};

export const useButtonClickSound = () => {
  const hasUserInteracted = useRef(false);
  
  // Initialize audio context on user interaction
  useEffect(() => {
    const handleInteraction = () => {
      hasUserInteracted.current = true;
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(console.warn);
      }
    };
    
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleInteraction, { once: true, passive: true });
    });
    
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleInteraction);
      });
    };
  }, []);
  
  const playClickSound = useCallback(async () => {
    try {
      const ctx = getAudioContext();
      
      if (!ctx) return;
      
      // Resume context if suspended
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (e) {
          console.warn('Failed to resume audio context:', e);
          return;
        }
      }
      
      if (ctx.state !== 'running') return;
      
      // Minimal, soft "tap" — a single mellow sine blip through a low-pass filter.
      // Quiet, warm, and satisfying — no harsh high-frequency click.
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      // Gentle mid-range pitch that quickly settles
      osc.type = 'sine';
      osc.frequency.setValueAtTime(720, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);

      // Low-pass to strip any sharp edges
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.Q.setValueAtTime(0.7, now);

      // Very quiet, smooth attack + short decay
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.1);

      osc.start(now);
      osc.stop(now + 0.12);
      
    } catch (error) {
      console.warn('Could not play click sound:', error);
    }
  }, []);
  
  return { playClickSound };
};

export default useButtonClickSound;
