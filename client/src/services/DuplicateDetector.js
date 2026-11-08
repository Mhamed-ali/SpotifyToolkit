/**
 * Single-Responsibility Service for Duplicate Detection & Composite Key Selection.
 * Fixes cross-playlist deletion ambiguity by keying selections with `${playlistId}::${uri}`.
 */
export class DuplicateDetector {
    static getFingerprint(item, matchDuration = false) {
        const t = item?.track;
        if (!t || !t.name || !t.artists) return null;

        const primaryArtist = t.artists[0]?.name?.toLowerCase()?.trim() || 'unknown artist';
        const title = t.name.toLowerCase().replace(/\s+/g, ' ').trim();
        let key = `${title}|${primaryArtist}`;
        if (matchDuration) {
            key += `|${t.duration_ms}`;
        }
        return key;
    }

    static getSelectionKey(item, fallbackPlaylistId = 'SINGLE') {
        const playlistId = item?.sourcePlaylist?.id || fallbackPlaylistId;
        const uri = item?.track?.uri || '';
        return `${playlistId}::${uri}`;
    }

    static extractUriFromKey(selectionKey) {
        if (!selectionKey) return '';
        const separatorIdx = selectionKey.indexOf('::');
        return separatorIdx !== -1 ? selectionKey.slice(separatorIdx + 2) : selectionKey;
    }

    static findDuplicatesInList(list = [], matchDuration = false) {
        const groups = {};
        list.forEach(item => {
            const key = DuplicateDetector.getFingerprint(item, matchDuration);
            if (!key) return;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return Object.values(groups).filter(group => group.length > 1);
    }

    static findDuplicates(tracks = [], { isCombined = false, scope = 'playlist', matchDuration = false } = {}) {
        if (!tracks || tracks.length === 0) return [];

        let allDupeGroups = [];

        if (isCombined && scope === 'playlist') {
            const byPlaylist = tracks.reduce((acc, item) => {
                const pid = item.sourcePlaylist?.id || 'unknown';
                if (!acc[pid]) acc[pid] = [];
                acc[pid].push(item);
                return acc;
            }, {});

            Object.values(byPlaylist).forEach(list => {
                const found = DuplicateDetector.findDuplicatesInList(list, matchDuration);
                allDupeGroups = [...allDupeGroups, ...found];
            });
        } else {
            allDupeGroups = DuplicateDetector.findDuplicatesInList(tracks, matchDuration);
        }

        if (isCombined) {
            allDupeGroups.sort((a, b) => {
                const pa = a[0]?.sourcePlaylist?.name || '';
                const pb = b[0]?.sourcePlaylist?.name || '';
                return pa.localeCompare(pb);
            });
        }

        return allDupeGroups;
    }
}
