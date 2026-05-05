import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({ errorInfo });

        // Log to console for debugging
        console.group('🔴 Error Boundary - Error Details');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.error('Component Stack:', errorInfo.componentStack);
        console.groupEnd();
    }

    handleReload = (): void => {
        window.location.reload();
    };

    handleReset = (): void => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            // Custom fallback UI if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 p-8">
                    <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center border border-slate-200 dark:border-slate-700">
                        {/* Icon */}
                        <div className="w-16 h-16 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-500 dark:text-red-400" />
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                            ¡Algo salió mal!
                        </h1>

                        {/* Description */}
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            Ha ocurrido un error inesperado. No te preocupes, puedes intentar recargar la página.
                        </p>

                        {/* Error Details (collapsible) */}
                        {this.state.error && (
                            <details className="mb-6 text-left">
                                <summary className="text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                                    Ver detalles técnicos
                                </summary>
                                <div className="mt-3 p-4 bg-slate-100 dark:bg-slate-900 rounded-lg overflow-auto max-h-40">
                                    <code className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">
                                        {this.state.error.message}
                                    </code>
                                </div>
                            </details>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleReload}
                                className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:opacity-90 transition-all shadow-lg hover:shadow-xl"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Recargar Página
                            </button>

                            <button
                                onClick={this.handleReset}
                                className="px-6 py-3 text-slate-600 dark:text-slate-400 font-medium hover:text-slate-900 dark:hover:text-white transition-colors"
                            >
                                Intentar continuar
                            </button>
                        </div>

                        {/* Support text */}
                        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
                            Si el problema persiste, contacta al soporte técnico.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
