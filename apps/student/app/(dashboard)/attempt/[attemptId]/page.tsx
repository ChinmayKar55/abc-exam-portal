"use client"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { ExamRoom } from "@/components/exam/ExamRoom"
import { OMRExamRoom } from "@/components/exam/OMRExamRoom"
import type { StartResponse } from "@/lib/queries/exams"

interface AttemptData extends StartResponse {
  exam_type?: string
}

export default function AttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const router = useRouter()
  const [data, setData] = useState<AttemptData | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(`attempt:${attemptId}`)
    if (raw) {
      setData(JSON.parse(raw))
    } else {
      router.replace("/exams")
    }
  }, [attemptId, router])

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    )
  }

  return data.exam_type === "mock"
    ? <OMRExamRoom data={data} />
    : <ExamRoom data={data} />
}
