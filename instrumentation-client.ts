import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Videos/emails pass through this app — don't attach cookies, headers, or request
  // bodies to error reports by default.
  sendDefaultPii: false,
  // Sample a fraction of transactions for performance monitoring rather than all of
  // them, to keep event volume (and cost) bounded on a free/low tier.
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
