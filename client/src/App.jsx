import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import Editor from './pages/Editor.jsx';
import Library from './pages/Library.jsx';
import Settings from './pages/Settings.jsx';
import ToastContainer from './components/ToastContainer.jsx';

// ── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

const initialState = {
  currentVideo: null,
  detectedClips: [],
  selectedClips: new Set(),
  isDetecting: false,
  isGenerating: false,
  generationProgress: 0,
  settings: {
    format: 'mp4',
    quality: '720p',
    aspect: 'original',
    maxDuration: 60
  },
  toasts: [],
  library: []
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_VIDEO':
      return { ...state, currentVideo: action.payload, detectedClips: [], selectedClips: new Set() };
    case 'SET_DETECTED_CLIPS':
      return { ...state, detectedClips: action.payload, isDetecting: false };
    case 'SET_DETECTING':
      return { ...state, isDetecting: action.payload };
    case 'TOGGLE_CLIP': {
      const next = new Set(state.selectedClips);
      if (next.has(action.payload)) next.delete(action.payload);
      else next.add(action.payload);
      return { ...state, selectedClips: next };
    }
    case 'SELECT_ALL_CLIPS':
      return { ...state, selectedClips: new Set(state.detectedClips.map((_, i) => i)) };
    case 'DESELECT_ALL':
      return { ...state, selectedClips: new Set() };
    case 'SET_GENERATING':
      return { ...state, isGenerating: action.payload, generationProgress: 0 };
    case 'SET_GENERATION_PROGRESS':
      return { ...state, generationProgress: action.payload };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    case 'SET_LIBRARY':
      return { ...state, library: action.payload };
    default:
      return state;
  }
}

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now().toString();
    dispatch({ type: 'ADD_TOAST', payload: { id, message, type } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), duration);
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, addToast }}>
      {children}
    </AppContext.Provider>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────
function Header() {
  return (
    <header className="header">
      <div className="header-logo">
        <svg viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="7" fill="#6366F1"/>
          <polygon points="10,7 10,21 21,14" fill="white"/>
        </svg>
        ClipGen
      </div>

      <nav className="header-nav">
        <NavLink to="/" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
          Editor
        </NavLink>
        <NavLink to="/library" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
          Library
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `nav-tab${isActive ? ' active' : ''}`}>
          Settings
        </NavLink>
      </nav>

      <div className="header-actions">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
          </svg>
        </a>
      </div>
    </header>
  );
}

// ── App Shell ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="app">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Editor />} />
              <Route path="/library" element={<Library />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <ToastContainer />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}
