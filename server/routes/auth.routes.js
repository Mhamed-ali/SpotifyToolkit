const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const anghamiController = require('../controllers/anghami.controller');

// Spotify Auth Routes
router.get('/login', authController.login);
router.get('/callback', authController.callback);
router.get('/refresh_token', authController.refreshToken);
router.post('/refresh_token', authController.refreshToken);

// Anghami Auth & Proxy Routes
router.get('/anghami/login', anghamiController.login);
router.get('/anghami/callback', anghamiController.callback);
router.all('/anghami/proxy', anghamiController.proxyRequest);

module.exports = router;
