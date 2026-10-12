import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function downloadYouTube(url, id, outputDir, onProgress) {
  const outputTemplate = path.join(outputDir, `${id}_yt.%(ext)s`);

  // Check yt-dlp is available
  await new Promise((resolve, reject) => {
    const check = spawn('yt-dlp', ['--version']);
    check.on('close', code => {
      if (code !== 0) reject(new Error('yt-dlp not installed. Run: brew install yt-dlp'));
      else resolve();
    });
    check.on('error', err => reject(err));
  });

  return new Promise((resolve, reject) => {
    const args = [
      '--newline',
      '-f', 'best[height<=720]/best',
      '--output', outputTemplate,
      '--no-playlist',
      url
    ];

    const proc = spawn('yt-dlp', args);
    let title = '';
    let stderr = '';

    proc.stdout.on('data', d => {
      const line = d.toString().trim();
      onProgress?.({ type: 'log', message: line });
      const m = line.match(/\[download\]\s+(\d+\.?\d*)%/);
      if (m) onProgress?.({ type: 'progress', percent: parseFloat(m[1]) });
      // Capture title from output (last non-bracket line before download starts)
      if (!title && line.length > 3 && !line.startsWith('[')) title = line;
    });

    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(`yt-dlp failed (code ${code}): ${stderr.substring(0, 300)}`));
        return;
      }
      try {
        const files = fs.readdirSync(outputDir).filter(f => f.startsWith(`${id}_yt.`));
        if (!files.length) { reject(new Error('yt-dlp did not produce a file')); return; }
        const filePath = path.join(outputDir, files[0]);
        resolve({
          filePath,
          title: title || 'YouTube Video',
          duration: 0,
          thumbnailUrl: `https://img.youtube.com/vi/${extractVideoId(url)}/hqdefault.jpg`
        });
      } catch (err) { reject(err); }
    });

    proc.on('error', err => reject(err));
  });
}
