import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles.css'

// Dev console relay to backend
if (typeof window !== 'undefined' && import.meta && import.meta.env && import.meta.env.DEV) {
  const methods = ['log','info','warn','error'];
  methods.forEach((m) => {
    const orig = console[m];
    console[m] = (...args) => {
      try {
        fetch('/api/logs?level=' + m, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            args: args.map(a => {
              try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
            })
          })
        }).catch(() => { /* ignore dev log failures */ });
      } catch {
        /* noop */
      }
      orig.apply(console, args);
    };
  });
}

createRoot(document.getElementById('root')).render(<App />)
