"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-destructive" />
      </div>
      <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
      <p className="text-sm text-muted-foreground mb-5 max-w-xs">
        An unexpected error occurred. You can try again, or head back to the home page.
      </p>
      <Button onClick={() => reset()}>
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
        Try again
      </Button>
    </div>
  );
}
