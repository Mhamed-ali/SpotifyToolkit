import Dashboard from './Dashboard';
import { SpotifyPlaylist } from '@/lib/types/spotify';

export default async function DashboardWrapper({ initialPlaylistsPromise, userPromise }: { initialPlaylistsPromise: Promise<SpotifyPlaylist[]>, userPromise: Promise<any> }) {
  const initialPlaylists = await initialPlaylistsPromise;
  const user = await userPromise;
  return <Dashboard initialPlaylists={initialPlaylists} userId={user?.display_name || user?.id || 'unknown'} />;
}
