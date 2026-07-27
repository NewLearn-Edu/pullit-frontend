import { create } from 'zustand'

export type UserRole = 'admin' | 'student'

interface AuthState {
  role: UserRole
  setRole: (role: UserRole) => void
}

/**
 * 로그인 연동 전 임시 스텁 — 백엔드 인증이 붙으면 로그인 응답의 권한으로 교체.
 * role 이 'admin' 이 아니면 /admin/* 진입 시 홈으로 리다이렉트된다.
 */
export const useAuthStore = create<AuthState>((set) => ({
  role: 'admin',
  setRole: (role) => set({ role }),
}))
