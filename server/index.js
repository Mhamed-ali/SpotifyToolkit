const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config/config');
const authRoutes = require('./routes/auth.routes');

const app = express();

console.log('--- DEBUG INFO ---');
console.log('Loading .env setup...');
console.log('CLIENT_ID:', config.CLIENT_ID ? 'Loaded' : 'NOT LOADED');
console.log('PORT:', config.PORT);
console.log('------------------');

app.use(cors());
app.use(cookieParser());
app.use(express.json());

app.use('/', authRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Spotify Auth Server is running' });
});

const https = require('https');
const selfsigned = require('selfsigned');

// Generate self-signed certificate
// Generate self-signed certificate synchronously
const startServer = () => {
  try {
    console.log('Generating SSL Certificate...');
    const attrs = [{ name: 'commonName', value: '192.168.1.113' }];

    // selfsigned.generate is synchronous in many versions, removing await to be safe.
    // If it returns a promise (v2+), this will return the promise object, so we handle that check.
    let pems = selfsigned.generate(attrs, { days: 365, keySize: 2048, algorithm: 'sha256' });

    // Handle if it IS a promise (future proofing)
    if (pems instanceof Promise) {
      console.log('Certificate generation gave a Promise, awaiting...');
      pems.then(resolvedPems => launchServer(resolvedPems))
        .catch(err => {
          console.error('Failed to resolve certificate promise:', err);
          process.exit(1);
        });
    } else {
      launchServer(pems);
    }

  } catch (err) {
    console.error('CRITICAL: Failed to generate SSL Certificate:', err);
    process.exit(1);
  }
};

const launchServer = (pems) => {
  console.log('SSL Certificate Generated.');
  console.log('Private Key Preview:', pems.private ? pems.private.substring(0, 20) + '...' : 'MISSING');

  const httpsOptions = {
    key: pems.private,
    cert: pems.cert
  };

  https.createServer(httpsOptions, app).listen(config.PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server is running on https://192.168.1.113:${config.PORT}`);
    console.log(`Also available on https://localhost:${config.PORT}`);
    console.log(`Ensure you trust the certificate on your device.`);
  });
};

startServer();
