import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getFrontendUri } from '../../../../lib/config/app';
import { ServiceFactory } from '../../../../lib/core/ServiceFactory';

export async function GET(request: Request) {
  try {
    const sessionManager = ServiceFactory.getSessionManager();
    const logger = ServiceFactory.getLoggerService();

    logger.info('User initiated logout');

    const cookieStore = await cookies();
    
    // 1. Delete session cookies
    cookieStore.delete('spotify_access_token');
    cookieStore.delete('spotify_refresh_token');

    // Redirect safely back to the home page using the encapsulated utility
    return NextResponse.redirect(getFrontendUri(request));
  } catch (error) {
    const logger = ServiceFactory.getLoggerService();
    logger.error('Logout Error', error);
    return NextResponse.json({ error: 'Failed to log out' }, { status: 500 });
  }
}
