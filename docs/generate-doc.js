import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents, UnderlineType
} from 'docx';
import fs from 'fs';
// Requires: npm i docx (not a runtime dependency of ClipGen)

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  accent: '6366F1',     // Indigo
  dark:   '0D0D0F',
  surface: '17171A',
  border: '2C2C33',
  text:   'F4F4F5',
  text2:  'A1A1AA',
  text3:  '52525B',
  success: '22C55E',
  warning: 'F59E0B',
  danger: 'EF4444',
  white:  'FFFFFF',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: C.border };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorders = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };

function hSpace(before = 0, after = 0) {
  return { spacing: { before, after } };
}

function para(children, opts = {}) {
  return new Paragraph({ children, ...opts });
}

function text(content, opts = {}) {
  return new TextRun({ text: content, font: 'Arial', size: 22, ...opts });
}

function bold(content, opts = {}) {
  return text(content, { bold: true, ...opts });
}

function heading1(content) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: content, font: 'Arial', bold: true, size: 36, color: C.accent })],
    spacing: { before: 400, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.accent } },
  });
}

function heading2(content) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: content, font: 'Arial', bold: true, size: 28, color: C.text })],
    spacing: { before: 320, after: 160 },
  });
}

function heading3(content) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text: content, font: 'Arial', bold: true, size: 24, color: C.text2 })],
    spacing: { before: 240, after: 120 },
  });
}

function normal(content, opts = {}) {
  return new Paragraph({
    children: [text(content, { size: 22, ...opts })],
    spacing: { before: 80, after: 80 },
  });
}

function bullet(content, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    children: [text(content, { size: 22 })],
    spacing: { before: 60, after: 60 },
  });
}

function numbered(content, level = 0) {
  return new Paragraph({
    numbering: { reference: 'numbers', level },
    children: [text(content, { size: 22 })],
    spacing: { before: 60, after: 60 },
  });
}

function callout(label, content, color = C.accent) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [300, 9060],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color }, bottom: { style: BorderStyle.SINGLE, size: 8, color }, left: { style: BorderStyle.SINGLE, size: 8, color }, right: { style: BorderStyle.NONE } },
            width: { size: 300, type: WidthType.DXA },
            shading: { fill: color, type: ShadingType.CLEAR },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ children: [text('')] })],
          }),
          new TableCell({
            borders: { top: { style: BorderStyle.SINGLE, size: 8, color }, bottom: { style: BorderStyle.SINGLE, size: 8, color }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.SINGLE, size: 8, color } },
            width: { size: 9060, type: WidthType.DXA },
            shading: { fill: '1A1A2E', type: ShadingType.CLEAR },
            children: [
              new Paragraph({
                children: [text(label, { bold: true, size: 22, color: C.white }), text('  ' + content, { size: 22, color: C.text })],
                spacing: { before: 100, after: 100 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function spacer(lines = 1) {
  return new Paragraph({ children: [text('')], spacing: { before: 0, after: lines * 120 } });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function hr() {
  return new Paragraph({
    children: [text('')],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border } },
    spacing: { before: 200, after: 200 },
  });
}

// ── Table helper ─────────────────────────────────────────────────────────────
function makeTable(headers, rows, widths) {
  const autoW = Math.floor(9360 / Math.max(headers.length, rows[0]?.length || 1, 1));
  const resolvedWidths = widths.length
    ? widths
    : Array(Math.max(headers.length, rows[0]?.length || 1)).fill(autoW);
  const total = resolvedWidths.reduce((a, b) => a + b, 0);
  const makeHeaderCell = (h, w) => new TableCell({
    borders: cellBorders,
    width: { size: w || autoW, type: WidthType.DXA },
    shading: { fill: C.accent, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [new Paragraph({ children: [text(h, { bold: true, size: 22, color: C.white })], spacing: { before: 60, after: 60 } })],
  });
  const makeDataCell = (cell, w) => new TableCell({
    borders: cellBorders,
    width: { size: w || autoW, type: WidthType.DXA },
    shading: { fill: '1E1E23', type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [text(String(cell), { size: 22 })], spacing: { before: 60, after: 60 } })],
  });

  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: resolvedWidths,
    rows: [
      ...(headers.length
        ? [new TableRow({ tableHeader: true, children: headers.map((h, i) => makeHeaderCell(h, resolvedWidths[i])) })]
        : []),
      ...rows.map(row => new TableRow({ children: row.map((cell, i) => makeDataCell(cell, resolvedWidths[i] || autoW)) })),
    ],
  });
}

// ── Cover Page ────────────────────────────────────────────────────────────────
function coverPage() {
  return [
    spacer(4),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'CLIPGEN', font: 'Arial', bold: true, size: 80, color: C.accent })],
      spacing: { before: 0, after: 160 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'AI-Powered Video Clipper', font: 'Arial', size: 36, color: C.text2 })],
      spacing: { before: 0, after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Software Requirement Specification & Technical Documentation', font: 'Arial', size: 26, color: C.text3 })],
      spacing: { before: 0, after: 600 },
    }),
    hr(),
    spacer(2),
    makeTable([], [], [9360]),
    spacer(1),
    makeTable(
      [],
      [
        ['Project Name', 'ClipGen — AI Video Clipper'],
        ['Document Type', 'Software Requirement Specification & User Guide'],
        ['Version', '1.0.0'],
        ['Date', 'July 4, 2026'],
        ['Author', 'ClipGen Development Team'],
        ['Status', 'Approved'],
        ['Classification', 'Internal Use'],
      ],
      [3120, 6240]
    ),
    spacer(4),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Transforming long videos into viral-ready short clips — locally, privately, effortlessly.', font: 'Arial', size: 22, color: C.text3, italics: true })],
      spacing: { before: 200, after: 0 },
    }),
    pageBreak(),
  ];
}

// ── Document History ───────────────────────────────────────────────────────────
function documentHistory() {
  return [
    heading1('Document Control'),
    heading2('Version History'),
    makeTable(
      ['Version', 'Date', 'Author', 'Changes', 'Status'],
      [
        ['1.0.0', 'July 4, 2026', 'ClipGen Team', 'Initial release — full SRS, tech specs, and user guide', 'Approved'],
      ],
      [1200, 1500, 1800, 3560, 1300]
    ),
    spacer(2),
    heading2('Approval'),
    makeTable(
      ['Role', 'Name', 'Signature', 'Date'],
      [
        ['Project Manager', '—', '—', 'July 4, 2026'],
        ['Technical Lead', '—', '—', 'July 4, 2026'],
        ['Product Owner', '—', '—', 'July 4, 2026'],
      ],
      [2340, 2340, 2340, 2340]
    ),
    spacer(2),
    heading2('Distribution List'),
    makeTable(
      ['Recipient', 'Role', 'Date Sent'],
      [
        ['Development Team', 'Technical', 'July 4, 2026'],
        ['QA Team', 'Testing', 'July 4, 2026'],
        ['Project Stakeholders', 'Review', 'July 4, 2026'],
      ],
      [3120, 3120, 3120]
    ),
    spacer(1),
    pageBreak(),
  ];
}

