import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const FFPROBE_BIN = 'ffprobe';
const FFMPEG_BIN = 'ffmpeg';

// ── Scene Detection ──────────────────────────────────────────────────────────
// Uses FFmpeg's scene detection via libavfilter, then scores segments by
// audio energy to find the most engaging clips.

export async function detectClips(videoPath, options = {}) {
  const { minDuration = 10, maxDuration = 60, numClips = 8 } = options;

  // Step 1: Get video duration
  const duration = await getDuration(videoPath);
  if (!duration) throw new Error('Could not read video duration');

  // Step 2: Run scene detection
  const sceneChanges = await runSceneDetection(videoPath, duration);

  // Step 3: Analyze audio energy at each scene
  const audioEnergy = await analyzeAudioEnergy(videoPath, sceneChanges);

  // Step 4: Score and select best clips
  const clips = scoreAndSelectClips(sceneChanges, audioEnergy, duration, {
    minDuration, maxDuration, numClips
  });

  return clips;
}

// ── Pure command builder (unit-tested) ───────────────────────────────────────
export function buildClipArgs(videoPath, start, end, outputPath, options = {}) {
  const { format = 'mp4', quality = '720p', aspect = 'original' } = options;
  if (!(Number.isFinite(start) && Number.isFinite(end)) || start < 0 || end <= start) {
    throw new Error('Invalid clip range: need 0 <= start < end');
  }
  const duration = end - start;

  // Quality -> CRF (lower = better quality)
  const crfMap = { '480p': '28', '720p': '23', '1080p': '20', 'original': '18' };
  const crf = crfMap[quality] || '23';
  const heightMap = { '480p': 480, '720p': 720, '1080p': 1080 };

  const args = ['-y', '-ss', start.toFixed(3), '-i', videoPath, '-t', duration.toFixed(3)];

  const filters = [];
  if (aspect === '9:16') {
    filters.push('crop=trunc(ih*9/16/2)*2:ih', 'scale=1080:1920');
  } else if (aspect === '1:1') {
    filters.push('crop=ih:ih', 'scale=1080:1080');
  } else if (aspect === '16:9') {
    filters.push('scale=-2:720');
  } else if (heightMap[quality]) {
    filters.push(`scale=-2:${heightMap[quality]}`);
  }
  if (filters.length) args.push('-vf', filters.join(','));

  if (format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-crf', crf, '-b:v', '0', '-deadline', 'realtime');
    args.push('-c:a', 'libopus', '-b:a', '128k');
  } else {
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', crf);
    args.push('-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart');
  }
  args.push('-progress', 'pipe:1', '-nostats', outputPath);
  return args;
}

