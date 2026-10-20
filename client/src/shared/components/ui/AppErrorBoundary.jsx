import React from 'react';
import { RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react';
import logger from '../../../utils/logger';
import '../../../styles/gloss.css';
import '../../../components/company-dash/dash.css';

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
        if (import.meta.env.DEV) {
            const label = this.props.label || 'Unknown';
            logger.error(`[AppErrorBoundary][${label}] Caught render error:`, error, info.componentStack);
        }
    }

    reset() {
        this.setState({ hasError: false, error: null });
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        const whole = this.props.label === 'App';
        const isDev = import.meta.env.DEV;

        return (
            <div
                className="cd-state"
                data-tone="danger"
                role="alert"
                style={{ height: '100%', minHeight: whole ? '100vh' : 200, background: 'var(--bg-base)', color: 'var(--text-secondary)' }}
            >
                <span className="gl-empty-mark"><AlertTriangle size={18} /></span>
                <p className="gl-empty-title">{whole ? 'Something went wrong' : `${this.props.label || 'This section'} couldn’t load`}</p>
                <p className="gl-empty-text">
                    {whole
                        ? 'Oruinwan hit an unexpected problem. Your messages and work are safe. Try again, or reload the page.'
                        : 'Something went wrong showing this part of the page. The rest of the app still works.'}
                </p>

                {isDev && this.state.error && (
                    <pre style={{
                        maxWidth: 'min(480px, 100%)', overflowX: 'auto', margin: '4px 0', padding: '10px 12px', textAlign: 'left',
                        fontSize: 12, color: 'var(--state-danger)', background: 'var(--bg-hover)',
                        border: '1px solid var(--border-default)', borderRadius: 'var(--gl-radius)',
                    }}>
                        {this.state.error.message}
                    </pre>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                    <button type="button" className="gl-btn gl-btn--primary" onClick={this.reset}>
                        <RotateCcw size={13} /> Try again
                    </button>
                    <button type="button" className="gl-btn gl-btn--ghost" onClick={() => window.location.reload()}>
                        <RefreshCw size={13} /> Reload page
                    </button>
                </div>
            </div>
        );
    }
}

export default AppErrorBoundary;
