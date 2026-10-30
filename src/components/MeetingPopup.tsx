import React, { useState, useEffect } from 'react';
import { useMeeting } from '@/contexts/MeetingContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface MeetingPopupProps {
  onClose?: () => void;
}

const MeetingPopup: React.FC<MeetingPopupProps> = ({ onClose }) => {
  const { currentMeeting, isLive, meetingLink } = useMeeting();
  const { user } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Only show popup if user is logged in AND meeting is live
    setShowPopup(isLive && !!user);
  }, [isLive, user]);

  const handleJoin = () => {
    if (meetingLink) {
      window.open(meetingLink, '_blank');
    }
  };

  const handleClose = () => {
    setShowPopup(false);
    onClose?.();
  };

  return (
    <>
      {/* Mobile Popup - Full Screen Locked with Join Button Only */}
      {isMobile && showPopup && currentMeeting && user && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-sm">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-gray-600/40 rounded-2xl overflow-hidden shadow-2xl">
                {/* Content */}
                <div className="p-8 space-y-6 text-center">
                  {/* Live Indicator */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-70 animate-pulse" />
                      <div className="relative h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <h1 className="text-4xl font-bold text-white mb-2">
                      {currentMeeting.title}
                    </h1>
                    <p className="text-white/90 text-lg font-semibold">
                      Meeting is LIVE
                    </p>
                  </div>

                  {/* Meeting Time */}
                  <div className="bg-gray-700/20 border border-gray-600/30 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-2">Scheduled Until</p>
                    <p className="text-3xl font-bold text-white">
                      {currentMeeting.end_time}
                    </p>
                  </div>

                  {/* Join Button */}
                  <Button
                    onClick={handleJoin}
                    data-track="meeting_join"
                    data-track-label="Mobile Popup Join Meeting Now"
                    data-meeting-id={currentMeeting.id}
                    className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold text-lg py-4 rounded-lg transition-all duration-200"
                  >
                    Join Meeting Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Desktop Popup - Compact with Close and Later Options */}
      {!isMobile && showPopup && currentMeeting && user && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={handleClose} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-md">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-gray-600/40 rounded-2xl overflow-hidden shadow-2xl">
                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="absolute top-3 right-3 z-20 p-2 hover:bg-white/10 rounded-lg transition-all hover:scale-110 active:scale-95"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>

                {/* Content */}
                <div className="p-6 space-y-4">
                  {/* Live Indicator */}
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-70 animate-pulse" />
                      <div className="relative h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                    </div>
                    <span className="text-sm font-bold text-red-400 uppercase tracking-wide">
                      Meeting Live Now
                    </span>
                  </div>

                  {/* Title */}
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">
                      {currentMeeting.title}
                    </h2>
                    {currentMeeting.description && (
                      <p className="text-sm text-gray-400">
                        {currentMeeting.description}
                      </p>
                    )}
                  </div>

                  {/* Meeting Time */}
                  <div className="bg-gray-700/20 border border-gray-600/30 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Scheduled Until</p>
                    <p className="text-lg font-semibold text-white">
                      {currentMeeting.end_time}
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleJoin}
                      data-track="meeting_join"
                      data-track-label="Desktop Popup Join Now"
                      data-meeting-id={currentMeeting.id}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg transition-all duration-200"
                    >
                      Join Now
                    </Button>
                    <Button
                      onClick={handleClose}
                      variant="outline"
                      className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800/50 font-semibold py-2 rounded-lg transition-all duration-200"
                    >
                      Later
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Persistent Meeting Indicator - Always Shows When Meeting is Live (Desktop Only) */}
      {!isMobile && isLive && currentMeeting && user && (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="bg-gradient-to-br from-red-600/40 via-slate-600/30 to-red-700/40 border border-red-500/40 rounded-2xl p-4 backdrop-blur-lg shadow-lg shadow-red-600/30">
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-70 animate-pulse" />
                <div className="relative h-3 w-3 bg-red-500 rounded-full animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-red-300 truncate">
                  {currentMeeting.title}
                </p>
                <p className="text-xs text-red-200/70">
                  Ends at {currentMeeting.end_time}
                </p>
              </div>
              {!showPopup && (
                <button
                  onClick={() => setShowPopup(true)}
                  data-track="meeting_join_indicator"
                  data-track-label="Persistent Indicator Join"
                  data-meeting-id={currentMeeting.id}
                  className="flex-shrink-0 bg-red-600/50 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-red-600/40"
                >
                  Join
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </>
  );
};

export default MeetingPopup;
