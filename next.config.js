const { withSentryConfig } = require("@sentry/nextjs/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  // No org/project/authToken configured — this only enables Sentry's webpack plugin
  // for cleaner client-side stack traces (source map handling still works without
  // upload; add SENTRY_AUTH_TOKEN + org/project later to get uploaded source maps).
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
