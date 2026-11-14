/**
 * Pure helpers for ranking top artists, release year/decade distributions, and playlist statistics.
 * Zero simulated or random fallbacks — 100% real Spotify track & album metadata.
 */

/**
 * Pure helper to rank top artists from a track list (primary only or including collaborations).
 */
export const calculateTopArtists = (tracks = [], includeCollabs = false) => {
    if (!tracks || tracks.length === 0) return [];

    const artistCounts = {};
    tracks.forEach(item => {
        if (!item?.track?.artists) return;

        if (includeCollabs) {
            item.track.artists.forEach(artist => {
                if (artist?.name) {
                    artistCounts[artist.name] = (artistCounts[artist.name] || 0) + 1;
                }
            });
        } else {
            const primaryArtist = item.track.artists[0]?.name;
            if (primaryArtist) {
                artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
            }
        }
    });

    return Object.entries(artistCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
};

/**
 * Pure helper to filter tracks by a Set of selected artist names.
 */
export const filterTracksByArtists = (tracks = [], selectedArtistsSet = new Set(), includeCollabs = false) => {
    if (!selectedArtistsSet || selectedArtistsSet.size === 0) return [];

    return tracks.filter(item => {
        if (!item?.track?.artists) return false;
        if (includeCollabs) {
            return item.track.artists.some(a => selectedArtistsSet.has(a.name));
        }
        return selectedArtistsSet.has(item.track.artists[0]?.name);
    });
};

/**
 * Pure helper to compute release year/decade distributions and oldest/newest tracks.
 */
export const calculateTimelineStats = (tracks = []) => {
    const yearCounts = {};
    const decadeCounts = {};
    let minDate = new Date();
    let maxDate = new Date(0);
    let oldestTrack = null;
    let newestTrack = null;
    let count = 0;

    tracks.forEach(item => {
        const dateStr = item?.track?.album?.release_date;
        if (!dateStr) return;

        const year = parseInt(dateStr.substring(0, 4), 10);
        if (Number.isNaN(year)) return;

        count++;
        yearCounts[year] = (yearCounts[year] || 0) + 1;

        const decade = Math.floor(year / 10) * 10;
        decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;

        const date = new Date(dateStr);
        if (date < minDate) {
            minDate = date;
            oldestTrack = item.track;
        }
        if (date > maxDate) {
            maxDate = date;
            newestTrack = item.track;
        }
    });

    const sortedYears = Object.entries(yearCounts)
        .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
        .map(([year, cnt]) => ({ year, count: cnt }));

    const sortedDecades = Object.entries(decadeCounts)
        .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
        .map(([decade, cnt]) => ({ decade, count: cnt }));

    return {
        years: sortedYears,
        decades: sortedDecades,
        oldest: oldestTrack,
        newest: newestTrack,
        totalWithDate: count
    };
};

/**
 * Pure helper to compute overall playlist statistics (duration, explicit %, popularity histogram).
 */
export const calculatePlaylistStats = (tracks = []) => {
    let totalDuration = 0;
    let explicitCount = 0;
    let popularitySum = 0;
    let validPopCount = 0;
    const popBuckets = new Array(10).fill(0);

    tracks.forEach(item => {
        const t = item?.track;
        if (!t) return;

        totalDuration += t.duration_ms || 0;
        if (t.explicit) explicitCount++;

        if (typeof t.popularity === 'number') {
            popularitySum += t.popularity;
            validPopCount++;
            const bucketIndex = Math.min(Math.floor(t.popularity / 10), 9);
            popBuckets[bucketIndex]++;
        }
    });

    const totalTracks = tracks.length || 1;
    const avgPopularity = validPopCount > 0 ? Math.round(popularitySum / validPopCount) : 0;
    const explicitPercent = Math.round((explicitCount / totalTracks) * 100);

    const hours = Math.floor(totalDuration / 3600000);
    const minutes = Math.floor((totalDuration % 3600000) / 60000);
    const durationStr = hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;

    return {
        totalTracks,
        durationStr,
        explicitCount,
        explicitPercent,
        avgPopularity,
        popBuckets
    };
};

/**
 * Detects whether a track item is a local file, explicitly marked unplayable, or delisted.
 */
export const isTrackUnplayableOrLocal = (item) => {
    const t = item?.track;
    if (!t) return true;
    if (t.is_local === true) return true;
    if (t.is_playable === false) return true;
    if (!t.id && !t.uri) return true;
    if (Array.isArray(t.available_markets) && t.available_markets.length === 0 && t.is_playable !== true) {
        return true;
    }
    return false;
};

const normalizeReplacementText = (str = '') =>
    String(str).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const normalizeReplacementTitle = (str = '') =>
    String(str)
        .toLowerCase()
        .replace(/\s*\((?:feat\.?|ft\.?|with|remaster(?:ed)?|live|radio edit|single version|album version|bonus track)[^)]*\)/gi, '')
        .replace(/\s*\[(?:feat\.?|ft\.?|with|remaster(?:ed)?|live|radio edit|single version|album version|bonus track)[^\]]*\]/gi, '')
        .replace(/\s*-\s*(?:remaster(?:ed)?(?:\s+\d{4})?|radio edit|single version|album version|original mix).*$/gi, '')
        .replace(/[^\p{L}\p{N}]/gu, '');

