import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('OpenNews UI boundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="opennews-canvas flex min-h-[100dvh] items-center justify-center p-6">
          <div className="settings-group max-w-md space-y-3 p-6 text-center">
            <h1 className="text-lg font-bold text-[var(--ink)]">Ansicht konnte nicht geladen werden</h1>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              Ein unerwarteter Fehler ist aufgetreten. Deine gespeicherten Quellen und Artikel bleiben lokal erhalten.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="primary-action mt-2 px-5 text-sm"
            >
              Neu laden
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
