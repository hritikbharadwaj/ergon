import React from 'react';

/**
 * Ergon — attendance review card, holiday state.
 *
 * This is the SAME card used everywhere else (avatar + name + role header,
 * Check-in / Check-out / Work log rows, action row at the bottom) — not a
 * separate design. On a holiday we just:
 *   1. Blur the check-in / check-out / work-log values (nothing to show)
 *   2. Grey out the status circles (present/absent doesn't apply)
 *   3. Add the diagonal "HOLIDAY" ribbon
 *   4. Replace the Present/Absent button row with a single green
 *      "Marked as Holiday" bar in that exact same slot — not a second
 *      card stacked underneath.
 */

interface HolidayCardProps {
  /** Admin's display name, e.g. adminProfile?.name */
  name?: string | null;
  /** Admin's role label, e.g. adminProfile?.role */
  role?: string | null;
  /** Admin's avatar image URL, e.g. adminProfile?.avatar */
  avatarUrl?: string | null;
  className?: string;
}

const getInitials = (name?: string | null) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '');
  return initials.join('') || '?';
};

const formatRole = (role?: string | null) => (role ? role.replace(/_/g, ' ') : '');

const Avatar: React.FC<{ name?: string | null; avatarUrl?: string | null }> = ({ name, avatarUrl }) => {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'Admin avatar'}
        className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-white/10"
      />
    );
  }
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff3b6f] to-[#c81452] text-lg font-black text-white ring-1 ring-white/10">
      {getInitials(name)}
    </div>
  );
};

const CheckInIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
    <path d="M3 12h13" />
    <path d="M12 8l4 4-4 4" />
  </svg>
);

const CheckOutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3" />
    <path d="M21 12H8" />
    <path d="M12 8l4 4-4 4" />
  </svg>
);

const WorkLogIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
    <path d="M9 13h6" />
    <path d="M9 17h6" />
  </svg>
);

const NeutralStatusDot = () => (
  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-600 text-gray-500">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  </div>
);

const BlurredValue = () => (
  <span className="select-none blur-[4px] text-sm font-medium tabular-nums text-white/50">09:15 AM</span>
);

const AttendanceRow: React.FC<{ icon: React.ReactNode; label: string; delay: number }> = ({ icon, label, delay }) => (
  <div
    className="thry-row flex items-center justify-between border-t border-gray-800 py-3 first:border-t-0"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-center gap-3 text-gray-400">
      {icon}
      <span className="text-base font-medium text-white">{label}</span>
    </div>
    <div className="flex items-center gap-3">
      <BlurredValue />
      <NeutralStatusDot />
    </div>
  </div>
);

const HolidayCard: React.FC<HolidayCardProps> = ({ name, role, avatarUrl, className }) => {
  return (
    <div
      className={`thry-card relative overflow-hidden rounded-2xl border border-gray-800 bg-[#0d0d0e] p-4 sm:p-6 ${className || ''}`}
    >
      <style>{`
        @keyframes thry-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes thry-ribbon-in { from { opacity: 0; transform: translateY(-14px) rotate(45deg); } to { opacity: 1; transform: translateY(0) rotate(45deg); } }
        @keyframes thry-glow-pulse {
          0%, 100% { box-shadow: 0 0 12px 1px rgba(61,220,132,0.4); }
          50% { box-shadow: 0 0 20px 4px rgba(61,220,132,0.7); }
        }
        @keyframes thry-bar-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(61,220,132,0); }
          50% { box-shadow: 0 0 24px 2px rgba(61,220,132,0.25); }
        }
        @keyframes thry-palm-sway {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        .thry-card { animation: thry-fade-up 0.45s ease both; }
        .thry-ribbon-inner { animation: thry-ribbon-in 0.55s cubic-bezier(0.22,1,0.36,1) both, thry-glow-pulse 2.6s ease-in-out infinite 0.55s; }
        .thry-row { animation: thry-fade-up 0.4s ease both; }
        .thry-bar { animation: thry-fade-up 0.4s ease both, thry-bar-glow 3s ease-in-out infinite 0.6s; }
        .thry-palm { display: inline-block; transform-origin: 70% 100%; animation: thry-palm-sway 3.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .thry-card, .thry-ribbon-inner, .thry-row, .thry-bar, .thry-palm { animation: none !important; }
        }
      `}</style>

      {/* Corner-ribbon: fixed-size box, independent of card width, so it never breaks on mobile */}
      <div className="pointer-events-none absolute -right-1 -top-1 z-20 h-28 w-28 overflow-hidden sm:h-32 sm:w-32">
        <div className="thry-ribbon-inner absolute right-[-42px] top-[22px] flex w-[170px] origin-center rotate-45 items-center justify-center gap-1.5 whitespace-nowrap border-y-2 border-[#3ddc84] bg-gradient-to-r from-[#0f3d24] via-[#1a6b3c] to-[#0f3d24] py-1 sm:right-[-46px] sm:top-[26px] sm:w-[195px] sm:py-1.5">
          <span className="thry-palm text-xs leading-none sm:text-sm">🌴</span>
          <span className="text-[9px] font-extrabold tracking-[0.18em] text-white sm:text-[11px] sm:tracking-[0.2em]">
            HOLIDAY
          </span>
          <span className="text-[10px] leading-none sm:text-xs">☀️</span>
        </div>
      </div>

      {/* Header — real admin identity */}
      <div className="relative z-10 mb-3 flex items-center gap-3">
        <Avatar name={name} avatarUrl={avatarUrl} />
        <div>
          <h2 className="text-lg font-bold text-white sm:text-xl">{name || 'Admin'}</h2>
          {role && <p className="text-sm text-gray-500">{formatRole(role)}</p>}
        </div>
      </div>

      {/* Rows — same structure as the normal review card, values blurred + status neutral */}
      <div className="relative z-10">
        <AttendanceRow icon={<CheckInIcon />} label="Check-in" delay={60} />
        <AttendanceRow icon={<CheckOutIcon />} label="Check-out" delay={120} />
        <AttendanceRow icon={<WorkLogIcon />} label="Work log" delay={180} />
      </div>

      {/* Where Present/Absent buttons normally sit — replaced in place with the holiday message */}
      <div
        className="thry-bar relative z-10 mt-4 flex items-center justify-center gap-3 rounded-xl border border-[#3ddc84]/30 bg-gradient-to-r from-[#123a24] to-[#0d2a1a] px-4 py-3"
        style={{ animationDelay: '240ms' }}
      >
        <span className="thry-palm text-xl leading-none">🌴</span>
        <div className="text-center">
          <p className="text-sm font-bold text-white sm:text-base">Marked as Holiday</p>
          <p className="text-xs text-[#8fe4ae] sm:text-sm">Enjoy your day off. See you next working day!</p>
        </div>
        <span className="text-lg leading-none">☀️</span>
      </div>
    </div>
  );
};

export default HolidayCard;