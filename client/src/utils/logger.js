/**
 * Frontend Structured Logger (Facade Pattern).
 * - Gates verbose logs (debug, info, warn) behind development mode or localStorage flag (`debug_logs`).
 * - Redacts OAuth tokens from logged strings/metadata.
 * - Maintains an in-memory ring buffer of the last 100 log entries for diagnostics.
 */

const MAX_BUFFER_SIZE = 100;
const logRingBuffer = [];

const isVerboseEnabled = () => {
    try {
        return Boolean(import.meta.env?.DEV) || localStorage.getItem('debug_logs') === 'true';
    } catch {
        return true;
    }
};

const sanitizeText = (input) => {
    if (typeof input !== 'string') return input;
    return input
        .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
        .replace(/([?&](?:access_token|refresh_token)=)[^&\s]+/gi, '$1[REDACTED]');
};

const recordEntry = (level, scope, message, meta) => {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        scope,
        message: sanitizeText(String(message)),
        meta: meta instanceof Error ? { message: meta.message, status: meta.status } : meta
    };
    logRingBuffer.push(entry);
    if (logRingBuffer.length > MAX_BUFFER_SIZE) {
        logRingBuffer.shift();
    }
    return entry;
};

export const getRecentClientLogs = () => [...logRingBuffer];

export const createClientLogger = (scope = 'App') => ({
    debug(message, meta) {
        const entry = recordEntry('DEBUG', scope, message, meta);
        if (isVerboseEnabled()) {
            console.debug(`[${entry.timestamp}] [DEBUG] [${scope}] ${entry.message}`, meta ?? '');
        }
    },
    info(message, meta) {
        const entry = recordEntry('INFO', scope, message, meta);
        if (isVerboseEnabled()) {
            console.info(`[${entry.timestamp}] [INFO] [${scope}] ${entry.message}`, meta ?? '');
        }
    },
    warn(message, meta) {
        const entry = recordEntry('WARN', scope, message, meta);
        if (isVerboseEnabled()) {
            console.warn(`[${entry.timestamp}] [WARN] [${scope}] ${entry.message}`, meta ?? '');
        }
    },
    error(message, err) {
        const entry = recordEntry('ERROR', scope, message, err);
        console.error(
            `[${entry.timestamp}] [ERROR] [${scope}] ${entry.message}`,
            isVerboseEnabled() ? (err ?? '') : (err?.message || '')
        );
    }
});
