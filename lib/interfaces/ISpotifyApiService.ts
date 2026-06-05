import { SpotifyPlaylist, SpotifyUserProfile } from '../types/spotify';

export interface ISpotifyApiService {
  getInitialPlaylists(): Promise<SpotifyPlaylist[]>;
  getRemainingPlaylists(): Promise<SpotifyPlaylist[]>;
  getUserProfile(): Promise<SpotifyUserProfile>;
  getPlaylistTracks(playlistId: string, offset?: number, limit?: number, signal?: AbortSignal): Promise<any>;
  getPlaylistsByIds(ids: string[]): Promise<SpotifyPlaylist[]>;
  removeTracksFromPlaylist(playlistId: string, trackUris: string[]): Promise<void>;
  removeTracksFromLikedSongs(trackIds: string[]): Promise<void>;
}
