import React, { useEffect, useState } from 'react';
import { useAppState } from '../App.jsx';

export default function Library() {
  const { addToast } = useAppState();
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLibrary = async () => {
    try {
      const res = await fetch('/api/library');
      const data = await res.json();
      setLibrary(data.clips || []);
    } catch (err) {
      addToast('Failed to load library', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLibrary(); }, []);

  const handleDelete = async (clipId) => {
    if (!confirm('Delete this clip permanently?')) return;
    try {
      const res = await fetch(`/api/library/${clipId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setLibrary(prev => prev.filter(c => c.id !== clipId));
      addToast('Clip deleted', 'success');
    } catch (err) {
      addToast('Failed to delete clip', 'error');
    }
  };

  const handleDownload = (clipId, filename) => {
    const a = document.createElement('a');
    a.href = `/api/download/${clipId}`;
    a.download = filename;
    a.click();
  };

  const formatTime = (t) => {
    if (!t && t !== 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch { return iso; }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: 6 }}>Library</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '0.9375rem' }}>
            {library.length} saved clip{library.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLibrary}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : library.length === 0 ? (
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
          </svg>
          <h3>No clips yet</h3>
          <p>Generate some clips in the Editor and they'll appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {library.map(clip => (
            <div key={clip.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', padding: '14px 16px',
              animation: 'fadeIn 200ms ease-out'
            }}>
              {/* Thumbnail */}
              <div style={{
                width: 80, height: 45, background: 'var(--surface-2)',
                borderRadius: 6, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--text-3)">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {clip.outputName}
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span className="badge badge-muted" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6875rem' }}>
                    {formatTime(clip.start)} – {formatTime(clip.end)}
                  </span>
                  <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
                    {formatTime(clip.duration)}
                  </span>
                  <span className="badge badge-accent" style={{ fontSize: '0.6875rem' }}>
                    {clip.format?.toUpperCase()}
                  </span>
                  <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
                    {clip.quality}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    {(clip.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    {formatDate(clip.createdAt)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownload(clip.id, clip.outputName)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                  Download
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(clip.id)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