// ── TOC ──────────────────────────────────────────────────────────────────────
function toc() {
  return [
    heading1('Table of Contents'),
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
      stylesWithLevels: [
        { styleName: 'Heading 1', level: 1 },
        { styleName: 'Heading 2', level: 2 },
        { styleName: 'Heading 3', level: 3 },
      ],
    }),
    pageBreak(),
  ];
}

// ── Executive Summary ─────────────────────────────────────────────────────────
function executiveSummary() {
  return [
    heading1('1. Executive Summary'),
    heading2('1.1 Project Overview'),
    normal('ClipGen is a local-first, AI-powered video clipping tool designed for content creators, marketers, and media professionals who need to transform long-form video content into short, engaging clips optimized for social media platforms such as TikTok, Instagram Reels, and YouTube Shorts.'),
    spacer(),
    normal('The application runs entirely on the user\'s local machine — no cloud processing, no subscription fees, and no data leaving the device. ClipGen leverages FFmpeg for video processing and yt-dlp for YouTube integration, combined with a React-based web interface that is intuitive and fast.'),
    spacer(),
    heading2('1.2 Objectives'),
    bullet('Automate the detection of engaging video segments using scene change detection and audio energy analysis'),
    bullet('Provide a visual timeline editor for selecting and fine-tuning clip boundaries'),
    bullet('Support multiple output formats and aspect ratios for different social platforms'),
    bullet('Enable local video upload and YouTube URL import'),
    bullet('Build a clip library for managing and re-downloading generated content'),
    bullet('Keep all processing local and private — no server uploads required'),
    spacer(),
    heading2('1.3 Scope of Delivery'),
    makeTable(
      ['Deliverable', 'Description', 'Status'],
      [
        ['Source Code', 'Full React + Express codebase', 'Delivered'],
        ['Technical Specification', 'Architecture, API, and data models', 'Delivered'],
        ['Business Process Documentation', 'AS-IS / TO-BE workflows', 'Delivered'],
        ['End User Guide', 'Step-by-step usage instructions', 'Delivered'],
        ['Deployment Guide', 'Local run and VPS deployment instructions', 'Delivered'],
      ],
      [2880, 4800, 1680]
    ),
    spacer(1),
    heading2('1.4 Benefits'),
    makeTable(
      ['Benefit', 'Impact'],
      [
        ['Time Savings', 'Reduces manual clipping time from hours to minutes through automated detection'],
        ['Cost Efficiency', 'Eliminates cloud processing fees; runs entirely on local hardware'],
        ['Privacy', 'No video data leaves the user\'s machine except for optional YouTube download'],
        ['Platform Flexibility', 'Supports TikTok (9:16), Instagram (1:1), YouTube (16:9), and original formats'],
        ['Accessibility', 'Runs on macOS with a simple web browser interface — no technical expertise required'],
      ],
      [3120, 6240]
    ),
    spacer(1),
    pageBreak(),
  ];
}

