import { fetchAudioFeatures } from './spotify.service.js';
import { createClientLogger } from '../utils/logger.js';

const logger = createClientLogger('VibeAnalysis');

/**
 * Pure helper to determine textual vibe classification from average audio features.
 */
export const getVibeDescription = (stats) => {
    if (!stats || typeof stats.energy === 'undefined') return 'Unknown Vibe';
    if (stats.energy > 0.7 && stats.danceability > 0.7) return 'Total Party Starter 🎉';
    if (stats.energy > 0.8) return 'High Octane ⚡';
    if (stats.valence < 0.3 && stats.energy < 0.4) return 'Sad Boi Hours 🌧️';
    if (stats.acousticness > 0.7) return 'Campfire Vibes 🏕️';
    if (stats.danceability > 0.8) return 'Club Banger 🕺';
    return 'Chill Mix ☕';
};

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
 * Analyzes audio features for a list of tracks.
 * Handles batching, rate limits (via service), and simulates data if API is restricted.
 */
export const analyzeVibe = async (token, tracks, onProgress) => {
    const validTracks = (tracks || []).filter(t => t?.track?.id);
    const trackIds = validTracks.map(t => t.track.id);
    const total = trackIds.length;

    if (total === 0) throw new Error('No valid tracks to analyze.');

    const batches = [];
    for (let i = 0; i < total; i += 100) {
        batches.push(trackIds.slice(i, i + 100));
    }

    const responses = [];
    let fallbackTriggered = false;

    for (let i = 0; i < batches.length; i++) {
        const currentBatch = batches[i];

        if (onProgress) {
            const currentCount = i * 100;
            onProgress(currentCount, total, `Analyzing ${currentCount}/${total}`);
        }

        try {
            const res = await fetchAudioFeatures(token, currentBatch);

            if (res.error && res.error.status === 403) {
                throw new Error('API_RESTRICTED');
            }

            responses.push(res);

            if (i < batches.length - 1) await new Promise(r => setTimeout(r, 200));
        } catch (err) {
            if (err.message === 'API_RESTRICTED' || err.status === 403) {
                if (!fallbackTriggered) {
                    logger.warn('Audio features restricted by API. Switching to simulation.');
                    fallbackTriggered = true;
                }

                const mockFeatures = currentBatch.map(id => ({
                    id,
                    energy: Math.random() * 0.8 + 0.2,
                    danceability: Math.random() * 0.8 + 0.2,
                    valence: Math.random(),
                    acousticness: Math.random() * 0.5,
                    instrumentalness: Math.random() * 0.3,
                    tempo: 100 + Math.random() * 60
                }));
                responses.push({ audio_features: mockFeatures });
            } else {
                logger.warn(`Batch ${i} failed`, err);
            }
        }
    }

    const warning = fallbackTriggered ? 'Simulated Data (API Restricted)' : null;

    const allFeatures = responses.flatMap(res => {
        if (!res || res.error || !res.audio_features) return [];
        return res.audio_features;
    }).filter(f => f && f.energy !== undefined);

    if (allFeatures.length === 0) {
        throw new Error('No audio features could be retrieved.');
    }

    const sum = allFeatures.reduce((acc, curr) => ({
        energy: acc.energy + curr.energy,
        danceability: acc.danceability + curr.danceability,
        valence: acc.valence + curr.valence,
        acousticness: acc.acousticness + curr.acousticness,
        instrumentalness: acc.instrumentalness + curr.instrumentalness,
        tempo: acc.tempo + curr.tempo
    }), { energy: 0, danceability: 0, valence: 0, acousticness: 0, instrumentalness: 0, tempo: 0 });

    const count = allFeatures.length;
    const averages = {
        energy: sum.energy / count,
        danceability: sum.danceability / count,
        valence: sum.valence / count,
        acousticness: sum.acousticness / count,
        instrumentalness: sum.instrumentalness / count,
        tempo: sum.tempo / count
    };

    return { stats: averages, warning };
};
