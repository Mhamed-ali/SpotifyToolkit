import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ServiceFactory } from '@/lib/core/ServiceFactory';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get('playlistId');
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  if (!playlistId) {
    return NextResponse.json({ error: 'playlistId is required' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('spotify_access_token');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const logger = ServiceFactory.getLoggerService();
    const streamId = searchParams.get('streamId');
    const streamPrefix = streamId ? `[Stream ${streamId}] ` : '';
    
    // Log dispatch immediately on the server before making the request
    logger.info(`[SpotifyTracksAPI] ${streamPrefix}Dispatching fetch for chunk at offset ${offset}`);

    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    const data = await apiService.getPlaylistTracks(playlistId, offset, limit, request.signal);
    
    // Log success immediately on the server
    logger.info(`[SpotifyTracksAPI] ${streamPrefix}Successfully fetched ${data.items?.length || 0} tracks from offset ${offset}`);
    
    return NextResponse.json(data);
  } catch (error: any) {
    const logger = ServiceFactory.getLoggerService();
    logger.error(`[SpotifyTracksRoute] Failed to fetch tracks in proxy route`, error.message || error);
    return NextResponse.json(
      { error: error.message, retryAfter: error.retryAfter }, 
      { status: error.status || 500 }
    );
  }
}