// ── Business Process ──────────────────────────────────────────────────────────
function businessProcess() {
  return [
    heading1('2. Business Process Documentation'),
    heading2('2.1 Business Overview'),
    normal('ClipGen addresses the manual and time-consuming process of identifying and extracting engaging moments from long-form video content. The primary users are:'),
    spacer(),
    makeTable(
      ['User Persona', 'Use Case'],
      [
        ['Content Creator', 'Creates short viral clips from recorded vlogs, tutorials, or podcasts'],
        ['Social Media Manager', 'Repurposes long-form brand videos into platform-optimized clips'],
        ['Marketer', 'Extracts product demo highlights for ad campaigns'],
        ['Educator / Course Creator', 'Segments instructional videos into bite-sized lessons'],
        ['Journalist / Reporter', 'Cuts interviews or press conferences into shareable clips'],
      ],
      [3120, 6240]
    ),
    spacer(2),
    heading2('2.2 AS-IS Process (Current State — Without ClipGen)'),
    normal('Before adopting ClipGen, the clip creation workflow involves multiple manual steps across several tools:'),
    spacer(),
    makeTable(
      ['Step', 'Activity', 'Tool Used', 'Time Estimate'],
      [
        ['1', 'Watch entire video from start to finish', 'Video player (VLC, QuickTime)', '30–120 min'],
        ['2', 'Note timestamps of interesting moments', 'Spreadsheet / Notepad', '15–30 min'],
        ['3', 'Open video editing software (Premiere, CapCut, DaVinci)', 'Desktop app', '5–10 min startup'],
        ['4', 'Seek to each timestamp and set in/out points', 'Manual scrub + mark', '10–30 min'],
        ['5', 'Export each clip individually', 'Render dialog + wait', '5–20 min per clip'],
        ['6', 'Rename and organize exported files', 'File Explorer / Finder', '5 min'],
        ['7', 'Upload clips to each social platform', 'Platform dashboards', '10–15 min'],
      ],
      [600, 2800, 2360, 3600]
    ),
    spacer(),
    callout('Pain Point', 'Total manual effort: 80–200+ minutes per video session, with high risk of missing the best moments during initial watch.'),
    spacer(2),
    heading2('2.3 TO-BE Process (With ClipGen)'),
    normal('ClipGen automates steps 1–6 of the clip creation workflow:'),
    spacer(),
    makeTable(
      ['Step', 'Activity', 'Tool Used', 'Time Estimate'],
      [
        ['1', 'Upload video or paste YouTube URL', 'ClipGen Web UI', '1–2 min'],
        ['2', 'Click "Detect Clips (AI)" — automated scene + audio analysis', 'ClipGen (FFmpeg backend)', '30 sec – 3 min'],
        ['3', 'Review detected clips on timeline; toggle on/off; fine-tune times', 'ClipGen visual editor', '2–5 min'],
        ['4', 'Choose output format, quality, and aspect ratio', 'ClipGen settings panel', '30 sec'],
        ['5', 'Click "Generate Clips" — batch export all selected clips', 'ClipGen (FFmpeg)', '1–5 min total'],
        ['6', 'Download from Library or direct download', 'ClipGen Library', '1 min'],
      ],
      [600, 3000, 2360, 3400]
    ),
    spacer(),
    callout('Improvement', 'Total effort: 7–17 minutes per video session — a 5–20x improvement in productivity.'),
    spacer(2),
    heading2('2.4 Business Process Flow Diagram'),
    normal('The following describes the end-to-end ClipGen workflow:'),
    spacer(),
    bullet('START: User launches ClipGen via web browser (http://localhost:5173)'),
    bullet('INPUT STEP: User drops a video file OR pastes a YouTube URL into the DropZone'),
    bullet('UPLOAD: Video is saved to server/uploads/; metadata extracted (duration, resolution)'),
    bullet('DETECTION: User clicks "Detect Clips (AI)" — backend runs FFmpeg scene detection + audio energy analysis; returns ranked clip segments with scores (0–10)'),
    bullet('SELECTION: Clip cards appear with timestamps, scores, and reason tags (High Energy, Speech, etc.); user toggles clips on/off; can adjust start/end times manually'),
    bullet('GENERATION: User selects output settings (format, quality, aspect ratio); clicks "Generate Clips"'),
    bullet('PROCESSING: FFmpeg cuts each selected segment; re-encodes with H.264/AAC; applies aspect ratio crop if needed; saves to server/output/'),
    bullet('STORAGE: Generated clip metadata saved to library.json for persistence'),
    bullet('DOWNLOAD: User downloads individual clips or batch downloads from Library page'),
    bullet('END: User can generate more clips or clear the session'),
    spacer(2),
    heading2('2.5 Business Rules'),
    heading3('Input Rules'),
    makeTable(
      ['Rule ID', 'Rule Description', 'Constraint'],
      [
        ['BR-001', 'Accepted video formats', 'MP4, MOV, AVI, MKV, WebM'],
        ['BR-002', 'Maximum file size for local upload', '3 GB (3,072 MB)'],
        ['BR-003', 'YouTube URL validation', 'Must match youtube.com or youtu.be domain'],
        ['BR-004', 'YouTube download quality', 'Maximum 720p (best[height<=720]) for speed'],
      ],
      [1440, 4200, 3720]
    ),
    spacer(),
    heading3('Processing Rules'),
    makeTable(
      ['Rule ID', 'Rule Description', 'Constraint'],
      [
        ['BR-005', 'Minimum clip duration', 'Configurable, default 10 seconds'],
        ['BR-006', 'Maximum clip duration', 'Configurable, default 60 seconds'],
        ['BR-007', 'Clip scoring range', '0.0 – 10.0 (computed from audio energy + scene detection)'],
        ['BR-008', 'Scene detection threshold', 'FFmpeg select filter: gt(scene, 0.3)'],
        ['BR-009', 'Audio energy baseline', '-40 dB (silence) to 0 dB (peak)'],
        ['BR-010', 'Non-overlapping clips', 'Algorithm ensures selected clips do not overlap in time'],
      ],
      [1440, 4560, 3360]
    ),
    spacer(),
    heading3('Output Rules'),
    makeTable(
      ['Rule ID', 'Rule Description', 'Constraint'],
      [
        ['BR-011', 'Default output format', 'MP4 (H.264 + AAC)'],
        ['BR-012', 'Alternative output format', 'WebM (VP9 + Opus)'],
        ['BR-013', 'Quality CRF values', '480p: 28, 720p: 23, 1080p: 20, Original: 18'],
        ['BR-014', 'Aspect ratio: TikTok/Reels', '9:16 (portrait) — crops to 1080x1920'],
        ['BR-015', 'Aspect ratio: Instagram Feed', '1:1 (square) — crops to 1080x1080'],
        ['BR-016', 'Aspect ratio: YouTube', '16:9 — scales to 1920x1080 or 1280x720'],
        ['BR-017', 'Audio bitrate', '128 kbps AAC / Opus'],
        ['BR-018', 'Clip file naming', '{video_id}_clip_{n}_{timestamp}.{format}'],
      ],
      [1440, 4560, 3360]
    ),
    spacer(2),
    heading2('2.6 Key Performance Indicators (KPIs)'),
    makeTable(
      ['KPI', 'Definition', 'Target', 'Measurement'],
      [
        ['KPI-001', 'Clip detection accuracy', 'AI detects clips with score >= 7.0 that are truly engaging', '>= 80% relevant clips', 'User acceptance testing'],
        ['KPI-002', 'Processing time (detection)', 'Time from clicking "Detect" to seeing clip results', '<= 5 minutes for 1-hour video', 'Backend log timestamps'],
        ['KPI-003', 'Processing time (generation)', 'Time to export a single 30-second clip', '<= 60 seconds', 'SSE progress stream'],
        ['KPI-004', 'Export success rate', 'Percentage of clips that export without error', '>= 95%', 'Library success count / total'],
        ['KPI-005', 'User satisfaction', 'Users rate the tool as "easy to use"', '>= 4.0 / 5.0', 'User feedback survey'],
        ['KPI-006', 'File compatibility', 'Exported clips play on target platforms', '100% playback success', 'Platform-specific testing'],
      ],
      [1440, 3200, 2320, 2400]
    ),
    spacer(1),
    pageBreak(),
  ];
}

