import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  title: string
  description?: string
  type: ToastType
  duration?: number
}

export type ToastOptionsOrDesc = string | { description?: string; duration?: number } | Error | any

interface ToastState {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

function normalizeToastPayload(
  title: any,
  descOrOptions?: ToastOptionsOrDesc,
  customDuration?: number
): { title: string; description?: string; duration?: number } {
  let safeTitle = 'Notification'
  if (typeof title === 'string') {
    safeTitle = title
  } else if (title instanceof Error) {
    safeTitle = title.message || 'Error'
  } else if (title !== null && title !== undefined) {
    safeTitle = String(title)
  }

  let description: string | undefined
  let duration = customDuration

  if (typeof descOrOptions === 'string') {
    description = descOrOptions
  } else if (descOrOptions instanceof Error) {
    description = descOrOptions.message
  } else if (descOrOptions && typeof descOrOptions === 'object') {
    if (typeof descOrOptions.description === 'string') {
      description = descOrOptions.description
    } else if (descOrOptions.description instanceof Error) {
      description = descOrOptions.description.message
    } else if (descOrOptions.description) {
      description = String(descOrOptions.description)
    }
    if (typeof descOrOptions.duration === 'number') {
      duration = descOrOptions.duration
    }
  }

  return { title: safeTitle, description, duration }
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    try {
      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())
      const safeDescription = typeof toast.description === 'string'
        ? toast.description
        : (toast.description ? String(toast.description) : undefined)

      const newToast: ToastItem = {
        ...toast,
        title: typeof toast.title === 'string' ? toast.title : String(toast.title || ''),
        description: safeDescription,
        id
      }

      set((state) => ({ toasts: [...state.toasts, newToast].slice(-5) })) // keep max 5

      const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 3500)
      if (duration > 0) {
        setTimeout(() => {
          set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
        }, duration)
      }

      return id
    } catch (e) {
      console.error('[ToastStore] Failed to add toast:', e)
      return ''
    }
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
  clearToasts: () => {
    set({ toasts: [] })
  }
}))

// Convenience helper methods that accept both (title, description, duration) AND (title, { description, duration })
export const toast = {
  show: (title: any, descOrOptions?: ToastOptionsOrDesc, type: ToastType = 'info', duration?: number) => {
    const payload = normalizeToastPayload(title, descOrOptions, duration)
    return useToastStore.getState().addToast({ ...payload, type })
  },
  success: (title: any, descOrOptions?: ToastOptionsOrDesc, duration?: number) => {
    const payload = normalizeToastPayload(title, descOrOptions, duration)
    return useToastStore.getState().addToast({ ...payload, type: 'success' })
  },
  error: (title: any, descOrOptions?: ToastOptionsOrDesc, duration?: number) => {
    const payload = normalizeToastPayload(title, descOrOptions, duration)
    return useToastStore.getState().addToast({ ...payload, type: 'error' })
  },
  warning: (title: any, descOrOptions?: ToastOptionsOrDesc, duration?: number) => {
    const payload = normalizeToastPayload(title, descOrOptions, duration)
    return useToastStore.getState().addToast({ ...payload, type: 'warning' })
  },
  info: (title: any, descOrOptions?: ToastOptionsOrDesc, duration?: number) => {
    const payload = normalizeToastPayload(title, descOrOptions, duration)
    return useToastStore.getState().addToast({ ...payload, type: 'info' })
  }
}
