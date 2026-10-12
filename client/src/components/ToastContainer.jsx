import React from 'react';
import { useAppState } from '../App.jsx';

export default function ToastContainer() {
  const { state } = useAppState();

  const icon = (type) => {
    if (type === 'success') return '✓';
    if (type === 'error') return '✕';
    if (type === 'warning') return '⚠';
    return 'ℹ';
  };

  return (
    <div className="toast-container">
      {state.toasts.map(toast => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{icon(toast.type)}</span>
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button className="toast-close" onClick={() => {}}>✕</button>
        </div>
      ))}
    </div>
  );
}
