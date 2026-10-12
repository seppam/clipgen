import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipgen-test-'));
process.env.CLIPGEN_DATA_DIR = dataDir;
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

let server, base;
before(async () => {
  const { app } = await import('../server/index.js');
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('GET /api/health', async () => {
  assert.equal((await (await fetch(base + '/api/health')).json()).status, 'ok');
});

test('GET /api/library starts empty', async () => {
  assert.deepEqual(await (await fetch(base + '/api/library')).json(), { clips: [] });
});

test('upload without file is 400', async () => {
  assert.equal((await fetch(base + '/api/upload', { method: 'POST' })).status, 400);
});

test('detect/generate/stream reject unknown or unsafe ids', async () => {
  assert.equal((await post('/api/detect', { videoId: 'nope' })).status, 404);
  assert.equal((await post('/api/detect', { videoId: '../../etc/passwd' })).status, 404);
  assert.equal((await post('/api/generate', { videoId: '../x', clips: [{ start: 0, end: 1 }] })).status, 400);
  assert.equal((await fetch(base + '/api/stream/nope')).status, 404);
});

test('youtube endpoint requires an http(s) url', async () => {
  assert.equal((await post('/api/youtube', { url: 'file:///etc/passwd' })).status, 400);
});

test('end to end: upload -> detect -> generate -> download -> delete', { skip: !hasFfmpeg }, async () => {
  const sample = path.join(dataDir, 'sample.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=40:size=320x240:rate=15',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=40', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', sample]);
  assert.equal(r.status, 0);

  const form = new FormData();
  form.append('video', new Blob([fs.readFileSync(sample)], { type: 'video/mp4' }), 'sample.mp4');
  const up = await (await fetch(base + '/api/upload', { method: 'POST', body: form })).json();
  assert.ok(up.success && up.video.duration > 39);

  const det = await (await post('/api/detect', { videoId: up.video.id, minDuration: 5, maxDuration: 15 })).json();
  assert.ok(det.success && Array.isArray(det.clips));

  const gen = await post('/api/generate', { videoId: up.video.id, clips: [{ start: 2, end: 8 }], quality: '480p', aspect: '1:1' });
  const events = (await gen.text()).split('\n\n').filter(Boolean).map(l => JSON.parse(l.replace(/^data: /, '')));
  const done = events.find(e => e.type === 'clip_done');
  assert.ok(done, 'clip generated: ' + JSON.stringify(events.at(-1)));
  assert.ok(done.clip.size > 0);

  const dl = await fetch(`${base}/api/download/${done.clip.id}`);
  assert.equal(dl.status, 200);
  assert.ok((await dl.arrayBuffer()).byteLength > 1000);

  assert.equal((await fetch(`${base}/api/library/${done.clip.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await (await fetch(base + '/api/library')).json()).clips.length, 0);
});
