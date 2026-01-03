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

app.listen(config.PORT, () => {
  console.log(`Server is running on port ${config.PORT}`);
});
