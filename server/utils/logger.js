const config = require('../config/config');

/**
 * Centralized Structured Logger & HTTP Access Middleware (Facade Pattern).
 * - Adds ISO-8601 timestamps, severity levels, and module scopes.
 * - Automatically redacts OAuth secrets, tokens, and authorization codes.
 * - Provides Express HTTP request/latency logging middleware.
 */

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

const SENSITIVE_KEY_PATTERN = /^(access_token|refresh_token|client_secret|authorization|code|code_verifier|x-api-key|cookie)$/i;

const getActiveLevel = () => {
    const levelName = String(config.LOG_LEVEL || 'info').toLowerCase();
    return LOG_LEVELS[levelName] ?? LOG_LEVELS.info;
};

const redactValue = (val) => {
    if (typeof val === 'string') {
        return val
            .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED]')
            .replace(/(Basic\s+)[A-Za-z0-9+/=]+/gi, '$1[REDACTED]')
            .replace(/([?&](?:access_token|refresh_token|code|client_secret)=)[^&\s]+/gi, '$1[REDACTED]');
    }
    if (Array.isArray(val)) {
        return val.map(redactValue);
    }
    if (val && typeof val === 'object') {
        const sanitized = {};
        for (const [k, v] of Object.entries(val)) {
            sanitized[k] = SENSITIVE_KEY_PATTERN.test(k) ? '[REDACTED]' : redactValue(v);
        }
        return sanitized;
    }
    return val;
};

const formatEntry = (level, scope, message, meta) => {
    const timestamp = new Date().toISOString();
    const safeMessage = redactValue(String(message));
    let metaSuffix = '';

    if (meta !== undefined && meta !== null) {
        try {
            const normalizedMeta = meta instanceof Error
                ? { message: meta.message, status: meta.status, data: meta.response?.data }
                : meta;
            metaSuffix = ` | ${JSON.stringify(redactValue(normalizedMeta))}`;
        } catch {
            metaSuffix = ' | [Unserializable Meta]';
        }
    }

    return `[${timestamp}] [${level.toUpperCase()}] [${scope}] ${safeMessage}${metaSuffix}`;
};

const createLogger = (scope = 'App') => ({
    debug(message, meta) {
        if (getActiveLevel() <= LOG_LEVELS.debug) {
            console.debug(formatEntry('debug', scope, message, meta));
        }
    },
    info(message, meta) {
        if (getActiveLevel() <= LOG_LEVELS.info) {
            console.log(formatEntry('info', scope, message, meta));
        }
    },
    warn(message, meta) {
        if (getActiveLevel() <= LOG_LEVELS.warn) {
            console.warn(formatEntry('warn', scope, message, meta));
        }
    },
    error(message, meta) {
        if (getActiveLevel() <= LOG_LEVELS.error) {
            console.error(formatEntry('error', scope, message, meta));
        }
    }
});

const httpLogger = createLogger('HTTP');

const requestLoggerMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const safePath = (req.originalUrl || req.url || '/').split('?')[0];

    res.on('finish', () => {
        const durationMs = Date.now() - startTime;
        const status = res.statusCode;
        const msg = `${req.method} ${safePath} ${status} - ${durationMs}ms`;

        if (status >= 500) {
            httpLogger.error(msg);
        } else if (status >= 400) {
            httpLogger.warn(msg);
        } else {
            httpLogger.info(msg);
        }
    });

    next();
};

module.exports = {
    createLogger,
    requestLoggerMiddleware
};
