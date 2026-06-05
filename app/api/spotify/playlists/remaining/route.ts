import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ServiceFactory } from '@/lib/core/ServiceFactory';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('spotify_access_token');
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    const playlists = await apiService.getRemainingPlaylists();
    
    return NextResponse.json(playlists);
  } catch (error: any) {
    console.error('Error fetching remaining playlists:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
