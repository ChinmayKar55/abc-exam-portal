import LandingPage from "@/components/landing/LandingPage"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "OSSSC Online — Odisha Staff Selection Commission Exam Prep",
  description: "India's most trusted platform for OSSSC mock exams. Practice Nursing Officer, Paramedical & Allied Health exams with detailed analytics and AI-powered proctoring.",
}

export default function RootPage() {
  return <LandingPage />
}
