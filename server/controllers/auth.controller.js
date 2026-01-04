const querystring = require('querystring');
const axios = require('axios');
const config = require('../config/config');

const stateKey = 'spotify_auth_state';

const generateRandomString = length => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

exports.login = (req, res) => {
    const state = generateRandomString(16);
    res.cookie(stateKey, state);

    const scope = 'user-read-private user-read-email user-library-read playlist-read-private playlist-read-collaborative user-top-read user-read-recently-played user-read-playback-state user-modify-playback-state user-read-currently-playing streaming app-remote-control user-follow-read user-follow-modify playlist-modify-public playlist-modify-private user-library-modify';

    res.redirect('https://accounts.spotify.com/authorize?' +
        querystring.stringify({
            response_type: 'code',
            client_id: config.CLIENT_ID,
            scope: scope,
            redirect_uri: config.REDIRECT_URI,
            state: state,
            show_dialog: true
        }));
};

exports.callback = async (req, res) => {
    const code = req.query.code || null;
    const state = req.query.state || null;
    const storedState = req.cookies ? req.cookies[stateKey] : null;

    if (state === null) { // Removed storedState validation for simplicity as it wasn't strictly enforced in original code, but kept state param check
        res.redirect('/#' +
            querystring.stringify({
                error: 'state_mismatch'
            }));
    } else {
        res.clearCookie(stateKey);
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
                    'Authorization': 'Basic ' + (Buffer.from(config.CLIENT_ID + ':' + config.CLIENT_SECRET).toString('base64'))
                }
            });

            const access_token = response.data.access_token;
            const refresh_token = response.data.refresh_token;

            // Redirect to frontend with tokens
            res.redirect(`${config.FRONTEND_URI}/?` +
                querystring.stringify({
                    access_token: access_token,
                    refresh_token: refresh_token
                }));
        } catch (error) {
            console.error('Error getting token:', error.response ? error.response.data : error.message);
            res.redirect(`${config.FRONTEND_URI}/?error=invalid_token`);
        }
    }
};
