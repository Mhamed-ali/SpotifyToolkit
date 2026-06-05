/**
 * @fileoverview Spotify OAuth 2.0 Callback Handler
 * 
 * This endpoint receives the user after they have authorized the app on Spotify.
 * It verifies the CSRF state token to prevent hijacking, exchanges the temporary 
 * authorization code for an Access Token and Refresh Token via a secure server-to-server 
 * request, securely stores these tokens in HttpOnly cookies, and redirects the user 
 * to the main dashboard.
 * 
 * @route GET /api/auth/callback
 * @param {NextRequest} request - The incoming request containing 'code' and 'state' in the URL query.
 * @returns {NextResponse} 302 Redirect to the root dashboard ('/') on success, or JSON error on failure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServiceFactory } from '../../../../lib/core/ServiceFactory';
import { getFrontendUri } from '../../../../lib/config/app';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      return NextResponse.redirect(getFrontendUri(request));
    }

    const authService = ServiceFactory.getSpotifyAuthService();
    const sessionManager = ServiceFactory.getSessionManager();
    const logger = ServiceFactory.getLoggerService();

    logger.info('Received auth callback from Spotify');

    // 1. Strict State Validation
    const isValidState = await sessionManager.verifyCsrfState(state);
    if (!isValidState) {
      return NextResponse.redirect(getFrontendUri(request));
    }

    // 2. Exchange the authorization code for an Access Token
    const tokens = await authService.exchangeCodeForToken(code);

    // 3. Store tokens securely in HttpOnly cookies
    await sessionManager.createSession(tokens.access_token, tokens.refresh_token, tokens.expires_in);

    logger.info('Successfully exchanged token and created session');

    // 4. Redirect safely back to the dashboard using the encapsulated utility
    return NextResponse.redirect(getFrontendUri(request));
  } catch (error) {
    const logger = ServiceFactory.getLoggerService();
    logger.error('Token Exchange Error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error during token exchange' }, 
      { status: 500 }
    );
  }
}