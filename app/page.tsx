"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VideoUploadDropzone } from "@/components/video-upload-dropzone";
import { WorkflowProgress } from "@/components/workflow-progress";
import { VideoPlayer } from "@/components/video-player";
import { Button } from "@/components/ui/button";
import { ButtonWithProgress } from "@/components/button-with-progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, AlertCircle, Upload, Mic, Scissors, Clapperboard, ArrowRight } from "lucide-react";
import Image from "next/image";
import { RenderedVideo } from "@/lib/types";
import { createSession } from "@/lib/session";
import { useAuth } from "@/contexts/auth-context";
import { AuthModal } from "@/components/auth-modal";
import { Navbar } from "@/components/navbar";
import { UserQuota } from "@/lib/quota";

type WorkflowStage = "transcribe" | "identifyClips" | "detectFocus" | "render" | "completed";

function HomeContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [quota, setQuota] = useState<UserQuota | null>(null);

  // Fetch quota whenever user changes
  useEffect(() => {
    if (!user) { setQuota(null); return; }
    fetch("/api/quota")
      .then((r) => r.json())
      .then(({ quota: q }) => setQuota(q))
      .catch(() => {/* non-critical */});
  }, [user]);

  // Redirect to dashboard if the user already has videos.
  // Skip when ?new=1 is present — that means the user intentionally came to upload.
  useEffect(() => {
    if (authLoading || !user || searchParams.get("new") === "1") return;
    fetch("/api/sessions")
      .then((r) => r.json())
      .then(({ sessions }) => {
        if (Array.isArray(sessions) && sessions.length > 0) {
          router.replace("/dashboard");
        }
      })
      .catch(() => {/* stay on upload page on error */});
  }, [user, authLoading, router, searchParams]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileData, setUploadedFileData] = useState<{
    publicUrl: string;
    filePath: string;
    sessionId: string;
    threadId: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<WorkflowStage | undefined>();
  const [processedVideos, setProcessedVideos] = useState<RenderedVideo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");

  const handleVideoSelect = (file: File) => {
    setSelectedFile(file);
    setUploadedFileData(null);
    setError(null);
    setUploadProgress(0);
    setUploadStatus("idle");
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadStatus("uploading");
    setUploadProgress(10);

    try {
      const generateUrlResponse = await fetch("/api/upload/generate-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileType: selectedFile.type,
        }),
      });

      if (!generateUrlResponse.ok) {
        const errorData = await generateUrlResponse.json();
        throw new Error(`Failed to generate upload URL: ${errorData.error || generateUrlResponse.statusText}`);
      }

      const { uploadUrl, filePath } = await generateUrlResponse.json();
      setUploadProgress(20);

      const xhr = new XMLHttpRequest();

      await new Promise((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 70) + 20;
            setUploadProgress(percentComplete);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(90);
            resolve(xhr.response);
          } else {
            reject(new Error("Failed to upload file to storage"));
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Failed to upload file to storage"));
        });

        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", selectedFile.type);
        xhr.setRequestHeader("x-upsert", "false");
        xhr.send(selectedFile);
      });

      const confirmResponse = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        throw new Error(`Failed to confirm upload: ${errorData.error || confirmResponse.statusText}`);
      }

      const { publicUrl } = await confirmResponse.json();
      setUploadProgress(100);
      setUploadStatus("success");

      const session = await createSession({
        userId: user.id,
        filename: selectedFile.name,
        fileSize: selectedFile.size,
        filePath: filePath,
        publicUrl: publicUrl,
      });

      setUploadedFileData({
        publicUrl,
        filePath,
        sessionId: session.id,
        threadId: session.thread_id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploadStatus("error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcess = async () => {
    if (!uploadedFileData) return;

    setIsProcessing(true);
    setError(null);
    setCurrentStage("transcribe");
    setProcessedVideos([]);

    try {
      const response = await fetch("/api/process-video/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: uploadedFileData.sessionId,
          threadId: uploadedFileData.threadId,
          videoUrl: uploadedFileData.publicUrl,
          filePath: uploadedFileData.filePath,
        }),
      });

      if (response.status === 402) {
        const data = await response.json();
        setError(data.error);
        setIsProcessing(false);
        setCurrentStage(undefined);
        // Refresh quota so UI reflects exhausted state
        fetch("/api/quota").then((r) => r.json()).then(({ quota: q }) => setQuota(q)).catch(() => {});
        return;
      }

      if (!response.ok) {
        throw new Error("Processing failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response stream");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.status === "completed") {
              if (data.state?.renderedVideos) {
                setProcessedVideos(data.state.renderedVideos);
              }
              setCurrentStage("completed");
              setIsProcessing(false);
              break;
            }

            if (data.node) {
              const nodeStageMap: Record<string, WorkflowStage> = {
                transcribe: "transcribe",
                identifyClips: "identifyClips",
                detectFocus: "detectFocus",
                render: "render",
              };

              const stage = nodeStageMap[data.node];
              if (stage) {
                setCurrentStage(stage);
              }

              if (data.node === "render" && data.state?.renderedVideos) {
                setProcessedVideos(data.state.renderedVideos);
                setCurrentStage("completed");
              }
            }

            if (data.error) {
              throw new Error(data.error);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
      setIsProcessing(false);
      setCurrentStage(undefined);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadedFileData(null);
    setIsProcessing(false);
    setIsUploading(false);
    setCurrentStage(undefined);
    setProcessedVideos([]);
    setError(null);
    setUploadProgress(0);
    setUploadStatus("idle");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />

      <Navbar onSignInClick={() => setShowAuthModal(true)} />

      {/* Hero Section */}
      <section className="py-14 border-b bg-gradient-to-b from-accent to-background">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <div className="flex justify-center mb-6">
            <Image src="/logo.svg" alt="AM Logo" width={100} height={65} priority />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 rounded-full text-primary text-xs font-semibold mb-5 tracking-wide uppercase">
            <Sparkles className="w-3 h-3" />
            AI-Powered Video Clipping
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight mb-4">
            Turn Long Videos Into{" "}
            <span className="text-primary">Viral Short Clips</span>
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-xl mx-auto">
            Upload any long-form video and our AI identifies the best moments,
            crops for portrait, adds captions, and renders ready-to-post clips.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Mic className="w-3 h-3 text-primary" />
              </div>
              Auto Transcription
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Scissors className="w-3 h-3 text-primary" />
              </div>
              Smart Clip Selection
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Clapperboard className="w-3 h-3 text-primary" />
              </div>
              Portrait Rendering
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-10 max-w-7xl flex-1">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column - Upload & Controls */}
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>Upload Video</CardTitle>
                    <CardDescription>
                      Select a video file to generate short-form clips
                    </CardDescription>
                  </div>
                  {user && quota && (
                    <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${
                      quota.attempts_used >= quota.attempts_limit
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}>
                      {quota.attempts_limit - quota.attempts_used}/{quota.attempts_limit} attempts left
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <VideoUploadDropzone
                  onVideoSelect={handleVideoSelect}
                  disabled={isUploading || isProcessing}
                  uploadProgress={uploadProgress}
                  uploadStatus={uploadStatus}
                />

                {selectedFile && !uploadedFileData && !isProcessing && (
                  <div className="flex gap-2">
                    <ButtonWithProgress
                      onClick={handleUpload}
                      disabled={isUploading}
                      className="flex-1"
                      size="lg"
                      progress={uploadProgress}
                      showProgress={isUploading}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploading ? "Uploading..." : "Upload Video"}
                    </ButtonWithProgress>
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      size="lg"
                      disabled={isUploading}
                    >
                      Reset
                    </Button>
                  </div>
                )}

                {uploadedFileData && !isProcessing && (
                  <>
                    {quota && quota.attempts_used >= quota.attempts_limit ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400">
                        You&apos;ve used all {quota.attempts_limit} free attempts. Upgrade to Pro for unlimited clips.
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleProcess}
                          className="flex-1"
                          size="lg"
                          disabled={isProcessing || (!!quota && quota.attempts_used >= quota.attempts_limit)}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Clips
                        </Button>
                        <Button
                          onClick={handleReset}
                          variant="outline"
                          size="lg"
                        >
                          Reset
                        </Button>
                      </div>
                    )}
                  </>
                )}

                {error && (
                  <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {isProcessing && (
              <WorkflowProgress currentStage={currentStage} />
            )}
          </div>

          {/* Right Column - Results */}
          <div className="space-y-6">
            {processedVideos.length > 0 ? (
              <VideoPlayer videos={processedVideos} />
            ) : (
              <Card className="border-dashed shadow-sm h-full min-h-[320px]">
                <CardContent className="flex flex-col items-center justify-center h-full py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Sparkles className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Your clips will appear here</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Upload a video and click &quot;Generate Clips&quot; to create
                    AI-powered short-form content
                  </p>
                  {!user && !authLoading && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-5"
                      onClick={() => setShowAuthModal(true)}
                    >
                      Sign in to get started
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <Image src="/logo.svg" alt="AM Logo" width={40} height={26} />
          <p>© {new Date().getFullYear()} ClipAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
