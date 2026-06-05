'use server'

import { cookies } from 'next/headers';
import { ServiceFactory } from '@/lib/core/ServiceFactory';
import { SpotifyPlaylist } from '@/lib/types/spotify';

export async function getRemainingPlaylistsAndLiked(): Promise<SpotifyPlaylist[]> {
  const cookieStore = await cookies();
  const token = cookieStore.get('spotify_access_token');
  
  if (!token) {
    return [];
  }

  const apiService = ServiceFactory.getSpotifyApiService(token.value);
  return apiService.getRemainingPlaylists();
}
