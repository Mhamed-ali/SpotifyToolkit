import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ServiceFactory } from '@/lib/core/ServiceFactory';
import { calculateDataSize } from '@/lib/utils/formatBytes';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('spotify_access_token');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    const playlists = await apiService.getRemainingPlaylists();
    
    const logger = ServiceFactory.getLoggerService();
    const sizeStr = calculateDataSize(playlists);
    const user = request.headers.get('x-user-id') || undefined;
    logger.info(`[SpotifyPlaylistsAPI] Successfully fetched remaining ${playlists.length} playlists (${sizeStr})`, undefined, { user });
    
    return NextResponse.json(playlists);
  } catch (error: any) {
    console.error('Error fetching remaining playlists:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
