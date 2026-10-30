import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileBottomNav from '@/components/MobileBottomNav';

const DASHBOARD_SCROLL_KEY = 'scroll:/dashboard';

interface ModuleLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

const ModuleLayout: React.FC<ModuleLayoutProps> = ({
  title,
  description,
  children,
  actions
}) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleBackToDashboard = () => {
    // Step-by-step back — go to the previous route instead of jumping home.
    // Fall back to the dashboard if there is no history entry (e.g. deep link).
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="container mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-full overflow-x-hidden">
      {/* Header — pill back button + big title, matching reference */}
      <div
        className="flex items-start justify-between mb-8 gap-4"
        style={{ animation: 'fadeInDown 0.6s ease-out' }}
      >
        <div className="flex items-start gap-5 sm:gap-6 min-w-0">
          <Button
            onClick={handleBackToDashboard}
            className="shrink-0 h-11 sm:h-12 px-4 sm:px-5 rounded-xl bg-[#0d0d0d] hover:bg-[#141414] text-white border border-white/10 hover:border-white/20 font-medium text-sm sm:text-base gap-2 transition-all duration-300"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <div className="min-w-0 pt-0.5">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-none">
              {title}
            </h1>
            {description && (
              <p className="text-sm sm:text-lg text-white/50 mt-2 sm:mt-3 line-clamp-2">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center space-x-2 shrink-0 pt-1">
            {actions}
          </div>
        )}
      </div>

      {/* Content — clean, no wrapper card so section matches the dark reference layout */}
      <div style={{ animation: 'fadeInUp 0.6s ease-out 0.1s backwards' }} className="overflow-x-auto">
        {children}
      </div>

      {/* Mobile bottom nav on all module pages */}
      {isMobile && <div className="pb-20"><MobileBottomNav /></div>}
    </div>
  );
};

export default ModuleLayout;
