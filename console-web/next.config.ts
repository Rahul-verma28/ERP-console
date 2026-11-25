import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

// The AHEAD Console and partner portal. Talks only to console-api, never to an ERP.
// Repo root: the app reads the shared, dependency-free contracts (field rules, industries, modules)
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url))
const CONSOLE_API_URL = process.env.CONSOLE_API_URL ?? "http://localhost:5100"

const nextConfig: NextConfig = {
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: { root: REPO_ROOT },
  outputFileTracingRoot: REPO_ROOT,
  // Same-origin API: the refresh-token cookie stays first-party and no CORS is needed
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${CONSOLE_API_URL}/api/v1/:path*` }]
  },
  // Nothing here belongs in search results, or inside another site's frame
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "X-Frame-Options", value: "DENY" }, { key: "Referrer-Policy", value: "same-origin" }] }]
  },
}

export default nextConfig
