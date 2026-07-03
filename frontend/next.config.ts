import type { NextConfig } from "next";
import path from "path";

const BASE_HEADERS = [
  { key: "X-Content-Type-Options",  value: "nosniff" },
  { key: "X-DNS-Prefetch-Control",  value: "on" },
  { key: "X-XSS-Protection",        value: "1; mode=block" },
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  turbopack: { root: path.resolve(__dirname) },

  async headers() {
    return [
      {
        // All routes: block framing, lock CSP
        source: "/((?!embed).*)",
        headers: [
          ...BASE_HEADERS,
          { key: "X-Frame-Options",         value: "SAMEORIGIN" },
          { key: "Content-Security-Policy",  value: "frame-ancestors 'self'" },
        ],
      },
      {
        // Embed pages: allow framing by any external site (that's the point)
        source: "/embed/:path*",
        headers: [
          ...BASE_HEADERS,
          { key: "Content-Security-Policy",  value: "frame-ancestors *" },
        ],
      },
      {
        // API routes: explicit CORS — same origin only, no CDN origin spoofing
        source: "/api/:path*",
        headers: [
          ...BASE_HEADERS,
          { key: "Access-Control-Allow-Origin",  value: process.env.NEXT_PUBLIC_BASE_URL ?? "https://nedb.vercel.app" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
