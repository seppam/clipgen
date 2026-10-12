import React from 'react';
import { useAppState } from '../App.jsx';

export default function Settings() {
  const { state, dispatch, addToast } = useAppState();

  const presets = [
    { label: 'TikTok / Reels', aspect: '9:16', quality: '720p', format: 'mp4' },
    { label: 'YouTube Shorts', aspect: '9:16', quality: '1080p', format: 'mp4' },
    { label: 'Instagram Feed', aspect: '1:1', quality: '720p', format: 'mp4' },
    { label: 'YouTube Full', aspect: '16:9', quality: '1080p', format: 'mp4' },
    { label: 'Archive (Original)', aspect: 'original', quality: 'original', format: 'mp4' },
  ];

  const applyPreset = (preset) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: preset });
    addToast(`Applied preset: ${preset.label}`, 'success');
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 6 }}>Settings</h1>
        <p style={{ color: 'var(--text-2)', fontSize: '0.9375rem' }}>
          Configure default output settings and application preferences.
        </p>
      </div>

      {/* Output Presets */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Quick Presets</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {presets.map(preset => {
            const isActive = state.settings.aspect === preset.aspect
              && state.settings.quality === preset.quality
              && state.settings.format === preset.format;
            return (
              <button
                key={preset.label}
                className="btn"
                onClick={() => applyPreset(preset)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isActive ? 'var(--accent-dim)' : 'var(--surface-2)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  color: 'var(--text)',
                  padding: '10px 14px'
                }}
              >
                <span style={{ fontWeight: 500 }}>{preset.label}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-muted">{preset.aspect}</span>
                  <span className="badge badge-muted">{preset.quality}</span>
                  <span className="badge badge-muted">{preset.format.toUpperCase()}</span>
                  {isActive && <span className="badge badge-accent">Active</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Settings */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Custom Output Settings</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="label">Format</label>
            <select
              className="input"
              value={state.settings.format}
              onChange={e => dispatch({ type: 'UPDATE_SETTINGS', payload: { format: e.target.value } })}
            >
              <option value="mp4">MP4 (H.264) — Best compatibility</option>
              <option value="webm">WebM (VP9) — Smaller file size</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Quality</label>
            <select
              className="input"
              value={state.settings.quality}
              onChange={e => dispatch({ type: 'UPDATE_SETTINGS', payload: { quality: e.target.value } })}
            >
              <option value="480p">480p — Faster export, smaller files</option>
              <option value="720p">720p — Balanced (recommended)</option>
              <option value="1080p">1080p — Best quality</option>
              <option value="original">Original — No re-encoding</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Aspect Ratio</label>
            <select
              className="input"
              value={state.settings.aspect}
              onChange={e => dispatch({ type: 'UPDATE_SETTINGS', payload: { aspect: e.target.value } })}
            >
              <option value="original">Original — Keep source ratio</option>
              <option value="9:16">9:16 — TikTok, Reels, Shorts</option>
              <option value="1:1">1:1 — Instagram Feed</option>
              <option value="16:9">16:9 — YouTube, Desktop</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Max Clip Duration: {state.settings.maxDuration}s</label>
            <input
              type="range"
              className="range-input"
              min="5"
              max="120"
              step="5"
              value={state.settings.maxDuration}
              onChange={e => dispatch({ type: 'UPDATE_SETTINGS', payload: { maxDuration: parseInt(e.target.value) } })}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: 4 }}>
              <span>5s</span>
              <span>120s</span>
            </div>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">About</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['App', 'ClipGen'],
            ['Version', '1.0.0'],
            ['Frontend', 'React 18 + Vite'],
            ['Backend', 'Express.js'],
            ['Video Engine', 'FFmpeg'],
            ['YouTube', 'yt-dlp'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-2)' }}>{k}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="divider" />
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', lineHeight: 1.6 }}>
          ClipGen runs entirely on your machine. Videos are processed locally — nothing is uploaded
          to external servers (except YouTube downloads when you provide a URL).
          Your content stays private.
        </p>
      </div>
    </div>
  );
}
