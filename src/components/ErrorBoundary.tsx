import React, { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

/**
 * ErrorBoundary global — evita que un crash de componente derrumbe toda la app.
 * Muestra un mensaje amigable con opción de recargar.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Error capturado:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-surface-2 text-foreground p-8">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold">Algo salió mal</h1>
          <p className="text-sm text-text-muted text-center max-w-sm">
            Ocurrió un error inesperado. Por favor recarga la página.
            {this.state.error && (
              <span className="block mt-2 font-mono text-xs text-destructive">
                {this.state.error.message}
              </span>
            )}
          </p>
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
