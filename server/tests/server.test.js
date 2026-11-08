const test = require('node:test');
const assert = require('node:assert/strict');

// Intercept axios in require.cache before loading controllers so all OAuth/Proxy HTTP paths are deterministically testable
const axiosPath = require.resolve('axios');
let mockAxiosHandler = async () => ({ data: {} });
const axiosMock = (...args) => mockAxiosHandler(...args);
axiosMock.post = (...args) => mockAxiosHandler(...args);
axiosMock.get = (...args) => mockAxiosHandler(...args);
require.cache[axiosPath] = {
    id: axiosPath,
    filename: axiosPath,
    loaded: true,
    exports: axiosMock
};

const config = require('../config/config');
const { createLogger, requestLoggerMiddleware } = require('../utils/logger');
const authController = require('../controllers/auth.controller');
const anghamiController = require('../controllers/anghami.controller');
const authRoutes = require('../routes/auth.routes');

// Helper to create mock Express req/res objects
const createMockReqRes = ({ query = {}, body = {}, cookies = {}, headers = {}, method = 'GET', originalUrl = '/' } = {}) => {
    const res = {
        statusCode: 200,
        cookiesSet: {},
        cookiesCleared: [],
        redirectUrl: null,
        jsonBody: null,
        cookie(name, val, opts) {
            this.cookiesSet[name] = { val, opts };
            return this;
        },
        clearCookie(name) {
            this.cookiesCleared.push(name);
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        redirect(url) {
            this.redirectUrl = url;
            return this;
        },
        json(payload) {
            this.jsonBody = payload;
            return this;
        }
    };
    return {
        req: { query, body, cookies, headers, method, originalUrl },
        res
    };
};

test('Suite 1 — Server Config: loads defaults cleanly', () => {
    assert.ok(config.PORT);
    assert.equal(typeof config.USE_HTTPS, 'boolean');
    assert.ok(config.ANGHAMI_SDK_URL.includes('sdk.anghami.com'));
});

test('Suite 2 — Server Logger: redacts sensitive tokens, arrays, circular objects, and debug level', () => {
    const captured = [];
    const origLog = console.log;
    const origDebug = console.debug;
    const origWarn = console.warn;
    const origError = console.error;
    const origLevel = config.LOG_LEVEL;

    console.log = (msg) => captured.push(msg);
    console.debug = (msg) => captured.push(msg);
    console.warn = (msg) => captured.push(msg);
    console.error = (msg) => captured.push(msg);

    try {
        config.LOG_LEVEL = 'debug';
        const logger = createLogger('TestScope');

        // 1. Debug level + array redaction
        logger.debug('Debug message Basic dXNlcjpwYXNz', ['Bearer secret_in_array', 123]);

        // 2. Object redaction + query/Bearer redaction
        logger.info('OAuth callback ?access_token=secret123&refresh_token=ref456 Bearer tok789', {
            access_token: 'secret123',
            refresh_token: 'ref456',
            client_secret: 'my_secret',
            authorization: 'Bearer tok789',
            safeField: 'visible'
        });

        // 3. Unserializable circular meta fallback
        const circular = {};
        circular.self = circular;
        logger.warn('Circular meta test', circular);

        // 4. Error instance formatting
        logger.error('Error test', new Error('Test failure'));

        assert.equal(captured.length, 4);
        assert.ok(captured[0].includes('[DEBUG]'));
        assert.ok(!captured[0].includes('secret_in_array'));
        assert.ok(!captured[1].includes('secret123'), 'access_token should be redacted');
        assert.ok(!captured[1].includes('ref456'), 'refresh_token should be redacted');
        assert.ok(!captured[1].includes('my_secret'), 'client_secret should be redacted');
        assert.ok(!captured[1].includes('tok789'), 'Bearer token should be redacted');
        assert.ok(captured[1].includes('"safeField":"visible"'), 'non-sensitive fields should remain');
        assert.ok(captured[2].includes('[Unserializable Meta]'));
        assert.ok(captured[3].includes('Test failure'));
    } finally {
        config.LOG_LEVEL = origLevel;
        console.log = origLog;
        console.debug = origDebug;
        console.warn = origWarn;
        console.error = origError;
    }
});

test('Suite 3 — HTTP Request Logger Middleware: strips query tokens & logs 2xx/4xx/5xx status codes', () => {
    const captured = [];
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;
    console.log = (msg) => captured.push({ level: 'info', msg });
    console.warn = (msg) => captured.push({ level: 'warn', msg });
    console.error = (msg) => captured.push({ level: 'error', msg });

    try {
        for (const statusCode of [302, 401, 500]) {
            let finishCb = null;
            const req = { method: 'GET', originalUrl: '/callback?code=super_secret_code&state=xyz' };
            const res = {
                statusCode,
                on(event, cb) {
                    if (event === 'finish') finishCb = cb;
                }
            };
            requestLoggerMiddleware(req, res, () => {});
            finishCb();
        }

        assert.equal(captured.length, 3);
        assert.equal(captured[0].level, 'info');
        assert.equal(captured[1].level, 'warn');
        assert.equal(captured[2].level, 'error');
        assert.ok(!captured[0].msg.includes('super_secret_code'));
    } finally {
        console.log = origLog;
        console.warn = origWarn;
        console.error = origError;
    }
});

test('Suite 4 — Spotify Auth Controller (login, callback success/failure, refreshToken success/failure)', async () => {
    // 1. Login sets state cookie and redirects to Spotify Authorize with least-privilege scopes
    const { req: loginReq, res: loginRes } = createMockReqRes();
    authController.login(loginReq, loginRes);
    assert.ok(loginRes.cookiesSet.spotify_auth_state.val);
    assert.ok(loginRes.redirectUrl.startsWith('https://accounts.spotify.com/authorize?'));
    assert.ok(!loginRes.redirectUrl.includes('app-remote-control'));

    // 2. Callback rejects state mismatch
    const { req: cbMismatchReq, res: cbMismatchRes } = createMockReqRes({
        query: { code: 'abc', state: 'wrong_state' },
        cookies: { spotify_auth_state: 'expected_state' }
    });
    await authController.callback(cbMismatchReq, cbMismatchRes);
    assert.ok(cbMismatchRes.redirectUrl.includes('error=state_mismatch'));

    // 3. Callback succeeds when state matches and axios resolves
    mockAxiosHandler = async () => ({
        data: { access_token: 'sp_acc_1', refresh_token: 'sp_ref_1', expires_in: 3600 }
    });
    const { req: cbOkReq, res: cbOkRes } = createMockReqRes({
        query: { code: 'valid_code', state: 'valid_state' },
        cookies: { spotify_auth_state: 'valid_state' }
    });
    await authController.callback(cbOkReq, cbOkRes);
    assert.ok(cbOkRes.cookiesCleared.includes('spotify_auth_state'));
    assert.ok(cbOkRes.redirectUrl.includes('access_token=sp_acc_1'));
    assert.ok(cbOkRes.redirectUrl.includes('refresh_token=sp_ref_1'));

    // 4. Callback handles token exchange error gracefully
    mockAxiosHandler = async () => {
        const err = new Error('Spotify API error');
        err.response = { data: { error: 'invalid_grant' } };
        throw err;
    };
    const { req: cbErrReq, res: cbErrRes } = createMockReqRes({
        query: { code: 'bad_code', state: 'valid_state' },
        cookies: { spotify_auth_state: 'valid_state' }
    });
    await authController.callback(cbErrReq, cbErrRes);
    assert.ok(cbErrRes.redirectUrl.includes('error=invalid_token'));

    // 5. Refresh token returns 400 when refresh_token is missing
    const { req: refMissingReq, res: refMissingRes } = createMockReqRes();
    await authController.refreshToken(refMissingReq, refMissingRes);
    assert.equal(refMissingRes.statusCode, 400);
    assert.equal(refMissingRes.jsonBody.error, 'Missing refresh_token');

    // 6. Refresh token succeeds and returns new access_token
    mockAxiosHandler = async () => ({
        data: { access_token: 'new_sp_acc', expires_in: 3600 }
    });
    const { req: refOkReq, res: refOkRes } = createMockReqRes({
        query: { refresh_token: 'existing_ref_tok' }
    });
    await authController.refreshToken(refOkReq, refOkRes);
    assert.equal(refOkRes.statusCode, 200);
    assert.equal(refOkRes.jsonBody.access_token, 'new_sp_acc');
    assert.equal(refOkRes.jsonBody.refresh_token, 'existing_ref_tok');

    // 7. Refresh token returns 401 when upstream fails
    mockAxiosHandler = async () => {
        throw new Error('Refresh rejected');
    };
    const { req: refFailReq, res: refFailRes } = createMockReqRes({
        body: { refresh_token: 'expired_ref_tok' }
    });
    await authController.refreshToken(refFailReq, refFailRes);
    assert.equal(refFailRes.statusCode, 401);
    assert.equal(refFailRes.jsonBody.error, 'Failed to refresh token');
});

test('Suite 5 — Anghami Auth Controller (Public/Sandbox login, PKCE login, callback success/failure, proxy success/failure)', async () => {
    const originalClientId = config.ANGHAMI_CLIENT_ID;
    const originalApiKey = config.ANGHAMI_API_KEY;

    try {
        // 1. Public/Sandbox login when ANGHAMI_CLIENT_ID is empty
        config.ANGHAMI_CLIENT_ID = '';
        const { req: pubReq, res: pubRes } = createMockReqRes();
        anghamiController.login(pubReq, pubRes);
        assert.ok(pubRes.redirectUrl.includes('provider=anghami'));
        assert.ok(pubRes.redirectUrl.includes('mode=public'));

        // 2. OAuth 2.0 + PKCE login when ANGHAMI_CLIENT_ID is configured
        config.ANGHAMI_CLIENT_ID = 'test_anghami_client';
        const { req: pkceReq, res: pkceRes } = createMockReqRes();
        anghamiController.login(pkceReq, pkceRes);
        assert.ok(pkceRes.cookiesSet.anghami_auth_state.val);
        assert.ok(pkceRes.cookiesSet.anghami_pkce_verifier.val);
        assert.ok(pkceRes.redirectUrl.includes('code_challenge_method=S256'));

        // 3. Callback rejects state mismatch
        const { req: cbReq, res: cbRes } = createMockReqRes({
            query: { code: '123', state: 'bad' },
            cookies: { anghami_auth_state: 'good' }
        });
        await anghamiController.callback(cbReq, cbRes);
        assert.ok(cbRes.redirectUrl.includes('error=anghami_state_mismatch'));

        // 4. Callback succeeds when state matches and axios.post resolves
        mockAxiosHandler = async () => ({
            data: { access_token: 'ang_acc_1', refresh_token: 'ang_ref_1' }
        });
        const { req: cbOkReq, res: cbOkRes } = createMockReqRes({
            query: { code: 'ang_code', state: 'good_state' },
            cookies: { anghami_auth_state: 'good_state', anghami_pkce_verifier: 'verifier_123' }
        });
        await anghamiController.callback(cbOkReq, cbOkRes);
        assert.ok(cbOkRes.cookiesCleared.includes('anghami_auth_state'));
        assert.ok(cbOkRes.cookiesCleared.includes('anghami_pkce_verifier'));
        assert.ok(cbOkRes.redirectUrl.includes('access_token=ang_acc_1'));

        // 5. Callback redirects with error when axios.post rejects
        mockAxiosHandler = async () => {
            throw new Error('Anghami token error');
        };
        const { req: cbFailReq, res: cbFailRes } = createMockReqRes({
            query: { code: 'bad_code', state: 'good_state' },
            cookies: { anghami_auth_state: 'good_state', anghami_pkce_verifier: 'verifier_123' }
        });
        await anghamiController.callback(cbFailReq, cbFailRes);
        assert.ok(cbFailRes.redirectUrl.includes('error=anghami_invalid_token'));

        // 6. Proxy rejects missing endpoint parameter
        const { req: proxyMissingReq, res: proxyMissingRes } = createMockReqRes();
        await anghamiController.proxyRequest(proxyMissingReq, proxyMissingRes);
        assert.equal(proxyMissingRes.statusCode, 400);
        assert.equal(proxyMissingRes.jsonBody.error, 'Missing endpoint parameter');

        // 7. Proxy forwards Authorization & x-api-key headers and returns upstream JSON
        config.ANGHAMI_API_KEY = 'ang_key_999';
        mockAxiosHandler = async (reqConfig) => ({
            data: { items: [{ id: 'pl_1' }], echoedHeaders: reqConfig.headers }
        });
        const { req: proxyOkReq, res: proxyOkRes } = createMockReqRes({
            query: { endpoint: '/playlists/me', params: JSON.stringify({ limit: 10 }) },
            headers: { authorization: 'Bearer real_anghami_token' },
            method: 'POST',
            body: { test: true }
        });
        await anghamiController.proxyRequest(proxyOkReq, proxyOkRes);
        assert.equal(proxyOkRes.statusCode, 200);
        assert.equal(proxyOkRes.jsonBody.echoedHeaders['Authorization'], 'Bearer real_anghami_token');
        assert.equal(proxyOkRes.jsonBody.echoedHeaders['x-api-key'], 'ang_key_999');

        // 8. Proxy handles upstream failure with status code & ANGHAMI_API_UNAVAILABLE
        mockAxiosHandler = async () => {
            const err = new Error('Upstream gateway timeout');
            err.response = { status: 503, data: { message: 'Service Temporarily Unavailable' } };
            throw err;
        };
        const { req: proxyErrReq, res: proxyErrRes } = createMockReqRes({
            query: { endpoint: 'me' }
        });
        await anghamiController.proxyRequest(proxyErrReq, proxyErrRes);
        assert.equal(proxyErrRes.statusCode, 503);
        assert.equal(proxyErrRes.jsonBody.error, 'ANGHAMI_API_UNAVAILABLE');
        assert.equal(proxyErrRes.jsonBody.message, 'Service Temporarily Unavailable');
    } finally {
        config.ANGHAMI_CLIENT_ID = originalClientId;
        config.ANGHAMI_API_KEY = originalApiKey;
    }
});

test('Suite 6 — Express Auth Routes Registration', () => {
    const registeredPaths = authRoutes.stack
        .filter(layer => layer.route)
        .map(layer => layer.route.path);

    assert.ok(registeredPaths.includes('/login'));
    assert.ok(registeredPaths.includes('/callback'));
    assert.ok(registeredPaths.includes('/refresh_token'));
    assert.ok(registeredPaths.includes('/anghami/login'));
    assert.ok(registeredPaths.includes('/anghami/callback'));
    assert.ok(registeredPaths.includes('/anghami/proxy'));
});
