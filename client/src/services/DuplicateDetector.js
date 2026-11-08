/**
 * Single-Responsibility Service for Duplicate Detection, 2-Pass Clustering, & Composite Key Selection.
 * Supports both Strict (exact track ID) and Fuzzy (Unicode-normalized title + artist + duration tolerance)
 * clustering across Per-Playlist ('per' / 'playlist') and Cross-Playlist ('cross' / 'global') scopes.
 */
export class DuplicateDetector {
    static normalizeText(str = '') {
        return String(str).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    }

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
        const parts = String(selectionKey).split('::');
        return parts.length >= 2 ? parts[1] : selectionKey;
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

        if (isCombined && (scope === 'playlist' || scope === 'per')) {
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

    /**
     * 2-Pass Clustering Engine ported from SpotifyToolkit 2.0 (clustering.ts):
     * - Pass 1 (Strict): Groups tracks by exact track.id (per-playlist or cross-playlist).
     * - Pass 2 (Fuzzy): Groups Pass 1 blocks by Unicode-normalized title + primary artist
     *   and merges blocks within `durationTolerance` seconds (0s - 5s).
     */
    static clusterTracks(
        tracks = [],
        {
            matchCriteria = 'fuzzy',
            durationTolerance = 2,
            scope = 'cross'
        } = {}
    ) {
        if (!tracks || tracks.length === 0) return [];

        // PASS 1: Group by Exact Track ID
        const idMap = new Map();
        for (const item of tracks) {
            const t = item?.track;
            if (!t || !t.name) continue;
            const pid = item.sourcePlaylist?.id || 'SINGLE';
            const trackId = t.id || t.uri || 'local-file';
            const key = scope === 'per' ? `${pid}::${trackId}` : trackId;
            if (!idMap.has(key)) idMap.set(key, []);
            idMap.get(key).push(item);
        }

        if (matchCriteria === 'strict') {
            const strictGroups = [];
            for (const instances of idMap.values()) {
                if (instances.length > 1) {
                    strictGroups.push(instances);
                }
            }
            return strictGroups;
        }

        // PASS 2: Fuzzy Grouping by Unicode-normalized Title + Primary Artist + Duration Tolerance
        const fuzzyMap = new Map();
        for (const block of idMap.values()) {
            const rep = block[0];
            const normName = DuplicateDetector.normalizeText(rep.track.name);
            const normArtist = rep.track.artists?.[0]
                ? DuplicateDetector.normalizeText(rep.track.artists[0].name)
                : 'unknown';
            const pid = rep.sourcePlaylist?.id || 'SINGLE';
            const key = scope === 'per' ? `${pid}::${normName}::${normArtist}` : `${normName}::${normArtist}`;
            if (!fuzzyMap.has(key)) fuzzyMap.set(key, []);
            fuzzyMap.get(key).push(block);
        }

        const finalClusters = [];
        const toleranceMs = (Number(durationTolerance) || 0) * 1000;

        for (const blockArray of fuzzyMap.values()) {
            blockArray.sort((a, b) => (a[0].track.duration_ms || 0) - (b[0].track.duration_ms || 0));

            let currentSubCluster = [];
            for (const block of blockArray) {
                if (currentSubCluster.length === 0) {
                    currentSubCluster.push(...block);
                } else {
                    const durA = block[0].track.duration_ms || 0;
                    const durB = currentSubCluster[0].track.duration_ms || 0;
                    if (Math.abs(durA - durB) <= toleranceMs) {
                        currentSubCluster.push(...block);
                    } else {
                        if (currentSubCluster.length > 1) {
                            finalClusters.push([...currentSubCluster]);
                        }
                        currentSubCluster = [...block];
                    }
                }
            }

            if (currentSubCluster.length > 1) {
                finalClusters.push(currentSubCluster);
            }
        }

        return finalClusters;
    }
}
