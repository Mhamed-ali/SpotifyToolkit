import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ServiceFactory } from '@/lib/core/ServiceFactory';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('spotify_access_token');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, name, description } = body;

    if (!userId || !name) {
      return NextResponse.json({ error: 'userId and name are required' }, { status: 400 });
    }

    const logger = ServiceFactory.getLoggerService();
    const reqId = request.headers.get('x-request-id') || undefined;
    const user = request.headers.get('x-user-id') || undefined;
    
    logger.info(`[SpotifyPlaylistCreateRoute] Creating playlist "${name}"`, undefined, { user, reqId });

    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    const playlist = await apiService.createPlaylist(userId, name, description);
    
    return NextResponse.json(playlist);
  } catch (error: any) {
    const logger = ServiceFactory.getLoggerService();
    logger.error(`[SpotifyPlaylistCreateRoute] Failed to create playlist`, error.message || error);
    return NextResponse.json(
      { error: error.message }, 
      { status: error.status || 500 }
    );
  }
}
