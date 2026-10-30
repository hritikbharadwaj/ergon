import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

type BackButtonProps = {
  to?: string;
  onClick?: () => void;
  label?: string;
  pageName?: string;
  className?: string;
};

const BackButton: React.FC<BackButtonProps> = ({
  to,
  onClick,
  label = 'Back',
  pageName,
  className = ''
}) => {
  const navigate = useNavigate();

  const handle = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    if (to) {
      navigate(to);
      return;
    }
    navigate(-1);
  };

  return (
    <div className={`flex items-center gap-3 mb-6 ${className}`}>
      <button
        type="button"
        onClick={handle}
        title={label}
        aria-label={label}
        className={`
          inline-flex items-center justify-center
          w-9 h-9
          rounded-lg
          bg-gradient-to-b from-[#021424] to-[#031826]
          border border-white/8
          text-white/90
          shadow-[0_4px_12px_rgba(2,6,23,0.5)]
          hover:bg-gradient-to-b hover:from-[#031825] hover:to-[#041927]
          hover:border-white/12
          transition-all duration-150 ease-out
          focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:ring-offset-1 focus:ring-offset-[#0a0f1a]
        `}
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2.5} />
      </button>

      {pageName && (
        <>
          <div className="w-px h-6 bg-white/10" />
          <h1 className="text-lg font-semibold text-white/95 tracking-tight">
            {pageName}
          </h1>
        </>
      )}
    </div>
  );
};

export default BackButton;