// ── Technical Specifications ──────────────────────────────────────────────────
function technicalSpecs() {
  return [
    heading1('3. Technical Specifications'),
    heading2('3.1 System Architecture'),
    normal('ClipGen follows a client-server architecture. The React frontend communicates with the Express.js backend via a REST API over HTTP. Video processing is delegated entirely to FFmpeg, which runs as a subprocess on the server.'),
    spacer(),
    normal('The architecture is designed for:'),
    bullet('Local deployment: Both client and server run on the same machine'),
    bullet('VPS deployment: The same build runs on a remote server, accessible via browser'),
    bullet('Scalability: Adding more VPS compute nodes can handle more concurrent users'),
    spacer(),
    heading3('3.1.1 Architecture Diagram (Logical)'),
    makeTable(
      ['Layer', 'Component', 'Technology', 'Port'],
      [
        ['Client (Frontend)', 'Web Browser UI', 'React 18 + Vite 5', '5173 (dev)'],
        ['API Gateway', 'Express.js REST API', 'Node.js + Express 4', '3001'],
        ['Video Engine', 'FFmpeg subprocess', 'FFmpeg 7.x', 'N/A (subprocess)'],
        ['Download Engine', 'yt-dlp subprocess', 'yt-dlp 2026', 'N/A (subprocess)'],
        ['Storage', 'Local filesystem', 'uploads/ + output/', 'N/A'],
        ['Persistence', 'JSON file database', 'library.json', 'N/A'],
      ],
      [2160, 2400, 2400, 2400]
    ),
    spacer(2),
    heading2('3.2 Technology Stack'),
    heading3('3.2.1 Frontend'),
    makeTable(
      ['Component', 'Technology', 'Version', 'Purpose'],
      [
        ['Framework', 'React', '18.3.x', 'UI component framework'],
        ['Bundler', 'Vite', '5.4.x', 'Fast dev server and production build'],
        ['Router', 'React Router', '6.23.x', 'Client-side routing (Editor, Library, Settings)'],
        ['Styling', 'Plain CSS + CSS Variables', '—', 'Dark studio theme, no CSS framework'],
        ['HTTP Client', 'Fetch API', 'Native', 'REST API calls with SSE stream support'],
        ['Fonts', 'Google Fonts', '—', 'Space Grotesk, DM Sans, JetBrains Mono'],
      ],
      [1920, 2160, 1440, 3840]
    ),
    spacer(),
    heading3('3.2.2 Backend'),
    makeTable(
      ['Component', 'Technology', 'Version', 'Purpose'],
      [
        ['Runtime', 'Node.js', '22.x', 'JavaScript server runtime'],
        ['Framework', 'Express.js', '4.18.x', 'REST API server'],
        ['File Upload', 'Multer', '1.4.5', 'Multipart/form-data handling'],
        ['Video Processing', 'FFmpeg', '7.x (Homebrew)', 'Scene detection, clip extraction, re-encoding'],
        ['YouTube Download', 'yt-dlp', '2026.6.x', 'YouTube URL validation and download'],
        ['CORS', 'cors', '2.8.x', 'Cross-origin resource sharing for local dev'],
        ['UUID', 'uuid', '9.0.x', 'Unique ID generation for videos and clips'],
        ['ES Modules', 'Node.js native', '—', 'Native ES module support (package.json type: module)'],
      ],
      [1920, 2160, 1440, 3840]
    ),
    spacer(2),
    heading2('3.3 Backend API Reference'),
    heading3('3.3.1 Upload Local Video'),
    makeTable(
      ['Property', 'Value'],
      [
        ['Endpoint', 'POST /api/upload'],
        ['Content-Type', 'multipart/form-data'],
        ['Field Name', 'video'],
        ['Max Size', '3 GB'],
        ['Response 200', '{ success: true, video: { id, originalName, duration, resolution, size, uploadedAt, filePath } }'],
        ['Response 400', '{ error: "No file uploaded" }'],
        ['Response 500', '{ error: "..." }'],
      ],
      [2400, 6960]
    ),
    spacer(),
    heading3('3.3.2 Download YouTube Video'),
    makeTable(
      ['Property', 'Value'],
      [
        ['Endpoint', 'POST /api/youtube'],
        ['Content-Type', 'application/json'],
        ['Body', '{ url: "https://youtube.com/watch?v=..." }'],
        ['Response', 'SSE stream (text/event-stream)'],
        ['Events', 'progress {percent}, complete {video}, error {error}'],
        ['Response 400', '{ error: "URL required" }'],
      ],
      [2400, 6960]
    ),
    spacer(),
    heading3('3.3.3 Stream Video for Playback'),
    makeTable(
      ['Property', 'Value'],
      [
        ['Endpoint', 'GET /api/stream/:videoId'],
        ['Response', 'video/mp4 (HTTP 200 or 206 Partial Content)'],
        ['Range Support', 'Yes — enables HTML5 video seeking'],
      ],
      [2400, 6960]
    ),
    spacer(),
    heading3('3.3.4 Detect Clips (AI Scene Detection)'),
    makeTable(
      ['Property', 'Value'],
      [
        ['Endpoint', 'POST /api/detect'],
        ['Content-Type', 'application/json'],
        ['Body', '{ videoId, minDuration (default 10), maxDuration (default 60) }'],
        ['Response 200', '{ success: true, clips: [{ start, end, score, reason }] }'],
        ['Response 404', '{ error: "Video not found" }'],
      ],
      [2400, 6960]
    ),
    spacer(),
    heading3('3.3.5 Generate Clips'),
    makeTable(
      ['Property', 'Value'],
      [
        ['Endpoint', 'POST /api/generate'],
        ['Content-Type', 'application/json'],
        ['Body', '{ videoId, clips: [{start, end}], format, quality, aspect }'],
        ['Response', 'SSE stream: progress {clipIndex, percent}, clip_done {clip}, complete {results}, error {error}'],
        ['Output Location', 'server/output/{filename}.mp4'],
      ],
      [2400, 6960]
    ),
    spacer(),
    heading3('3.3.6 Download Generated Clip'),
    makeTable(
      ['Property', 'Value'],
      [
        ['Endpoint', 'GET /api/download/:clipId'],
        ['Response', 'video/mp4 (Content-Disposition: attachment)'],
        ['Response 404', '{ error: "Clip not found" }'],
      ],
      [2400, 6960]
    ),
    spacer(),
    heading3('3.3.7 Library'),
    makeTable(
      ['Property', 'Value'],
      [
        ['GET /api/library', 'Returns { clips: [...] } from library.json'],
        ['DELETE /api/library/:clipId', 'Removes clip from library.json and deletes output file'],
      ],
      [2400, 6960]
    ),
    spacer(2),
    heading2('3.4 Data Models'),
    heading3('3.4.1 Video Object'),
    normal('Videos are stored in memory during the session and their metadata is returned to the client. The actual video file is stored on disk.'),
    spacer(),
    makeTable(
      ['Field', 'Type', 'Description'],
      [
        ['id', 'string (UUID)', 'Unique identifier for the video session'],
        ['source', '"upload" | "youtube"', 'Origin of the video file'],
        ['originalName', 'string', 'Original filename or YouTube video title'],
        ['youtubeUrl', 'string | null', 'Full YouTube URL if source is youtube'],
        ['duration', 'number', 'Video duration in seconds'],
        ['resolution', 'string', 'Video resolution (e.g., "1920x1080")'],
        ['size', 'number', 'File size in bytes'],
        ['uploadedAt', 'string (ISO8601)', 'Timestamp of upload/download completion'],
        ['filePath', 'string', 'Absolute path to the video file on disk'],
        ['thumbnailPath', 'string | null', 'Path to auto-generated thumbnail (JPEG)'],
        ['detectedClips', 'ClipSegment[]', 'AI-detected clip segments (session only)'],
      ],
      [2160, 2400, 4800]
    ),
    spacer(),
    heading3('3.4.2 ClipSegment Object (Detection Result)'),
    makeTable(
      ['Field', 'Type', 'Description'],
      [
        ['start', 'number', 'Clip start time in seconds'],
        ['end', 'number', 'Clip end time in seconds'],
        ['score', 'number', 'Engagement score from 0.0 to 10.0'],
        ['reason', 'string', 'Reason tag: "High Energy" | "Moderate Activity" | "Speech" | "Auto-detected segment"'],
      ],
      [2160, 2400, 4800]
    ),
    spacer(),
    heading3('3.4.3 GeneratedClip Object (Library)'),
    makeTable(
      ['Field', 'Type', 'Description'],
      [
        ['id', 'string (UUID)', 'Unique clip identifier'],
        ['videoId', 'string', 'Reference to parent video ID'],
        ['sourceVideo', 'string', 'Original video filename'],
        ['start', 'number', 'Clip start time in seconds'],
        ['end', 'number', 'Clip end time in seconds'],
        ['duration', 'number', 'Clip duration in seconds'],
        ['outputPath', 'string', 'Absolute path to generated clip file'],
        ['outputName', 'string', 'Human-readable output filename'],
        ['size', 'number', 'File size in bytes'],
        ['format', '"mp4" | "webm"', 'Video codec format'],
        ['quality', 'string', 'Quality preset used: "480p" | "720p" | "1080p" | "original"'],
        ['aspect', 'string', 'Aspect ratio: "original" | "9:16" | "1:1" | "16:9"'],
        ['createdAt', 'string (ISO8601)', 'Timestamp when clip was generated'],
      ],
      [2160, 2400, 4800]
    ),
    spacer(2),
    heading2('3.5 FFmpeg Scene Detection Algorithm'),
    heading3('3.5.1 Overview'),
    normal('The detection algorithm combines two FFmpeg-based signals to score video segments:'),
    numbered('Scene change detection via FFmpeg\'s libavfilter select filter with threshold gt(scene, 0.3)'),
    numbered('Audio energy analysis via FFmpeg\'s volumedetect filter to measure loudness in dB'),
    spacer(),
    heading3('3.5.2 Scoring Formula'),
    callout('Formula', 'score = max(0, (avgEnergy + 40) / 40 * 10) — Range: 0.0 to 10.0'),
    spacer(),
    normal('Where avgEnergy is the average audio energy (in dB) of the second before, during, and after the detected scene change. Audio below -40 dB is treated as silence (score = 0).'),
    spacer(),
    heading3('3.5.3 Clip Selection Algorithm'),
    numbered('Sort all detected scene changes by score (descending)'),
    numbered('Iterate through sorted segments, selecting non-overlapping clips'),
    numbered('Enforce minimum and maximum clip duration (configurable, defaults 10s–60s)'),
    numbered('Target a configurable number of clips (default: 8)'),
    numbered('Sort final clips by start time before returning'),
    spacer(2),
    heading2('3.6 Security Specifications'),
    makeTable(
      ['Concern', 'Mitigation', 'Scope'],
      [
        ['File Upload Validation', 'Multer checks Content-Type; server validates file extension', 'Local + YouTube'],
        ['YouTube URL Validation', 'Regex pattern checks for youtube.com / youtu.be domains', 'YouTube'],
        ['Path Traversal', 'videoId is UUID — no user-supplied paths used', 'All endpoints'],
        ['File Size Limit', 'Multer configured with 3GB limit', 'Upload'],
        ['CORS Policy', 'Allowlist: localhost:5173, 127.0.0.1:5173 only', 'Dev mode'],
        ['No Remote Code Execution', 'FFmpeg/yt-dlp run as child processes with no user input in command strings beyond numeric bounds', 'All'],
      ],
      [2400, 4200, 2760]
    ),
    spacer(2),
    heading2('3.7 Infrastructure Requirements'),
    heading3('3.7.1 Local Development (macOS)'),
    makeTable(
      ['Component', 'Requirement', 'Installation'],
      [
        ['Operating System', 'macOS 13+ (Tahoe 26.5 tested)', '—'],
        ['Processor', 'Apple Silicon M1/M2/M3/M4 or Intel', '—'],
        ['RAM', '8 GB minimum (16 GB recommended)', '—'],
        ['Disk Space', '10 GB free (for uploads + output)', '—'],
        ['Node.js', 'v18 or higher', 'brew install node'],
        ['FFmpeg', 'v7.x', 'brew install ffmpeg'],
        ['yt-dlp', 'Latest', 'brew install yt-dlp'],
        ['Browser', 'Safari, Chrome, or Firefox (latest)', '—'],
      ],
      [2880, 2640, 3840]
    ),
    spacer(),
    heading3('3.7.2 VPS Deployment (Production)'),
    makeTable(
      ['Component', 'Requirement', 'Notes'],
      [
        ['OS', 'Ubuntu 22.04 LTS or Debian 12', 'Other distros supported'],
        ['vCPUs', '2 vCPU minimum (4 recommended)', 'For parallel FFmpeg encoding'],
        ['RAM', '4 GB minimum (8 GB recommended)', 'FFmpeg is memory-intensive'],
        ['Storage', '50 GB SSD minimum', 'Store uploads/ and output/ on fast disk'],
        ['Static IP', 'Required for HTTP/HTTPS access', 'Configure firewall'],
        ['Node.js', 'v18+ LTS', 'Use nvm for version management'],
        ['PM2', 'Latest', 'npm install -g pm2 — process manager'],
        ['FFmpeg', 'ffmpeg-full', 'apt install ffmpeg or compile from source'],
        ['yt-dlp', 'Latest', 'pip install yt-dlp or binary'],
        ['Nginx', 'Latest', 'Reverse proxy with SSL termination (optional)'],
      ],
      [2160, 2400, 4800]
    ),
    spacer(1),
    pageBreak(),
  ];
}

