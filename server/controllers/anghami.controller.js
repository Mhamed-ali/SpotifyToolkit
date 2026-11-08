const querystring = require('querystring');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config/config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('AnghamiAuth');
const ANGHAMI_STATE_COOKIE = 'anghami_auth_state';
const ANGHAMI_VERIFIER_COOKIE = 'anghami_pkce_verifier';

const base64UrlEncode = (buffer) =>
    buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

const generateCodeVerifier = () => base64UrlEncode(crypto.randomBytes(32));

const generateCodeChallenge = (verifier) =>
    base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());

exports.login = (req, res) => {
    if (!config.ANGHAMI_CLIENT_ID) {
        logger.info('Starting Anghami session in Public/Sandbox mode (no ANGHAMI_CLIENT_ID configured)');
        return res.redirect(`${config.FRONTEND_URI}/?` +
            querystring.stringify({
                provider: 'anghami',
                access_token: 'anghami_public_session',
                mode: 'public'
            }));
    }

    const state = base64UrlEncode(crypto.randomBytes(16));
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const cookieOptions = {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.USE_HTTPS
    };

    res.cookie(ANGHAMI_STATE_COOKIE, state, cookieOptions);
    res.cookie(ANGHAMI_VERIFIER_COOKIE, codeVerifier, cookieOptions);

    logger.info('Redirecting user to Anghami OAuth 2.0 + PKCE authorization');

    res.redirect(`${config.ANGHAMI_SDK_URL}/auth/authorize?` +
        querystring.stringify({
            client_id: config.ANGHAMI_CLIENT_ID,
            redirect_uri: config.ANGHAMI_REDIRECT_URI,
            response_type: 'code',
            scope: 'read stream',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            state: state
        }));
};

exports.callback = async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[ANGHAMI_STATE_COOKIE] : null;
    const codeVerifier = req.cookies ? req.cookies[ANGHAMI_VERIFIER_COOKIE] : null;

    if (!state || (storedState && state !== storedState)) {
        logger.warn('Anghami OAuth state mismatch detected');
        return res.redirect(`${config.FRONTEND_URI}/?error=anghami_state_mismatch`);
    }

    res.clearCookie(ANGHAMI_STATE_COOKIE);
    res.clearCookie(ANGHAMI_VERIFIER_COOKIE);

    try {
        const response = await axios.post(`${config.ANGHAMI_SDK_URL}/auth/token`, {
            client_id: config.ANGHAMI_CLIENT_ID,
            client_secret: config.ANGHAMI_CLIENT_SECRET || undefined,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: config.ANGHAMI_REDIRECT_URI,
            code_verifier: codeVerifier
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const { access_token, refresh_token } = response.data;
        logger.info('Anghami OAuth token exchange succeeded');

        res.redirect(`${config.FRONTEND_URI}/?` +
            querystring.stringify({
                provider: 'anghami',
                access_token,
                refresh_token
            }));
    } catch (error) {
        logger.error('Anghami token exchange failed', error.response ? error.response.data : error);
        res.redirect(`${config.FRONTEND_URI}/?error=anghami_invalid_token`);
    }
};

exports.proxyRequest = async (req, res) => {
    const endpoint = req.query.endpoint;
    if (!endpoint) {
        logger.warn('Anghami proxy called without endpoint parameter');
        return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    const authHeader = req.headers.authorization;
    const headers = { 'Content-Type': 'application/json' };

    if (authHeader && !authHeader.includes('anghami_public_session')) {
        headers['Authorization'] = authHeader;
    }
    if (config.ANGHAMI_API_KEY) {
        headers['x-api-key'] = config.ANGHAMI_API_KEY;
    }

    try {
        logger.debug(`Proxying Anghami SDK request: ${endpoint}`);
        const response = await axios({
            method: req.method,
            url: `${config.ANGHAMI_SDK_URL}/${endpoint.replace(/^\//, '')}`,
            headers,
            params: req.query.params ? JSON.parse(req.query.params) : undefined,
            data: req.method !== 'GET' ? req.body : undefined,
            timeout: 10000
        });
        return res.json(response.data);
    } catch (error) {
        const status = error.response?.status || 502;
        logger.warn(`Anghami SDK proxy request failed (${status}) for endpoint: ${endpoint}`, error.message);
        return res.status(status).json({
            error: 'ANGHAMI_API_UNAVAILABLE',
            message: error.response?.data?.message || error.message
        });
    }
};
