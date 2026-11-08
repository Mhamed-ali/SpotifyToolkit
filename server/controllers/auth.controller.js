const querystring = require('querystring');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config/config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SpotifyAuth');
const STATE_COOKIE_KEY = 'spotify_auth_state';

// Least-privilege scopes required by Spotify Toolkit
const SPOTIFY_SCOPES = [
    'user-read-private',
    'user-read-email',
    'user-library-read',
    'user-library-modify',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private'
].join(' ');

const generateRandomString = (length = 16) =>
    crypto.randomBytes(length).toString('hex').slice(0, length);

const getBasicAuthHeader = () =>
    'Basic ' + Buffer.from(`${config.CLIENT_ID}:${config.CLIENT_SECRET}`).toString('base64');

exports.login = (req, res) => {
    const state = generateRandomString(16);
    res.cookie(STATE_COOKIE_KEY, state, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.USE_HTTPS
    });

    logger.info('Redirecting user to Spotify OAuth authorization');

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: config.CLIENT_ID,
            scope: SPOTIFY_SCOPES,
            redirect_uri: config.REDIRECT_URI,
            state: state,
            show_dialog: true
        }));
};

exports.callback = async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[STATE_COOKIE_KEY] : null;

    if (!state || (storedState && state !== storedState)) {
        logger.warn('Spotify OAuth state mismatch detected', { hasState: Boolean(state), hasCookie: Boolean(storedState) });
        return res.redirect(`${config.FRONTEND_URI}/?` +
            querystring.stringify({ error: 'state_mismatch' }));
    }

    res.clearCookie(STATE_COOKIE_KEY);

    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                code: code,
                redirect_uri: config.REDIRECT_URI,
                grant_type: 'authorization_code'
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': getBasicAuthHeader()
            }
        });

        const { access_token, refresh_token, expires_in } = response.data;
        logger.info('Spotify OAuth token exchange succeeded', { expires_in });

        res.redirect(`${config.FRONTEND_URI}/?` +
            querystring.stringify({
                provider: 'spotify',
                access_token,
                refresh_token,
                expires_in
            }));
    } catch (error) {
        logger.error('Spotify token exchange failed', error.response ? error.response.data : error);
        res.redirect(`${config.FRONTEND_URI}/?error=invalid_token`);
    }
};

exports.refreshToken = async (req, res) => {
    const refreshToken = req.query.refresh_token || req.body?.refresh_token;

    if (!refreshToken) {
        logger.warn('Refresh token request missing refresh_token parameter');
        return res.status(400).json({ error: 'Missing refresh_token' });
    }

    try {
        const response = await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token',
            data: querystring.stringify({
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': getBasicAuthHeader()
            }
        });

        logger.info('Spotify access token refreshed successfully');

        return res.json({
            access_token: response.data.access_token,
            refresh_token: response.data.refresh_token || refreshToken,
            expires_in: response.data.expires_in
        });
    } catch (error) {
        logger.error('Failed to refresh Spotify access token', error.response ? error.response.data : error);
        return res.status(401).json({ error: 'Failed to refresh token' });
    }
};
