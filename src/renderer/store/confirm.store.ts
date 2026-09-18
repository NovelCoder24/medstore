import { create } from 'zustand'

export interface ConfirmDialogOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'primary'
}

export interface PromptDialogOptions {
  title: string
  message: string
  placeholder?: string
  initialValue?: string
  confirmText?: string
  cancelText?: string
  required?: boolean
}

interface ConfirmState {
  // Confirm modal state
  confirmOpen: boolean
  confirmOptions: ConfirmDialogOptions | null
  confirmResolver: ((value: boolean) => void) | null

  // Prompt modal state
  promptOpen: boolean
  promptOptions: PromptDialogOptions | null
  promptResolver: ((value: string | null) => void) | null

  // Methods
  openConfirm: (options: ConfirmDialogOptions) => Promise<boolean>
  closeConfirm: (result: boolean) => void

  openPrompt: (options: PromptDialogOptions) => Promise<string | null>
  closePrompt: (result: string | null) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  confirmOpen: false,
  confirmOptions: null,
  confirmResolver: null,

  promptOpen: false,
  promptOptions: null,
  promptResolver: null,

  openConfirm: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        confirmOpen: true,
        confirmOptions: options,
        confirmResolver: resolve
      })
    })
  },

  closeConfirm: (result) => {
    const resolver = get().confirmResolver
    if (resolver) resolver(result)
    set({
      confirmOpen: false,
      confirmOptions: null,
      confirmResolver: null
    })
  },

  openPrompt: (options) => {
    return new Promise<string | null>((resolve) => {
      set({
        promptOpen: true,
        promptOptions: options,
        promptResolver: resolve
      })
    })
  },

  closePrompt: (result) => {
    const resolver = get().promptResolver
    if (resolver) resolver(result)
    set({
      promptOpen: false,
      promptOptions: null,
      promptResolver: null
    })
  }
}))

export const confirmModal = (options: ConfirmDialogOptions | string) => {
  const opts: ConfirmDialogOptions = typeof options === 'string' 
    ? { title: 'Confirm Action', message: options } 
    : options
  return useConfirmStore.getState().openConfirm(opts)
}

export const promptModal = (options: PromptDialogOptions | string) => {
  const opts: PromptDialogOptions = typeof options === 'string'
    ? { title: 'Input Required', message: options }
    : options
  return useConfirmStore.getState().openPrompt(opts)
}
