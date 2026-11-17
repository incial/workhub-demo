import React, { type ErrorInfo, type ReactNode } from 'react';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Uncaught application render error:', error, errorInfo);
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  private reload = () => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
            <h1 className="text-xl font-bold text-slate-950">This screen could not be displayed</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your data has not been changed. Try the screen again, or reload the app if the problem continues.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" onClick={this.retry} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Try again
              </button>
              <button type="button" onClick={this.reload} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                Reload app
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
