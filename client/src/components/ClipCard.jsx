import React, { useState } from 'react';

export default function ClipCard({ clip, index, isSelected, onToggle, onPreview, onAdjust }) {
  const [editing, setEditing] = useState(false);
  const [startStr, setStartStr] = useState(clip.start.toFixed(1));
  const [endStr, setEndStr] = useState(clip.end.toFixed(1));

  const formatTime = (t) => {
    if (!t && t !== 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const duration = clip.end - clip.start;

  const scoreColor = clip.score > 7 ? 'var(--success)'
    : clip.score > 4 ? 'var(--warning)' : 'var(--text-3)';

  const reasonIcon = {
    'High Energy': '⚡',
    'Moderate Activity': '📊',
    'Speech': '🗣',
    'Auto-detected segment': '🎬'
  }[clip.reason] || '🎬';

  const handleApplyTimes = () => {
    const newStart = parseFloat(startStr);
    const newEnd = parseFloat(endStr);
    if (!isNaN(newStart) && !isNaN(newEnd) && newStart < newEnd) {
      onAdjust?.({ start: newStart, end: newEnd });
      setEditing(false);
    }
  };

  return (
    <div
      style={{
        background: isSelected ? 'var(--accent-dim2)' : 'var(--surface-2)',
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '14px',
        cursor: 'pointer',
        transition: 'all var(--transition)',
        animation: 'fadeIn 200ms ease-out',
        animationDelay: `${index * 50}ms`,
        animationFillMode: 'both',
        position: 'relative',
        boxShadow: isSelected ? '0 0 0 1px var(--accent), 0 0 20px rgba(99,102,241,0.15)' : 'none'
      }}
      onClick={() => onToggle?.(index)}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        {/* Checkbox */}
        <div style={{
          width: 20, height: 20, borderRadius: 4,
          border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-light)'}`,
          background: isSelected ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all var(--transition)', flexShrink: 0
        }}>
          {isSelected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </div>

        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: '0.75rem' }}>{reasonIcon}</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600,
            color: scoreColor
          }}>
            {clip.score.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Thumbnail placeholder */}
      <div style={{
        width: '100%',
        aspectRatio: '16/9',
        background: 'linear-gradient(135deg, var(--surface-3), var(--surface))',
        borderRadius: 6,
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--text-3)">
          <polygon points="5,3 19,12 5,21"/>
        </svg>
        <div style={{
          position: 'absolute', bottom: 6, right: 6,
          background: 'rgba(0,0,0,0.8)',
          borderRadius: 4, padding: '2px 6px',
          fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'white'
        }}>
          {formatTime(duration)}
        </div>
        {/* Play overlay on hover */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity var(--transition)'
        }} className="play-overlay">
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
        </div>
      </div>

      {/* Time range */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            <input
              className="input"
              type="number"
              value={startStr}
              onChange={e => setStartStr(e.target.value)}
              style={{ flex: 1, padding: '4px 8px', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
              onClick={e => e.stopPropagation()}
              step="0.1"
              min="0"
            />
            <input
              className="input"
              type="number"
              value={endStr}
              onChange={e => setEndStr(e.target.value)}
              style={{ flex: 1, padding: '4px 8px', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
              onClick={e => e.stopPropagation()}
              step="0.1"
              min="0"
            />
            <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); handleApplyTimes(); }}>
              ✓
            </button>
          </div>
        ) : (
          <>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-2)'
            }}>
              {formatTime(clip.start)} – {formatTime(clip.end)}
            </span>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              onClick={e => { e.stopPropagation(); setEditing(true); }}
              title="Adjust times"
              style={{ color: 'var(--text-3)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Reason tag */}
      <div style={{ marginTop: 8 }}>
        <span className="badge badge-muted" style={{ fontSize: '0.6875rem' }}>
          {clip.reason || 'Detected segment'}
        </span>
      </div>

      <style>{`
        div:hover .play-overlay { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
