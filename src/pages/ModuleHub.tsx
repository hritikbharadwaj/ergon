import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import DashboardCard from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { findHub, isHubVisibleForRole } from '@/lib/moduleGroups';

const ModuleHub: React.FC = () => {
  const { hubId } = useParams<{ hubId: string }>();
  const navigate = useNavigate();
  const { adminProfile } = useAuth();

  const hub = hubId ? findHub(hubId) : null;

  if (!hub) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-10 text-white">
          <p className="mb-4">Module group not found.</p>
          <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard')}
                    className="mb-6 bg-black/40 border-white/10 text-white hover:bg-white/10"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </Button>
        </div>
      </>
    );
  }

  const role = (adminProfile?.role as string) || 'user';
  const children = isHubVisibleForRole(hub, role) || [];

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">{hub.title}</h1>
            <p className="text-muted-foreground text-sm">{hub.description}</p>
          </div>
        </div>

        {children.length === 0 ? (
          <p className="text-muted-foreground">You don't have access to any tools in this section.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {children.map((child) => (
              <DashboardCard
                key={child.route}
                title={child.title}
                description={child.description}
                iconSrc={child.iconSrc}
                onClick={() => navigate(child.route)}
                badge={child.badge}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ModuleHub;