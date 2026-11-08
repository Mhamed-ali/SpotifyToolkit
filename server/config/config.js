require('dotenv').config();

module.exports = {
    PORT: process.env.PORT || 8888,
    HOST: process.env.HOST || '0.0.0.0',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    SSL_COMMON_NAME: process.env.SSL_COMMON_NAME || 'localhost',
    USE_HTTPS: process.env.USE_HTTPS !== 'false', // Defaults to true for local dev
    FRONTEND_URI: process.env.FRONTEND_URI || 'https://localhost:5173',

    // Spotify Configuration
    CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    REDIRECT_URI: process.env.REDIRECT_URI || process.env.SPOTIFY_REDIRECT_URI || 'https://localhost:8888/callback',

    // Anghami Configuration (Anghami + OSN+ SDK: sdk.anghami.com)
    ANGHAMI_CLIENT_ID: process.env.ANGHAMI_CLIENT_ID || '',
    ANGHAMI_CLIENT_SECRET: process.env.ANGHAMI_CLIENT_SECRET || '',
    ANGHAMI_API_KEY: process.env.ANGHAMI_API_KEY || '',
    ANGHAMI_REDIRECT_URI: process.env.ANGHAMI_REDIRECT_URI || 'https://localhost:8888/anghami/callback',
    ANGHAMI_SDK_URL: process.env.ANGHAMI_SDK_URL || 'https://sdk.anghami.com/v1'
};
