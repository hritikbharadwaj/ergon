import React from 'react';
import BackButton from '@/components/BackButton';

const EsportsPlayers: React.FC = () => {
  return (
    <div className="p-6 md:p-8">
      <BackButton pageName="Clients & Customers" to="/dashboard" />
      {/* Rest of your module content */}
    </div>
  );
};

export default EsportsPlayers;