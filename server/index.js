import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { detectClips, generateClip } from './services/ffmpeg.js';
import { downloadYouTube } from './services/youtube.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();
const PORT = process.env.PORT || 3001;

// ── Storage ──────────────────────────────────────────────────────────────────
const DATA_DIR = process.env.CLIPGEN_DATA_DIR || __dirname;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const OUTPUT_DIR = path.join(DATA_DIR, 'output');
const LIBRARY_FILE = path.join(DATA_DIR, 'library.json');

// Video ids are UUIDs (optionally with a file extension); reject anything else
// so request params can never traverse outside the storage directories.
const SAFE_ID = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9]+)?$/;
const isSafeId = (v) => typeof v === 'string' && SAFE_ID.test(v);

// Find the source video for an id, ignoring generated thumbnails.
function findUpload(videoId) {
  if (!isSafeId(videoId)) return null;
  return fs.readdirSync(UPLOAD_DIR).find(f => f.startsWith(videoId) && !f.includes('_thumb')) || null;
}

[UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function getLibrary() {
  if (!fs.existsSync(LIBRARY_FILE)) return { clips: [] };
  return JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
}

function saveLibrary(lib) {
  fs.writeFileSync(LIBRARY_FILE, JSON.stringify(lib, null, 2));
}

// ── Multer (RAM storage for small files, disk for large) ────────────────────
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 * 1024 }, // 3GB
});

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Upload local video
app.post('/api/upload', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const metadata = await getVideoMetadata(req.file.path);
    const id = path.basename(req.file.filename, path.extname(req.file.filename));

    const video = {
      id,
      source: 'upload',
      originalName: req.file.originalname,
      duration: metadata.duration,
      resolution: metadata.resolution,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      filePath: req.file.path,
      thumbnailPath: null,
      detectedClips: [],
      metadata
    };

    // Generate thumbnail
    try {
      const thumbPath = path.join(UPLOAD_DIR, `${id}_thumb.jpg`);
      const { spawn } = await import('child_process');
      const thumbProc = spawn('ffmpeg', [
        '-y', '-ss', '00:00:01', '-i', req.file.path,
        '-vframes', '1', '-q:v', '2', '-vf', 'scale=320:-1', thumbPath
      ]);
      await new Promise((resolve, reject) => {
        thumbProc.on('error', reject);
        thumbProc.on('close', code => code === 0 ? resolve() : reject(new Error(`thumb failed ${code}`)));
      });
      video.thumbnailPath = thumbPath;
    } catch { /* thumbnail optional */ }

    res.json({ success: true, video });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// YouTube download
app.post('/api/youtube', async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string' || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'A valid http(s) URL is required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const id = uuidv4();
    const { filePath, title, duration, thumbnailUrl } = await downloadYouTube(url, id, UPLOAD_DIR, send);

    const video = {
      id,
      source: 'youtube',
      originalName: title,
      youtubeUrl: url,
      duration,
      resolution: 'unknown',
      size: fs.statSync(filePath).size,
      uploadedAt: new Date().toISOString(),
      filePath,
      thumbnailPath: thumbnailUrl,
      thumbnailUrl,
      detectedClips: [],
      metadata: { title }
    };

    send({ type: 'complete', video });
    res.end();
  } catch (err) {
    send({ type: 'error', error: err.message });
    res.end();
  }
});

// Get video stream (for playback)
app.get('/api/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!isSafeId(videoId)) return res.status(400).json({ error: 'Invalid id' });
  const videoPath = path.join(UPLOAD_DIR, videoId);
  const altPath = path.join(UPLOAD_DIR, `${videoId}.mp4`);

  const filePath = fs.existsSync(videoPath) ? videoPath :
    fs.existsSync(altPath) ? altPath : null;

  if (!filePath) {
    // Check output dir
    const outPath = path.join(OUTPUT_DIR, videoId);
    const outAlt = path.join(OUTPUT_DIR, `${videoId}.mp4`);
    const final = fs.existsSync(outPath) ? outPath : fs.existsSync(outAlt) ? outAlt : null;
    if (!final) return res.status(404).json({ error: 'Video not found' });

    const stat = fs.statSync(final);
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunk = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunk,
        'Content-Type': 'video/mp4'
      });
      fs.createReadStream(final, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'video/mp4' });
      fs.createReadStream(final).pipe(res);
    }
    return;
  }

  const stat = fs.statSync(filePath);
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunk = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunk,
      'Content-Type': 'video/mp4'
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'video/mp4' });
    fs.createReadStream(filePath).pipe(res);
  }
});