/**
 * 3-Tier Replacement Matcher for Unavailable / Locked Tracks:
 * Given a dead/locked track item and a pool of candidate tracks (either library `{ track }` items
 * from Stage 1 or raw Spotify track objects from Stage 2 ISRC / Stage 3 Fuzzy Search),
 * returns the highest-confidence playable replacement track.
 */
export const findBestPlayableReplacement = (deadItem, candidates = [], defaultSourceLabel = 'Spotify Search') => {
    const deadTrack = deadItem?.track || deadItem;
    if (!deadTrack || !deadTrack.name) return null;

    const deadId = deadTrack.id || '';
    const deadUri = deadTrack.uri || '';
    const deadIsrc = deadTrack.external_ids?.isrc || null;
    const deadNormTitle = normalizeReplacementTitle(deadTrack.name);
    const deadPrimaryArtist = normalizeReplacementText(deadTrack.artists?.[0]?.name || '');
    const deadAllArtists = new Set(
        (deadTrack.artists || []).map(a => normalizeReplacementText(a?.name || '')).filter(Boolean)
    );
    const deadDuration = Number(deadTrack.duration_ms) || 0;

    if (!deadNormTitle) return null;

    let bestMatch = null;

    for (const rawCand of candidates) {
        const candTrack = rawCand?.track || rawCand;
        if (!candTrack || !candTrack.id || !candTrack.uri) continue;
        if (candTrack.id === deadId || candTrack.uri === deadUri) continue;
        if (isTrackUnplayableOrLocal({ track: candTrack })) continue;

        const candIsrc = candTrack.external_ids?.isrc || null;
        const candNormTitle = normalizeReplacementTitle(candTrack.name);
        const candPrimaryArtist = normalizeReplacementText(candTrack.artists?.[0]?.name || '');
        const candAllArtists = (candTrack.artists || [])
            .map(a => normalizeReplacementText(a?.name || ''))
            .filter(Boolean);
        const candDuration = Number(candTrack.duration_ms) || 0;
        const durationDiff = (deadDuration > 0 && candDuration > 0)
            ? Math.abs(candDuration - deadDuration)
            : 0;

        let tier = 0;
        let matchReason = defaultSourceLabel;

        // Tier 3: Exact ISRC studio master match
        if (deadIsrc && candIsrc && deadIsrc === candIsrc) {
            tier = 3;
            matchReason = defaultSourceLabel === 'Library Cache'
                ? 'Playable in Library (ISRC)'
                : 'Exact ISRC Master Match';
        } else if (candNormTitle === deadNormTitle) {
            const primaryMatches = deadPrimaryArtist && candPrimaryArtist === deadPrimaryArtist;
            const sharedArtist = candAllArtists.some(a => deadAllArtists.has(a));

            if (primaryMatches && durationDiff <= 3000) {
                tier = 2;
                matchReason = defaultSourceLabel === 'Library Cache'
                    ? 'Playable Copy in Your Library'
                    : 'Exact Title, Artist & Duration (±2s)';
            } else if ((primaryMatches || sharedArtist) && durationDiff <= 5000) {
                tier = 1;
                matchReason = defaultSourceLabel === 'Library Cache'
                    ? 'Playable Copy in Your Library'
                    : 'Title & Artist Match (±5s)';
            }
        }

        if (tier > 0) {
            const pop = Number(candTrack.popularity) || 0;
            const score = tier * 1000 + pop - Math.round(durationDiff / 100);
            if (!bestMatch || score > bestMatch.score) {
                bestMatch = {
                    track: candTrack,
                    matchReason,
                    tier,
                    score,
                    durationDiffMs: durationDiff
                };
            }
        }
    }

    return bestMatch;
};

