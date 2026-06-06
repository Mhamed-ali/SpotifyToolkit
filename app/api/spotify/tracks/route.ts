import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ServiceFactory } from '@/lib/core/ServiceFactory';
import { calculateDataSize } from '@/lib/utils/formatBytes';

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
    
    const reqId = request.headers.get('x-request-id') || undefined;
    const rawUser = request.headers.get('x-user-id');
    const user = rawUser ? decodeURIComponent(rawUser) : undefined;
    const meta = { user, reqId };
    
    // Log dispatch immediately on the server before making the request
    logger.info(`[SpotifyTracksAPI] ${streamPrefix}Dispatching fetch for chunk at offset ${offset}`, undefined, meta);

    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    const data = await apiService.getPlaylistTracks(playlistId, offset, limit, request.signal);
    
    // Log success immediately on the server
    const sizeStr = calculateDataSize(data);
    logger.info(`[SpotifyTracksAPI] ${streamPrefix}Successfully fetched ${data.items?.length || 0} tracks (${sizeStr}) from offset ${offset}`, undefined, meta);
    
    return NextResponse.json(data);
  } catch (error: any) {
    const logger = ServiceFactory.getLoggerService();
    const streamId = searchParams.get('streamId');
    const streamPrefix = streamId ? `[Stream ${streamId}] ` : '';
    const reqId = request.headers.get('x-request-id') || undefined;
    const rawUser = request.headers.get('x-user-id');
    const user = rawUser ? decodeURIComponent(rawUser) : undefined;
    
    if (error.name === 'AbortError' || error.name === 'ResponseAborted' || String(error).includes('aborted') || String(error).includes('ResponseAborted')) {
      logger.warn(`[SpotifyTracksRoute] ${streamPrefix}Fetch aborted by client (Cancellation)`, undefined, { user, reqId });
    } else {
      logger.error(`[SpotifyTracksRoute] ${streamPrefix}Failed to fetch tracks in proxy route`, error.message || error, { user, reqId });
    }
    
    return NextResponse.json(
      { error: error.message, retryAfter: error.retryAfter }, 
      { status: error.status || 500 }
    );
  }
}
