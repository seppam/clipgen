# Video Clipper — SPEC.md

## 1. Concept & Vision

**ClipGen** — an AI-powered video clipper that transforms long videos into viral-ready short clips. Upload a video or paste a YouTube URL, let the AI find the most engaging moments, select your clips, and export — all from a sleek local web app that runs on your Mac today and deploys to a VPS tomorrow.

The vibe: **professional creator studio meets minimal dark UI**. Think Final Cut Pro's precision with a Figma-like browser interface.

---

## 2. Design Language

**Aesthetic:** Dark studio — cinematic, precise, focused. No distractions from the content.

**Color Palette:**
- Background: `#0D0D0F`
- Surface: `#17171A`
- Surface Elevated: `#1E1E23`
- Border: `#2C2C33`
- Accent Primary: `#6366F1` (Indigo)
- Accent Glow: `#818CF8`
- Success: `#22C55E`
- Warning: `#F59E0B`
- Danger: `#EF4444`
- Text Primary: `#F4F4F5`
- Text Secondary: `#A1A1AA`
- Text Muted: `#52525B`

**Typography:**
- Headings: `Space Grotesk` (Google Fonts)
- Body/UI: `DM Sans` (Google Fonts)
- Mono (timestamps/code): `JetBrains Mono`

**Spatial System:**
- Base unit: 4px
- Component padding: 12px / 16px / 24px
- Section gaps: 24px / 32px
- Border radius: 8px (cards), 6px (buttons), 4px (inputs)

**Motion Philosophy:**
- Transitions: 150ms ease-out (micro), 250ms ease-in-out (panels)
- Clip detection: animated scanning bar during analysis
- Timeline: smooth scrub with momentum
- Clip cards: fade-in staggered 50ms

---

## 3. Layout & Structure

```
┌─────────────────────────────────────────────────────┐
│  HEADER: Logo + Nav (Upload | Library | Settings)   │
├─────────────────────────────────────────────────────┤
│                                                     │
│   ┌─────────────────────────────────────────────┐   │
│   │          VIDEO PLAYER (16:9 / 9:16)         │   │
│   │          with custom controls                │   │
│   └─────────────────────────────────────────────┘   │
│                                                     │
│   ┌─────────────────────────────────────────────┐   │
│   │  TIMELINE: waveform + scene markers         │   │
│   │  [====detected clip====] [====clip 2====]   │   │
│   └─────────────────────────────────────────────┘   │
│                                                     │
│   ┌─SOURCE─┐  ┌─CLIPS─────────────────────────┐     │
│   │Drop    │  │ [clip1] [clip2] [clip3]       │     │
│   │Video   │  │ [clip4] [clip5]               │     │
│   │or URL  │  │ + Custom time range           │     │
│   └────────┘  └───────────────────────────────┘     │
│                                                     │
│   [ ✂ GENERATE CLIPS ]    [ ⬆ EXPORT SELECTED ]    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Pages:**
1. **Editor** (/) — main workspace
2. **Library** (/library) — saved clips history
3. **Settings** (/settings) — output presets, FFmpeg path, theme

**Responsive:** Desktop-first (1280px+), tablet-adaptive (768px), mobile-functional (390px)

---

## 4. Features & Interactions

### 4.1 Video Input
- **Drag & drop** video file onto drop zone (MP4, MOV, AVI, MKV, WebM)
- **Paste YouTube URL** — yt-dlp downloads audio/video
- **Browse** — file picker fallback
- Max file size: 2GB (local) / unlimited for YouTube
- Shows: filename, duration, resolution, file size
- Error: unsupported format → red border + message

### 4.2 AI Scene Detection
- Click **"Detect Clips"** → progress bar animation
- FFmpeg scene detection runs on backend
- Identifies shots based on: scene change rate, audio peaks, motion
- Returns array of `{ start, end, score, reason }`
- Each detected clip shown as a **highlighted range** on timeline
- Overlay badges: "👋 Wave", "🗣 Speech", "⚡ Action", "🔥 High Energy"

### 4.3 Video Player
- Custom HTML5 player controls
- Play/Pause, scrub bar, volume, playback speed (0.5x–2x)
- Click on timeline segment → jump to that timestamp
- Keyboard shortcuts: Space (play/pause), ← → (±5s), J K L (shuttle)

### 4.4 Clip Selection
- **Toggle clips** on/off (checkbox on each clip card)
- **Custom range**: drag start/end handles on timeline
- **Adjust**: click clip → fine-tune start/end time with inputs
- **Preview**: click play icon on clip card → plays just that segment
- **Select All / Deselect All**
- Clip cards show: thumbnail, duration, timestamp, score badge

### 4.5 Clip Generation
- Click **"Generate Clips"**
- FFmpeg extracts each selected segment:
  - Re-encodes with H.264 (fast, compatible)
  - Audio: AAC 128kbps
  - Output format: MP4
  - Naming: `{original_name}_clip_{n}_{start}-{end}.mp4`
- Progress: per-clip progress bar with percentage
- Cancel button stops in-progress FFmpeg

### 4.6 Export & Upload
- **Download**: direct MP4 download to Downloads folder
- **Copy to clipboard**: (where supported)
- **Rename** before export
- Batch export: ZIP of all clips

### 4.7 Library
- Grid of previously generated clips
- Filter by: date, source video, duration
- Re-download, delete, regenerate with different settings

### 4.8 Output Presets (Settings)
- **Format**: MP4 (H.264), WebM (VP9)
- **Aspect ratio**: Original, 9:16 (TikTok), 1:1 (Feed), 16:9 (YouTube)
- **Quality**: Low (480p), Medium (720p), High (1080p), Original
- **Duration**: Max clip length slider (5s–120s)

---

## 5. Component Inventory

### Header
- Logo (left), nav tabs (center), settings icon (right)
- Active tab: indigo underline + glow
- Sticky on scroll

### DropZone
- Default: dashed border `#2C2C33`, icon + "Drop video here"
- Hover/Dragover: border `#6366F1`, background `#6366F1/10`, scale(1.01)
- Error: border `#EF4444`, shake animation
- Loading: spinner overlay

