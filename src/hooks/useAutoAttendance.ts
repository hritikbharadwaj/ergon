import { useCallback } from 'react';

export const useAutoAttendance = () => {
  const markAttendanceAsPresent = useCallback(async () => {
    // Attendance is strictly face-scan based.
    // Work logs must never create or upgrade attendance records.
    return false;
  }, []);

  return { markAttendanceAsPresent };
};

export default useAutoAttendance;
