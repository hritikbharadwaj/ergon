import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import MeetingService from '@/services/MeetingService';
import { MeetingInfoResponse } from '@/types/meeting';

interface MeetingContextType {
  currentMeeting: MeetingInfoResponse | null;
  isLive: boolean;
  loading: boolean;
  refreshMeeting: () => Promise<void>;
  toggleMeeting: (action: 'start' | 'end') => Promise<boolean>;
  meetingLink: string | null;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

interface MeetingProviderProps {
  children: React.ReactNode;
  roomName?: string;
}

export const MeetingProvider: React.FC<MeetingProviderProps> = ({
  children,
  roomName = 'Daily Standup',
}) => {
  const [currentMeeting, setCurrentMeeting] = useState<MeetingInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMeeting = useCallback(async () => {
    try {
      const meeting = await MeetingService.getMeetingInfo(roomName);
      setCurrentMeeting(meeting);
    } catch (error) {
      console.error('Error refreshing meeting:', error);
    }
  }, [roomName]);

  const toggleMeeting = useCallback(
    async (action: 'start' | 'end'): Promise<boolean> => {
      try {
        const result = await MeetingService.toggleMeeting(roomName, action);
        if (result) {
          await refreshMeeting();
          return true;
        }
        return false;
      } catch (error) {
        console.error('Error toggling meeting:', error);
        return false;
      }
    },
    [roomName, refreshMeeting]
  );

  // Initial load
  useEffect(() => {
    refreshMeeting().finally(() => setLoading(false));
  }, [refreshMeeting]);

  // Poll for updates every 10 seconds to catch status changes
  useEffect(() => {
    const interval = setInterval(refreshMeeting, 10000);
    return () => clearInterval(interval);
  }, [refreshMeeting]);

  // Real-time subscription for manual toggles
  useEffect(() => {
    const subscription = MeetingService.getAllMeetings().then((meetings) => {
      const meeting = meetings.find((m) => m.room_name === roomName);
      if (meeting) {
        setCurrentMeeting(meeting);
      }
    });

    return () => {
      // Cleanup if needed
    };
  }, [roomName]);

  const isLive = currentMeeting?.status === 'LIVE';
  const meetingLink = currentMeeting?.meet_link || null;

  return (
    <MeetingContext.Provider
      value={{
        currentMeeting,
        isLive,
        loading,
        refreshMeeting,
        toggleMeeting,
        meetingLink,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
};

export const useMeeting = (): MeetingContextType => {
  const context = useContext(MeetingContext);
  if (!context) {
    throw new Error('useMeeting must be used within MeetingProvider');
  }
  return context;
};