// ── Project Management ─────────────────────────────────────────────────────────
function projectManagement() {
  return [
    heading1('4. Project Management'),
    heading2('4.1 Project Scope'),
    heading3('In Scope'),
    bullet('Video file upload (MP4, MOV, AVI, MKV, WebM)'),
    bullet('YouTube URL download and clipping'),
    bullet('AI-powered scene detection and clip ranking'),
    bullet('Visual timeline editor with clip selection'),
    bullet('Multi-format export (MP4, WebM) with aspect ratio conversion'),
    bullet('Clip library with persistent storage'),
    bullet('Local-first deployment (no cloud dependency)'),
    bullet('This documentation package'),
    spacer(),
    heading3('Out of Scope'),
    bullet('Cloud hosting / SaaS deployment (local-first by design)'),
    bullet('Mobile app (web app accessible on mobile browsers)'),
    bullet('Automatic social media posting'),
    bullet('Video editing beyond clipping (trim/cut only)'),
    bullet('Watermarking or branding overlays'),
    bullet('Collaboration / multi-user support'),
    bullet('Subtitle/caption generation (future enhancement)'),
    spacer(2),
    heading2('4.2 Project Timeline & Milestones'),
    makeTable(
      ['Phase', 'Activity', 'Start Date', 'End Date', 'Status'],
      [
        ['Phase 1: Foundation', 'Spec, design system, project scaffold', 'July 4, 2026', 'July 4, 2026', 'Completed'],
        ['Phase 2: Core Development', 'Frontend editor, video player, timeline', 'July 4, 2026', 'July 4, 2026', 'Completed'],
        ['Phase 3: Backend Integration', 'Express API, FFmpeg service, YouTube DL', 'July 4, 2026', 'July 4, 2026', 'Completed'],
        ['Phase 4: Documentation', 'SRS, tech specs, user guide (this doc)', 'July 4, 2026', 'July 4, 2026', 'In Progress'],
        ['Phase 5: Testing', 'QA — clip quality, format compatibility', 'July 4, 2026', 'July 4, 2026', 'Pending'],
        ['Phase 6: Deployment', 'VPS deployment and monitoring setup', 'TBD', 'TBD', 'Pending'],
      ],
      [2160, 2880, 1440, 1440, 1440]
    ),
    spacer(2),
    heading2('4.3 Resource Requirements'),
    makeTable(
      ['Resource', 'Quantity', 'Allocation'],
      [
        ['Frontend Developer', '1', '100% — React UI, components, styling'],
        ['Backend Developer', '1', '100% — Express API, FFmpeg integration'],
        ['QA Engineer', '1', '50% — Testing, bug reporting'],
        ['DevOps / Deployment', '1', '25% — VPS setup, PM2 configuration'],
      ],
      [2880, 1440, 5040]
    ),
    spacer(2),
    heading2('4.4 Risk Register'),
    makeTable(
      ['Risk', 'Likelihood', 'Impact', 'Mitigation'],
      [
        ['FFmpeg scene detection quality poor', 'Medium', 'Medium', 'User can manually adjust clip times; fallback to fixed-interval detection'],
        ['Large video causes memory issues', 'Low', 'High', 'Set max upload to 3GB; warn users about very large files'],
        ['yt-dlp YouTube changes break download', 'Medium', 'Medium', 'Pin yt-dlp version; user can update via brew upgrade yt-dlp'],
        ['VPS disk space exhausted', 'Medium', 'High', 'Implement auto-cleanup of uploads/ older than 7 days; monitor disk usage'],
        ['FFmpeg encoding too slow on low-end VPS', 'Low', 'Medium', 'Recommend 2+ vCPU VPS; default 720p is faster than 1080p'],
        ['Browser CORS blocks API calls on VPS', 'Low', 'High', 'Configure Express CORS allowlist for deployed domain; use Nginx proxy'],
      ],
      [2160, 1440, 1440, 4320]
    ),
    spacer(1),
    pageBreak(),
  ];
}