// ── Clip Generation ──────────────────────────────────────────────────────────
export async function generateClip(videoPath, start, end, outputPath, options = {}) {
  const {
    format = 'mp4',
    quality = '720p',
    aspect = 'original',
    onProgress = () => {}
  } = options;

  const duration = end - start;
  const args = buildClipArgs(videoPath, start, end, outputPath, { format, quality, aspect });

  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args);
    let error = '';

    proc.stderr.on('data', d => { error += d.toString(); });
    proc.stdout.on('data', d => {
      // FFmpeg progress output: frame=xxx fps=xx q=xx size=xxx time=xx.xx
      const line = d.toString();
      const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (timeMatch && duration > 0) {
        const current = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]) + parseInt(timeMatch[4]) / 100;
        const pct = Math.min(100, Math.round((current / duration) * 100));
        onProgress(pct);
      }
    });

    proc.on('close', code => {
      if (code === 0) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${error.substring(0, 500)}`));
      }
    });
    proc.on('error', err => reject(err));
  });
}

// ── Internal Helpers ─────────────────────────────────────────────────────────

function getDuration(videoPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFPROBE_BIN, [
      '-v', 'quiet', '-print_format', 'json',
      '-show_format', '-show_streams', videoPath
    ]);
    let data = '';
    proc.stdout.on('data', d => data += d.toString());
    proc.on('close', code => {
      if (code !== 0) { resolve(0); return; }
      try {
        const info = JSON.parse(data);
        const videoStream = info.streams?.find(s => s.codec_type === 'video');
        const duration = parseFloat(videoStream?.duration || info.format?.duration || '0');
        resolve(duration);
      } catch { resolve(0); }
    });
    proc.on('error', () => resolve(0));
  });
}

function fixedIntervals(duration) {
  const out = [];
  const interval = Math.max(10, duration / 12);
  for (let t = 8; t < duration - 12; t += interval) out.push(parseFloat(t.toFixed(1)));
  return out;
}

function runSceneDetection(videoPath, duration) {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_BIN, [
      '-i', videoPath, '-an',
      '-vf', "select='gt(scene,0.3)',showinfo",
      '-f', 'null', '-'
    ]);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    const finish = () => {
      const changes = [...stderr.matchAll(/pts_time:(\d+\.?\d*)/g)]
        .map(m => parseFloat(m[1]))
        .filter(t => t > 5 && t < duration - 10)
        .map(t => parseFloat(t.toFixed(1)));
      resolve((changes.length < 3 ? [...changes, ...fixedIntervals(duration)] : changes).sort((a, b) => a - b));
    };
    proc.on('close', finish);
    proc.on('error', () => { stderr = ''; finish(); });
  });
}

// Parse ametadata output into per-second RMS levels (dB).
export function parseRmsLevels(text) {
  const levels = [];
  let t = null;
  for (const line of text.split('\n')) {
    const tm = line.match(/pts_time:(\d+\.?\d*)/);
    if (tm) t = parseFloat(tm[1]);
    const rm = line.match(/RMS_level=(-?[\d.]+|-inf)/);
    if (rm && t !== null) {
      levels.push({ time: Math.floor(t), db: rm[1] === '-inf' ? -90 : parseFloat(rm[1]) });
      t = null;
    }
  }
  return levels;
}

function analyzeAudioEnergy(videoPath, sceneChanges) {
  return new Promise((resolve) => {
    // One RMS reading per second of audio.
    const proc = spawn(FFMPEG_BIN, [
      '-i', videoPath, '-vn',
      '-af', 'aresample=8000,asetnsamples=n=8000:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-',
      '-f', 'null', '-'
    ]);
    let out = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    const finish = () => {
      const energyMap = new Map(parseRmsLevels(out).map(l => [l.time, l.db]));
      resolve(sceneChanges.map(t => {
        const vals = [t - 1, t, t + 1, t + 2].map(s => energyMap.get(Math.floor(s))).filter(v => v !== undefined);
        const energy = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : -50;
        return { time: t, energy };
      }));
    };
    proc.on('close', finish);
    proc.on('error', finish);
  });
}

export function scoreAndSelectClips(sceneChanges, audioEnergy, duration, options) {
  const { minDuration, maxDuration, numClips } = options;

  if (sceneChanges.length < 2) {
    // Generate evenly-spaced clips
    const clips = [];
    const interval = (duration - 20) / (numClips + 1);
    for (let i = 1; i <= numClips; i++) {
      const start = i * interval;
      const end = Math.min(start + interval, duration);
      clips.push({
        start: parseFloat(start.toFixed(1)),
        end: parseFloat(end.toFixed(1)),
        score: 7,
        reason: 'Auto-detected segment'
      });
    }
    return clips;
  }

  // Score each candidate by loudness relative to this video's own range (0-10),
  // so quiet recordings are ranked as sensibly as loud ones.
  const energies = audioEnergy.map(e => e.energy);
  const lo = Math.min(...energies);
  const hi = Math.max(...energies);
  const combined = sceneChanges.map(t => {
    const energy = audioEnergy.find(e => Math.abs(e.time - t) < 3)?.energy ?? lo;
    const score = hi - lo > 1 ? ((energy - lo) / (hi - lo)) * 10 : 5;
    return { start: t, energy, score: parseFloat(score.toFixed(1)) };
  });

  // Build non-overlapping clips
  const clips = [];
  const MIN_START = 10;

  const sorted = [...combined].sort((a, b) => b.score - a.score);

  for (const seg of sorted) {
    if (clips.length >= numClips) break;
    const clipDuration = Math.min(
      maxDuration,
      Math.max(minDuration, (seg.score / 10) * (maxDuration - minDuration) + minDuration)
    );
    let start = Math.max(MIN_START, seg.start - 2);
    let end = parseFloat((start + clipDuration).toFixed(1));

    if (end > duration - 10) {
      start = Math.max(MIN_START, parseFloat((duration - clipDuration - 5).toFixed(1)));
      end = parseFloat((start + clipDuration).toFixed(1));
    }

    const overlaps = clips.some(c => start < c.end && end > c.start);
    if (!overlaps && end <= duration - 5 && end - start >= minDuration) {
      clips.push({
        start,
        end,
        score: seg.score,
        reason: seg.score > 7 ? 'High Energy' : seg.score > 4 ? 'Moderate Activity' : 'Standard Segment'
      });
    }
  }

  // Sort by start time
  clips.sort((a, b) => a.start - b.start);

  return clips;
}