/**
 * Classifies a track into one of 6 Smart Splitter Genre Family buckets using real Spotify Artist Genres
 * and Arabic detection metadata.
 */
export const classifyGenreBucket = (item, genreMap = new Map()) => {
    if (item?._isArabic) return 'arabic';

    const genres = [];
    if (Array.isArray(item?.track?.artists)) {
        item.track.artists.forEach(a => {
            if (a?.id && genreMap && typeof genreMap.get === 'function') {
                const g = genreMap.get(a.id);
                if (Array.isArray(g)) genres.push(...g);
            }
            if (Array.isArray(a?.genres)) {
                genres.push(...a.genres);
            }
        });
    }

    const joined = genres.join(' ').toLowerCase();
    if (/arab|egypt|mahragan|shaabi|khaliji|levant|lebanese|syrian|iraqi|maghreb|moroccan|tunisian|algerian|sudanese|mena/i.test(joined)) {
        return 'arabic';
    }
    if (/hip hop|hip-hop|rap|trap|drill|r&b|rnb|urban/i.test(joined)) {
        return 'hiphop';
    }
    if (/edm|electro|house|techno|trance|dubstep|drum and bass|dnb|synthwave|club/i.test(joined)) {
        return 'electronic';
    }
    if (/rock|metal|punk|indie|alternative|grunge|shoegaze|emo/i.test(joined)) {
        return 'rock';
    }
    if (/pop|dance|disco|k-pop|latin/i.test(joined)) {
        return 'pop';
    }
    return 'chill';
};

/**
 * Computes Smart Splitter buckets for 'genre', 'decade', or 'language' dimensions.
 */
