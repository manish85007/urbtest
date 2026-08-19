import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
    // Explicitly forward to Sentry if installed — React render errors don't always
    // reach window.onerror so the global handler may miss them.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Sentry = (window as any).__SENTRY__;
      if (Sentry?.getCurrentHub) {
        import('@sentry/react' as any)
          .then((S: any) => S.captureException(error, { extra: { componentStack: info.componentStack } }))
          .catch(() => {});
      }
    } catch {
      // Never let error reporting crash the boundary itself
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: '1rem',
            padding: '2rem',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>⚠️</div>
          <h2 style={{ margin: 0 }}>Something went wrong</h2>
          <p style={{ color: 'var(--g2)', maxWidth: '36rem', margin: 0 }}>
            An unexpected error occurred. Please refresh the page. If the problem persists,
            contact your system administrator.
          </p>
          <pre
            style={{
              background: 'var(--bl2, #f0f4ff)',
              padding: '.75rem 1rem',
              borderRadius: '6px',
              fontSize: '.75rem',
              maxWidth: '40rem',
              overflow: 'auto',
              textAlign: 'left',
              color: 'var(--rd, #c00)',
            }}
          >
            {this.state.error.message}
          </pre>
          <button
            className="btn bp"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
