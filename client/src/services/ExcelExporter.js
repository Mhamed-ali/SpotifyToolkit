import { utils, writeFile } from 'xlsx';

/**
 * Builder / Service Pattern for Excel (.xlsx) Export (Single Responsibility & DRY).
 * Centralizes field definitions, formula injection (=HYPERLINK), and workbook writing.
 */

export const EXPORT_FIELDS = [
    {
        key: 'track_name',
        label: 'Track Name',
        accessor: (t) => {
            const url = t.external_urls?.spotify || '';
            const name = (t.name || '').replace(/"/g, '""');
            return url ? `=HYPERLINK("${url}","${name}")` : name;
        }
    },
    {
        key: 'available_in_playlists',
        label: 'Available in Playlists',
        accessor: (t, item, contextPlaylist) => {
            if (item.sourcePlaylists && item.sourcePlaylists.length > 0) {
                return item.sourcePlaylists.join(', ');
            }
            return item.sourcePlaylist ? item.sourcePlaylist.name : (contextPlaylist?.name || '');
        }
    },
    { key: 'artist_names', label: 'Artist Names', accessor: t => t.artists?.map(a => a.name).join(', ') || '' },
    { key: 'album_name', label: 'Album Name', accessor: t => t.album?.name || '' },
    { key: 'track_popularity', label: 'Popularity', accessor: t => t.popularity ?? '' },
    { key: 'track_duration_ms', label: 'Duration (ms)', accessor: t => t.duration_ms ?? '' },
    { key: 'track_explicit', label: 'Explicit', accessor: t => t.explicit ? 'Yes' : 'No' },
    { key: 'track_number', label: 'Track Number', accessor: t => t.track_number ?? '' },
    { key: 'disc_number', label: 'Disc Number', accessor: t => t.disc_number ?? '' },
    { key: 'album_release_date', label: 'Release Date', accessor: t => t.album?.release_date || '' },
    { key: 'album_type', label: 'Album Type', accessor: t => t.album?.album_type || '' },
    { key: 'artist_ids', label: 'Artist IDs', accessor: t => t.artists?.map(a => a.id).join(', ') || '' },
    { key: 'album_id', label: 'Album ID', accessor: t => t.album?.id || '' },
    { key: 'track_id', label: 'Track ID', accessor: t => t.id || '' },
    { key: 'track_isrc', label: 'ISRC', accessor: t => t.external_ids?.isrc || '' },
    { key: 'danceability', label: 'Danceability', accessor: t => t.audio_features?.danceability || '' },
    { key: 'added_at', label: 'Added At', accessor: (t, item) => item.added_at ? new Date(item.added_at).toISOString() : '' },
    { key: 'spotify_url', label: 'Track URL', accessor: t => t.external_urls?.spotify || '' },
    { key: 'uri', label: 'URI', accessor: t => t.uri || '' }
];

export class ExcelExporter {
    constructor(tracks = []) {
        this.tracks = tracks;
        this.selectedFieldKeys = EXPORT_FIELDS.map(f => f.key);
        this.contextPlaylist = null;
        this.sheetName = 'Tracks';
        this.enableFormulas = true;
        this.customRowMapper = null;
    }

    withFields(fieldKeys = []) {
        this.selectedFieldKeys = fieldKeys;
        return this;
    }

    withContextPlaylist(playlist) {
        this.contextPlaylist = playlist;
        return this;
    }

    withSheetName(sheetName) {
        this.sheetName = sheetName;
        return this;
    }

    withCustomRowMapper(mapperFn) {
        this.customRowMapper = mapperFn;
        return this;
    }

    buildRows() {
        if (this.customRowMapper) {
            return this.tracks.map(this.customRowMapper);
        }

        return this.tracks.map(item => {
            const t = item.track || item;
            const row = {};

            this.selectedFieldKeys.forEach(key => {
                const fieldConfig = EXPORT_FIELDS.find(f => f.key === key);
                if (fieldConfig) {
                    row[fieldConfig.label] = fieldConfig.accessor(t, item, this.contextPlaylist);
                }
            });

            return row;
        });
    }

    download(fileName = 'Playlist_Export.xlsx') {
        if (!this.tracks || this.tracks.length === 0) return;

        const data = this.buildRows();
        const ws = utils.json_to_sheet(data);

        if (this.enableFormulas && ws['!ref']) {
            const range = utils.decode_range(ws['!ref']);
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = utils.encode_cell({ c: C, r: R });
                    const cell = ws[cellAddress];
                    if (cell && cell.v && typeof cell.v === 'string' && cell.v.startsWith('=')) {
                        cell.f = cell.v.substring(1);
                        cell.v = undefined;
                    }
                }
            }
        }

        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, this.sheetName);
        writeFile(wb, fileName);
    }

    static exportQuickTrackList(tracks = [], fileName = 'Tracks_Export.xlsx') {
        new ExcelExporter(tracks)
            .withCustomRowMapper(item => {
                const t = item.track || item;
                return {
                    'Track Name': t.name || '',
                    'Artist': t.artists?.map(a => a.name).join(', ') || 'Unknown',
                    'Album': t.album?.name || 'Unknown',
                    'Duration (m)': t.duration_ms ? (t.duration_ms / 60000).toFixed(2) : '',
                    'Release Date': t.album?.release_date || '',
                    'Playlist Source': item.sourcePlaylist?.name || '',
                    'URI': t.uri || '',
                    'Match Reason': item.matchReasons?.join(', ') || ''
                };
            })
            .download(fileName);
    }
}
