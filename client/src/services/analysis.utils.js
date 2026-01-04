import { fetchAudioFeatures } from './spotify.service';

/**
 * Analyzes audio features for a list of tracks.
 * Handles batching, rate limits (via service), and simulates data if API is restricted.
 * 
 * @param {string} token - Spotify Access Token
 * @param {Array} tracks - Array of track objects
 * @param {Function} onProgress - Callback(current, total, message)
 * @returns {Promise<Object>} - Calculated stats { energy, danceability, valence, ... }
 */
export const analyzeVibe = async (token, tracks, onProgress) => {
    // 1. Extract IDs (filter out locals/nulls)
    const validTracks = tracks.filter(t => t.track && t.track.id);
    const trackIds = validTracks.map(t => t.track.id);
    const total = trackIds.length;

    if (total === 0) throw new Error("No valid tracks to analyze.");

    // 2. Batch requests
    const batches = [];
    for (let i = 0; i < total; i += 100) {
        batches.push(trackIds.slice(i, i + 100));
    }

    const responses = [];
    let fallbackTriggered = false;

    // 3. Process batches sequentially
    for (let i = 0; i < batches.length; i++) {
        const currentBatch = batches[i];

        // Report Progress
        if (onProgress) {
            const currentCount = i * 100;
            onProgress(currentCount, total, `Analyzing ${currentCount}/${total}`);
        }

        try {
            const res = await fetchAudioFeatures(token, currentBatch);

            // Check for restriction
            if (res.error && res.error.status === 403) {
                throw new Error("API_RESTRICTED");
            }

            responses.push(res);

            // Small delay for politeness
            if (i < batches.length - 1) await new Promise(r => setTimeout(r, 200));

        } catch (err) {
            if (err.message === "API_RESTRICTED" || err.status === 403) {
                if (!fallbackTriggered) {
                    console.warn("Audio features restricted. Switching to simulation.");
                    fallbackTriggered = true;
                }

                // Generate Mock Data
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
                console.warn(`Batch ${i} failed`, err);
            }
        }
    }

    // Report specific warning if fallback was used
    const warning = fallbackTriggered
        ? "Simulated Data (API Restricted)"
        : null;

    // 4. Combine results
    const allFeatures = responses.flatMap(res => {
        if (!res || res.error || !res.audio_features) return [];
        return res.audio_features;
    }).filter(f => f && f.energy !== undefined);

    if (allFeatures.length === 0) {
        throw new Error("No audio features could be retrieved.");
    }

    // 5. Calculate Averages
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
