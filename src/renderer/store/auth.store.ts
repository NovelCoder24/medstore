import { create } from 'zustand'
import { Role } from '../../shared/constants'

export interface User {
  id: number
  display_name: string
  role: Role
  is_active: boolean
  created_at: string
}

interface AuthState {
  user: User | null
  login: (user: User) => void
  logout: () => void
  isOwner: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  login: (user) => set({ user }),
  logout: () => set({ user: null }),
  isOwner: () => get().user?.role === 'OWNER'
}))
