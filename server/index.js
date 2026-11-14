const express = require('express');
const http = require('http');
const https = require('https');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const selfsigned = require('selfsigned');
const config = require('./config/config');
const authRoutes = require('./routes/auth.routes');
const { createLogger, requestLoggerMiddleware } = require('./utils/logger');

const logger = createLogger('Server');
const app = express();

logger.info('Initializing server configuration', {
    port: config.PORT,
    protocol: config.USE_HTTPS ? 'HTTPS' : 'HTTP',
    logLevel: config.LOG_LEVEL,
    spotifyConfigured: Boolean(config.CLIENT_ID)
});

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(requestLoggerMiddleware);

app.use('/', authRoutes);
app.use('/api/auth', authRoutes);

const healthHandler = (req, res) => {
    res.json({
        message: 'Spotify Toolkit 2.0 Auth Server is running',
        providers: {
            spotify: Boolean(config.CLIENT_ID)
        }
    });
};

app.get('/', healthHandler);
app.get('/health', healthHandler);

const launchHttpServer = () => {
    http.createServer(app).listen(config.PORT, config.HOST, () => {
        logger.info(`HTTP Server listening on http://${config.SSL_COMMON_NAME}:${config.PORT}`);
    });
};

const launchHttpsServer = (pems) => {
    const httpsOptions = {
        key: pems.private,
        cert: pems.cert
    };

    https.createServer(httpsOptions, app).listen(config.PORT, config.HOST, () => {
        logger.info(`HTTPS Server listening on https://${config.SSL_COMMON_NAME}:${config.PORT}`);
        logger.info(`Local loopback available at https://localhost:${config.PORT}`);
    });
};

const startServer = async () => {
    if (!config.USE_HTTPS) {
        return launchHttpServer();
    }

    try {
        logger.debug('Generating self-signed SSL certificate...', { commonName: config.SSL_COMMON_NAME });
        const attrs = [{ name: 'commonName', value: config.SSL_COMMON_NAME }];
        const pems = await Promise.resolve(
            selfsigned.generate(attrs, { days: 365, keySize: 2048, algorithm: 'sha256' })
        );
        launchHttpsServer(pems);
    } catch (err) {
        logger.error('Failed to generate SSL Certificate', err);
        process.exit(1);
    }
};

startServer();
