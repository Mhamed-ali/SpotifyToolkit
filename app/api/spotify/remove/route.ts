import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ServiceFactory } from '@/lib/core/ServiceFactory';

export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('spotify_access_token');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { removals } = await request.json();
    // removals is an object: { [playlistId: string]: { uris?: string[], ids?: string[] } }

    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    const logger = ServiceFactory.getLoggerService();

    logger.info(`[SpotifyRemoveAPI] Starting deletion process for ${Object.keys(removals).length} playlists`);

    // Process removals sequentially to respect Spotify rate limits better,
    // or we could use Promise.all. Let's do it sequentially for safety.
    for (const [playlistId, data] of Object.entries(removals)) {
      const typedData = data as { uris?: string[], ids?: string[] };
      if (playlistId === 'liked-songs') {
        if (typedData.ids && typedData.ids.length > 0) {
          logger.info(`[SpotifyRemoveAPI] Removing ${typedData.ids.length} tracks from Liked Songs`);
          await apiService.removeTracksFromLikedSongs(typedData.ids);
        }
      } else {
        if (typedData.uris && typedData.uris.length > 0) {
          logger.info(`[SpotifyRemoveAPI] Removing ${typedData.uris.length} tracks from playlist ${playlistId}`);
          await apiService.removeTracksFromPlaylist(playlistId, typedData.uris);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const logger = ServiceFactory.getLoggerService();
    logger.error(`[SpotifyRemoveRoute] Failed to remove tracks in proxy route`, error.message || error);
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
}
