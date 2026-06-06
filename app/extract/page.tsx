import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ServiceFactory } from '@/lib/core/ServiceFactory';
import Navbar from '@/components/Navbar';
import ExtractEngine from '@/components/ExtractEngine';

export default async function ExtractPage(props: { searchParams: Promise<{ playlist?: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('spotify_access_token');

  if (!token) {
    redirect('/');
  }

  const searchParams = await props.searchParams;
  const playlistId = searchParams.playlist;

  if (!playlistId) {
    redirect('/');
  }

  const apiService = ServiceFactory.getSpotifyApiService(token.value);
  const user = await apiService.getUserProfile();
  
  // We fetch the metadata for just the selected playlist
  const playlists = await apiService.getPlaylistsByIds([playlistId]);
  
  if (playlists.length === 0) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-zinc-950 font-sans selection:bg-[#1ED760]/30 flex flex-col pb-24 relative overflow-x-hidden">
      <Navbar userPromise={Promise.resolve(user)} />
      <main className="flex-1 max-w-[1000px] w-full mx-auto px-0 sm:px-6 py-8 sm:py-12">
        <ExtractEngine initialPlaylists={playlists} userId={user.id} />
      </main>
    </div>
  );
}
