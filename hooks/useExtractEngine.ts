import { useState, useEffect, useRef } from 'react';
import { SpotifyPlaylist } from '@/lib/types/spotify';
import { isArabicByRegex, isArabicByGenre } from '@/lib/utils/arabicDetection';
import { clientLogger } from '@/lib/utils/clientLogger';

export function useExtractEngine(initialPlaylists: SpotifyPlaylist[], userId: string) {
  const [isFinished, setIsFinished] = useState(false);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<any | null>(null);
  const [scannedTracks, setScannedTracks] = useState(0);
  const [extractedTracks, setExtractedTracks] = useState<any[]>([]);
  const [recentFindings, setRecentFindings] = useState<any[]>([]);
  const [statusText, setStatusText] = useState('Initializing...');
  const [currentPass, setCurrentPass] = useState(1);
  
  const isCancelled = useRef(false);
  const genreCache = useRef(new Map<string, string[]>());

  useEffect(() => {
    let active = true;
    isCancelled.current = false;

    // Reset state on mount
    setIsFinished(false);
    setCurrentPlaylistIndex(0);
    setCurrentTrackIndex(0);
    setCurrentTrack(null);
    setScannedTracks(0);
    setExtractedTracks([]);
    setRecentFindings([]);
    setStatusText('Initializing...');
    setCurrentPass(1);

    async function runExtraction() {
      if (initialPlaylists.length === 0) {
        setStatusText('No playlists selected.');
        setIsFinished(true);
        return;
      }

      if (!active || isCancelled.current) return;

      const allFoundTracks: any[] = [];
      const pendingArtists = new Set<string>();

      for (let pIdx = 0; pIdx < initialPlaylists.length; pIdx++) {
        const initialPlaylist = initialPlaylists[pIdx];
        setCurrentPlaylistIndex(pIdx);
        setCurrentTrackIndex(0);
        
        const totalTracks = initialPlaylist.tracks?.total || 0;
        if (totalTracks === 0) continue;

        let offset = 0;
        const limit = 50;

        // Pass 1: Fetch tracks & do fast regex detection
        setCurrentPass(1);
        setStatusText(`[${initialPlaylist.name}] Scanning & Regex...`);
        while (offset < totalTracks) {
          if (!active || isCancelled.current) return;
          
          const headers: Record<string, string> = {};
          const reqId = clientLogger.getLoggerRequestId();
          const loggerUserId = clientLogger.getLoggerUser();
          if (reqId) headers['x-request-id'] = reqId;
          if (loggerUserId) headers['x-user-id'] = encodeURIComponent(loggerUserId);
          
          const res = await fetch(`/api/spotify/tracks?playlistId=${initialPlaylist.id}&offset=${offset}&limit=${limit}`, { headers });
          if (!res.ok) break;
          const data = await res.json();
          
          for (let i = 0; i < data.items.length; i++) {
            if (!active || isCancelled.current) return;
            const item = data.items[i];
            if (!item?.track) continue;

            setCurrentTrackIndex(offset + i + 1);
            setCurrentTrack(item);
            setScannedTracks(prev => prev + 1);

            // 1. Fast Regex Check
            const regexCheck = isArabicByRegex(item.track);
            if (regexCheck.match) {
              // Ensure uniqueness
              if (!allFoundTracks.some(t => t.track.id === item.track.id)) {
                const findingData = { track: item.track, reason: `Regex Match ("${regexCheck.matchedString}")`, playlistName: initialPlaylist.name };
                allFoundTracks.push(findingData);
                setExtractedTracks([...allFoundTracks]);
                setRecentFindings(prev => [findingData, ...prev].slice(0, 50));
              }
            } else {
              // Collect artist IDs for deep genre check
              if (item.track.artists) {
                item.track.artists.forEach((a: any) => {
                  if (a.id && !genreCache.current.has(a.id)) {
                    pendingArtists.add(a.id);
                  }
                });
              }
            }
            await new Promise(r => setTimeout(r, 10)); // tiny delay for UI
          }
          
          offset += limit;
        }

        if (!active || isCancelled.current) return;

        // Pass 2: Deep Search (Genres)
        setCurrentPass(2);
        setStatusText(`[${initialPlaylist.name}] Analyzing Artist Genres...`);
        const artistIds = Array.from(pendingArtists);
        for (let i = 0; i < artistIds.length; i += 50) {
          if (!active || isCancelled.current) return;
          const chunk = artistIds.slice(i, i + 50);
          
          const headers: Record<string, string> = {};
          const reqId = clientLogger.getLoggerRequestId();
          const loggerUserId = clientLogger.getLoggerUser();
          if (reqId) headers['x-request-id'] = reqId;
          if (loggerUserId) headers['x-user-id'] = encodeURIComponent(loggerUserId);
          
          const res = await fetch(`/api/spotify/artists?ids=${chunk.join(',')}`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data.artists) {
              data.artists.forEach((artist: any) => {
                if (artist && artist.id) {
                  genreCache.current.set(artist.id, artist.genres || []);
                }
              });
            }
          }
        }

        if (!active || isCancelled.current) return;

        // Re-scan non-regex tracks with updated genre cache
        setCurrentPass(3);
        setStatusText(`[${initialPlaylist.name}] Applying Genre analysis...`);
        offset = 0;
        setCurrentTrackIndex(0);
        while (offset < totalTracks) {
          if (!active || isCancelled.current) return;
          const headers: Record<string, string> = {};
          const reqId = clientLogger.getLoggerRequestId();
          const loggerUserId = clientLogger.getLoggerUser();
          if (reqId) headers['x-request-id'] = reqId;
          if (loggerUserId) headers['x-user-id'] = encodeURIComponent(loggerUserId);
          
          const res = await fetch(`/api/spotify/tracks?playlistId=${initialPlaylist.id}&offset=${offset}&limit=${limit}`, { headers });
          if (!res.ok) break;
          const data = await res.json();
          
          for (let i = 0; i < data.items.length; i++) {
            if (!active || isCancelled.current) return;
            const item = data.items[i];
            if (!item?.track) continue;

            setCurrentTrackIndex(offset + i + 1);
            setCurrentTrack(item);

            // Skip if already found via regex
            if (allFoundTracks.some(t => t.track.id === item.track.id)) continue;

            // Check genres
            const genresToTest: string[] = [];
            if (item.track.artists) {
              item.track.artists.forEach((a: any) => {
                const cached = genreCache.current.get(a.id);
                if (cached) genresToTest.push(...cached);
              });
            }

            const genreCheck = isArabicByGenre(genresToTest);
            if (genreCheck.match) {
              const findingData = { track: item.track, reason: `Genre Match ("${genreCheck.matchedString}")`, playlistName: initialPlaylist.name };
              allFoundTracks.push(findingData);
              setExtractedTracks([...allFoundTracks]);
              setRecentFindings(prev => [findingData, ...prev].slice(0, 50));
            }
          }
          offset += limit;
        }
        
        pendingArtists.clear();
      }

      if (!active || isCancelled.current) return;

      if (allFoundTracks.length > 0) {
        setStatusText('Extraction Complete.');
      } else {
        setStatusText('No Arabic tracks found.');
      }

      setIsFinished(true);
    }

    runExtraction();

    return () => {
      active = false;
      isCancelled.current = true;
    };
  }, []);

  return {
    isFinished,
    currentPlaylistIndex,
    currentTrackIndex,
    currentTrack,
    scannedTracks,
    extractedTracks,
    recentFindings,
    statusText,
    currentPass,
    cancelProcessing: () => { 
      isCancelled.current = true; 
      clientLogger.warn("User manually aborted arabic extraction", undefined, undefined, true);
    }
  };
}
