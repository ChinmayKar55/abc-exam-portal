"use client"
import { useCallback, useEffect, useRef } from "react"
import { useAuthStore } from "@/store/auth"

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8081"

type WSMessageType =
  | "answer_saved"
  | "submitted"
  | "auto_submitted"
  | "time_warning"
  | "pong"
  | "error"

interface WSMessage {
  type: WSMessageType
  payload?: unknown
}

interface UseExamWSOptions {
  attemptId: string
  onTimeWarning?: (secondsLeft: number) => void
  onAutoSubmitted?: (attempt: unknown) => void
  onSubmitted?: (attempt: unknown) => void
  onError?: (message: string) => void
}

export function useExamWS({
  attemptId,
  onTimeWarning,
  onAutoSubmitted,
  onSubmitted,
  onError,
}: UseExamWSOptions) {
  const ws = useRef<WebSocket | null>(null)
  const token = useAuthStore((s) => s.accessToken)
  const pingInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  const send = useCallback((msg: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg))
    }
  }, [])

  const saveAnswer = useCallback(
    (questionId: string, answer: string) => {
      send({ type: "save_answer", payload: { question_id: questionId, answer } })
    },
    [send]
  )

  const submitExam = useCallback(() => {
    send({ type: "submit" })
  }, [send])

  const reportProctoring = useCallback(
    (eventType: string, severity: string, meta?: Record<string, unknown>) => {
      send({ type: "proctoring_event", payload: { type: eventType, severity, meta: meta ?? {} } })
    },
    [send]
  )

  useEffect(() => {
    if (!token || !attemptId) return

    const url = `${WS_BASE}/ws/attempts/${attemptId}?token=${encodeURIComponent(token)}`
    const socket = new WebSocket(url)
    ws.current = socket

    socket.onopen = () => {
      // Start heartbeat ping every 25s
      pingInterval.current = setInterval(() => send({ type: "ping" }), 25_000)
    }

    socket.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        switch (msg.type) {
          case "time_warning":
            onTimeWarning?.((msg.payload as { seconds_left: number }).seconds_left)
            break
          case "auto_submitted":
            onAutoSubmitted?.(msg.payload)
            break
          case "submitted":
            onSubmitted?.(msg.payload)
            break
          case "error":
            onError?.((msg.payload as { message: string }).message)
            break
        }
      } catch {
        // ignore malformed messages
      }
    }

    socket.onerror = () => onError?.("Connection error")

    return () => {
      if (pingInterval.current) clearInterval(pingInterval.current)
      socket.close()
    }
  }, [attemptId, token, send, onTimeWarning, onAutoSubmitted, onSubmitted, onError])

  return { saveAnswer, submitExam, reportProctoring }
}