// Scene detection
app.post('/api/detect', async (req, res) => {
  const { videoId, minDuration = 10, maxDuration = 60 } = req.body || {};
  const actualPath = findUpload(videoId);
  if (!actualPath) return res.status(404).json({ error: 'Video not found' });

  try {
    const clips = await detectClips(path.join(UPLOAD_DIR, actualPath), { minDuration, maxDuration });
    res.json({ success: true, clips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate clips (SSE progress)
app.post('/api/generate', async (req, res) => {
  const { videoId, clips: clipRequests, format = 'mp4', quality = '720p', aspect = 'original' } = req.body || {};
  if (!isSafeId(videoId) || !Array.isArray(clipRequests) || !clipRequests.length) {
    return res.status(400).json({ error: 'videoId and a non-empty clips array are required' });
  }
  if (!['mp4', 'webm'].includes(format)) return res.status(400).json({ error: 'format must be mp4 or webm' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const actualFile = findUpload(videoId);
    if (!actualFile) throw new Error('Video not found');
    const videoPath = path.join(UPLOAD_DIR, actualFile);

    const results = [];
    const lib = getLibrary();

    for (let i = 0; i < clipRequests.length; i++) {
      const clipReq = clipRequests[i];
      const clipId = uuidv4();
      const outputName = `${videoId}_clip_${i + 1}_${Date.now()}.${format}`;
      const outputPath = path.join(OUTPUT_DIR, outputName);

      send({ type: 'progress', clipIndex: i, total: clipRequests.length, current: clipReq });

      try {
        await generateClip(videoPath, clipReq.start, clipReq.end, outputPath, {
          format, quality, aspect,
          onProgress: (pct) => send({ type: 'progress', clipIndex: i, total: clipRequests.length, percent: pct })
        });

        const stat = fs.statSync(outputPath);
        const generatedClip = {
          id: clipId,
          videoId,
          sourceVideo: actualFile,
          start: clipReq.start,
          end: clipReq.end,
          duration: clipReq.end - clipReq.start,
          outputPath,
          outputName,
          size: stat.size,
          format,
          quality,
          aspect,
          createdAt: new Date().toISOString()
        };
        results.push(generatedClip);
        lib.clips.unshift(generatedClip);
        send({ type: 'clip_done', clip: generatedClip, index: i });
      } catch (err) {
        send({ type: 'clip_error', clipIndex: i, error: err.message });
      }
    }

    saveLibrary(lib);
    send({ type: 'complete', results });
    res.end();
  } catch (err) {
    send({ type: 'error', error: err.message });
    res.end();
  }
});

// Download generated clip
app.get('/api/download/:clipId', (req, res) => {
  const lib = getLibrary();
  const clip = lib.clips.find(c => c.id === req.params.clipId);
  if (!clip || !fs.existsSync(clip.outputPath)) {
    return res.status(404).json({ error: 'Clip not found' });
  }
  res.download(clip.outputPath, clip.outputName);
});

// Serve output clips as static
app.use('/output', express.static(OUTPUT_DIR));

// Library
app.get('/api/library', (req, res) => {
  res.json(getLibrary());
});

app.delete('/api/library/:clipId', (req, res) => {
  const lib = getLibrary();
  const idx = lib.clips.findIndex(c => c.id === req.params.clipId);
  if (idx === -1) return res.status(404).json({ error: 'Clip not found' });

  const clip = lib.clips[idx];
  if (fs.existsSync(clip.outputPath)) fs.unlinkSync(clip.outputPath);
  lib.clips.splice(idx, 1);
  saveLibrary(lib);
  res.json({ success: true });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ── FFmpeg helpers (inline for metadata only) ─────────────────────────────────
async function getVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    import('child_process').then(({ spawn }) => {
      const proc = spawn('ffmpeg', ['-i', filePath, '-hide_banner']);
      let stderr = '';
      proc.stderr.on('data', d => stderr += d.toString());
      proc.on('close', () => {
        const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        const resMatch = stderr.match(/(\d{3,4}x\d{3,4})/);
        const duration = durationMatch
          ? parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseInt(durationMatch[3]) + parseInt(durationMatch[4]) / 100
          : 0;
        resolve({
          duration,
          resolution: resMatch ? resMatch[1] : 'unknown',
          raw: stderr.substring(0, 1000)
        });
      });
      proc.on('error', reject);
    }).catch(reject);
  });
}

// ── Start ────────────────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`ClipGen server running on http://localhost:${PORT}`);
  });
}
