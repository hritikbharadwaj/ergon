import React from 'react';
import BackButton from '@/components/BackButton';

const SocialAnalytics: React.FC = () => {
  return (
    <div className="p-6 md:p-8">
      <BackButton pageName="Social Analytics" to="/dashboard" />
      {/* Rest of your module content */}
    </div>
  );
};

export default SocialAnalytics;