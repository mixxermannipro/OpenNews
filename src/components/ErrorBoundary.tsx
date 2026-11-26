import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  inline?: boolean;
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const ERROR_COPY = {
  de: {
    title: 'Ansicht konnte nicht geladen werden',
    desc: 'Ein unerwarteter Fehler ist aufgetreten. Deine gespeicherten Quellen und Artikel bleiben lokal erhalten.',
    retry: 'Erneut versuchen',
    reload: 'Neu laden',
  },
  en: {
    title: 'View could not be loaded',
    desc: 'An unexpected error occurred. Your saved sources and articles remain safely stored on this device.',
    retry: 'Try again',
    reload: 'Reload app',
  },
  fr: {
    title: 'Impossible de charger cette vue',
    desc: 'Une erreur inattendue est survenue. Vos sources et articles enregistrés restent conservés localement.',
    retry: 'Réessayer',
    reload: 'Recharger',
  },
  es: {
    title: 'No se pudo cargar la vista',
    desc: 'Ocurrió un error inesperado. Tus fuentes y artículos guardados permanecen seguros en tu dispositivo.',
    retry: 'Reintentar',
    reload: 'Recargar',
  },
  it: {
    title: 'Impossibile caricare la vista',
    desc: 'Si è verificato un errore imprevisto. Le fonti e gli articoli salvati restano al sicuro sul dispositivo.',
    retry: 'Riprova',
    reload: 'Ricarica',
  },
  pt: {
    title: 'Não foi possível carregar esta vista',
    desc: 'Ocorreu um erro inesperado. As suas fontes e artigos guardados permanecem salvos localmente.',
    retry: 'Tentar novamente',
    reload: 'Recarregar',
  },
} as const;

type CopyLang = keyof typeof ERROR_COPY;

function resolveCopy() {
  const raw = typeof document !== 'undefined' ? document.documentElement.lang.toLowerCase() : 'de';
  const short = raw.split('-')[0] as CopyLang;
  return ERROR_COPY[short] ?? ERROR_COPY.de;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: unknown) {
    console.error('OpenNews UI boundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      const copy = resolveCopy();
      const shellClass = this.props.inline
        ? 'flex min-h-[240px] items-center justify-center p-6'
        : 'opennews-canvas flex min-h-[100dvh] items-center justify-center p-6';

      return (
        <div className={shellClass} role="alert">
          <div className="settings-group max-w-md space-y-3 p-6 text-center">
            <h2 className="text-lg font-bold text-[var(--ink)]">{copy.title}</h2>
            <p className="text-sm leading-relaxed text-[var(--muted)]">{copy.desc}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false })}
                className="primary-action px-5 text-sm"
              >
                {copy.retry}
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="choice-pill px-4 text-sm"
              >
                {copy.reload}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
