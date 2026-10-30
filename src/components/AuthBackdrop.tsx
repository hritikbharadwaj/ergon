import React from 'react';

/**
 * Floating-orb backdrop matching the auth screen.
 * Pure black bg + soft blue/violet/pink blurred orbs + tiny dot constellation.
 */
const AuthBackdrop: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-black ${className}`}>
    {/* Large soft orbs */}
    <div className="absolute -top-32 -left-40 h-[520px] w-[520px] rounded-full bg-[#1e2a4d] opacity-60 blur-[120px]" />
    <div className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-[#3a1f55] opacity-60 blur-[120px]" />
    <div className="absolute bottom-0 left-1/4 h-[420px] w-[420px] rounded-full bg-[#4a1a3d] opacity-60 blur-[120px]" />
    {/* Tiny constellation dots */}
    <div className="absolute inset-0 opacity-[0.18]"
      style={{
        backgroundImage:
          'radial-gradient(circle at 12% 18%, #6aa9ff 1.5px, transparent 2px),' +
          'radial-gradient(circle at 78% 24%, #b07cff 1.2px, transparent 2px),' +
          'radial-gradient(circle at 32% 70%, #ff7cc2 1.5px, transparent 2px),' +
          'radial-gradient(circle at 64% 82%, #6aa9ff 1.2px, transparent 2px),' +
          'radial-gradient(circle at 88% 58%, #b07cff 1.4px, transparent 2px),' +
          'radial-gradient(circle at 18% 52%, #ff7cc2 1.1px, transparent 2px)',
      }}
    />
    {/* Subtle grid */}
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:40px_40px]" />
  </div>
);

export default AuthBackdrop;