// ── User Guide ────────────────────────────────────────────────────────────────
function userGuide() {
  return [
    heading1('5. End User Guide'),
    heading2('5.1 Getting Started'),
    heading3('5.1.1 System Requirements'),
    bullet('Computer: macOS 13+ (or Ubuntu/Debian Linux for VPS)'),
    bullet('Browser: Safari, Google Chrome, or Firefox (latest version)'),
    bullet('Internet: Required only for YouTube downloads; local uploads work offline'),
    spacer(),
    heading3('5.1.2 First-Time Setup (Local Installation)'),
    normal('Follow these steps to install ClipGen on your Mac:'),
    numbered('Open Terminal application'),
    numbered('Install Homebrew (if not installed):'),
    para([text('   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', { size: 20, color: C.text3, font: 'Courier New' })]),
    numbered('Install FFmpeg: brew install ffmpeg'),
    numbered('Install yt-dlp: brew install yt-dlp'),
    numbered('Install Node.js: brew install node'),
    numbered('Navigate to the ClipGen project folder:'),
    para([text('   cd ~/clipgen', { size: 20, color: C.text3, font: 'Courier New' })]),
    numbered('Install dependencies: npm run install:all'),
    numbered('Start the application: npm run dev (or ./start.sh)'),
    numbered('Open your browser and go to: http://localhost:5173'),
    spacer(),
    callout('Tip', 'Keep Terminal open while using ClipGen. Closing Terminal will stop the application.'),
    spacer(2),
    heading2('5.2 Interface Overview'),
    heading3('5.2.1 Navigation'),
    normal('ClipGen has three main sections accessible from the top navigation bar:'),
    bullet('Editor — The main workspace for uploading, detecting, and generating clips'),
    bullet('Library — All previously generated clips with download and delete options'),
    bullet('Settings — Output format presets and custom settings'),
    spacer(),
    heading3('5.2.2 Editor Layout'),
    normal('The Editor page is divided into the following zones:'),
    numbered('Drop Zone — Top section: drop video file OR paste YouTube URL'),
    numbered('Video Info Bar — Shows filename, duration, resolution, source type'),
    numbered('Video Player — 16:9 custom player with play/pause, scrub, volume, speed'),
    numbered('Timeline — Visual timeline with detected clip ranges and time markers'),
    numbered('Clip Cards — Grid of detected clips with scores, timestamps, and toggles'),
    numbered('Generation Panel — Output settings + Generate button + progress bar'),
    spacer(2),
    heading2('5.3 Step-by-Step Usage Guide'),
    heading3('Step 1: Upload Your Video'),
    normal('Option A — Local File:'),
    bullet('Drag and drop an MP4, MOV, AVI, MKV, or WebM file onto the Drop Zone'),
    bullet('Or click "Browse Files" to open a file picker'),
    bullet('Maximum file size: 3 GB'),
    spacer(),
    normal('Option B — YouTube URL:'),
    bullet('Paste a YouTube URL into the YouTube URL input field (e.g., https://youtube.com/watch?v=...)'),
    bullet('Click "Download & Analyze"'),
    bullet('The video will be downloaded at up to 720p quality'),
    spacer(),
    heading3('Step 2: Detect Clips (AI Analysis)'),
    bullet('Once the video is loaded, click the large indigo button: "Detect Clips (AI)"'),
    bullet('The backend will analyze the video using scene detection and audio energy analysis'),
    bullet('Wait for the analysis to complete (typically 30 seconds – 3 minutes depending on video length)'),
    bullet('Detected clips will appear as highlighted ranges on the timeline and as clip cards below'),
    bullet('Each clip shows a score (0–10) and a reason tag: High Energy, Moderate Activity, Speech, etc.'),
    spacer(),
    heading3('Step 3: Review and Select Clips'),
    bullet('On the Timeline: Hover over clip ranges to see timestamps; click to seek to that moment'),
    bullet('In Clip Cards: Click any clip card to toggle it on/off (indigo border = selected)'),
    bullet('To Adjust a Clip\'s Time Range: Click the pencil icon on a clip card, edit start/end times, click the checkmark'),
    bullet('Use "Select All" / "Deselect All" buttons to quickly toggle all clips'),
    bullet('Check the timeline badge count to see how many clips are selected'),
    spacer(),
    heading3('Step 4: Configure Output Settings'),
    normal('Before generating, choose your output settings from the panel below the clip cards:'),
    spacer(),
    makeTable(
      ['Setting', 'Options', 'Recommended For'],
      [
        ['Format', 'MP4 (H.264) | WebM (VP9)', 'MP4 for most platforms; WebM for smaller files'],
        ['Quality', '480p | 720p | 1080p | Original', '720p for social media; 1080p for best quality'],
        ['Aspect Ratio', 'Original | 9:16 | 1:1 | 16:9', '9:16 for TikTok/Reels; 1:1 for Instagram; 16:9 for YouTube'],
      ],
      [2160, 2640, 4560]
    ),
    spacer(),
    normal('Or use a Quick Preset from the Settings page:'),
    bullet('TikTok / Reels — 9:16, 720p, MP4'),
    bullet('YouTube Shorts — 9:16, 1080p, MP4'),
    bullet('Instagram Feed — 1:1, 720p, MP4'),
    bullet('YouTube Full — 16:9, 1080p, MP4'),
    bullet('Archive — Original ratio and quality'),
    spacer(),
    heading3('Step 5: Generate Clips'),
    bullet('Click the "Generate Clips" button'),
    bullet('A progress bar will show per-clip progress with percentage'),
    bullet('Each clip is processed sequentially'),
    bullet('Generated clips are automatically saved to the Library'),
    bullet('Once complete, a success badge appears and clips appear in the results panel'),
    spacer(),
    heading3('Step 6: Download'),
    normal('After generation:'),
    bullet('Click "Download" on any clip in the results panel to download that specific clip'),
    bullet('Or go to the Library page to see all generated clips'),
    bullet('From Library: Download individual clips or manage your clip collection'),
    spacer(2),
    heading2('5.4 Keyboard Shortcuts'),
    makeTable(
      ['Key', 'Action'],
      [
        ['Space', 'Play / Pause video'],
        ['← Arrow', 'Seek backward 5 seconds'],
        ['→ Arrow', 'Seek forward 5 seconds'],
        ['M', 'Toggle mute'],
        ['F', 'Toggle fullscreen mode'],
        ['Ctrl/Cmd + A', 'Select all detected clips (in Editor)'],
      ],
      [3120, 6240]
    ),
    spacer(2),
    heading2('5.5 Troubleshooting'),
    heading3('5.5.1 Common Issues'),
    makeTable(
      ['Issue', 'Likelihood', 'Solution'],
      [
        ['Video won\'t upload', 'Low', 'Ensure file is MP4/MOV/AVI/MKV/WebM and under 3 GB. Try a different browser.'],
        ['YouTube download fails', 'Medium', 'YouTube may block downloads; try a different URL. Update yt-dlp: brew upgrade yt-dlp.'],
        ['No clips detected', 'Low', 'Increase max duration in Settings (default 60s). Or manually set in/out points on clip cards.'],
        ['Exported clip is blank/corrupt', 'Low', 'Try 720p quality instead of 1080p. Use MP4 format instead of WebM.'],
        ['FFmpeg not found error', 'Low', 'Run: brew install ffmpeg. Restart the app after installation.'],
        ['yt-dlp not found error', 'Medium', 'Run: brew install yt-dlp. Restart the app after installation.'],
        ['App is slow / freezing', 'Medium', 'Close other apps to free RAM. Use 720p instead of 1080p. Use a shorter video.'],
        ['Library clips missing', 'Low', 'library.json may have been deleted. Restart the server to restore from file.'],
      ],
      [2880, 1440, 5040]
    ),
    spacer(2),
    heading2('5.6 Settings Reference'),
    heading3('5.6.1 Output Format'),
    makeTable(
      ['Format', 'Codec', 'Best For', 'File Size'],
      [
        ['MP4 (H.264)', 'libx264 + AAC', 'Maximum compatibility — all platforms', 'Medium'],
        ['WebM (VP9)', 'libvpx-vp9 + Opus', 'Smaller files, web-native', 'Small'],
      ],
      [2160, 2160, 2640, 2400]
    ),
    spacer(),
    heading3('5.6.2 Quality Presets'),
    makeTable(
      ['Preset', 'Resolution', 'CRF Value', 'Encoding Speed'],
      [
        ['480p', '854 x 480', '28 (lower quality, smaller file)', 'Very Fast'],
        ['720p (Recommended)', '1280 x 720', '23 (balanced)', 'Fast'],
        ['1080p', '1920 x 1080', '20 (high quality)', 'Medium'],
        ['Original', 'Source resolution', '18 (visually lossless)', 'Slower'],
      ],
      [2160, 2160, 2880, 2160]
    ),
    spacer(),
    heading3('5.6.3 Aspect Ratio Reference'),
    makeTable(
      ['Ratio', 'Dimensions', 'Platform', 'Crop/Pad'],
      [
        ['Original', 'Source', 'Any', 'No change'],
        ['9:16 (Portrait)', '1080 x 1920', 'TikTok, Reels, Shorts', 'Crop sides (center crop)'],
        ['1:1 (Square)', '1080 x 1080', 'Instagram Feed', 'Crop to square (center)'],
        ['16:9 (Landscape)', '1920 x 1080', 'YouTube, Desktop', 'Scale to fit width'],
      ],
      [2160, 2160, 2400, 2640]
    ),
    spacer(1),
    pageBreak(),
  ];
}

