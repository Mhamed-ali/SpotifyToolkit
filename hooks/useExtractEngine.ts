"use client";

import { useState, useEffect, useRef } from 'react';
import { SpotifyPlaylist } from '@/lib/types/spotify';
import { isArabicByRegex, isArabicByGenre } from '@/lib/utils/arabicDetection';
import { clientLogger } from '@/lib/utils/clientLogger';

export function useExtractEngine(initialPlaylists: SpotifyPlaylist[], userId: string, advancedOptions?: any) {
  const [isFinished, setIsFinished] = useState(false);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<any | null>(null);
  const [scannedTracks, setScannedTracks] = useState(0);
  const [extractedTracks, setExtractedTracks] = useState<any[]>([]);
  const [recentFindings, setRecentFindings] = useState<any[]>([]);
  const [statusText, setStatusText] = useState('Initializing...');
  const [currentPass, setCurrentPass] = useState(1);
  
  // Precise Progress Tracking
  const [fetchedTracksCount, setFetchedTracksCount] = useState(0);
  const [totalTracksToFetch, setTotalTracksToFetch] = useState(0);
  const [fetchedArtistsCount, setFetchedArtistsCount] = useState(0);
  const [totalArtistsToFetch, setTotalArtistsToFetch] = useState(0);
  const [processedTracksCount, setProcessedTracksCount] = useState(0);

  const isCancelled = useRef(false);
  const genreCache = useRef(new Map<string, string[]>());
  const allDownloadedTracksRef = useRef<{track: any, playlistName: string}[]>([]);

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
    setFetchedTracksCount(0);
    setTotalTracksToFetch(0);
    setFetchedArtistsCount(0);
    setTotalArtistsToFetch(0);
    setProcessedTracksCount(0);

    async function runExtraction() {
      if (initialPlaylists.length === 0) {
        setStatusText('No playlists selected.');
        setIsFinished(true);
        return;
      }

      if (!active || isCancelled.current) return;
      const startTime = performance.now();

      const allFoundTracks: any[] = [];
      const pendingArtists = new Set<string>();

      let globalFetchedTracks = 0;
      let globalFetchedArtists = 0;
      let globalTotalArtists = 0;
      let globalProcessedTracks = 0;

      const totalAllTracks = initialPlaylists.reduce((acc, p) => acc + (p.tracks?.total || 0), 0);
      setTotalTracksToFetch(totalAllTracks);

      for (let pIdx = 0; pIdx < initialPlaylists.length; pIdx++) {
        const initialPlaylist = initialPlaylists[pIdx];
        setCurrentPlaylistIndex(pIdx);
        setCurrentTrackIndex(0);
        
        const totalTracks = initialPlaylist.tracks?.total || 0;
        if (totalTracks === 0) continue;

        // --- PASS 1: PARALLEL STREAM DOWNLOAD ---
        setCurrentPass(1);
        setStatusText(`[${initialPlaylist.name}] Downloading Tracks (Pass 1)...`);
        
        const downloadedTracks: any[] = [];
        let fetchOffset = 0;
        let completedStreams = 0;
        const CONCURRENCY = 30;

        const fillQueue = async (streamId: number) => {
          while (fetchOffset < totalTracks && active && !isCancelled.current) {
            const currentOffset = fetchOffset;
            const maxLimit = initialPlaylist.id === 'liked-songs' ? 50 : 100;
            const limit = Math.min(maxLimit, totalTracks - currentOffset);
            if (limit <= 0) break;

            fetchOffset += limit;

            let retries = 5;
            let success = false;
            let lastError: any = null;

            while (retries > 0 && active && !isCancelled.current) {
              try {
                const reqId = clientLogger.getLoggerRequestId();
                const loggerUserId = clientLogger.getLoggerUser();
                const headers: Record<string, string> = {};
                if (reqId) headers['x-request-id'] = reqId;
                if (loggerUserId) headers['x-user-id'] = encodeURIComponent(loggerUserId);

                const res = await fetch(`/api/spotify/tracks?playlistId=${encodeURIComponent(initialPlaylist.id)}&offset=${currentOffset}&limit=${limit}&streamId=${streamId}`, { 
                  headers
                });
                if (!res.ok) {
                  if (res.status === 429 || res.status >= 500) {
                    const delay = (6 - retries) * 3000;
                    await new Promise(r => setTimeout(r, delay));
                    retries--;
                    continue;
                  }
                  throw new Error(`API error ${res.status}: ${res.statusText}`);
                }

                const data = await res.json();
                const tracks = data.items || [];
                // Store safely in memory
                downloadedTracks.push(...tracks);
                allDownloadedTracksRef.current.push(...tracks.map((t: any) => ({ track: t.track, playlistName: initialPlaylist.name })));
                
                globalFetchedTracks += tracks.length;
                setFetchedTracksCount(globalFetchedTracks);
                
                success = true;
                break;
              } catch (err: any) {
                lastError = err;
                if (err.name === 'AbortError' || !active || isCancelled.current) break;
                retries--;
                if (retries > 0) await new Promise(r => setTimeout(r, 2000));
              }
            }

            if (!success && active && !isCancelled.current) {
              clientLogger.error(`[Stream ${streamId}] Failed to fetch chunk at offset ${currentOffset}`, lastError?.message || lastError);
              break;
            }
          }
          completedStreams++;
        };

        const streamPromises = [];
        for (let s = 1; s <= CONCURRENCY; s++) {
          streamPromises.push(fillQueue(s));
        }

        // Wait for all streams to finish downloading the playlist into memory
        await Promise.all(streamPromises);

        if (!active || isCancelled.current) return;

        // --- PASS 1.5: INSTANT REGEX & ARTIST AGGREGATION ---
        setStatusText(`[${initialPlaylist.name}] Scanning Regex...`);
        let scanned = 0;
        
        for (let i = 0; i < downloadedTracks.length; i++) {
          if (!active || isCancelled.current) return;
          const item = downloadedTracks[i];
          if (!item?.track) continue;

          scanned++;
          
          setCurrentTrackIndex(globalFetchedTracks);

          const strictMode = !!advancedOptions?.strictArabicExtraction;
          const regexCheck = isArabicByRegex(item.track, strictMode);
          if (regexCheck.match) {
            globalProcessedTracks++;
            if (!allFoundTracks.some(t => t.track.id === item.track.id)) {
              const findingData = { track: item.track, reason: `Regex Match ("${regexCheck.matchedString}")`, playlistName: initialPlaylist.name };
              allFoundTracks.push(findingData);
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

          // Batch UI updates to avoid freezing and dropping frames
          if (scanned % 100 === 0) {
             setScannedTracks(scanned);
             setCurrentTrackIndex(scanned);
             setCurrentTrack(item);
             setExtractedTracks([...allFoundTracks]);
             setRecentFindings([...allFoundTracks].reverse().slice(0, 50));
             setProcessedTracksCount(globalProcessedTracks);
             // Yield slightly just to flush React render queue
             await new Promise(r => setTimeout(r, 0));
          }
        }
        
        // Final flush
        setScannedTracks(scanned);
        setCurrentTrackIndex(scanned);
        setExtractedTracks([...allFoundTracks]);
        setRecentFindings([...allFoundTracks].reverse().slice(0, 50));
        setProcessedTracksCount(globalProcessedTracks);

        if (!active || isCancelled.current) return;

        // --- PASS 2: PARALLEL GENRE FETCH ---
        setCurrentPass(2);
        setStatusText(`[${initialPlaylist.name}] Analyzing Artist Genres...`);
        
        const artistIds = Array.from(pendingArtists);
        
        globalTotalArtists += artistIds.length;
        setTotalArtistsToFetch(globalTotalArtists);

        const artistChunks: string[][] = [];
        for (let i = 0; i < artistIds.length; i += 50) {
          artistChunks.push(artistIds.slice(i, i + 50));
        }

        let chunkIndex = 0;
        const ARTIST_CONCURRENCY = 5; // Artists API limits are stricter

        const fetchArtistChunk = async () => {
           while (chunkIndex < artistChunks.length && active && !isCancelled.current) {
              const myChunkIndex = chunkIndex++;
              const chunk = artistChunks[myChunkIndex];
              
              let retries = 3;
              while (retries > 0 && active && !isCancelled.current) {
                try {
                  const headers: Record<string, string> = {};
                  const reqId = clientLogger.getLoggerRequestId();
                  const loggerUserId = clientLogger.getLoggerUser();
                  if (reqId) headers['x-request-id'] = reqId;
                  if (loggerUserId) headers['x-user-id'] = encodeURIComponent(loggerUserId);
                  
                  const res = await fetch(`/api/spotify/artists?ids=${chunk.join(',')}`, { headers });
                  if (!res.ok) {
                    if (res.status === 429) {
                       await new Promise(r => setTimeout(r, 3000));
                       retries--;
                       continue;
                    }
                    throw new Error(`API error ${res.status}`);
                  }
                  
                  const data = await res.json();
                  if (data.artists) {
                    data.artists.forEach((artist: any) => {
                      if (artist && artist.id) {
                        genreCache.current.set(artist.id, artist.genres || []);
                      }
                    });
                  }
                  
                  globalFetchedArtists += chunk.length;
                  setFetchedArtistsCount(globalFetchedArtists);
                  
                  break;
                } catch (e) {
                   retries--;
                   if (retries > 0) await new Promise(r => setTimeout(r, 1000));
                }
              }
           }
        };

        const artistPromises = [];
        for (let a = 0; a < ARTIST_CONCURRENCY; a++) {
           artistPromises.push(fetchArtistChunk());
        }
        await Promise.all(artistPromises);

        if (!active || isCancelled.current) return;

        // --- PASS 3: INSTANT GENRE ANALYSIS (IN MEMORY) ---
        setCurrentPass(3);
        setStatusText(`[${initialPlaylist.name}] Applying Genre analysis...`);
        
        let genreScanned = 0;
        for (let i = 0; i < downloadedTracks.length; i++) {
          if (!active || isCancelled.current) return;
          const item = downloadedTracks[i];
          if (!item?.track) continue;

          genreScanned++;

          // Skip if already found via regex (already counted as processed)
          if (allFoundTracks.some(t => t.track.id === item.track.id)) continue;
          
          globalProcessedTracks++;

          // Check genres
          const genresToTest: string[] = [];
          if (item.track.artists) {
            item.track.artists.forEach((a: any) => {
              const cached = genreCache.current.get(a.id);
              if (cached) genresToTest.push(...cached);
            });
          }

          const strictMode = !!advancedOptions?.strictArabicExtraction;
          const genreCheck = isArabicByGenre(genresToTest, strictMode);
          if (genreCheck.match) {
            const findingData = { track: item.track, reason: `Genre Match ("${genreCheck.matchedString}")`, playlistName: initialPlaylist.name };
            allFoundTracks.push(findingData);
          }

          // Batch UI updates
          if (genreScanned % 100 === 0) {
             setCurrentTrackIndex(genreScanned);
             setCurrentTrack(item);
             setExtractedTracks([...allFoundTracks]);
             setRecentFindings([...allFoundTracks].reverse().slice(0, 50));
             setProcessedTracksCount(globalProcessedTracks);
             await new Promise(r => setTimeout(r, 0));
          }
        }
        
        // Final flush for Pass 3
        setCurrentTrackIndex(genreScanned);
        setExtractedTracks([...allFoundTracks]);
        setRecentFindings([...allFoundTracks].reverse().slice(0, 50));
        setProcessedTracksCount(globalProcessedTracks);
        
        pendingArtists.clear();
      }

      if (!active || isCancelled.current) return;

      if (allFoundTracks.length > 0) {
        setStatusText('Extraction Complete.');
      } else {
        setStatusText('No Arabic tracks found.');
      }

      const endTime = performance.now();
      const timeMs = Math.round(endTime - startTime);
      const memKB = (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1024) : 0;
      clientLogger.info(`Performance Metrics: Arabic Extraction completed in ${timeMs}ms. Tracks Processed: ${globalProcessedTracks}. JS Heap: ~${memKB} KB.`);

      setIsFinished(true);
    }

    runExtraction();

    return () => {
      active = false;
      isCancelled.current = true;
    };
  }, []);

  useEffect(() => {
    if (isFinished && allDownloadedTracksRef.current.length > 0) {
      const strictMode = !!advancedOptions?.strictArabicExtraction;
      const newFoundTracks: any[] = [];
      const seenIds = new Set<string>();

      for (const item of allDownloadedTracksRef.current) {
        if (!item?.track || !item.track.id) continue;
        if (seenIds.has(item.track.id)) continue;
        
        seenIds.add(item.track.id);

        const regexCheck = isArabicByRegex(item.track, strictMode);
        if (regexCheck.match) {
           newFoundTracks.push({ track: item.track, reason: `Regex Match ("${regexCheck.matchedString}")`, playlistName: item.playlistName });
           continue;
        }
        
        const genresToTest: string[] = [];
        if (item.track.artists) {
          item.track.artists.forEach((a: any) => {
            const cached = genreCache.current.get(a.id);
            if (cached) genresToTest.push(...cached);
          });
        }
        
        const genreCheck = isArabicByGenre(genresToTest, strictMode);
        if (genreCheck.match) {
           newFoundTracks.push({ track: item.track, reason: `Genre Match ("${genreCheck.matchedString}")`, playlistName: item.playlistName });
        }
      }
      
      setExtractedTracks(newFoundTracks);
      setRecentFindings([...newFoundTracks].reverse().slice(0, 50));
    }
  }, [advancedOptions?.strictArabicExtraction, isFinished]);

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
    fetchedTracksCount,
    totalTracksToFetch,
    fetchedArtistsCount,
    totalArtistsToFetch,
    processedTracksCount,
    cancelProcessing: () => { 
      isCancelled.current = true; 
      clientLogger.warn("User manually aborted arabic extraction", undefined, undefined, true);
    }
  };
}
