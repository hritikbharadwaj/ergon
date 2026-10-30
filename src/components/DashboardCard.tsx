import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useButtonClickSound } from '@/hooks/useButtonClickSound';

interface DashboardCardProps {
  title: string;
  description: string;
  iconSrc: string;
  onClick: () => void;
  badge?: string;
  isDisabled?: boolean;
  stats?: {
    label: string;
    value: string | number;
  }[];
  gradient?: string;
  glowColor?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  description,
  iconSrc,
  onClick,
  badge,
  isDisabled = false,
  stats = [],
}) => {
  const { playClickSound } = useButtonClickSound();
  const [isHovered, setIsHovered] = React.useState(false);
  
  const handleClick = () => {
    if (!isDisabled) {
      playClickSound();
      onClick();
    }
  };
  
  return (
    <Card 
      className={`
        relative overflow-hidden group
        bg-black
        border border-white/15
        transition-all duration-300 ease-out
        ${!isDisabled ? 'cursor-pointer hover:border-white/30 hover:shadow-lg hover:shadow-white/5' : 'opacity-40 cursor-not-allowed'}
      `}
      style={{
        boxShadow: !isDisabled ? '0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Subtle warm accent — barely visible until hover */}
      <div
        className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 70%)' }}
      />

      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between mb-4">
          {/* Icon */}
          <div className="relative">
            <img 
              src={iconSrc} 
              alt={title} 
              className="h-16 w-16 object-contain transition-all duration-400 ease-out group-hover:scale-105 group-hover:drop-shadow-md"
              style={{
                filter: isHovered ? 'brightness(1.08) contrast(1.05)' : 'brightness(1) contrast(1)',
              }}
            />
          </div>
          
          {badge && (
            <Badge 
              className="bg-gradient-to-r from-slate-600 to-slate-700 text-white border-0 shadow-md font-bold px-3 py-1 relative overflow-hidden"
              style={{
                animation: 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
              }}
            >
              <span className="relative z-10">{badge}</span>
            </Badge>
          )}
        </div>
        
        <h3 className="text-base font-bold mb-1.5 text-white group-hover:text-slate-100 transition-colors duration-300">
          {title}
        </h3>
        <p className="text-sm text-slate-400 mb-4 leading-snug line-clamp-2 group-hover:text-slate-300 transition-colors duration-300">
          {description}
        </p>
        
        {stats.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {stats.map((stat, index) => (
              <div 
                key={index} 
                className="p-2.5 rounded-lg bg-white/[0.03] backdrop-blur-sm border border-white/10 group-hover:border-white/20 transition-all duration-300"
                style={{
                  animation: isHovered ? `slideInUp 0.4s ease-out ${0.08 * index}s both` : 'none'
                }}
              >
                <p className="text-[11px] text-white/50 mb-0.5 font-medium uppercase tracking-wide">{stat.label}</p>
                <p className="text-sm font-semibold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        )}
        
        {/* Golden Hour pill — ~85% black base, crisp white border, ~15% warm flash on the right */}
        <Button
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDisabled) {
              playClickSound();
              onClick();
            }
          }}
          className="w-full h-10 rounded-xl border border-white/25 text-white font-medium tracking-wide transition-all duration-300 hover:border-white/40 active:scale-[0.98] relative overflow-hidden"
          style={{
            background:
              'linear-gradient(90deg, #0a0a0a 0%, #0a0a0a 70%, rgba(201,168,76,0.55) 92%, rgba(240,215,140,0.85) 100%)',
            boxShadow:
              '0 4px 14px -6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            Open
            <span className="inline-block group-hover:translate-x-0.5 transition-transform duration-300">→</span>
          </span>
        </Button>
      </CardContent>
    </Card>
  );
};

export default DashboardCard;
