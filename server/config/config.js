require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 8888,
    CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    REDIRECT_URI: process.env.REDIRECT_URI || 'http://127.0.0.1:8888/callback',
    FRONTEND_URI: process.env.FRONTEND_URI || 'http://localhost:5173'
};
