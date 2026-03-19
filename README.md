# Video Generator Frontend

Next.js application with shadcn/ui for AI-powered video clipping.

## Features

- 🎨 Modern UI with shadcn/ui and Tailwind CSS
- 📤 Drag & drop video upload
- 📊 Real-time progress tracking with workflow visualization
- 🎬 Video player for processed clips
- ⚡ LangGraph orchestration for AI workflow

## Architecture

**Workflow**: `Transcribe → Identify Clips → Detect Focus → Render`

### Nodes

1. **transcribe**: Calls FastAPI `/transcribe` endpoint (Whisper transcription)
2. **identifyClips**: Uses ChatOpenAI (GPT-4o-mini) to analyze transcript and identify best 3 clips
3. **detectFocus**: Calls FastAPI `/detect-focus` endpoint (face/object detection for smart cropping)
4. **render**: Calls FastAPI `/render` endpoint (FFmpeg video rendering with captions)

## Setup

1. Install dependencies:
```bash
cd video-generator-fe
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```
FASTAPI_URL=http://localhost:8000
OPENAI_API_KEY=your-openai-api-key-here
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:3000 in your browser

5. Ensure FastAPI backend is running on `http://localhost:8000`

## Usage

### 1. Start the Next.js Dev Server

```bash
npm run dev
```

### 2. Use the API Routes

#### Standard Processing (POST `/api/process-video`)

```bash
curl -X POST http://localhost:3000/api/process-video \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "https://example.com/video.mp4"}'
```

Response:
```json
{
  "success": true,
  "result": {
    "videoUrl": "...",
    "transcript": {...},
    "clips": [...],
    "renderedVideos": [...]
  }
}
```

#### Streaming Updates (POST `/api/process-video/stream`)

```bash
curl -X POST http://localhost:3000/api/process-video/stream \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "https://example.com/video.mp4"}'
```

Returns Server-Sent Events (SSE) with updates at each node.

### 3. Direct Graph Usage (in code)

```typescript
import { videoProcessingGraph } from '@/lib/graph';

const initialState = {
  videoUrl: 'https://example.com/video.mp4',
  currentStage: 'transcribe',
};

const result = await videoProcessingGraph.invoke(initialState);
```

### 4. Test Script (Standalone)

```bash
# Install dependencies first
npm install

# Run the test script
npx tsx scripts/run-example.mjs https://example.com/video.mp4
```

## State Structure

See `lib/types.ts` for full state definition:

- `videoUrl`: Input video URL
- `transcript`: Whisper transcription with word-level timestamps
- `clips`: Array of identified clips with timestamps and scores
- `focusData`: Face/object detection data for smart cropping
- `renderedVideos`: Final rendered video URLs
- `currentStage`: Current workflow stage
- `errors`: Any errors encountered

## Project Structure

```
video-generator-fe/
├── app/
│   ├── page.tsx                           # Main page with upload & results
│   ├── layout.tsx                         # Root layout
│   ├── globals.css                        # Global styles with Tailwind
│   └── api/
│       └── process-video/
│           ├── route.ts                   # Standard processing endpoint
│           └── stream/route.ts            # Streaming updates endpoint
├── components/
│   ├── ui/                                # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── progress.tsx
│   ├── video-upload-dropzone.tsx          # File upload component
│   ├── workflow-progress.tsx              # Progress tracker with stages
│   └── video-player.tsx                   # Video player grid
├── lib/
│   ├── types.ts                           # TypeScript interfaces
│   ├── graph.ts                           # LangGraph workflow
│   ├── utils.ts                           # Utility functions (cn)
│   └── example-usage.ts                   # Example patterns
└── tailwind.config.ts                     # Tailwind configuration
```

## Components

### VideoUploadDropzone
- Drag & drop file upload
- File type validation (MP4, MOV, AVI, MKV)
- Visual feedback on file selection
- Uses lucide-react icons

### WorkflowProgress
- Real-time progress bar (0-100%)
- 4 workflow stages visualization
- Active stage highlighting
- Completion checkmarks
- Animated loading indicators

### VideoPlayer
- Grid layout for multiple clips
- 9:16 aspect ratio display
- Built-in video controls
- Download button for each clip
- Responsive design
