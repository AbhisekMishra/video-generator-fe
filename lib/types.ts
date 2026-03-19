/**
 * Identified clip with timestamps and metadata
 */
export interface Clip {
  start: number;
  end: number;
  score: number;
  reason: string;
  hook?: string;
}

/**
 * Rendered video output
 */
export interface RenderedVideo {
  url: string;
  duration: number;
  clip?: Clip;
}
