import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ServiceFactory } from '@/lib/core/ServiceFactory';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids');
  
  if (!idsParam) {
    return NextResponse.json({ error: 'ids parameter is required' }, { status: 400 });
  }

  const ids = idsParam.split(',').filter(id => id.trim() !== '');

  if (ids.length === 0) {
    return NextResponse.json({ artists: [] });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('spotify_access_token');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const logger = ServiceFactory.getLoggerService();
    const reqId = request.headers.get('x-request-id') || undefined;
    const rawUser = request.headers.get('x-user-id');
    const user = rawUser ? decodeURIComponent(rawUser) : undefined;
    
    logger.info(`[SpotifyArtistsRoute] Fetching details for ${ids.length} artists`, undefined, { user, reqId });

    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    const artists = await apiService.getArtists(ids);
    
    return NextResponse.json({ artists });
  } catch (error: any) {
    const logger = ServiceFactory.getLoggerService();
    logger.error(`[SpotifyArtistsRoute] Failed to fetch artists`, error.message || error);
    return NextResponse.json(
      { error: error.message }, 
      { status: error.status || 500 }
    );
  }
}
