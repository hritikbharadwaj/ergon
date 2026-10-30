import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Fingerprint, KeyRound, Lock, MapPin, ShieldCheck, Siren } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const policyItems = [
  {
    icon: MapPin,
    title: 'Location Verification',
    body: 'Admin access requires browser location permission before sign-in. Location checks help confirm that access attempts are coming from an expected device context.',
  },
  {
    icon: KeyRound,
    title: 'OTP Authentication',
    body: 'Sign-in uses one-time passwords delivered to registered admin email addresses. Codes are short-lived and must be entered before dashboard access is granted.',
  },
  {
    icon: Fingerprint,
    title: 'Face Attendance Integrity',
    body: 'Attendance is tied to face scan workflows, work-log status, timestamps, and admin identity to reduce manual abuse and keep records accountable.',
  },
  {
    icon: Eye,
    title: 'Activity Monitoring',
    body: 'Security-sensitive actions such as login, attendance changes, overrides, uploads, and admin updates may be recorded for audit and review.',
  },
  {
    icon: Lock,
    title: 'Data Protection',
    body: 'Admin data, attendance records, employee information, and reports are restricted by role-based access controls and protected dashboard routes.',
  },
  {
    icon: Siren,
    title: 'Incident Response',
    body: 'Suspicious access, missing work logs, failed checks, or policy violations may lead to session removal, account review, or temporary restrictions.',
  },
];

