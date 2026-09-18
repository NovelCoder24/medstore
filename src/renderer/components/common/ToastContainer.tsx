import React from 'react'
import { useToastStore, ToastItem } from '../../store/toast.store'
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X, Copy, Check } from 'lucide-react'

function ToastRow({ item }: { item: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const [copied, setCopied] = React.useState(false)

  const handleCopy = async () => {
    try {
      const fullText = item.description ? `${item.title}\n${item.description}` : item.title
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const typeConfig = {
    success: {
      bg: 'bg-white border-emerald-300 text-emerald-950',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
    },
    error: {
      bg: 'bg-white border-rose-300 text-rose-950',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
    },
    warning: {
      bg: 'bg-white border-amber-300 text-amber-950',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
    },
    info: {
      bg: 'bg-white border-slate-300 text-slate-950',
      icon: <Info className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
    }
  }[item.type]

  return (
    <div
      role="status"
      className={`w-84 sm:w-96 p-3.5 rounded-xl border shadow-xl flex items-start justify-between gap-3 transition-all animate-in fade-in slide-in-from-bottom-2 ${typeConfig.bg}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {typeConfig.icon}
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-bold leading-tight break-words">{item.title}</p>
          {item.description && (
            <p className="text-xs text-slate-600 mt-1 leading-relaxed break-words">{item.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-1">
        {item.type === 'error' && (
          <button
            type="button"
            onClick={handleCopy}
            title="Copy error text"
            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => removeToast(item.id)}
          title="Dismiss"
          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      </div>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-full pointer-events-auto">
      {toasts.map((toast) => (
        <ToastRow key={toast.id} item={toast} />
      ))}
    </div>
  )
}
