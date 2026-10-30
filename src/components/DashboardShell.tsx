import React from 'react';

/**
 * Pass-through shell. Sidebar removed by user request.
 * Kept as a wrapper so App.tsx imports remain stable.
 */
const DashboardShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export default DashboardShell;