import type { Metadata } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Providers } from "@/lib/providers"

const inter = localFont({
  src: [
    { path: "../public/fonts/inter-regular.woff2",  weight: "400", style: "normal" },
    { path: "../public/fonts/inter-medium.woff2",   weight: "500", style: "normal" },
    { path: "../public/fonts/inter-semibold.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/inter-bold.woff2",     weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
})

export const metadata: Metadata = {
  title: { default: "ABC Exam Portal", template: "%s | ABC Exam" },
  description: "Practice MCQ exams for competitive exam preparation",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
