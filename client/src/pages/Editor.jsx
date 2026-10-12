import React, { useState, useCallback } from 'react';
import { useAppState } from '../App.jsx';
import DropZone from '../components/DropZone.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import Timeline from '../components/Timeline.jsx';
import ClipCard from '../components/ClipCard.jsx';

export default function Editor() {
  const { state, dispatch, addToast } = useAppState();
  const [currentTime, setCurrentTime] = useState(0);
  const [generationState, setGenerationState] = useState(null); // null | { progress, current, total, results }

  const handleVideoLoaded = (video) => {
    dispatch({ type: 'SET_VIDEO', payload: video });
  };

  const handleDetect = async () => {
    if (!state.currentVideo) return;
    dispatch({ type: 'SET_DETECTING', payload: true });
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: state.currentVideo.id,
          minDuration: 10,
          maxDuration: state.settings.maxDuration
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      dispatch({ type: 'SET_DETECTED_CLIPS', payload: data.clips });
      addToast(`Found ${data.clips.length} potential clips`, 'success');
    } catch (err) {
      addToast(`Detection failed: ${err.message}`, 'error');
      dispatch({ type: 'SET_DETECTING', payload: false });
    }
  };

  const handleGenerate = async () => {
    if (state.selectedClips.size === 0) {
      addToast('Select at least one clip to generate', 'warning');
      return;
    }

    const selectedClips = [...state.selectedClips].map(i => state.detectedClips[i]);
    setGenerationState({ progress: 0, current: 0, total: selectedClips.length, results: [] });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: state.currentVideo.id,
          clips: selectedClips,
          format: state.settings.format,
          quality: state.settings.quality,
          aspect: state.settings.aspect
        })
      });

      if (!res.ok) throw new Error('Generation request failed');

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
              if (data.type === 'progress' && data.percent !== undefined) {
                setGenerationState(prev => prev ? {
                  ...prev,
                  progress: Math.round(((data.clipIndex + data.percent / 100) / data.total) * 100),
                  current: data.clipIndex + 1,
                  total: data.total
                } : prev);
              }
              if (data.type === 'clip_done') {
                setGenerationState(prev => prev ? {
                  ...prev,
                  current: data.index + 1,
                  results: [...(prev?.results || []), data.clip]
                } : prev);
              }
              if (data.type === 'complete') {
                setGenerationState({ progress: 100, current: data.results.length, total: data.results.length, results: data.results });
                addToast(`Generated ${data.results.length} clips successfully!`, 'success');
              }
              if (data.type === 'error') {
                addToast(`Generation error: ${data.error}`, 'error');
              }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err) {
      addToast(`Generation failed: ${err.message}`, 'error');
      setGenerationState(null);
    }
  };

  const handleDownload = (clipId, filename) => {
    const a = document.createElement('a');
    a.href = `/api/download/${clipId}`;
    a.download = filename;
    a.click();
  };

  const handleAdjustClip = (index, newRange) => {
    const updated = [...state.detectedClips];
    updated[index] = { ...updated[index], ...newRange };
    dispatch({ type: 'SET_DETECTED_CLIPS', payload: updated });
  };

  const formatTime = (t) => {
    if (!t && t !== 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectedClips = [...state.selectedClips].map(i => state.detectedClips[i]);
  const totalDuration = selectedClips.reduce((sum, c) => sum + (c.end - c.start), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero title */}
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 6 }}>
          Video Editor
        </h1>
        <p style={{ color: 'var(--text-2)', fontSize: '0.9375rem' }}>
          Upload a video or paste a YouTube URL — AI finds the best moments to clip.
        </p>
      </div>

      {/* Step 1: Upload */}
      {!state.currentVideo && <DropZone onVideoLoaded={handleVideoLoaded} />}

      {/* Step 2: Video loaded */}
      {state.currentVideo && (
        <>
          {/* Video info bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '10px 16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--accent)"><polygon points="5,3 19,12 5,21"/></svg>
              <span style={{ fontWeight: 600, fontSize: '0.9375rem', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {state.currentVideo.originalName}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span className="badge badge-muted">
                {formatTime(state.currentVideo.duration)}
              </span>
              <span className="badge badge-muted">
                {state.currentVideo.resolution}
              </span>
              <span className={`badge badge-${state.currentVideo.source === 'youtube' ? 'warning' : 'success'}`}>
                {state.currentVideo.source === 'youtube' ? 'YouTube' : 'Local'}
              </span>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  dispatch({ type: 'SET_VIDEO', payload: null });
                  dispatch({ type: 'SET_DETECTED_CLIPS', payload: [] });
                  dispatch({ type: 'DESELECT_ALL' });
                }}
              >
                ✕ Clear
              </button>
            </div>
          </div>

          {/* Video player */}
          <VideoPlayer
            video={state.currentVideo}
            clips={state.detectedClips}
            onTimeUpdate={setCurrentTime}
          />

          {/* Timeline */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Timeline</span>
              {state.detectedClips.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => dispatch({ type: 'SELECT_ALL_CLIPS' })}
                  >
                    Select All
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => dispatch({ type: 'DESELECT_ALL' })}
                  >
                    Deselect All
                  </button>
                </div>
              )}
            </div>
            <Timeline
              clips={state.detectedClips}
              duration={state.currentVideo.duration}
              currentTime={currentTime}
              selectedClips={state.selectedClips}
              onSeek={setCurrentTime}
            />
          </div>

          {/* Detect button */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleDetect}
              disabled={state.isDetecting || state.isGenerating}
            >
              {state.isDetecting ? (
                <>
                  <div className="spinner spinner-sm" />
                  <span>Analyzing video...</span>
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                  </svg>
                  <span>{state.detectedClips.length > 0 ? 'Re-detect Clips' : 'Detect Clips (AI)'}</span>
                </>
              )}
            </button>
          </div>

          {/* Clips grid */}
          {state.detectedClips.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', marginBottom: 2 }}>
                    Detected Clips
                    <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 8, fontSize: '0.875rem' }}>
                      {state.selectedClips.size} selected
                    </span>
                  </h2>
                  {state.selectedClips.size > 0 && (
                    <p style={{ color: 'var(--text-2)', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                      Total: {formatTime(totalDuration)} of selected clips
                    </p>
                  )}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
                marginBottom: 24
              }}>
                {state.detectedClips.map((clip, i) => (
                  <ClipCard
                    key={i}
                    clip={clip}
                    index={i}
                    isSelected={state.selectedClips.has(i)}
                    onToggle={(idx) => dispatch({ type: 'TOGGLE_CLIP', payload: idx })}
                    onAdjust={(range) => handleAdjustClip(i, range)}
                  />
                ))}
              </div>

              {/* Generation */}
              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>Ready to Export</p>
                    <p style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>
                      {state.selectedClips.size} clips selected · {formatTime(totalDuration)} total
                    </p>
                    {generationState && generationState.progress < 100 && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 280 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}>
                          <span>Clip {generationState.current} of {generationState.total}</span>
                          <span>{generationState.progress}%</span>
                        </div>
                        <div className="progress-track">
                          <div className="progress-fill" style={{ width: `${generationState.progress}%` }} />
                        </div>
                      </div>
                    )}
                    {generationState && generationState.progress === 100 && (
                      <div style={{ marginTop: 8 }}>
                        <span className="badge badge-success">✓ All clips generated</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Output settings */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select
                        className="input"
                        value={state.settings.format}
                        onChange={e => dispatch({ type: 'UPDATE_SETTINGS', payload: { format: e.target.value } })}
                        style={{ width: 80, padding: '7px 28px 7px 10px', fontSize: '0.8125rem' }}
                      >
                        <option value="mp4">MP4</option>
                        <option value="webm">WebM</option>
                      </select>
                      <select
                        className="input"
                        value={state.settings.quality}
                        onChange={e => dispatch({ type: 'UPDATE_SETTINGS', payload: { quality: e.target.value } })}
                        style={{ width: 90, padding: '7px 28px 7px 10px', fontSize: '0.8125rem' }}
                      >
                        <option value="480p">480p</option>
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                      </select>
                      <select
                        className="input"
                        value={state.settings.aspect}
                        onChange={e => dispatch({ type: 'UPDATE_SETTINGS', payload: { aspect: e.target.value } })}
                        style={{ width: 100, padding: '7px 28px 7px 10px', fontSize: '0.8125rem' }}
                      >
                        <option value="original">Original</option>
                        <option value="9:16">9:16</option>
                        <option value="1:1">1:1</option>
                        <option value="16:9">16:9</option>
                      </select>
                    </div>

                    <button
                      className="btn btn-primary"
                      onClick={handleGenerate}
                      disabled={state.selectedClips.size === 0 || state.isGenerating || (generationState?.progress < 100)}
                    >
                      {state.isGenerating ? (
                        <>
                          <div className="spinner spinner-sm" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                          </svg>
                          Generate Clips
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Generated results */}
                {generationState && generationState.results.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div className="divider" />
                    <h3 style={{ fontSize: '0.9375rem', marginBottom: 12 }}>Generated Clips</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {generationState.results.map((clip, i) => (
                        <div key={clip.id} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)',
                          padding: '10px 14px'
                        }}>
                          <div className="spinner spinner-sm" style={{ borderTopColor: 'var(--success)' }} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', marginBottom: 2 }}>
                              {clip.outputName}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                              {(clip.size / 1024 / 1024).toFixed(1)} MB · {clip.format.toUpperCase()} · {clip.quality}
                            </p>
                          </div>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDownload(clip.id, clip.outputName)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                            </svg>
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
