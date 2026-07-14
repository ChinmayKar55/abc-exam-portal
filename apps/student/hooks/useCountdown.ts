"use client"
import { useEffect, useRef, useState } from "react"

/**
 * Returns seconds remaining until `expiresAt`.
 * Uses requestAnimationFrame-based loop for smooth updates without drift.
 * Calls onExpire once when timer reaches zero.
 */
export function useCountdown(expiresAt: string, onExpire?: () => void) {
  const getRemaining = () =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))

  const [secondsLeft, setSecondsLeft] = useState(getRemaining)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire
  const expiredRef = useRef(false)

  useEffect(() => {
    expiredRef.current = false
    let rafId: number

    const tick = () => {
      const remaining = getRemaining()
      setSecondsLeft(remaining)
      if (remaining <= 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpireRef.current?.()
        return
      }
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt])

  return secondsLeft
}
