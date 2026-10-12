import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClipArgs, scoreAndSelectClips, parseRmsLevels } from '../server/services/ffmpeg.js';

test('buildClipArgs: mp4 720p uses libx264, faststart and correct range', () => {
  const a = buildClipArgs('in.mp4', 5, 20.5, 'out.mp4', { quality: '720p' });
  assert.deepEqual(a.slice(0, 6), ['-y', '-ss', '5.000', '-i', 'in.mp4', '-t']);
  assert.equal(a[6], '15.500');
  assert.ok(a.includes('libx264') && a.includes('+faststart'));
  assert.equal(a[a.indexOf('-vf') + 1], 'scale=-2:720');
  assert.equal(a.at(-1), 'out.mp4');
});

test('buildClipArgs: 9:16 crops and scales to 1080x1920', () => {
  const a = buildClipArgs('in.mp4', 0, 10, 'o.mp4', { aspect: '9:16' });
  const vf = a[a.indexOf('-vf') + 1];
  assert.match(vf, /crop=trunc\(ih\*9\/16\/2\)\*2:ih,scale=1080:1920/);
});

test('buildClipArgs: webm uses vp9 + opus; original quality adds no scale', () => {
  const a = buildClipArgs('in.mp4', 0, 5, 'o.webm', { format: 'webm', quality: 'original' });
  assert.ok(a.includes('libvpx-vp9') && a.includes('libopus'));
  assert.ok(!a.includes('-vf'));
});

test('buildClipArgs rejects invalid ranges', () => {
  assert.throws(() => buildClipArgs('i', 10, 5, 'o'));
  assert.throws(() => buildClipArgs('i', -1, 5, 'o'));
  assert.throws(() => buildClipArgs('i', NaN, 5, 'o'));
});

test('parseRmsLevels reads per-second RMS from ametadata output', () => {
  const txt = 'frame:0 pts:0 pts_time:0\nlavfi.astats.Overall.RMS_level=-20.5\nframe:1 pts:8000 pts_time:1\nlavfi.astats.Overall.RMS_level=-inf\n';
  assert.deepEqual(parseRmsLevels(txt), [{ time: 0, db: -20.5 }, { time: 1, db: -90 }]);
});

test('scoreAndSelectClips: non-overlapping, within duration bounds, loudest first', () => {
  const changes = [20, 60, 100, 140, 180];
  const energy = changes.map((t, i) => ({ time: t, energy: [-35, -10, -30, -5, -38][i] }));
  const clips = scoreAndSelectClips(changes, energy, 240, { minDuration: 10, maxDuration: 40, numClips: 3 });
  assert.ok(clips.length >= 2 && clips.length <= 3);
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    assert.ok(c.end - c.start >= 10 && c.end - c.start <= 40.01);
    assert.ok(c.end <= 240);
    if (i) assert.ok(c.start >= clips[i - 1].end, 'no overlap');
  }
  assert.ok(clips.some(c => c.score > 7), 'includes a high-energy clip');
});

test('scoreAndSelectClips falls back to even spacing with no scene changes', () => {
  const clips = scoreAndSelectClips([], [], 200, { minDuration: 10, maxDuration: 60, numClips: 4 });
  assert.equal(clips.length, 4);
});
