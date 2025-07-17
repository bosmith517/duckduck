import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="alert alert-danger m-5" role="alert">
            <h4 className="alert-heading">Something went wrong</h4>
            <p>The video component encountered an error. Please refresh the page to try again.</p>
            {this.state.error && (
              <details className="mt-3">
                <summary>Error details</summary>
                <pre className="mt-2">{this.state.error.toString()}</pre>
              </details>
            )}
          </div>
        )
      )
    }

    return this.props.children
  }
}