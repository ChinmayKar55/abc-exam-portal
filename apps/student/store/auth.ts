import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface AuthUser {
  id: string
  name: string
  email: string
  role: "student" | "admin"
  emailVerified: boolean
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  setAuth: (user: AuthUser, token: string) => void
  setToken: (token: string) => void
  logout: () => void
  isAuthenticated: () => boolean
}

/** Sync token to a cookie so Next.js middleware can read it for route protection */
function syncCookie(token: string | null) {
  if (typeof document === "undefined") return
  if (token) {
    // Session-scoped cookie (no expiry = browser session); Secure in prod via HTTPS
    document.cookie = `abc-auth-token=${token}; path=/; SameSite=Lax`
  } else {
    document.cookie = "abc-auth-token=; path=/; max-age=0; SameSite=Lax"
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,

      setAuth: (user, accessToken) => { syncCookie(accessToken); set({ user, accessToken }) },

      setToken: (accessToken) => { syncCookie(accessToken); set({ accessToken }) },

      logout: () => {
        syncCookie(null)
        set({ user: null, accessToken: null })
        fetch("/api/auth/logout", { method: "POST" }).catch(() => {})
      },

      isAuthenticated: () => !!get().accessToken && !!get().user,
    }),
    {
      name: "abc-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
      skipHydration: true,
    }
  )
)
