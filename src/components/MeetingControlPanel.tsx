import React, { useState } from 'react';
import { useMeeting } from '@/contexts/MeetingContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, RotateCw, Clock, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MeetingControlPanelProps {
  onStatusChange?: (status: string) => void;
}

const MeetingControlPanel: React.FC<MeetingControlPanelProps> = ({ onStatusChange }) => {
  const { currentMeeting, isLive, toggleMeeting, refreshMeeting, loading } = useMeeting();
  const [isToggling, setIsToggling] = useState(false);

  const handleStartMeeting = async () => {
    setIsToggling(true);
    try {
      const success = await toggleMeeting('start');
      if (success) {
        toast({ title: 'Meeting started!', description: 'Status changed to LIVE' });
        onStatusChange?.('LIVE');
      } else {
        toast({
          title: 'Error',
          description: 'Failed to start meeting',
          variant: 'destructive',
        });
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleEndMeeting = async () => {
    setIsToggling(true);
    try {
      const success = await toggleMeeting('end');
      if (success) {
        toast({ title: 'Meeting ended!', description: 'Status changed to OFFLINE' });
        onStatusChange?.('OFFLINE');
      } else {
        toast({
          title: 'Error',
          description: 'Failed to end meeting',
          variant: 'destructive',
        });
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshMeeting();
      toast({ title: 'Refreshed', description: 'Meeting info updated' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh',
        variant: 'destructive',
      });
    }
  };

  if (!currentMeeting) {
    return (
      <Card className="border-slate-700/40 bg-slate-900/30">
        <CardContent className="p-6">
          <p className="text-slate-400">Loading meeting info...</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LIVE':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'UPCOMING':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'ENDED':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'OFFLINE':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <Card className="border-slate-700/40 bg-gradient-to-br from-slate-900/50 to-slate-900/30 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-slate-900/10" />

      <CardHeader className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {currentMeeting.title}
              <Badge
                variant="outline"
                className={`border ${getStatusColor(currentMeeting.status)}`}
              >
                {currentMeeting.status}
              </Badge>
            </CardTitle>
            {currentMeeting.description && (
              <p className="text-sm text-slate-400">{currentMeeting.description}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 relative z-10">
        {/* Meeting Details */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-800/40 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              <span>Scheduled Time</span>
            </div>
            <p className="text-white font-semibold">
              {currentMeeting.start_time} - {currentMeeting.end_time}
            </p>
          </div>

          <div className="bg-slate-800/40 rounded-lg p-3">
            <div className="text-slate-400 text-sm mb-1">Timezone</div>
            <p className="text-white font-semibold">{currentMeeting.timezone}</p>
          </div>
        </div>

        {/* Current Time Info */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-3">
          <div className="text-xs text-slate-400 mb-1">Current Server Time</div>
          <p className="text-sm text-slate-200">
            {new Date(currentMeeting.current_time).toLocaleTimeString()}
          </p>
        </div>

        {/* Meeting Link Display - HIDDEN from frontend */}
        {/* Link is kept secret and only used internally */}

        {/* Control Buttons */}
        <div className="flex gap-2">
          {!isLive ? (
            <Button
              onClick={handleStartMeeting}
              disabled={isToggling || loading}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold shadow-lg shadow-green-600/40"
            >
              <Play className="w-4 h-4 mr-2" />
              {isToggling ? 'Starting...' : 'Start Meeting'}
            </Button>
          ) : (
            <Button
              onClick={handleEndMeeting}
              disabled={isToggling || loading}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold shadow-lg shadow-red-600/40"
            >
              <Square className="w-4 h-4 mr-2" />
              {isToggling ? 'Ending...' : 'End Meeting'}
            </Button>
          )}

          <Button
            onClick={handleRefresh}
            disabled={loading || isToggling}
            variant="outline"
            className="border-slate-700/40 hover:bg-slate-800/30"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Status Information */}
        <div className="text-xs text-slate-400 space-y-1">
          <p>
            <span className="text-slate-300 font-semibold">Auto Status:</span> Automatically changes
            based on scheduled time
          </p>
          <p>
            <span className="text-slate-300 font-semibold">Manual Control:</span> Click Start/End to
            override automatic status
          </p>
          {currentMeeting.status === 'LIVE' && (
            <p className="text-green-400">✓ Meeting is currently live and accessible to all users</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MeetingControlPanel;