### VideoPlayer
- 16:9 container, `object-fit: contain`, black letterbox
- Custom controls bar: gradient overlay bottom, appears on hover
- Scrub bar: full-width, indigo fill for played portion
- Fullscreen toggle

### Timeline
- Canvas-based waveform visualization
- Clip ranges: indigo semi-transparent overlays
- Draggable start/end handles
- Current time indicator: vertical red line
- Zoom in/out buttons
- Time markers every 10s (adaptive)

### ClipCard
- Thumbnail (auto-generated), duration badge, timestamp range
- Score badge (top-right)
- Toggle checkbox (top-left)
- Hover: scale(1.02), elevated shadow
- Selected: indigo border + glow
- Loading: shimmer skeleton

### ProgressBar
- Animated indigo fill, percentage label
- Indeterminate: animated gradient sweep

### Settings Panel
- Slide-in drawer from right (300px)
- Form controls: toggles, sliders, dropdowns
- Save button → persist to JSON config

### Toast Notifications
- Bottom-right stack
- Types: success (green), error (red), info (indigo), warning (amber)
- Auto-dismiss: 4s, manual close button
- Slide-in animation

---

## 6. Technical Approach

### Stack
- **Frontend**: React 18 + Vite 5
- **Backend**: Node.js + Express 4
- **Video Processing**: FFmpeg (system binary)
- **YouTube Download**: yt-dlp
- **File Handling**: Multer (upload), direct stream (YouTube)
- **State**: React Context + useReducer
- **Styling**: Plain CSS with CSS variables (no Tailwind)

### Project Structure
```
clipgen/
├── client/                  # React Vite app
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── utils/
│   │   ├── styles/
│   │   └── App.jsx
│   ├── index.html
│   └── vite.config.js
├── server/                  # Express API
│   ├── routes/
│   ├── services/
│   │   ├── ffmpeg.js        # Scene detection + clip gen
│   │   └── youtube.js       # yt-dlp download
│   ├── uploads/             # Temporary uploaded files
│   ├── output/              # Generated clips
│   ├── index.js
│   └── package.json
├── package.json             # Root workspace
└── SPEC.md
```

### API Design

**POST /api/upload**
- Multipart form: `video` file
- Returns: `{ id, filename, duration, size, resolution, thumbnailPath }`

**POST /api/youtube**
- Body: `{ url }`
- Returns: `{ id, title, duration, thumbnailPath, filePath }`
- Progress: SSE stream `text/event-stream`

**POST /api/detect**
- Body: `{ videoId, minClipDuration, maxClipDuration }`
- Returns: `{ clips: [{ start, end, score, reason }] }`

**POST /api/generate**
- Body: `{ videoId, clips: [{ start, end, format, quality, aspect }] }`
- Returns: SSE stream with progress updates
- Final: `{ clips: [{ clipId, path, size, duration }] }`

**GET /api/download/:clipId**
- Streams the generated clip file

**GET /api/stream/:videoId**
- Streams video for playback (range request support)

**GET /api/library**
- Returns: `{ clips: [...] }` (from output folder metadata)

### Data Model
```js
// Video (in-memory or JSON file)
{
  id: "uuid",
  source: "upload" | "youtube",
  originalName: "my_video.mp4",
  youtubeUrl: null,
  duration: 3600,
  resolution: "1920x1080",
  size: 524288000,
  uploadedAt: "ISO8601",
  filePath: "uploads/uuid.mp4",
  thumbnailPath: "uploads/uuid.jpg",
  detectedClips: [{ start, end, score, reason }]
}

// GeneratedClip
{
  id: "uuid",
  videoId: "uuid",
  sourceVideo: "my_video.mp4",
  start: 45.5,
  end: 72.3,
  duration: 26.8,
  outputPath: "output/uuid_clip_1.mp4",
  size: 15728640,
  format: "mp4",
  quality: "720p",
  aspect: "9:16",
  createdAt: "ISO8601"
}
```

### Deployment Notes
- **Local**: `npm run dev` starts both client (port 5173) + server (port 3001)
- **VPS**: `npm run build` → client builds to `dist/`, server runs via PM2
- **Env vars**: `PORT`, `UPLOAD_DIR`, `OUTPUT_DIR`, `FFMPEG_PATH`, `YTDLP_PATH`
- **YouTube**: yt-dlp must be installed on VPS (`pip install yt-dlp` or binary)
