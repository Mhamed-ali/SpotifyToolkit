import { SpotifyPlaylist, SpotifyPlaylistsResponse, SpotifyUserProfile } from '../types/spotify';
import { ISpotifyApiService } from '../interfaces/ISpotifyApiService';

import { ILoggerService } from '../interfaces/ILoggerService';

/**
 * Service dedicated to interacting with the Spotify Web API.
 * Adheres to the Single Responsibility Principle by separating data fetching 
 * from authentication flows.
 */
export class SpotifyApiService implements ISpotifyApiService {
  private accessToken: string;
  private logger?: ILoggerService;

  constructor(accessToken: string, logger?: ILoggerService) {
    this.accessToken = accessToken;
    this.logger = logger;
  }



  private createLikedSongsMock(total: number): SpotifyPlaylist {
    return {
      id: "liked-songs", 
      name: "Liked Songs",
      images: [{ url: "https://misc.scdn.co/liked-songs/liked-songs-640.png", height: 640, width: 640 }],
      tracks: { total, href: "https://api.spotify.com/v1/me/tracks" },
      owner: { display_name: "Spotify", id: "spotify" },
      external_urls: { spotify: "https://open.spotify.com/collection/tracks" }
    };
  }

  public async getInitialPlaylists(): Promise<SpotifyPlaylist[]> {
    // Fire off the Liked Songs fetch immediately so it runs in parallel with the playlists fetch
    const likedPromise = fetch('https://api.spotify.com/v1/me/tracks?limit=1', {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    }).then(res => res.ok ? res.json() : null).catch(() => null);

    const firstResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=50&offset=0', {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    if (!firstResponse.ok) {
      throw new Error(`Spotify API error: ${firstResponse.statusText}`);
    }

    const firstData = await firstResponse.json();
    const playlists = [...firstData.items].filter(p => p !== null);

    // Wait for the Liked Songs fetch to finish and inject the true total using the helper
    const likedData = await likedPromise;
    playlists.unshift(this.createLikedSongsMock(likedData?.total || 0));

    return playlists;
  }

  public async getRemainingPlaylists(): Promise<SpotifyPlaylist[]> {
    const restPlaylists: SpotifyPlaylist[] = [];

    // 1. Fetch total playlists count to know how many to fetch
    const firstResponse = await fetch('https://api.spotify.com/v1/me/playlists?limit=1&offset=0', {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    
    if (firstResponse.ok) {
      const firstData = await firstResponse.json();
      const total = firstData.total;
      
      if (total > 50) {
        const promises = [];
        for (let offset = 50; offset < total; offset += 50) {
          promises.push(
            fetch(`https://api.spotify.com/v1/me/playlists?limit=50&offset=${offset}`, {
              headers: { Authorization: `Bearer ${this.accessToken}` },
            }).then(res => res.ok ? res.json() : { items: [] })
          );
        }
        
        const results = await Promise.all(promises);
        for (const data of results) {
          if (data && data.items) restPlaylists.push(...data.items);
        }
      }
    }

    return restPlaylists.filter(p => p !== null);
  }

  public async getUserProfile(): Promise<SpotifyUserProfile> {
    const response = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.statusText}`);
    }

    return response.json();
  }

  public async getPlaylistTracks(playlistId: string, offset = 0, limit = 100, signal?: AbortSignal): Promise<any> {
    const isLikedSongs = playlistId === 'liked-songs';
    
    // Spotify's Liked Songs API has a strict maximum limit of 50. Regular playlists support 100.
    const actualLimit = isLikedSongs ? Math.min(limit, 50) : limit;
    
    // For regular playlists, we only need specific fields to save bandwidth. For liked songs, fields param is not supported.
    const url = isLikedSongs 
      ? `https://api.spotify.com/v1/me/tracks?offset=${offset}&limit=${actualLimit}`
      : `https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${actualLimit}&fields=items(added_at,track(id,name,uri,duration_ms,external_urls,artists(name,id),album(name,id,images))),total,next,offset,limit`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Accept-Language': 'ar,en-US;q=0.9'
      },
      signal,
    });

    if (!response.ok) {
      const error: any = new Error(`Spotify API error: ${response.statusText}`);
      error.status = response.status;
      error.retryAfter = response.headers.get('Retry-After');
      throw error;
    }

    return response.json();
  }

  public async getPlaylistsByIds(ids: string[]): Promise<SpotifyPlaylist[]> {
    if (!ids || ids.length === 0) return [];

    const promises = ids.map(id => 
      id === 'liked-songs' 
        ? fetch('https://api.spotify.com/v1/me/tracks?limit=1', { headers: { Authorization: `Bearer ${this.accessToken}` } })
            .then(res => res.ok ? res.json() : null)
            .then(data => data ? this.createLikedSongsMock(data.total) : undefined)
        : fetch(`https://api.spotify.com/v1/playlists/${id}`, { headers: { Authorization: `Bearer ${this.accessToken}` } })
            .then(res => res.ok ? res.json() : undefined)
    );

    const results = await Promise.all(promises);
    return results.filter((p): p is SpotifyPlaylist => p !== undefined);
  }

  public async removeTracksFromPlaylist(playlistId: string, trackUris: string[]): Promise<void> {
    if (!trackUris || trackUris.length === 0) return;
    
    // Spotify API allows deleting max 100 tracks per request for a playlist
    for (let i = 0; i < trackUris.length; i += 100) {
      const chunk = trackUris.slice(i, i + 100);
      const payload = {
        tracks: chunk.map(uri => ({ uri }))
      };

      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to remove tracks from playlist ${playlistId}: ${response.statusText}`);
      }
    }
  }

  public async removeTracksFromLikedSongs(trackIds: string[]): Promise<void> {
    if (!trackIds || trackIds.length === 0) return;

    // Spotify API allows deleting max 50 tracks per request for Liked Songs
    for (let i = 0; i < trackIds.length; i += 50) {
      const chunk = trackIds.slice(i, i + 50);
      const payload = {
        ids: chunk
      };

      const response = await fetch('https://api.spotify.com/v1/me/tracks', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to remove tracks from Liked Songs: ${response.statusText}`);
      }
    }
  }
  public async getArtists(ids: string[]): Promise<any[]> {
    if (!ids || ids.length === 0) return [];
    
    const artists: any[] = [];
    // Spotify API allows fetching max 50 artists per request
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const response = await fetch(`https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch artists: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.artists) {
        artists.push(...data.artists);
      }
    }
    return artists;
  }

  public async createPlaylist(userId: string, name: string, description: string = ''): Promise<SpotifyPlaylist> {
    const payload = {
      name,
      description,
      public: false // Defaulting to private
    };

    const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to create playlist: ${response.statusText}`);
    }

    return response.json();
  }

  public async addTracksToPlaylist(playlistId: string, trackUris: string[]): Promise<void> {
    if (!trackUris || trackUris.length === 0) return;

    // Spotify API allows adding max 100 tracks per request
    for (let i = 0; i < trackUris.length; i += 100) {
      const chunk = trackUris.slice(i, i + 100);
      const payload = { uris: chunk };

      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Failed to add tracks to playlist ${playlistId}: ${response.statusText}`);
      }
    }
  }
}
