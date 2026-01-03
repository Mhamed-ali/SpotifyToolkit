const express = require('express');
const cors = require('cors');
const querystring = require('querystring');
const axios = require('axios');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8888;

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://127.0.0.1:8888/callback';
const FRONTEND_URI = process.env.FRONTEND_URI || 'http://localhost:5173';

console.log('--- DEBUG INFO ---');
console.log('Loading .env from:', process.cwd());
console.log('CLIENT_ID:', CLIENT_ID ? 'Loaded (starts with ' + CLIENT_ID.substring(0, 5) + ')' : 'NOT LOADED');
console.log('REDIRECT_URI:', REDIRECT_URI);
console.log('------------------');

app.use(cors());
app.use(cookieParser());
app.use(express.json());

const generateRandomString = length => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const stateKey = 'spotify_auth_state';

app.get('/', (req, res) => {
  res.json({ message: 'Spotify Auth Server is running' });
});

app.get('/login', (req, res) => {
  const state = generateRandomString(16);
  res.cookie(stateKey, state);

  const scope = 'user-read-private user-read-email user-library-read';

  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI,
      state: state
    }));
});

app.get('/callback', async (req, res) => {
  const code = req.query.code || null;
  const state = req.query.state || null;

  if (state === null) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    try {
      const response = await axios({
        method: 'post',
        url: 'https://accounts.spotify.com/api/token',
        data: querystring.stringify({
          code: code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        }),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + (new Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'))
        }
      });

      const access_token = response.data.access_token;
      const refresh_token = response.data.refresh_token;

      // Redirect to frontend with tokens
      res.redirect(`${FRONTEND_URI}/?` +
        querystring.stringify({
          access_token: access_token,
          refresh_token: refresh_token
        }));
    } catch (error) {
      console.error('Error getting token:', error.response ? error.response.data : error.message);
      res.redirect(`${FRONTEND_URI}/?error=invalid_token`);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
