import * as spotifyService from '../services/spotify.service.js';
import * as anghamiService from '../services/anghami.service.js';

/**
 * Strategy + Factory Pattern for Music Streaming Providers (Dependency Inversion & Open/Closed).
 * Allows UI components to interact with a unified provider contract regardless of whether
 * the user is connected to Spotify (read/write) or Anghami (read-only SDK).
 */

export const PROVIDERS = {
    SPOTIFY: 'spotify',
    ANGHAMI: 'anghami'
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
    fetchAudioFeatures: spotifyService.fetchAudioFeatures,
    removeTracksFromPlaylist: spotifyService.removeTracksFromPlaylist,
    createPlaylist: spotifyService.createPlaylist,
    addTracksToPlaylist: spotifyService.addTracksToPlaylist,
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

const anghamiProvider = {
    id: PROVIDERS.ANGHAMI,
    displayName: 'Anghami',
    accentColor: '#a855f7',
    supportsWrite: false, // Anghami public SDK (sdk.anghami.com) is currently read-only for playlists
    loginPath: '/anghami/login',

    fetchProfile: anghamiService.fetchAnghamiProfile,
    fetchUserPlaylists: anghamiService.fetchAnghamiUserPlaylists,
    fetchSavedTracks: anghamiService.fetchAnghamiSavedTracks,
    fetchPlaylist: anghamiService.fetchAnghamiPlaylist,
    fetchPlaylistTracks: anghamiService.fetchAnghamiPlaylistTracks,
    fetchRemainingTracks: async () => [],
    fetchAllTracksForPlaylist: anghamiService.fetchAllAnghamiTracksForPlaylist,
    fetchAudioFeatures: async () => ({ error: { status: 403, message: 'API_RESTRICTED' } }),
    removeTracksFromPlaylist: async () => {
        throw new Error('Anghami SDK currently supports read-only playlist access. Export to Excel instead.');
    },
    createPlaylist: async () => {
        throw new Error('Anghami SDK currently supports read-only playlist access. Export to Excel instead.');
    },
    addTracksToPlaylist: async () => {
        throw new Error('Anghami SDK currently supports read-only playlist access.');
    },
    buildGlobalTrackMap: anghamiService.buildAnghamiGlobalTrackMap,

    extractPlaylistIdFromInput(input) {
        if (!input) return null;
        let id = input.trim();
        if (id.includes('anghami.com/playlist/')) {
            const url = new URL(id);
            const pathParts = url.pathname.split('/');
            id = pathParts[pathParts.indexOf('playlist') + 1];
        } else if (id.includes('anghami:playlist:')) {
            id = id.split(':')[2];
        }
        if (id && id.includes('?')) id = id.split('?')[0];
        return id || null;
    }
};

export const getMusicProvider = (providerId = PROVIDERS.SPOTIFY) => {
    if (providerId === PROVIDERS.ANGHAMI) {
        return anghamiProvider;
    }
    return spotifyProvider;
};
