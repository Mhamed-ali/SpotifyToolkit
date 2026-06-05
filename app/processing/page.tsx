import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ServiceFactory } from '@/lib/core/ServiceFactory';
import Navbar from '@/components/Navbar';
import ProcessingEngine from '@/components/ProcessingEngine';

export default async function ProcessingPage(props: { searchParams: Promise<{ playlists?: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('spotify_access_token');

  if (!token) {
    redirect('/');
  }

  const searchParams = await props.searchParams;
  const playlistIds = searchParams.playlists?.split(',').filter(Boolean) || [];

  if (playlistIds.length === 0) {
    redirect('/');
  }

  const apiService = ServiceFactory.getSpotifyApiService(token.value);
  const userPromise = apiService.getUserProfile();
  
  // We fetch the metadata for just the selected playlists
  const playlists = await apiService.getPlaylistsByIds(playlistIds);

  return (
    <div className="min-h-screen bg-zinc-950 font-sans selection:bg-[#1ED760]/30 flex flex-col pb-24 relative overflow-x-hidden">
      <Navbar userPromise={userPromise} />
      <main className="flex-1 max-w-[1000px] w-full mx-auto px-0 sm:px-6 py-8 sm:py-12">
        <ProcessingEngine initialPlaylists={playlists} />
      </main>
    </div>
  );
}
