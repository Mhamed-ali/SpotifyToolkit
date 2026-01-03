export const fetchProfile = async (token) => {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
}

export const fetchUserPlaylists = async (token, limit = 20) => {
    const result = await fetch(`https://api.spotify.com/v1/me/playlists?limit=${limit}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
}
