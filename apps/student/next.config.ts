import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/auth/refresh",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081/api"}/auth/refresh`,
      },
    ]
  },
}

export default nextConfig
