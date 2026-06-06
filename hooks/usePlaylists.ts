import { useState, useEffect } from "react";
import { SpotifyPlaylist } from "@/lib/types/spotify";
import { clientLogger } from "@/lib/utils/clientLogger";

/**
 * Custom hook to manage the user's Spotify playlists.
 * Handles the initial data injection and the background fetching of remaining playlists
 * to ensure a blazing fast initial load while seamlessly paginating the rest.
 */
export function usePlaylists(initialPlaylists: SpotifyPlaylist[]) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>(initialPlaylists);

  useEffect(() => {
    clientLogger.info("Dashboard mounted. Initial playlists count:", initialPlaylists.length);

    const userId = clientLogger.getLoggerUser();
    const headers: Record<string, string> = {};
    if (userId) headers['x-user-id'] = userId;

    fetch('/api/spotify/playlists/remaining', { headers })
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(rest => {
        clientLogger.info("Background API returned remaining playlists. Count:", rest?.length || 0);
        if (rest && rest.length > 0) {
          setPlaylists(prev => {
            const nextPlaylists = [...prev];
            
            rest.forEach((newItem: SpotifyPlaylist) => {
              const existingIndex = nextPlaylists.findIndex(p => p.id === newItem.id);
              if (existingIndex >= 0) {
                // Update existing mock (e.g., Liked Songs track count)
                nextPlaylists[existingIndex] = newItem;
              } else {
                // Append newly discovered playlists
                nextPlaylists.push(newItem);
              }
            });
            
            return nextPlaylists;
          });
        }
      })
      .catch(err => {
        clientLogger.error("Failed to fetch remaining playlists via background API:", err);
      });
  }, []); // Only run once on mount

  return { playlists };
}
