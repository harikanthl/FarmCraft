import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[FarmDots]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-center text-slate-100">
          <h1 className="text-xl font-semibold">Something broke</h1>
          <pre className="max-w-full overflow-auto rounded-lg bg-slate-800 p-4 text-left text-sm text-red-200">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
