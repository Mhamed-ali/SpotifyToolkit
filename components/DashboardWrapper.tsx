import Dashboard from './Dashboard';
import { SpotifyPlaylist } from '@/lib/types/spotify';

export default async function DashboardWrapper({ initialPlaylistsPromise }: { initialPlaylistsPromise: Promise<SpotifyPlaylist[]> }) {
  const initialPlaylists = await initialPlaylistsPromise;
  return <Dashboard initialPlaylists={initialPlaylists} />;
}
