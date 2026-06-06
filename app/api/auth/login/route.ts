/**
 * @fileoverview Spotify OAuth 2.0 Login Initiator
 * 
 * This endpoint begins the Authorization Code Flow. It generates a secure CSRF state
 * token, stores it in an HttpOnly cookie, and redirects the user's browser to the 
 * official Spotify authorization page to request permissions.
 * 
 * @route GET /api/auth/login
 * @returns {NextResponse} 302 Redirect to Spotify's authorization URL.
 */

import { NextResponse } from 'next/server';
import { ServiceFactory } from '../../../../lib/core/ServiceFactory';

export async function GET(request: Request) {
  try {
    const authService = ServiceFactory.getSpotifyAuthService();
    const sessionManager = ServiceFactory.getSessionManager();
    const logger = ServiceFactory.getLoggerService();

    logger.info(`Initiating Spotify login flow`);

    // 1. Generate and securely store the CSRF state
    const state = await sessionManager.createCsrfState();

    // 2. Construct the authorization URL
    const authUrl = authService.getAuthorizationUrl(state);

    // 3. Redirect the user
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const logger = ServiceFactory.getLoggerService();
    logger.error('Login Error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}