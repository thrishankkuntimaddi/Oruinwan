// client/src/shared/components/ui/AppErrorBoundary.jsx
//
// Global error boundary that catches uncaught React render errors so
// a crash in one panel does NOT blank-screen the entire application.
//
// Usage:
//   <AppErrorBoundary label="ChatWindow">
//     <ChatWindowV2 />
//   </AppErrorBoundary>

import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
        this.reset = this.reset.bind(this);
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // Only log in development; avoid leaking stack traces in production
        if (import.meta.env.DEV) {
            const label = this.props.label || 'Unknown';
            console.error(`[AppErrorBoundary][${label}] Caught render error:`, error, info.componentStack);
        }
    }

    reset() {
        this.setState({ hasError: false, error: null });
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        const label = this.props.label || 'This panel';
        const isDev  = import.meta.env.DEV;

        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-8 text-center bg-gray-50 dark:bg-gray-900">
                <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                    <AlertTriangle size={26} className="text-red-500 dark:text-red-400" />
                </div>
                <h3 className="text-base font-bold text-gray-800 dark:text-white mb-1">
                    {label} encountered an error
                </h3>
                <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mb-5">
                    Something went wrong rendering this section. Your other panels are unaffected.
                </p>

                {isDev && this.state.error && (
                    <pre className="mb-4 text-left text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg p-3 max-w-sm overflow-x-auto">
                        {this.state.error.message}
                    </pre>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={this.reset}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <RefreshCw size={14} /> Try Again
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        );
    }
}

export default AppErrorBoundary;
