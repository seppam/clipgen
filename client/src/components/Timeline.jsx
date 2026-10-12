import React, { useRef, useEffect, useState, useCallback } from 'react';

export default function Timeline({ clips = [], duration = 0, currentTime = 0, onSeek, selectedClips = new Set() }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredTime, setHoveredTime] = useState(null);
  const [hoveredX, setHoveredX] = useState(null);

  const t2x = useCallback((t) => duration ? (t / duration) * 100 : 0, [duration]);
  const x2t = useCallback((x) => {
    if (!containerRef.current) return 0;
    const w = containerRef.current.offsetWidth;
    const pct = x / w;
    return pct * duration;
  }, [duration]);

  // Draw waveform + clip markers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w;
    canvas.height = h;

    // Background
    ctx.fillStyle = '#1A1A1E';
    ctx.fillRect(0, 0, w, h);

    // Time grid lines
    const gridInterval = duration > 600 ? 60 : duration > 300 ? 30 : duration > 60 ? 10 : 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let t = 0; t <= duration; t += gridInterval) {
      const x = (t / duration) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Clip ranges
    clips.forEach((clip, i) => {
      const x1 = t2x(clip.start);
      const x2 = t2x(clip.end);
      const isSelected = selectedClips.has(i);

      ctx.fillStyle = isSelected ? 'rgba(99,102,241,0.35)' : 'rgba(99,102,241,0.15)';
      ctx.fillRect((x1 / 100) * w, 0, ((x2 - x1) / 100) * w, h);

      ctx.strokeStyle = isSelected ? '#6366F1' : 'rgba(99,102,241,0.5)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect((x1 / 100) * w, 0, ((x2 - x1) / 100) * w, h);
    });

    // Current time line
    const curX = (currentTime / duration) * w;
    ctx.strokeStyle = '#EF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(curX, 0);
    ctx.lineTo(curX, h);
    ctx.stroke();

    // Current time dot
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(curX, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Hover indicator
    if (hoveredX !== null) {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hoveredX, 0);
      ctx.lineTo(hoveredX, h);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [clips, duration, currentTime, selectedClips, t2x, hoveredX]);

  const formatTime = (t) => {
    if (!t && t !== 0) return '';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    setHoveredX(x);
    setHoveredTime(x2t(x));
  };

  const handleMouseLeave = () => {
    setHoveredX(null);
    setHoveredTime(null);
  };

  const handleClick = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const t = x2t(x);
    onSeek?.(Math.max(0, Math.min(t, duration)));
  };

  if (!duration) return null;

  // Time markers
  const markers = [];
  const interval = duration > 600 ? 60 : duration > 300 ? 30 : duration > 60 ? 10 : 5;
  for (let t = 0; t <= duration; t += interval) {
    markers.push(t);
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Time labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0 2px',
        marginBottom: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6875rem',
        color: 'var(--text-3)'
      }}>
        {markers.map(t => <span key={t}>{formatTime(t)}</span>)}
      </div>

      {/* Timeline canvas */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ position: 'relative', cursor: 'crosshair', borderRadius: 'var(--radius)' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', height: 60, display: 'block', borderRadius: 'var(--radius)' }} />

        {/* Hover tooltip */}
        {hoveredTime !== null && (
          <div style={{
            position: 'absolute',
            top: -28,
            left: hoveredX,
            transform: 'translateX(-50%)',
            background: 'var(--surface-3)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '2px 7px',
            fontSize: '0.6875rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap'
          }}>
            {formatTime(hoveredTime)}
          </div>
        )}
      </div>

      {/* Clip count */}
      {clips.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap'
        }}>
          {clips.map((clip, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: selectedClips.has(i) ? 'var(--accent-dim2)' : 'var(--surface-2)',
                border: `1px solid ${selectedClips.has(i) ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 100,
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: selectedClips.has(i) ? 'var(--accent-glow)' : 'var(--text-2)',
                cursor: 'pointer',
                transition: 'all var(--transition)'
              }}
            >
              <span>{formatTime(clip.start)} – {formatTime(clip.end)}</span>
              <span className={`badge badge-${clip.score > 7 ? 'success' : clip.score > 4 ? 'warning' : 'muted'}`}>
                {clip.score.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
