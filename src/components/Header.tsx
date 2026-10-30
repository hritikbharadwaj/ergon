import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { roleNames } from '@/types/auth';
import { LogOut, Mail, User } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';

const Header: React.FC = () => {
  const { user, adminProfile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    navigate('/dashboard');
  };

  const handleLogoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate('/dashboard');
    }
  };

  return (
    <header
      role="banner"
      className="sticky top-0 z-50 w-full border-b border-slate-700/30 bg-gradient-to-r from-black via-slate-900/10 to-black shadow-2xl backdrop-blur-md"
      style={{
        boxShadow: '0 4px 20px rgba(71, 85, 105, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Company Name */}
          <div
            role="button"
            tabIndex={0}
            onClick={handleLogoClick}
            onKeyDown={handleLogoKeyDown}
            aria-label="Go to Ergon Dashboard"
            className="flex items-center space-x-2 sm:space-x-3 min-w-0 group cursor-pointer transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg px-1 py-1"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-500 to-slate-600 rounded-full blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-500" />
              <div className="text-xl font-bold tracking-[0.18em] text-foreground">ERGON</div>
            </div>
            <div className="flex-shrink-0">
              <div
                className="text-lg sm:text-2xl font-extrabold tracking-wide bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-400 text-transparent bg-clip-text group-hover:from-cyan-100 group-hover:via-sky-200 group-hover:to-blue-300 transition-all duration-300"
                style={{ fontFamily: "'Nixmat', sans-serif" }}
              >
                Ergon
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 hidden sm:block group-hover:text-purple-400 transition-colors duration-300">
                People & Operations
              </p>
            </div>
          </div>

          {/* User Menu or Login Prompt */}
          {user && adminProfile ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg hover:bg-white/5 text-white/70 hover:text-white"
                aria-label="Open messages and communications"
                onClick={() => navigate('/dashboard/email')}
              >
                <Mail className="h-[18px] w-[18px]" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    aria-label="User navigation profile menu"
                    className="relative h-8 sm:h-10 w-auto px-1 sm:px-3 hover:bg-slate-800/20 transition-all duration-300 group border border-transparent hover:border-slate-600/30 rounded-lg"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-white group-hover:text-accent transition-colors duration-300">
                          {adminProfile.name}
                        </p>
                        <p className="text-xs text-gray-400 group-hover:text-purple-300 transition-colors duration-300">
                          {roleNames[adminProfile.role]}
                        </p>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-500 to-slate-600 rounded-full blur-md opacity-0 group-hover:opacity-30 transition-opacity duration-500" />
                        <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border border-slate-600/30 group-hover:border-slate-600 transition-all duration-300 relative">
                          <AvatarImage
                            src={adminProfile.avatar || undefined}
                            alt={adminProfile.name}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-gradient-to-br from-slate-700 to-slate-800 text-white text-xs font-bold">
                            {adminProfile.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-black/95 border-slate-700/30 shadow-2xl backdrop-blur-md">
                  <div className="px-2 py-1.5 border-b border-slate-700/20">
                    <p className="text-sm font-medium text-white">{adminProfile.name}</p>
                    <p className="text-xs text-gray-400">{adminProfile.email}</p>
                    <p className="text-xs text-slate-400 font-medium">{roleNames[adminProfile.role]}</p>
                  </div>
                  <DropdownMenuItem
                    className="hover:bg-slate-800/50 cursor-pointer"
                    onClick={() => navigate('/dashboard/settings')}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Account Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-700/20" />
                  <DropdownMenuItem
                    className="hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-all duration-200 cursor-pointer"
                    onClick={logout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => (window.location.href = '/login')}
                className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
