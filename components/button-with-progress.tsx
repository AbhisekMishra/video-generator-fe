"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonWithProgressProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  progress?: number;
  showProgress?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const ButtonWithProgress = forwardRef<HTMLButtonElement, ButtonWithProgressProps>(
  ({ progress = 0, showProgress = false, children, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        {...props}
      >
        {/* Progress bar overlay */}
        {showProgress && (
          <div
            className="absolute inset-0 bg-primary/30 transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              left: 0,
            }}
          />
        )}

        {/* Button content */}
        <span className="relative z-10 flex items-center gap-2">
          {children}
          {showProgress && (
            <span className="text-xs font-medium ml-1">
              {progress}%
            </span>
          )}
        </span>
      </Button>
    );
  }
);

ButtonWithProgress.displayName = "ButtonWithProgress";
