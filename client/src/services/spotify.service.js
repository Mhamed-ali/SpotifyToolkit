import { PLAYLIST_IDS } from '../models/Playlist.js';
import { createClientLogger } from '../utils/logger.js';

const logger = createClientLogger('SpotifyService');

let refreshPromise = null;

/**
 * Automatically refreshes the Spotify access token using the stored refresh_token.
 */
const attemptTokenRefresh = async () => {
    const refreshToken = localStorage.getItem('spotify_refresh_token');
    if (!refreshToken) return null;

    if (!refreshPromise) {
        refreshPromise = fetch(`/refresh_token?refresh_token=${encodeURIComponent(refreshToken)}`)
            .then(async (res) => {
                if (!res.ok) throw new Error('Refresh token failed');
                const data = await res.json();
                if (data.access_token) {
                    localStorage.setItem('spotify_access_token', data.access_token);
                    if (data.refresh_token) {
                        localStorage.setItem('spotify_refresh_token', data.refresh_token);
                    }
                    window.dispatchEvent(new CustomEvent('spotify-token-refreshed', { detail: data.access_token }));
                    return data.access_token;
                }
                return null;
            })
            .catch((err) => {
                logger.warn('Could not refresh Spotify access token', err);
                return null;
            })
            .finally(() => {
                refreshPromise = null;
            });
    }

    return refreshPromise;
};

// Helper for buffering/retrying on rate limits (429) and auto-refreshing expired tokens (401)
const fetchWithRetry = async (url, options = {}, retries = 3, backoff = 1000, hasRefreshed = false) => {
    try {
        const response = await fetch(url, options);

        // Automatic Token Refresh on 401 Unauthorized
        if (response.status === 401 && !hasRefreshed) {
            const newToken = await attemptTokenRefresh();
            if (newToken) {
                const updatedOptions = {
                    ...options,
                    headers: {
                        ...(options.headers || {}),
                        Authorization: `Bearer ${newToken}`
                    }
                };
                return fetchWithRetry(url, updatedOptions, retries, backoff, true);
            }
        }

        if (response.status === 429 && retries > 0) {
            logger.warn(`Rate limit hit. Retrying in ${backoff}ms... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2, hasRefreshed);
        }

        return response;
    } catch (err) {
        if (retries > 0) {
            logger.warn(`Network error. Retrying in ${backoff}ms... (${retries} attempts left)`, err);
            await new Promise(resolve => setTimeout(resolve, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2, hasRefreshed);
        }
        throw err;
    }
};

export const fetchProfile = async (token) => {
    const result = await fetchWithRetry("https://api.spotify.com/v1/me", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
};

export const fetchUserPlaylists = async (token, limit = 20) => {
    const result = await fetchWithRetry(`https://api.spotify.com/v1/me/playlists?limit=${limit}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
};

export const fetchTracksBatch = async (token, url) => {
    const result = await fetchWithRetry(url, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
};

export const fetchPlaylistTracks = async (token, playlistId, offset = 0, limit = 100) => {
    const result = await fetchWithRetry(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) {
        throw { status: result.status, message: result.statusText };
    }
    return await result.json();
};

export const fetchSavedTracks = async (token, offset = 0, limit = 50) => {
    const result = await fetchWithRetry(`https://api.spotify.com/v1/me/tracks?offset=${offset}&limit=${limit}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    if (!result.ok) {
        throw { status: result.status, message: result.statusText };
    }
    return await result.json();
};

export const fetchRemainingTracks = async (token, initialTotal, userId = null, playlistId = null) => {
    const limit = playlistId ? 100 : 50;
    const urls = [];

    for (let offset = limit; offset < initialTotal; offset += limit) {
        const url = playlistId
            ? `https://api.spotify.com/v1/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}`
            : `https://api.spotify.com/v1/me/tracks?offset=${offset}&limit=${limit}`;
        urls.push({ offset, url });
    }

    const results = new Array(urls.length);
    const CONCURRENCY = 4;

    for (let i = 0; i < urls.length; i += CONCURRENCY) {
        const chunk = urls.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(
            chunk.map(({ offset, url }) =>
                fetchWithRetry(url, {
                    method: "GET", headers: { Authorization: `Bearer ${token}` }
                })
                    .then(res => {
                        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
                        return res.json();
                    })
                    .then(data => data.items || [])
                    .catch(err => {
                        logger.warn(`Failed to fetch batch starting at ${offset}`, err);
                        return [];
                    })
            )
        );
        chunkResults.forEach((items, idx) => {
            results[i + idx] = items;
        });
    }

    return results.flat().filter(item => item !== null && item !== undefined);
};

export const fetchArtistsBatch = async (token, artistIds = []) => {
    if (!artistIds || artistIds.length === 0) return [];
    const uniqueIds = Array.from(new Set(artistIds.filter(Boolean)));
    const chunks = [];
    for (let i = 0; i < uniqueIds.length; i += 50) {
        chunks.push(uniqueIds.slice(i, i + 50));
    }

    const artists = [];
    const CONCURRENCY = 3;
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const group = chunks.slice(i, i + CONCURRENCY);
        const responses = await Promise.all(
            group.map(chunk =>
                fetchWithRetry(`https://api.spotify.com/v1/artists?ids=${chunk.join(',')}`, {
                    method: "GET", headers: { Authorization: `Bearer ${token}` }
                })
                    .then(res => (res.ok ? res.json() : { artists: [] }))
                    .then(data => data.artists || [])
                    .catch(err => {
                        logger.warn('Failed to fetch artists batch', err);
                        return [];
                    })
            )
        );
        artists.push(...responses.flat().filter(Boolean));
    }
    return artists;
};

/**
 * DRY Helper: Fetches all tracks (first page + remaining batches) for either a Playlist or Liked Songs.
 */
export const fetchAllTracksForPlaylist = async (token, playlistId, expectedTotal = null) => {
    const isLiked = playlistId === PLAYLIST_IDS.LIKED_SONGS;
    const firstPage = isLiked
        ? await fetchSavedTracks(token, 0, 50)
        : await fetchPlaylistTracks(token, playlistId, 0, 100);

    const total = expectedTotal ?? firstPage.total ?? 0;
    const pageLimit = isLiked ? 50 : 100;
    let items = firstPage.items || [];

    if (total > pageLimit) {
        const remaining = await fetchRemainingTracks(
            token,
            total,
            isLiked ? 'me' : null,
            isLiked ? null : playlistId
        );
        items = [...items, ...remaining];
    }

    return items;
};

export const fetchPlaylist = async (token, playlistId) => {
    const result = await fetchWithRetry(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
};

export const fetchAudioFeatures = async (token, trackIds) => {
    const idsString = trackIds.join(',');
    const result = await fetchWithRetry(`https://api.spotify.com/v1/audio-features?ids=${idsString}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
};

export const removeTracksFromPlaylist = async (token, playlistId, trackUris) => {
    const isLiked = playlistId === PLAYLIST_IDS.LIKED_SONGS;
    const batchSize = isLiked ? 50 : 100;
    const batches = [];

    for (let i = 0; i < trackUris.length; i += batchSize) {
        batches.push(trackUris.slice(i, i + batchSize));
    }

    for (const batch of batches) {
        let url;
        let body;

        if (isLiked) {
            const ids = batch.map(uri => uri.replace('spotify:track:', ''));
            url = "https://api.spotify.com/v1/me/tracks";
            body = { ids };
        } else {
            url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
            body = { tracks: batch.map(uri => ({ uri })) };
        }

        const result = await fetchWithRetry(url, {
            method: "DELETE",
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

    return true;
};

export const createPlaylist = async (token, userId, name, description, isPublic = false) => {
    const result = await fetchWithRetry(`https://api.spotify.com/v1/users/${userId}/playlists`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name,
            description,
            public: isPublic
        })
    });
    if (!result.ok) throw { status: result.status, message: result.statusText };
    return await result.json();
};

export const addTracksToPlaylist = async (token, playlistId, trackUris) => {
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
            body: JSON.stringify({ uris: batch })
        });
        if (!result.ok) throw { status: result.status, message: result.statusText };
    }
    return true;
};

