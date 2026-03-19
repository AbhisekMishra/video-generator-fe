"use client";

import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Scissors, Target, Clapperboard, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type WorkflowStage = "transcribe" | "identifyClips" | "detectFocus" | "render" | "completed";

interface WorkflowProgressProps {
  currentStage?: WorkflowStage;
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
  className,
}: WorkflowProgressProps) {
  const currentStageIndex = currentStage
    ? stages.findIndex((s) => s.id === currentStage)
    : -1;

  const progressValue = currentStage
    ? stages.find((s) => s.id === currentStage)?.progress || 0
    : 0;

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
