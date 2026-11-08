import { formatDuration, extractReleaseYear } from '../utils/formatters.js';

/**
 * OOP Domain Model for a Track item.
 * Normalizes both Spotify and Anghami payloads while maintaining backward-compatible
 * `.track` and `.added_at` properties so all existing table/analysis views work seamlessly.
 */
export class Track {
    constructor(rawItem = {}, sourcePlaylist = null) {
        const rawTrack = rawItem?.track || rawItem || {};

        this.id = String(rawTrack.id || rawTrack.songId || '');
        this.uri = rawTrack.uri || (this.id ? `track:${this.id}` : '');
        this.name = rawTrack.name || rawTrack.title || '';
        this.durationMs = Number(rawTrack.duration_ms ?? (rawTrack.duration ? rawTrack.duration * 1000 : 0));
        this.popularity = typeof rawTrack.popularity === 'number' ? rawTrack.popularity : 0;
        this.explicit = Boolean(rawTrack.explicit);
        this.added_at = rawItem?.added_at || rawTrack.added_at || null;
        this.sourcePlaylist = sourcePlaylist || rawItem?.sourcePlaylist || null;
        this.sourcePlaylists = rawItem?.sourcePlaylists || null;
        this.matchReasons = rawItem?.matchReasons || [];

        const normalizedArtists = Array.isArray(rawTrack.artists)
            ? rawTrack.artists.map(a => (typeof a === 'string' ? { name: a, id: a } : { name: a.name || '', id: a.id || '' }))
            : rawTrack.artistName
                ? [{ name: rawTrack.artistName, id: rawTrack.artistId || '' }]
                : [];

        const normalizedImages = Array.isArray(rawTrack.album?.images)
            ? rawTrack.album.images
            : rawTrack.coverArt
                ? [{ url: rawTrack.coverArt }, { url: rawTrack.coverArt }, { url: rawTrack.coverArt }]
                : [];

        this.track = {
            id: this.id,
            uri: this.uri,
            name: this.name,
            duration_ms: this.durationMs,
            popularity: this.popularity,
            explicit: this.explicit,
            track_number: rawTrack.track_number || 1,
            disc_number: rawTrack.disc_number || 1,
            external_ids: rawTrack.external_ids || {},
            external_urls: rawTrack.external_urls || (rawTrack.url ? { spotify: rawTrack.url } : {}),
            audio_features: rawTrack.audio_features || null,
            artists: normalizedArtists,
            album: {
                id: rawTrack.album?.id || rawTrack.albumId || '',
                name: rawTrack.album?.name || rawTrack.albumName || 'Unknown Album',
                release_date: rawTrack.album?.release_date || rawTrack.releaseDate || '',
                album_type: rawTrack.album?.album_type || 'album',
                images: normalizedImages
            }
        };
    }

    get isValid() {
        return Boolean(this.id && this.name && this.track.artists.length > 0);
    }

    get primaryArtist() {
        return this.track.artists[0]?.name || 'Unknown Artist';
    }

    get artistNames() {
        return this.track.artists.map(a => a.name);
    }

    get albumName() {
        return this.track.album?.name || 'Unknown Album';
    }

    get releaseYear() {
        return extractReleaseYear(this.track.album?.release_date);
    }

    get formattedDuration() {
        return formatDuration(this.durationMs);
    }

    /**
     * Composite key combining source playlist ID and track URI.
     * Prevents cross-playlist deletion ambiguity when the same track exists in multiple playlists.
     */
    get selectionKey() {
        const playlistKey = this.sourcePlaylist?.id || 'SINGLE';
        return `${playlistKey}::${this.uri}`;
    }

    getDuplicateFingerprint(matchDuration = false) {
        const normalizedTitle = this.name.toLowerCase().replace(/\s+/g, ' ').trim();
        const normalizedArtist = this.primaryArtist.toLowerCase().trim();
        let key = `${normalizedTitle}|${normalizedArtist}`;
        if (matchDuration) {
            key += `|${this.durationMs}`;
        }
        return key;
    }

    static from(item, sourcePlaylist = null) {
        if (item instanceof Track) {
            if (sourcePlaylist && !item.sourcePlaylist) {
                return new Track(item, sourcePlaylist);
            }
            return item;
        }
        return new Track(item, sourcePlaylist);
    }
}
