import { apiPost } from "@/lib/api"
import type { AuthUser } from "@/store/auth"

interface LoginResponse {
  access_token: string
  user: AuthUser
  success: boolean
}

export const authQueries = {
  login: (email: string, password: string) =>
    apiPost<LoginResponse>("auth/login", { email, password }),
  logout: () => apiPost("auth/logout"),
}
