import { apiPost, apiPut } from "@/lib/api"
import type { LoginInput, ProfileInput, RegisterInput } from "@/lib/schemas/auth"
import type { AuthUser } from "@/store/auth"

interface LoginResponse {
  access_token: string
  user: AuthUser
  success: boolean
}
interface MessageResponse { message: string; success: boolean }

export const authQueries = {
  login: (data: LoginInput) =>
    apiPost<LoginResponse>("auth/login", data),

  register: (data: RegisterInput) =>
    apiPost<MessageResponse>("auth/register", data),

  verifyEmail: (email: string, otp: string) =>
    apiPost<MessageResponse>("auth/verify-email", { email, otp }),

  resendOtp: (email: string) =>
    apiPost<MessageResponse>("auth/resend-otp", { email }),

  forgotPassword: (email: string) =>
    apiPost<MessageResponse>("auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    apiPost<MessageResponse>("auth/reset-password", { token, password }),

  logout: () =>
    apiPost<MessageResponse>("auth/logout"),

  updateProfile: (data: ProfileInput) =>
    apiPut<{ success: boolean; user: AuthUser }>("me", data),
}