export const computeSmartSplitBuckets = (tracks = [], dimension = 'genre', genreMap = new Map()) => {
    const total = Math.max(1, tracks.length);

    if (dimension === 'language') {
        const arabicTracks = tracks.filter(t => Boolean(t?._isArabic));
        const intlTracks = tracks.filter(t => !t?._isArabic);
        return [
            {
                id: 'lang-arabic',
                name: '🌙 Arabic Tracks',
                playlistTitle: 'Arabic Collection',
                tracks: arabicTracks,
                count: arabicTracks.length,
                pct: Math.round((arabicTracks.length / total) * 100)
            },
            {
                id: 'lang-intl',
                name: '🌍 International (Non-Arabic)',
                playlistTitle: 'International Collection',
                tracks: intlTracks,
                count: intlTracks.length,
                pct: Math.round((intlTracks.length / total) * 100)
            }
        ];
    }

    if (dimension === 'decade') {
        const groups = {
            '2020s': { id: 'dec-2020', name: '🔥 2020s Hits', playlistTitle: '2020s Hits Mix', tracks: [] },
            '2010s': { id: 'dec-2010', name: '🎧 2010s Throwbacks', playlistTitle: '2010s Throwbacks', tracks: [] },
            '2000s': { id: 'dec-2000', name: '💿 2000s Classics', playlistTitle: '2000s Classics', tracks: [] },
            '1990s': { id: 'dec-1990', name: '📼 1990s Golden Era', playlistTitle: '1990s Golden Era', tracks: [] },
            'older': { id: 'dec-older', name: '📻 1980s & Older', playlistTitle: 'Retro Classics (80s & Older)', tracks: [] }
        };

        tracks.forEach(item => {
            const year = item?._releaseYear || parseInt((item?.track?.album?.release_date || '').substring(0, 4), 10);
            if (!year || Number.isNaN(year) || year >= 2020) {
                groups['2020s'].tracks.push(item);
            } else if (year >= 2010) {
                groups['2010s'].tracks.push(item);
            } else if (year >= 2000) {
                groups['2000s'].tracks.push(item);
            } else if (year >= 1990) {
                groups['1990s'].tracks.push(item);
            } else {
                groups['older'].tracks.push(item);
            }
        });

        return Object.values(groups)
            .map(b => ({
                ...b,
                count: b.tracks.length,
                pct: Math.round((b.tracks.length / total) * 100)
            }))
            .filter(b => b.count > 0 || b.id === 'dec-2020');
    }

    // Default: 'genre'
    const genreGroups = {
        arabic: { id: 'gen-arabic', name: '🌙 Arabic & MENA', playlistTitle: 'Arabic & MENA Mix', tracks: [] },
        hiphop: { id: 'gen-hiphop', name: '🎤 Hip-Hop & R&B', playlistTitle: 'Hip-Hop & R&B Mix', tracks: [] },
        pop: { id: 'gen-pop', name: '✨ Pop & Dance', playlistTitle: 'Pop & Dance Mix', tracks: [] },
        rock: { id: 'gen-rock', name: '🎸 Rock & Indie', playlistTitle: 'Rock & Indie Mix', tracks: [] },
        electronic: { id: 'gen-electronic', name: '🎹 Electronic & House', playlistTitle: 'Electronic & House Mix', tracks: [] },
        chill: { id: 'gen-chill', name: '☕ Chill, Acoustic & Other', playlistTitle: 'Chill & Acoustic Mix', tracks: [] }
    };

    tracks.forEach(item => {
        const key = classifyGenreBucket(item, genreMap);
        (genreGroups[key] || genreGroups.chill).tracks.push(item);
    });

    return Object.values(genreGroups).map(b => ({
        ...b,
        count: b.tracks.length,
        pct: Math.round((b.tracks.length / total) * 100)
    }));
};

/**
 * Normalized track comparison key (by Spotify ID/URI or normalized title + primary artist).
 */
const getTrackCompareIdentity = (item) => {
    const t = item?.track;
    if (!t) return '';
    const title = (t.name || '').toLowerCase().trim();
    const artist = (t.artists?.[0]?.name || '').toLowerCase().trim();
    if (title && artist) return `${title}::${artist}`;
    return t.id || t.uri || '';
};

/**
 * Compares two playlist track arrays:
 * - 'diff' (A - B): Tracks in A that are NOT in B
 * - 'shared' (A ∩ B): Tracks in BOTH A and B
 * - 'union' (A ∪ B): Combined deduplicated union of A and B
 */
export const comparePlaylistTracks = (tracksA = [], tracksB = [], operation = 'diff') => {
    const keysB = new Set(tracksB.map(getTrackCompareIdentity).filter(Boolean));
    const seen = new Set();

    if (operation === 'diff') {
        return tracksA.filter(item => {
            const k = getTrackCompareIdentity(item);
            if (!k || keysB.has(k) || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }

    if (operation === 'shared') {
        return tracksA.filter(item => {
            const k = getTrackCompareIdentity(item);
            if (!k || !keysB.has(k) || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }

    // 'union' (A ∪ B)
    const combined = [];
    [...tracksA, ...tracksB].forEach(item => {
        const k = getTrackCompareIdentity(item);
        if (!k || seen.has(k)) return;
        seen.add(k);
        combined.push(item);
    });
    return combined;
};