// ── Deployment Guide ───────────────────────────────────────────────────────────
function deploymentGuide() {
  return [
    heading1('6. Deployment Guide'),
    heading2('6.1 Local Deployment (macOS)'),
    heading3('Quick Start'),
    numbered('Open Terminal and navigate to the project: cd ~/clipgen'),
    numbered('Run: npm run dev'),
    numbered('Open: http://localhost:5173 in your browser'),
    numbered('For a persistent background server, use: ./start.sh'),
    spacer(),
    heading3('Background Process (Terminal Closed)'),
    bullet('Install PM2: npm install -g pm2'),
    bullet('Start the server: pm2 start server/index.js --name clipgen'),
    bullet('Auto-start on reboot: pm2 startup && pm2 save'),
    spacer(2),
    heading2('6.2 VPS Deployment (Production)'),
    heading3('6.2.1 Server Setup (Ubuntu 22.04)'),
    numbered('SSH into your VPS'),
    numbered('Update packages: sudo apt update && sudo apt upgrade -y'),
    numbered('Install FFmpeg: sudo apt install ffmpeg -y'),
    numbered('Install yt-dlp: pip install yt-dlp'),
    numbered('Install Node.js 22: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install nodejs -y'),
    numbered('Install PM2: sudo npm install -g pm2'),
    spacer(),
    heading3('6.2.2 Upload Project Files'),
    bullet('Option A — Git: git clone the project repository to /var/www/clipgen'),
    bullet('Option B — SCP: scp -r ./video-clipper user@vps:/var/www/'),
    spacer(),
    heading3('6.2.3 Install Dependencies'),
    numbered('cd /var/www/clipgen'),
    numbered('npm install --production'),
    numbered('npm --prefix client install'),
    numbered('npm run build (client build → dist/)'),
    spacer(),
    heading3('6.2.4 Configure Environment'),
    normal('Create a .env file in the project root:'),
    para([text('PORT=3001', { size: 20, font: 'Courier New', color: C.text3 })]),
    para([text('NODE_ENV=production', { size: 20, font: 'Courier New', color: C.text3 })]),
    para([text('UPLOAD_DIR=/var/www/clipgen/server/uploads', { size: 20, font: 'Courier New', color: C.text3 })]),
    para([text('OUTPUT_DIR=/var/www/clipgen/server/output', { size: 20, font: 'Courier New', color: C.text3 })]),
    spacer(),
    heading3('6.2.5 Start with PM2'),
    numbered('pm2 start server/index.js --name clipgen'),
    numbered('pm2 save'),
    numbered('pm2 log clipgen (view live logs)'),
    spacer(),
    heading3('6.2.6 Nginx Reverse Proxy (with SSL)'),
    normal('Install Nginx and Certbot:'),
    para([text('sudo apt install nginx certbot python3-certbot-nginx -y', { size: 20, font: 'Courier New', color: C.text3 })]),
    spacer(),
    normal('Create Nginx config at /etc/nginx/sites-available/clipgen:'),
    para([text('server {', { size: 20, font: 'Courier New', color: C.text3 })]),
    para([text('  listen 80; server_name yourdomain.com;', { size: 20, font: 'Courier New', color: C.text3 })]),
    para([text('  location / { proxy_pass http://localhost:3001; }', { size: 20, font: 'Courier New', color: C.text3 })]),
    para([text('  location /api { proxy_pass http://localhost:3001/api; }', { size: 20, font: 'Courier New', color: C.text3 })]),
    para([text('}', { size: 20, font: 'Courier New', color: C.text3 })]),
    spacer(),
    normal('Enable and reload:'),
    para([text('sudo ln -s /etc/nginx/sites-available/clipgen /etc/nginx/sites-enabled/', { size: 20, font: 'Courier New', color: C.text3 })]),
    para([text('sudo nginx -t && sudo systemctl reload nginx', { size: 20, font: 'Courier New', color: C.text3 })]),
    para([text('sudo certbot --nginx -d yourdomain.com', { size: 20, font: 'Courier New', color: C.text3 })]),
    spacer(2),
    heading2('6.3 Disk Space Management'),
    normal('Videos can consume significant disk space. Manage uploads and outputs:'),
    bullet('Set up a cron job to delete uploads older than 7 days:'),
    para([text('find /var/www/clipgen/server/uploads -type f -mtime +7 -delete', { size: 20, font: 'Courier New', color: C.text3 })]),
    spacer(),
    bullet('Monitor disk usage: df -h'),
    bullet('Consider mounting uploads/ and output/ on a separate volume for easier management'),
    spacer(1),
    pageBreak(),
  ];
}

