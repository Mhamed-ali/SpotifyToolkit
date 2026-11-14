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
