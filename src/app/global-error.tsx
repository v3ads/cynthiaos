'use client';

import { useEffect } from 'react';

/**
 * Global error boundary for the Next.js App Router.
 *
 * When a ChunkLoadError occurs (stale JS bundle after a Vercel deployment),
 * the page is automatically reloaded once so the browser fetches the new
 * bundle.  A reload-loop guard (sessionStorage flag) prevents infinite
 * refreshes if the error persists for a different reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError =
    error?.name === 'ChunkLoadError' ||
    error?.message?.includes('Loading chunk') ||
    error?.message?.includes('Failed to fetch dynamically imported module') ||
    error?.message?.includes('Importing a module script failed');

  useEffect(() => {
    if (isChunkError) {
      const reloadKey = 'cynthiaos_chunk_reload_attempted';
      const alreadyTried = sessionStorage.getItem(reloadKey);
      if (!alreadyTried) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      }
    }
  }, [isChunkError]);

  // Clear the reload guard on successful navigation so future chunk errors
  // can also auto-recover.
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('cynthiaos_chunk_reload_attempted');
    };
  }, []);

  if (isChunkError) {
    return (
      <html lang="en">
        <body
          style={{
            background: '#0d0f14',
            color: '#c8cdd8',
            fontFamily: 'system-ui, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            gap: '12px',
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <p style={{ fontSize: '1rem', opacity: 0.7 }}>
            Refreshing to load the latest version…
          </p>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body
        style={{
          background: '#0d0f14',
          color: '#c8cdd8',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '16px',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: '0.9rem', opacity: 0.6, margin: 0 }}>
          {error?.message ?? 'An unexpected error occurred.'}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: '8px',
            padding: '8px 20px',
            background: '#5b5ef4',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
