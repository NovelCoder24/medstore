import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastItem {
  id: string
  title: string
  description?: string
  type: ToastType
  duration?: number
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id'>) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID()
    const newToast: ToastItem = { ...toast, id }
    set((state) => ({ toasts: [...state.toasts, newToast].slice(-5) })) // keep max 5

    const duration = toast.duration ?? (toast.type === 'error' ? 6000 : 3500)
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }

    return id
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
  clearToasts: () => {
    set({ toasts: [] })
  }
}))

// Convenience helper methods
export const toast = {
  show: (title: string, description?: string, type: ToastType = 'info', duration?: number) => {
    return useToastStore.getState().addToast({ title, description, type, duration })
  },
  success: (title: string, description?: string, duration?: number) => {
    return useToastStore.getState().addToast({ title, description, type: 'success', duration })
  },
  error: (title: string, description?: string, duration?: number) => {
    return useToastStore.getState().addToast({ title, description, type: 'error', duration })
  },
  warning: (title: string, description?: string, duration?: number) => {
    return useToastStore.getState().addToast({ title, description, type: 'warning', duration })
  },
  info: (title: string, description?: string, duration?: number) => {
    return useToastStore.getState().addToast({ title, description, type: 'info', duration })
  }
}
