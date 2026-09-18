import React, { useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Copy, Check, X } from 'lucide-react'

interface AlertBannerProps {
  type?: 'error' | 'warning' | 'info' | 'success'
  message: string
  details?: string
  onDismiss?: () => void
  className?: string
}

export function AlertBanner({
  type = 'error',
  message,
  details,
  onDismiss,
  className = ''
}: AlertBannerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      const textToCopy = details ? `${message}\n\nDetails:\n${details}` : message
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore clipboard failure
    }
  }

  const styles = {
    error: {
      container: 'bg-rose-50 border-rose-200 text-rose-900',
      icon: <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
      copyBtn: 'text-rose-700 hover:text-rose-900 hover:bg-rose-100/70'
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-900',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
      copyBtn: 'text-amber-700 hover:text-amber-900 hover:bg-amber-100/70'
    },
    info: {
      container: 'bg-slate-50 border-slate-200 text-slate-800',
      icon: <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />,
      copyBtn: 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
      copyBtn: 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/70'
    }
  }[type]

  return (
    <div
      role="alert"
      className={`p-3 text-xs sm:text-sm rounded-lg border flex items-start justify-between gap-3 shadow-sm transition-all animate-in fade-in slide-in-from-top-1 ${styles.container} ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {styles.icon}
        <div className="min-w-0">
          <p className="font-semibold leading-snug break-words">{message}</p>
          {details && (
            <p className="text-xs opacity-80 mt-1 font-mono break-all">{details}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        <button
          type="button"
          onClick={handleCopy}
          title="Copy error details for support"
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded transition cursor-pointer ${styles.copyBtn}`}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-600" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            title="Dismiss alert"
            className="p-1 rounded opacity-70 hover:opacity-100 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span className="sr-only">Dismiss</span>
          </button>
        )}
      </div>
    </div>
  )
}
