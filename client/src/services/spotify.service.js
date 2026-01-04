// Helper for buffering/retrying on rate limits
// retries=3 means: try 1, fail 429 -> wait 1s (total 1s), retry 1, fail 429 -> wait 2s (total 3s), retry 2, fail 429 -> wait 4s (total 7s), retry 3...
const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
    try {
        const response = await fetch(url, options);
        if (response.status === 429 && retries > 0) {
            console.warn(`Rate limit hit. Retrying in ${backoff}ms... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            // Exponential backoff
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        return response;
    } catch (err) {
        // Decide if we want to retry on network errors too?
        // simple fetch error usually means network down
        if (retries > 0) {
            console.warn(`Network error. Retrying in ${backoff}ms... (${retries} attempts left)`, err);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw err;
    }
};

export const fetchProfile = async (token) => {
    const result = await fetchWithRetry("https://api.spotify.com/v1/me", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
}

export const fetchUserPlaylists = async (token, limit = 20) => {
    const result = await fetchWithRetry(`https://api.spotify.com/v1/me/playlists?limit=${limit}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
}

export const fetchTracksBatch = async (token, url) => {
    const result = await fetchWithRetry(url, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
}

export const fetchPlaylistTracks = async (token, playlistId, offset = 0, limit = 100) => {
    // Increased default limit to 100 which is Spotify's max for this endpoint
    const result = await fetchWithRetry(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) {
        throw { status: result.status, message: result.statusText };
    }
    return await result.json();
}

export const fetchSavedTracks = async (token, offset = 0, limit = 50) => {
    const result = await fetchWithRetry(`https://api.spotify.com/v1/me/tracks?offset=${offset}&limit=${limit}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) {
        throw { status: result.status, message: result.statusText };
    }
    return await result.json();
}

// Dedicated helper for parallel fetching of the rest
// We process in smaller batches to avoid hitting rate limits too hard
export const fetchRemainingTracks = async (token, initialTotal, userId = null, playlistId = null) => {
    const limit = playlistId ? 100 : 50;
    const promises = [];

    // Start from 'limit'
    for (let offset = limit; offset < initialTotal; offset += limit) {
        const url = playlistId
            ? `https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}`
            : `https://api.spotify.com/v1/me/tracks?offset=${offset}&limit=${limit}`;

        // We catch errors per request so one failure doesn't break everything
        promises.push(
            fetchWithRetry(url, {
                method: "GET", headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => {
                    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                    return res.json();
                })
                .then(data => data.items) // Return just the items array
                .catch(err => {
                    console.warn(`Failed to fetch batch starting at ${offset}`, err);
                    return []; // Return empty array on failure so valid data is kept
                })
        );
    }

    // Use a simpler Promise.all since we catch internally
    const results = await Promise.all(promises);
    return results.flat().filter(item => item !== null && item !== undefined); // Cleaning
}

export const fetchPlaylist = async (token, playlistId) => {
    const result = await fetchWithRetry(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
}
// Max 100 IDs per request
export const fetchAudioFeatures = async (token, trackIds) => {
    // Join IDs with comma
    const idsString = trackIds.join(',');
    const result = await fetchWithRetry(`https://api.spotify.com/v1/audio-features?ids=${idsString}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
}
