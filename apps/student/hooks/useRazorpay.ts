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
  on: (event: string, callback: () => void) => void
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

      const razorpay = new window.Razorpay({
        ...options,
        handler: options.onSuccess,
        modal: {
          ondismiss: options.onDismiss,
        },
      })

      razorpay.on("payment.failed", () => {
        options.onError?.()
      })

      razorpay.open()
    },
    []
  )

  return { openCheckout, isLoaded: () => scriptLoaded.current }
}
