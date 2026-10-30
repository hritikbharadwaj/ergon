import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <AlertTriangle className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">Something went wrong</h2>
                <p className="text-sm text-slate-400">An unexpected application error occurred.</p>
              </div>
            </div>

            {this.state.error && (
              <div className="my-4 p-3 bg-black/50 border border-slate-800 rounded-lg text-xs font-mono text-red-300/90 overflow-x-auto max-h-36">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <Button
                variant="default"
                onClick={this.handleReload}
                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Page
              </Button>
              <Button
                variant="outline"
                onClick={this.handleGoHome}
                className="flex-1 border-slate-700 hover:bg-slate-800 text-slate-200"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

