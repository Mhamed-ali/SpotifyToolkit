import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ServiceFactory } from '@/lib/core/ServiceFactory';
import { calculateDataSize } from '@/lib/utils/formatBytes';

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('spotify_access_token');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { removals } = await request.json();
    const reqId = request.headers.get('x-request-id') || undefined;
    const user = request.headers.get('x-user-id') || undefined;
    const meta = { user, reqId };

    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    const logger = ServiceFactory.getLoggerService();

    logger.info(`[SpotifyRemoveAPI] Starting deletion process for ${Object.keys(removals).length} playlists`, undefined, meta);

    for (const [playlistId, data] of Object.entries(removals)) {
      const typedData = data as { uris?: string[], ids?: string[] };
      if (playlistId === 'liked-songs') {
        if (typedData.ids && typedData.ids.length > 0) {
          const sizeStr = calculateDataSize(typedData.ids);
          logger.info(`[SpotifyRemoveAPI] Removing ${typedData.ids.length} tracks (${sizeStr}) from Liked Songs`, undefined, meta);
          await apiService.removeTracksFromLikedSongs(typedData.ids);
        }
      } else {
        if (typedData.uris && typedData.uris.length > 0) {
          const sizeStr = calculateDataSize(typedData.uris);
          logger.info(`[SpotifyRemoveAPI] Removing ${typedData.uris.length} tracks (${sizeStr}) from playlist ${playlistId}`, undefined, meta);
          await apiService.removeTracksFromPlaylist(playlistId, typedData.uris);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const logger = ServiceFactory.getLoggerService();
    const reqId = request.headers.get('x-request-id') || undefined;
    const user = request.headers.get('x-user-id') || undefined;
    
    logger.error(`[SpotifyRemoveRoute] Failed to remove tracks in proxy route`, error.message || error, { user, reqId });
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
}
