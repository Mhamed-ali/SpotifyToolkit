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

export const removeTracksFromPlaylist = async (token, playlistId, trackUris) => {
    // Spotify API limit for deletion is 50 tracks per request for Saved Tracks, 100 for Playlists
    const isLiked = playlistId === 'LIKED_SONGS';
    const batchSize = isLiked ? 50 : 100;
    const batches = [];

    for (let i = 0; i < trackUris.length; i += batchSize) {
        batches.push(trackUris.slice(i, i + batchSize));
    }

    // Process batches
    for (const batch of batches) {
        let url, body, method = "DELETE";

        if (isLiked) {
            // Remove from "Liked Songs" (User Library)
            // Endpoint: DELETE /me/tracks
            // Body: { "ids": ["id1", "id2"] }
            // Extract IDs from URIs
            const ids = batch.map(uri => uri.replace('spotify:track:', ''));
            url = "https://api.spotify.com/v1/me/tracks";
            body = { ids: ids }; // Correct format: Object with ids property
        } else {
            // Remove from Standard Playlist
            // Endpoint: DELETE /playlists/{id}/tracks
            // Body: { "tracks": [{ "uri": "spotify:track:..." }] }
            url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
            body = {
                tracks: batch.map(uri => ({ uri }))
            };
        }

        const result = await fetchWithRetry(url, {
            method: method,
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!result.ok) {
            throw { status: result.status, message: result.statusText };
        }
    }

    return true; // Success
};

export const createPlaylist = async (token, userId, name, description, isPublic = false) => {
    const result = await fetchWithRetry(`https://api.spotify.com/v1/users/${userId}/playlists`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: name,
            description: description,
            public: isPublic
        })
    });
    if (!result.ok) throw { status: result.status, message: result.statusText };
    return await result.json();
};

export const addTracksToPlaylist = async (token, playlistId, trackUris) => {
    // Spotify limit: 100 tracks per request
    const batchSize = 100;
    const batches = [];
    for (let i = 0; i < trackUris.length; i += batchSize) {
        batches.push(trackUris.slice(i, i + batchSize));
    }

    for (const batch of batches) {
        const result = await fetchWithRetry(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                uris: batch
            })
        });
        if (!result.ok) throw { status: result.status, message: result.statusText };
    }
    return true;
};
// Helper to scan all user playlists and build a map of Track URI -> [Playlist Names]
export const buildGlobalTrackMap = async (token, userId, onProgress) => {
    // 1. Fetch All Playlists
    let allPlaylists = [];
    let nextUrl = `https://api.spotify.com/v1/me/playlists?limit=50`;

    while (nextUrl) {
        const res = await fetchWithRetry(nextUrl, {
            method: "GET", headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        allPlaylists = [...allPlaylists, ...data.items];
        nextUrl = data.next;
    }

    // Filter out playlists not owned by user? Maybe keep all they follow? 
    // Usually "Available in Playlists" implies playlists the user can see/edit or follows.
    // Let's keep all.

    const trackMap = {}; // URI -> Set(PlaylistNames)
    const totalPlaylists = allPlaylists.length;
    let processed = 0;

    // 2. Fetch Tracks for each Playlist
    // We can run some in parallel but limited to avoid rate limits
    const BATCH_SIZE = 3; // Process 3 playlists at a time
    for (let i = 0; i < totalPlaylists; i += BATCH_SIZE) {
        const batch = allPlaylists.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (playlist) => {
            try {
                // Fetch first page
                const firstPage = await fetchPlaylistTracks(token, playlist.id, 0, 100);
                let items = firstPage.items;

                // Fetch remaining
                if (playlist.tracks.total > 100) {
                    const remaining = await fetchRemainingTracks(token, playlist.tracks.total, null, playlist.id);
                    items = [...items, ...remaining];
                }

                // Map tracks
                items.forEach(item => {
                    if (item && item.track && item.track.uri) {
                        const uri = item.track.uri;
                        if (!trackMap[uri]) trackMap[uri] = new Set();
                        trackMap[uri].add(playlist.name);
                    }
                });

            } catch (err) {
                console.warn(`Failed to scan playlist ${playlist.name}`, err);
            }
        }));

        processed += batch.length;
        if (onProgress) onProgress(processed, totalPlaylists);
    }

    // 3. Scan Liked Songs (Saved Tracks)
    try {
        if (onProgress) onProgress(processed, totalPlaylists + 1); // Indicate +1 step

        const firstPage = await fetchSavedTracks(token, 0, 50);
        let likedItems = firstPage.items;

        if (firstPage.total > 50) {
            const remaining = await fetchRemainingTracks(token, firstPage.total, 'me');
            likedItems = [...likedItems, ...remaining];
        }

        likedItems.forEach(item => {
            if (item && item.track && item.track.uri) {
                const uri = item.track.uri;
                if (!trackMap[uri]) trackMap[uri] = new Set();
                trackMap[uri].add("Liked Songs");
            }
        });
    } catch (err) {
        console.warn("Failed to scan Liked Songs", err);
    }

    // Convert Sets to Arrays
    const resultMap = {};
    Object.keys(trackMap).forEach(uri => {
        resultMap[uri] = Array.from(trackMap[uri]);
    });

    return resultMap;
};
