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
    const { playlistId, trackUris } = body;

    if (!playlistId || !trackUris || !Array.isArray(trackUris)) {
      return NextResponse.json({ error: 'playlistId and trackUris (array) are required' }, { status: 400 });
    }

    const logger = ServiceFactory.getLoggerService();
    const reqId = request.headers.get('x-request-id') || undefined;
    const user = request.headers.get('x-user-id') || undefined;
    
    logger.info(`[SpotifyPlaylistAddRoute] Adding ${trackUris.length} tracks to playlist ${playlistId}`, undefined, { user, reqId });

    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    await apiService.addTracksToPlaylist(playlistId, trackUris);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const logger = ServiceFactory.getLoggerService();
    logger.error(`[SpotifyPlaylistAddRoute] Failed to add tracks`, error.message || error);
    return NextResponse.json(
      { error: error.message }, 
      { status: error.status || 500 }
    );
  }
}
