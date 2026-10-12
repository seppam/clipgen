import React, { useRef, useState, useEffect, useCallback } from 'react';

export default function VideoPlayer({ video, clips = [], onTimeUpdate }) {
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const hideTimer = useRef(null);

  const videoSrc = video?.source === 'youtube'
    ? `/api/stream/${video.id}`
    : `/api/stream/${video?.id}`;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => setDuration(v.duration);
    const onTime = () => {
      setCurrentTime(v.currentTime);
      onTimeUpdate?.(v.currentTime);
    };
    const onEnded = () => setPlaying(false);
    v.addEventListener('loadedmetadata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnded);
    };
  }, [video, onTimeUpdate]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  const seek = useCallback((t) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, duration));
  }, [duration]);

  const handleScrub = (e) => {
    seek((parseFloat(e.target.value) / 1000) * duration);
  };

  const handleVolume = (e) => {
    const v = videoRef.current;
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (v) v.volume = val;
    setMuted(val === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (muted) { v.volume = volume || 0.5; v.muted = false; setMuted(false); }
    else { v.muted = true; setMuted(true); }
  };

  const handleSpeed = (rate) => {
    const v = videoRef.current;
    setPlaybackRate(rate);
    if (v) v.playbackRate = rate;
  };

  const formatTime = (t) => {
    if (!t || isNaN(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const showControlsNow = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapperRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowLeft') seek(currentTime - 5);
      if (e.code === 'ArrowRight') seek(currentTime + 5);
      if (e.code === 'KeyM') toggleMute();
      if (e.code === 'KeyF') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentTime, togglePlay, seek]);

  if (!video) return null;

  const playedPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'relative',
        background: '#000',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        cursor: showControls ? 'default' : 'none',
        aspectRatio: '16/9',
        userSelect: 'none'
      }}
      onMouseMove={showControlsNow}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        onClick={togglePlay}
        preload="metadata"
      />

      {/* Play overlay */}
      {!playing && (
        <div
          onClick={togglePlay}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)', cursor: 'pointer'
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(99,102,241,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(99,102,241,0.5)'
          }}>
            <polygon points="26,20 26,44 44,32" fill="white"/>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        padding: '20px 16px 12px',
        opacity: showControls ? 1 : 0,
        transition: 'opacity 250ms ease-out',
        display: 'flex', flexDirection: 'column', gap: 8
      }}>
        {/* Scrub bar */}
        <input
          type="range"
          min="0"
          max="1000"
          value={Math.round((currentTime / (duration || 1)) * 1000)}
          onChange={handleScrub}
          style={{
            width: '100%', accentColor: 'var(--accent)', cursor: 'pointer',
            height: 4, appearance: 'none',
            background: `linear-gradient(to right, var(--accent) ${playedPct}%, rgba(255,255,255,0.2) ${playedPct}%)`,
            borderRadius: 2
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Play/Pause */}
          <button className="btn btn-ghost btn-icon" onClick={togglePlay} style={{ color: 'white' }}>
            {playing
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            }
          </button>

          {/* Time */}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)', minWidth: 90 }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div style={{ flex: 1 }} />

          {/* Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn btn-ghost btn-icon" onClick={toggleMute} style={{ color: 'white' }}>
              {muted || volume === 0
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
              }
            </button>
            <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : volume}
              onChange={handleVolume}
              style={{ width: 60, accentColor: 'var(--accent)', cursor: 'pointer', height: 3, appearance: 'none' }}
            />
          </div>

          {/* Speed */}
          <select
            value={playbackRate}
            onChange={e => handleSpeed(parseFloat(e.target.value))}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
              borderRadius: 4, padding: '2px 6px', fontSize: '0.75rem', cursor: 'pointer',
              fontFamily: 'var(--font-mono)'
            }}
          >
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
              <option key={r} value={r}>{r}x</option>
            ))}
          </select>

          {/* Fullscreen */}
          <button className="btn btn-ghost btn-icon" onClick={toggleFullscreen} style={{ color: 'white' }}>
            {fullscreen
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