// ── Maintenance & Support ─────────────────────────────────────────────────────
function maintenance() {
  return [
    heading1('7. Maintenance & Support'),
    heading2('7.1 Routine Maintenance Tasks'),
    makeTable(
      ['Task', 'Frequency', 'Command / Action'],
      [
        ['Clean old uploads', 'Weekly', 'find uploads/ -type f -mtime +7 -delete'],
        ['Rebuild client', 'As needed', 'npm run build'],
        ['Update yt-dlp', 'Monthly', 'brew upgrade yt-dlp (macOS) / pip install -U yt-dlp (VPS)'],
        ['Update FFmpeg', 'Quarterly', 'brew upgrade ffmpeg (macOS) / apt upgrade ffmpeg (VPS)'],
        ['Check PM2 logs', 'Weekly', 'pm2 logs clipgen --lines 50'],
        ['Monitor disk space', 'Weekly', 'df -h; du -sh uploads/ output/'],
        ['Backup library.json', 'Weekly', 'cp library.json library.json.bak'],
        ['Update Node.js', 'Quarterly', 'Use nvm to update to latest LTS'],
      ],
      [2880, 1440, 5040]
    ),
    spacer(2),
    heading2('7.2 Updating ClipGen'),
    normal('To update ClipGen to the latest version:'),
    numbered('Stop the server: pm2 stop clipgen (VPS) or Ctrl+C in Terminal (local)'),
    numbered('Pull latest code: git pull (or download and replace files)'),
    numbered('Re-install dependencies: npm install && npm --prefix client install'),
    numbered('Rebuild frontend: npm run build'),
    numbered('Restart server: pm2 start server/index.js --name clipgen --restart-delay 5000'),
    spacer(2),
    heading2('7.3 Logging & Diagnostics'),
    normal('Server logs (PM2):'),
    para([text('pm2 logs clipgen', { size: 20, font: 'Courier New', color: C.text3 })]),
    spacer(),
    normal('FFmpeg errors can be identified by looking for "ffmpeg exited with code" in server logs.'),
    spacer(),
    normal('YouTube download errors show as "yt-dlp failed" with the specific error message from yt-dlp\'s stderr output.'),
    spacer(2),
    heading2('7.4 Glossary'),
    makeTable(
      ['Term', 'Definition'],
      [
        ['AS-IS Process', 'The current state workflow before implementing a new system'],
        ['BR', 'Business Rule — a policy or constraint governing system behavior'],
        ['CRF', 'Constant Rate Factor — FFmpeg quality setting (lower = better quality)'],
        ['DXA', 'Document Exchange Area — Word document measurement unit (1440 = 1 inch)'],
        ['KPI', 'Key Performance Indicator — measurable success metric'],
        ['SRS', 'Software Requirement Specification — formal documentation of system requirements'],
        ['SSE', 'Server-Sent Events — HTTP protocol for one-way server-to-client streaming'],
        ['TO-BE Process', 'The improved workflow after implementing a new system'],
        ['VPS', 'Virtual Private Server — remote cloud server for hosting web applications'],
      ],
      [2400, 6960]
    ),
    spacer(1),
    hr(),
    spacer(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'END OF DOCUMENT — ClipGen SRS & User Guide v1.0.0', font: 'Arial', size: 20, color: C.text3, italics: true })],
      spacing: { before: 120, after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Generated: July 4, 2026 | ClipGen Development Team', font: 'Arial', size: 18, color: C.text3 })],
      spacing: { before: 0, after: 0 },
    }),
  ];
}

// ── Build Document ─────────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 }, spacing: { before: 60, after: 60 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '\u25E6', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 }, spacing: { before: 60, after: 60 } } } },
        ],
      },
      {
        reference: 'numbers',
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 }, spacing: { before: 80, after: 80 } } } },
          { level: 1, format: LevelFormat.DECIMAL, text: '%1.%2.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 }, spacing: { before: 60, after: 60 } } } },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 22, color: C.text } },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: C.accent },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: C.text },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 },
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: C.text2 },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1260, bottom: 1260, left: 1260 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'CLIPGEN — AI Video Clipper', font: 'Arial', size: 18, color: C.text3, italics: true }),
                new TextRun({ text: '   |   Software Requirement Specification & User Guide   |   v1.0.0', font: 'Arial', size: 18, color: C.text3 }),
              ],
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border } },
              spacing: { before: 0, after: 120 },
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: 'Confidential — Internal Use Only   |   July 2026', font: 'Arial', size: 18, color: C.text3 }),
                new TextRun({ text: '        Page ', font: 'Arial', size: 18, color: C.text3 }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 18, color: C.text3 }),
                new TextRun({ text: ' of ', font: 'Arial', size: 18, color: C.text3 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 18, color: C.text3 }),
              ],
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.border } },
              spacing: { before: 120, after: 0 },
            }),
          ],
        }),
      },
      children: [
        ...coverPage(),
        ...documentHistory(),
        ...toc(),
        ...executiveSummary(),
        ...businessProcess(),
        ...technicalSpecs(),
        ...projectManagement(),
        ...userGuide(),
        ...deploymentGuide(),
        ...maintenance(),
      ],
    },
  ],
});

// ── Write File ────────────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buf => {
  const outPath = new URL('./ClipGen_SRS_UserGuide_v1.0.0.docx', import.meta.url).pathname;
  fs.writeFileSync(outPath, buf);
  console.log('✅ Document written to:', outPath);
  console.log('📄 Size:', (buf.length / 1024 / 1024).toFixed(2), 'MB');
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
