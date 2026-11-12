import { Component, Suspense, type ErrorInfo, type ReactNode } from "react";

interface ModuleBoundaryProps {
  moduleId: string;
  children: ReactNode;
}

interface ModuleBoundaryState {
  failed: boolean;
}

/**
 * Contiene los fallos de un módulo (error al renderizar o al cargar su código) para
 * que el resto de la app siga funcionando, y muestra la carga diferida del módulo.
 */
export class ModuleBoundary extends Component<ModuleBoundaryProps, ModuleBoundaryState> {
  state: ModuleBoundaryState = { failed: false };

  static getDerivedStateFromError(): ModuleBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[module:${this.props.moduleId}]`, error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <p className="text-lg font-medium text-gray-800 dark:text-white/90">
            Esta sección no está disponible por ahora.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            El resto de la aplicación sigue funcionando. Inténtalo de nuevo en unos minutos.
          </p>
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Reintentar
          </button>
        </div>
      );
    }

    return (
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-16 text-sm text-gray-500" role="status">
            Cargando…
          </div>
        }
      >
        {this.props.children}
      </Suspense>
    );
  }
}
