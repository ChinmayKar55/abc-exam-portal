"use client"

import { useEffect, useRef, useCallback } from "react"

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description: string
  image?: string
  handler: (response: RazorpayResponse) => void
  prefill?: {
    name?: string
    email?: string
    contact?: string
  }
  notes?: Record<string, string>
  theme?: {
    color?: string
  }
  modal?: {
    ondismiss?: () => void
  }
}

interface RazorpayResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

interface RazorpayInstance {
  open: () => void
  close: () => void
  on: (event: string, callback: (response?: unknown) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js"

export function useRazorpay() {
  const scriptLoaded = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (document.getElementById("razorpay-checkout-script")) {
      scriptLoaded.current = true
      return
    }

    const script = document.createElement("script")
    script.id = "razorpay-checkout-script"
    script.src = RAZORPAY_SCRIPT_URL
    script.async = true
    script.onload = () => {
      scriptLoaded.current = true
    }
    script.onerror = () => {
      scriptLoaded.current = false
      console.error("Failed to load Razorpay Checkout script")
    }

    document.body.appendChild(script)

    return () => {
      // Do not remove the script on unmount; it is shared across the app.
    }
  }, [])

  const openCheckout = useCallback(
    (
      options: Omit<RazorpayOptions, "handler" | "modal"> & {
        onSuccess: (response: RazorpayResponse) => void
        onDismiss?: () => void
        onError?: () => void
      }
    ) => {
      if (typeof window === "undefined" || !window.Razorpay) {
        options.onError?.()
        return
      }

      const openedAt = Date.now()
      const log = (msg: string, extra?: unknown) => {
        console.log(`[razorpay ${((Date.now() - openedAt) / 1000).toFixed(1)}s] ${msg}`, extra ?? "")
      }

      let settled = false
      const settle = (label: string, fn?: () => void) => {
        log(`settle() called from: ${label}, already settled: ${settled}`)
        if (settled) return
        settled = true
        clearInterval(heartbeat)
        clearTimeout(stuckTimer)
        fn?.()
      }

      const razorpay = new window.Razorpay({
        ...options,
        handler: (response: RazorpayResponse) => settle("handler/success", () => options.onSuccess(response)),
        modal: {
          ondismiss: () => settle("modal.ondismiss", options.onDismiss),
        },
      })

      razorpay.on("payment.failed", (response?: unknown) => {
        log("payment.failed event received", response)
        settle("payment.failed", () => {
          razorpay.close()
          options.onError?.()
        })
      })

      // Heartbeat: proves the JS timer context is alive and not throttled/killed.
      const heartbeat = setInterval(() => log("heartbeat, settled=" + settled), 15000)

      // Safety net: some rejection scenarios (e.g. the Razorpay account not
      // being approved to accept payments on this website) never emit a
      // payment.failed event, leaving the widget open indefinitely with its
      // UPI QR/timer still visible. Force-close and surface an error if
      // nothing resolves within a reasonable window.
      const stuckTimer = setTimeout(() => {
        log("stuckTimer fired, forcing close")
        settle("stuckTimer", () => {
          razorpay.close()
          options.onError?.()
        })
      }, 3 * 60 * 1000)

      log("calling razorpay.open()")
      razorpay.open()
    },
    []
  )

  return { openCheckout, isLoaded: () => scriptLoaded.current }
}
