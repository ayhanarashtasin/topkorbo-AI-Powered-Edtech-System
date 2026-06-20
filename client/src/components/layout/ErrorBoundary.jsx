import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="rb-reader__error" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-color, #333)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong loading the book viewer</h3>
          <p style={{ opacity: 0.8, fontSize: '0.875rem', margin: '12px 0 20px', wordBreak: 'break-word', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
            {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 18px',
              background: '#C08552',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
              fontWeight: 500
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#A76D3D'}
            onMouseOut={(e) => e.currentTarget.style.background = '#C08552'}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
