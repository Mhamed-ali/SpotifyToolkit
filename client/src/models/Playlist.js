/**
 * Polymorphic Playlist Constants & Domain Factory (Liskov Substitution Principle).
 * Centralizes special playlist types (Liked Songs, Combined Analysis, Standard)
 * so components do not scatter magic strings or duplicated permission checks.
 */

export const PLAYLIST_IDS = {
    LIKED_SONGS: 'LIKED_SONGS',
    COMBINED_ANALYSIS: 'COMBINED_ANALYSIS'
};

export class PlaylistModel {
    static isLikedSongs(playlist) {
        return playlist?.id === PLAYLIST_IDS.LIKED_SONGS;
    }

    static isCombined(playlist) {
        return playlist?.id === PLAYLIST_IDS.COMBINED_ANALYSIS;
    }

    static canEdit(playlist, currentUserId, providerSupportsWrite = true) {
        if (!providerSupportsWrite || !playlist) return false;
        if (PlaylistModel.isLikedSongs(playlist)) return true;
        if (playlist.collaborative) return true;
        if (playlist.owner?.display_name === 'You') return true;
        return Boolean(currentUserId && playlist.owner?.id === currentUserId);
    }

    static createLikedSongs(totalTracks = 0) {
        return {
            id: PLAYLIST_IDS.LIKED_SONGS,
            name: 'Liked Songs',
            description: 'Your saved tracks',
            images: [],
            owner: { display_name: 'You' },
            tracks: { total: totalTracks },
            public: false,
            isLikedSongs: true
        };
    }

    static createCombined(selectedPlaylists = []) {
        const total = selectedPlaylists.reduce((acc, p) => acc + (p.tracks?.total || 0), 0);
        return {
            id: PLAYLIST_IDS.COMBINED_ANALYSIS,
            name: `Combined Analysis (${selectedPlaylists.length})`,
            description: `Analysis of: ${selectedPlaylists.map(p => p.name).join(', ')}`,
            images: [],
            tracks: { total },
            owner: { display_name: 'You' },
            public: false,
            isCombined: true
        };
    }

    static getSafeExportName(playlist) {
        return (playlist?.name || 'Playlist').replace(/[^a-z0-9]/gi, '_');
    }
}
