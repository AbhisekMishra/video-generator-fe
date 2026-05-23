"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Scissors, Target, Clapperboard, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkflowStage = "transcribe" | "identifyClips" | "detectFocus" | "render" | "completed";

interface WorkflowProgressProps {
  currentStage?: WorkflowStage;
  /** When set, shows a queue-position banner instead of workflow stages */
  queuePosition?: number;
  /** Estimated wait in seconds, shown alongside queue position */
  estimatedWaitSeconds?: number;
  className?: string;
}

const stages = [
  {
    id: "transcribe" as const,
    label: "Transcribing",
    icon: Mic,
    progress: 25,
  },
  {
    id: "identifyClips" as const,
    label: "Identifying Clips",
    icon: Scissors,
    progress: 50,
  },
  {
    id: "detectFocus" as const,
    label: "Detecting Focus",
    icon: Target,
    progress: 75,
  },
  {
    id: "render" as const,
    label: "Rendering",
    icon: Clapperboard,
    progress: 90,
  },
  {
    id: "completed" as const,
    label: "Completed",
    icon: Check,
    progress: 100,
  },
];

export function WorkflowProgress({
  currentStage,
  queuePosition,
  estimatedWaitSeconds,
  className,
}: WorkflowProgressProps) {
  const currentStageIndex = currentStage
    ? stages.findIndex((s) => s.id === currentStage)
    : -1;

  const progressValue = currentStage
    ? stages.find((s) => s.id === currentStage)?.progress || 0
    : 0;

  const estimatedMinutes = estimatedWaitSeconds
    ? Math.max(1, Math.round(estimatedWaitSeconds / 60))
    : null;

  if (queuePosition !== undefined && queuePosition > 0) {
    return (
      <Card className={cn("shadow-sm", className)}>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Waiting in queue...</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/20 flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                You&apos;re #{queuePosition} in queue
              </p>
              {estimatedMinutes && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Estimated wait: ~{estimatedMinutes} min
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Your video will start processing automatically when it reaches the front of the queue.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Processing your video...</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">
              {currentStage
                ? stages.find((s) => s.id === currentStage)?.label
                : "Waiting..."}
            </span>
            <span className="font-medium">{progressValue}%</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <div className="space-y-3">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isActive = stage.id === currentStage;
            const isCompleted = currentStageIndex > index;

            return (
              <div
                key={stage.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-colors",
                  isActive && "bg-primary/10 border border-primary/20",
                  isCompleted && "opacity-60"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                    isActive && "bg-primary text-primary-foreground",
                    isCompleted && "bg-green-500 text-white",
                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={cn(
                      "font-medium text-sm",
                      isActive && "text-primary"
                    )}
                  >
                    {stage.label}
                  </p>
                </div>
                {isActive && (
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse delay-75" />
                    <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse delay-150" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
