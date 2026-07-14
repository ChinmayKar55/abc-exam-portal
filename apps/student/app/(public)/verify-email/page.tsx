import type { Metadata } from "next"
import { Suspense } from "react"
import { OtpForm } from "@/components/auth/OtpForm"

export const metadata: Metadata = { title: "Verify Email" }

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <OtpForm />
    </Suspense>
  )
}
