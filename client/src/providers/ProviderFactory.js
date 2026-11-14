import * as spotifyService from '../services/spotify.service.js';

/**
 * Strategy + Factory Pattern for Music Streaming Providers (Dependency Inversion & Open/Closed).
 */

export const PROVIDERS = {
    SPOTIFY: 'spotify'
};

const spotifyProvider = {
    id: PROVIDERS.SPOTIFY,
    displayName: 'Spotify',
    accentColor: '#1db954',
    supportsWrite: true,
    loginPath: '/login',

    fetchProfile: spotifyService.fetchProfile,
    fetchUserPlaylists: spotifyService.fetchUserPlaylists,
    fetchSavedTracks: spotifyService.fetchSavedTracks,
    fetchPlaylist: spotifyService.fetchPlaylist,
    fetchPlaylistTracks: spotifyService.fetchPlaylistTracks,
    fetchRemainingTracks: spotifyService.fetchRemainingTracks,
    fetchAllTracksForPlaylist: spotifyService.fetchAllTracksForPlaylist,
    fetchArtistsBatch: spotifyService.fetchArtistsBatch,
    fetchAudioFeatures: spotifyService.fetchAudioFeatures,
    removeTracksFromPlaylist: spotifyService.removeTracksFromPlaylist,
    createPlaylist: spotifyService.createPlaylist,
    addTracksToPlaylist: spotifyService.addTracksToPlaylist,
    replacePlaylistTracks: spotifyService.replacePlaylistTracks,
    searchTracks: spotifyService.searchTracks,
    fetchTopTracks: spotifyService.fetchTopTracks,
    fetchTopArtists: spotifyService.fetchTopArtists,
    fetchRecentlyPlayed: spotifyService.fetchRecentlyPlayed,
    buildGlobalTrackMap: spotifyService.buildGlobalTrackMap,

    extractPlaylistIdFromInput(input) {
        if (!input) return null;
        let id = input.trim();
        if (id.includes('spotify.com/playlist/')) {
            const url = new URL(id);
            const pathParts = url.pathname.split('/');
            id = pathParts[pathParts.indexOf('playlist') + 1];
        } else if (id.includes('spotify:playlist:')) {
            id = id.split(':')[2];
        }
        if (id && id.includes('?')) id = id.split('?')[0];
        return id || null;
    }
};

export const getMusicProvider = () => spotifyProvider;
