import type { NextConfig } from "next";

// En développement (aperçus intégrés : StackBlitz, CodeSandbox, IDX…) ou avec ALLOW_IFRAME=true,
// l'application peut être affichée dans une iframe ; sinon protection contre le clickjacking.
const allowFraming = process.env.NODE_ENV !== "production" || process.env.ALLOW_IFRAME === "true";

const securityHeaders = [
  ...(allowFraming ? [] : [{ key: "X-Frame-Options", value: "SAMEORIGIN" }]),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
