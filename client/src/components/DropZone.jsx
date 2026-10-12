import React, { useState, useRef, useCallback } from 'react';
import { useAppState } from '../App.jsx';

export default function DropZone({ onVideoLoaded }) {
  const { addToast } = useAppState();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const fileRef = useRef();

  const uploadFile = async (file) => {
    if (!file) return;
    const allowed = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      addToast('Unsupported file format. Use MP4, MOV, AVI, MKV, or WebM.', 'error');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('video', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      addToast(`Uploaded: ${file.name}`, 'success');
      onVideoLoaded(data.video);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, []);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) uploadFile(file);
  };

  const handleYtSubmit = async (e) => {
    e.preventDefault();
    if (!ytUrl.trim()) return;
    if (!ytUrl.match(/youtube\.com|youtu\.be/)) {
      addToast('Please enter a valid YouTube URL', 'warning');
      return;
    }
    setYtLoading(true);
    try {
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ytUrl })
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'complete' && data.video) {
                addToast(`Downloaded: ${data.video.originalName}`, 'success');
                onVideoLoaded(data.video);
                setYtUrl('');
                return;
              }
              if (data.type === 'error') throw new Error(data.error);
              if (data.type === 'progress') {
                // could update a progress indicator here
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      addToast(`YouTube error: ${err.message}`, 'error');
    } finally {
      setYtLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      {/* File Drop */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '40px 24px',
          textAlign: 'center',
          cursor: uploading ? 'default' : 'pointer',
          background: dragging ? 'var(--accent-dim)' : 'var(--surface)',
          transition: 'all 150ms ease-out',
          transform: dragging ? 'scale(1.01)' : 'scale(1)',
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="video/*,.mp4,.mov,.avi,.mkv,.webm"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />

        {uploading ? (
          <>
            <div className="spinner spinner-lg" />
            <p style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>Processing video...</p>
          </>
        ) : (
          <>
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.5 }}>
              <rect x="4" y="8" width="40" height="32" rx="4" stroke="#A1A1AA" strokeWidth="2"/>
              <polygon points="19,18 19,30 30,24" fill="#A1A1AA"/>
              <rect x="8" y="32" width="32" height="3" rx="1.5" fill="#52525B"/>
            </svg>
            <div>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>Drop your video here</p>
              <p style={{ color: 'var(--text-3)', fontSize: '0.8125rem' }}>MP4, MOV, AVI, MKV, WebM — up to 3GB</p>
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 4 }} type="button">
              Browse Files
            </button>
          </>
        )}
      </div>

      {/* YouTube URL */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minHeight: 200
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#EF4444">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>YouTube URL</span>
        </div>

        <form onSubmit={handleYtSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          <input
            className="input"
            type="url"
            placeholder="https://youtube.com/watch?v=..."
            value={ytUrl}
            onChange={e => setYtUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={ytLoading || !ytUrl.trim()}
            style={{ marginTop: 'auto' }}
          >
            {ytLoading ? (
              <><div className="spinner spinner-sm" /> Downloading...</>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l-3.5-3.5 1.41-1.41L10 14.17l4.59-4.59L16 11l-6 6z"/>
                </svg>
                Download & Analyze
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
