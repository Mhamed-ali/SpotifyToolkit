export const clientLogger = {
  info: (message: string, details?: any, source?: string, immediate?: boolean) => log('info', message, details, source, immediate),
  warn: (message: string, details?: any, source?: string, immediate?: boolean) => log('warn', message, details, source, immediate),
  error: (message: string, details?: any, source?: string, immediate?: boolean) => log('error', message, details, source, immediate),
};

const log = (level: string, message: string, details?: any, source?: string, immediate?: boolean) => {
  // Always log to the browser console for immediate visibility
  if (level === 'error') console.error(message, details);
  else if (level === 'warn') console.warn(message, details);
  else console.info(message, details);

  // Use sendBeacon to bypass browser HTTP connection pool limits during heavy Spotify API usage
  try {
    const payload = JSON.stringify({ 
      level, 
      message, 
      details: typeof details === 'object' ? JSON.stringify(details) : details, 
      source: source || 'ClientUI' 
    });

    // If immediate is true, force a high-priority fetch instead of the background sendBeacon queue
    if (!immediate && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/log', blob);
    } else {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true, // Ensures it finishes sending even if the user navigates away
      }).catch(() => {});
    }
  } catch (e) {}
};