export const buildGlobalTrackMap = async (token, userId, onProgress) => {
    let allPlaylists = [];
    let nextUrl = `https://api.spotify.com/v1/me/playlists?limit=50`;

    while (nextUrl) {
        const res = await fetchWithRetry(nextUrl, {
            method: "GET", headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        allPlaylists = [...allPlaylists, ...(data.items || [])];
        nextUrl = data.next;
    }

    const trackMap = {};
    const totalPlaylists = allPlaylists.length;
    let processed = 0;

    const BATCH_SIZE = 3;
    for (let i = 0; i < totalPlaylists; i += BATCH_SIZE) {
        const batch = allPlaylists.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async (playlist) => {
            try {
                const items = await fetchAllTracksForPlaylist(token, playlist.id, playlist.tracks?.total);
                items.forEach(item => {
                    if (item && item.track && item.track.uri) {
                        const uri = item.track.uri;
                        if (!trackMap[uri]) trackMap[uri] = new Set();
                        trackMap[uri].add(playlist.name);
                    }
                });
            } catch (err) {
                logger.warn(`Failed to scan playlist ${playlist.name}`, err);
            }
        }));

        processed += batch.length;
        if (onProgress) onProgress(processed, totalPlaylists);
    }

    try {
        if (onProgress) onProgress(processed, totalPlaylists + 1);
        const likedItems = await fetchAllTracksForPlaylist(token, PLAYLIST_IDS.LIKED_SONGS);
        likedItems.forEach(item => {
            if (item && item.track && item.track.uri) {
                const uri = item.track.uri;
                if (!trackMap[uri]) trackMap[uri] = new Set();
                trackMap[uri].add("Liked Songs");
            }
        });
    } catch (err) {
        logger.warn("Failed to scan Liked Songs", err);
    }

    const resultMap = {};
    Object.keys(trackMap).forEach(uri => {
        resultMap[uri] = Array.from(trackMap[uri]);
    });

    return resultMap;
};
