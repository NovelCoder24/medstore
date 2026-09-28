import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Home, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  children?: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
    copied: false
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled React Error Boundary caught:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleTryAgain = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onReset) {
      try {
        this.props.onReset()
      } catch (e) {
        console.error('Error in onReset callback:', e)
      }
    }
  }

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    try {
      window.location.hash = ''
      window.location.reload()
    } catch {
      window.location.reload()
    }
  }

  private handleCopyError = async () => {
    try {
      const details = [
        `Error: ${this.state.error?.message || 'Unknown error'}`,
        `Stack: ${this.state.error?.stack || 'No stack'}`,
        `Component Stack: ${this.state.errorInfo?.componentStack || 'No component stack'}`
      ].join('\n\n')
      await navigator.clipboard.writeText(details)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch {
      // ignore
    }
  }

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.'

      return (
        <div className="flex flex-col items-center justify-center min-h-[420px] h-full p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm my-4 mx-auto max-w-2xl font-sans">
          <div className="p-3.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 mb-4 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-bold tracking-tight text-slate-900 mb-1.5">
            {this.props.fallbackTitle || 'Something went wrong in this view'}
          </h2>

          <p className="text-xs text-slate-600 max-w-md mb-6 leading-relaxed">
            {this.props.fallbackMessage || 'The system prevented an application crash. Your local database remains intact and completely safe.'}
          </p>

          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6 text-left">
            <p className="text-xs font-semibold text-rose-700 font-mono break-words">
              {errorMessage}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleTryAgain}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Try Again
            </button>

            <button
              type="button"
              onClick={this.handleGoHome}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition shadow-xs cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              Reload App Safely
            </button>

            <button
              type="button"
              onClick={this.handleCopyError}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition cursor-pointer"
            >
              {this.state.copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {this.state.copied ? 'Copied' : 'Copy Error Details'}
            </button>
          </div>

          {/* Collapsible Tech Stack Trace */}
          {this.state.error?.stack && (
            <div className="w-full mt-6 text-left">
              <button
                type="button"
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition cursor-pointer mb-2"
              >
                {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {this.state.showDetails ? 'Hide technical trace' : 'View technical trace'}
              </button>

              {this.state.showDetails && (
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[10px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                  {this.state.error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
