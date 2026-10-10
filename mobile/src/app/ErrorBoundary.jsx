import { Component } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Icon } from '../ui/Icon.jsx';

// Keeps one broken screen from taking down the whole app.
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] screen crashed', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg px-8 text-center pt-safe">
        <Icon as={TriangleAlert} size="lg" className="text-warning" />
        <h2 className="text-base font-semibold">This screen hit a problem</h2>
        <p className="max-w-xs text-sm text-text-2">
          Your data is safe. Try again, and if it keeps happening, update the app from Settings → Updates.
        </p>
        <p className="max-w-xs truncate font-mono text-[11px] text-text-3">{String(this.state.error?.message || this.state.error)}</p>
        <div className="mt-2 flex gap-2">
          {this.props.onBack && (
            <Button variant="secondary" size="sm" onClick={() => { this.setState({ error: null }); this.props.onBack(); }}>
              Go back
            </Button>
          )}
          <Button size="sm" icon={RotateCcw} onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
}