const SecurityPolicy: React.FC = () => {
  return (
    <>
      <style>{`
        @keyframes background-image-blink {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.15; }
        }
        .background-image-blink { animation: background-image-blink 4s ease-in-out infinite; }
        .energy-glow { filter: drop-shadow(0 0 6px rgba(139,92,246,0.20)); }
        .floating-particles { animation: floatUp 6s ease-in-out infinite; }
        .floating-particles-fast { animation: floatUp 3.5s ease-in-out infinite; }
        .floating-particles-medium { animation: floatUp 5s ease-in-out infinite; }
        @keyframes floatUp {
          0%, 100% { transform: translateY(0px); opacity: 0.5; }
          50% { transform: translateY(-20px); opacity: 1; }
        }
        @keyframes slide-in-right {
          0%, 100% { transform: translateX(-100%); opacity: 0; }
          20%, 80% { opacity: 1; }
          50% { transform: translateX(100%); }
        }
        @keyframes slide-down {
          0%, 100% { transform: translateY(-100%); opacity: 0; }
          20%, 80% { opacity: 1; }
          50% { transform: translateY(100%); }
        }
        @keyframes morph {
          0%, 100% { border-radius: 50%; transform: scale(1); }
          50% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; transform: scale(1.08); }
        }
        .animate-morph { animation: morph 6s ease-in-out infinite; }
        @keyframes animate-scale-in {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scale-in { animation: animate-scale-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
        @keyframes animate-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: animate-fade-in 0.6s ease both; }
      `}</style>

      <div className="min-h-screen bg-black relative overflow-hidden text-white">
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-full h-full max-w-6xl max-h-6xl background-image-blink"
            style={{
              backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(34,211,238,.12), transparent 42%), linear-gradient(135deg, #05080d, #0b1420)',
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.25,
            }}
          />
        </div>

        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-3xl animate-[spin_20s_linear_infinite]" />
          <div className="absolute top-3/4 right-1/4 w-96 h-96 bg-gradient-to-r from-purple-600/15 to-indigo-600/15 rounded-full blur-3xl animate-[spin_25s_linear_infinite_reverse]" />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-gradient-to-r from-indigo-500/25 to-cyan-500/25 rounded-full blur-3xl animate-[spin_15s_linear_infinite]" />
          <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-full blur-2xl animate-[bounce_3s_ease-in-out_infinite] energy-glow" />
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-2xl animate-[bounce_4s_ease-in-out_infinite] energy-glow" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/3 right-1/3 w-80 h-80 border border-blue-400/20 rounded-full animate-ping" />
          <div className="absolute bottom-1/3 left-1/3 w-60 h-60 border border-purple-400/20 rounded-full animate-ping" style={{ animationDelay: '2s' }} />
          <div className="absolute inset-0">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-400/30 to-transparent animate-[slide-in-right_4s_ease-in-out_infinite]" />
            <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-purple-400/30 to-transparent animate-[slide-in-right_5s_ease-in-out_infinite]" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-[slide-in-right_6s_ease-in-out_infinite]" style={{ animationDelay: '2s' }} />
            <div className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent animate-[slide-in-right_7s_ease-in-out_infinite]" style={{ animationDelay: '3s' }} />
          </div>
          <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-blue-400/25 to-transparent animate-[slide-down_8s_ease-in-out_infinite]" />
          <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-purple-400/25 to-transparent animate-[slide-down_9s_ease-in-out_infinite]" style={{ animationDelay: '2s' }} />
          {Array.from({ length: 120 }, (_, i) => (
            <div
              key={i}
              className={`absolute rounded-full ${
                i % 5 === 0 ? 'w-2 h-2 bg-blue-400/50 floating-particles-fast' :
                i % 5 === 1 ? 'w-1 h-1 bg-purple-400/50 floating-particles' :
                i % 5 === 2 ? 'w-3 h-3 bg-cyan-400/40 floating-particles-medium' :
                i % 5 === 3 ? 'w-1.5 h-1.5 bg-indigo-400/45 floating-particles-fast' :
                'w-2.5 h-2.5 bg-pink-400/35 floating-particles'
              }`}
              style={{
                left: `${(i * 137.508) % 100}%`,
                top: `${(i * 97.3) % 100}%`,
                animationDelay: `${(i * 0.17) % 3}s`,
              }}
            />
          ))}
          <div className="absolute top-20 right-20 w-20 h-20 bg-gradient-to-r from-blue-500/15 to-purple-500/15 rounded-full animate-morph energy-glow" />
          <div className="absolute bottom-20 left-20 w-16 h-16 bg-gradient-to-r from-purple-500/15 to-cyan-500/15 rounded-lg animate-morph energy-glow" style={{ animationDelay: '1.5s' }} />
          <div className="absolute top-1/2 right-1/4 w-12 h-12 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 rounded-full animate-morph energy-glow" style={{ animationDelay: '3s' }} />
          <div className="absolute top-1/2 left-10 w-4 h-4 bg-blue-400/60 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-1/3 right-10 w-3 h-3 bg-purple-400/60 rounded-full animate-ping" style={{ animationDelay: '1.5s' }} />
          <div className="absolute bottom-1/4 left-1/2 w-5 h-5 bg-cyan-400/60 rounded-full animate-ping" style={{ animationDelay: '2.5s' }} />
        </div>

        <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="text-gray-300 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Admin Login
              </Button>
            </Link>
            <div
              className="text-3xl font-extrabold tracking-wide text-transparent bg-clip-text"
              style={{
                fontFamily: "'Nixmat', sans-serif",
                backgroundImage: 'linear-gradient(90deg, #f97316 0%, #ec4899 50%, #3b82f6 100%)',
              }}
            >
              Ergon
            </div>
          </div>

          <section className="mx-auto w-full max-w-4xl animate-scale-in">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-blue-400/30 bg-black/60 shadow-[0_0_40px_rgba(59,130,246,0.18)] backdrop-blur">
                <ShieldCheck className="h-9 w-9 text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.35)]" />
              </div>
              <h1
                className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
                style={{ fontFamily: "'Nixmat', sans-serif" }}
              >
                Security Policy
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-gray-300 sm:text-base">
                Ergon Admin access is protected with location checks, OTP verification,
                role-based permissions, audit trails, and attendance integrity controls.
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.22em] text-blue-300/80">Last updated June 14, 2026</p>
            </div>

            <Card className="border-white/10 bg-black/70 shadow-[0_0_40px_rgba(59,130,246,0.12)] backdrop-blur-xl">
              <CardContent className="p-5 sm:p-8">
                <div className="grid gap-4 md:grid-cols-2">
                  {policyItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-blue-400/20 bg-blue-500/10">
                            <Icon className="h-5 w-5 text-blue-300" />
                          </div>
                          <h2 className="text-base font-semibold text-white">{item.title}</h2>
                        </div>
                        <p className="text-sm leading-6 text-gray-300">{item.body}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-lg border border-orange-400/20 bg-orange-500/10 p-4">
                  <h2 className="mb-2 text-base font-semibold text-orange-200">Admin Responsibility</h2>
                  <p className="text-sm leading-6 text-gray-300">
                    Use only your own registered email, never share OTPs, keep location permission enabled,
                    submit accurate work logs, and report suspicious activity immediately to a super admin or HR admin.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          <footer className="relative z-10 mt-10 pb-4 text-center text-sm text-muted-foreground animate-fade-in">
            <span className="inline-flex flex-wrap items-center justify-center gap-2">
              <span>Secure admin access for</span>
              <span
                className="text-lg font-extrabold tracking-wide bg-gradient-to-r from-orange-500 via-pink-500 to-blue-500 text-transparent bg-clip-text"
                style={{ fontFamily: "'Nixmat', sans-serif" }}
              >
                Ergon
              </span>
              <span>Admins</span>
            </span>
          </footer>
        </main>
      </div>
    </>
  );
};

export default SecurityPolicy;
