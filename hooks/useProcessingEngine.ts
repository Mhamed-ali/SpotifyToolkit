import { useState, useEffect, useRef, useMemo } from "react";
import { SpotifyPlaylist, SpotifyTrack } from "@/lib/types/spotify";
import { clientLogger } from "@/lib/utils/clientLogger";
import { AdvancedOptionsState } from "@/components/AdvancedOptions";
import { TrackInstance, TrackCluster, clusterTracks } from "@/lib/utils/clustering";

export interface Finding {
  id: string;
  type: 'duplicate' | 'arabic';
  title: string;
  message: string;
  timestamp: Date;
}

export function useProcessingEngine(initialPlaylists: SpotifyPlaylist[], advancedOptions?: AdvancedOptionsState) {
  const [isFinished, setIsFinished] = useState(false);
  
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState<{track: SpotifyTrack, playlistId: string} | null>(null);
  
  const [scannedTracks, setScannedTracks] = useState(0);
  const [recentFindings, setRecentFindings] = useState<Finding[]>([]);

  // The global memory bank of all downloaded tracks
  const [downloadedTracks, setDownloadedTracks] = useState<TrackInstance[]>([]);
  
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Run clustering synchronously whenever options or downloaded tracks change
  const clusters = useMemo(() => {
    if (!advancedOptions) return [];
    return clusterTracks(downloadedTracks, advancedOptions);
  }, [downloadedTracks, advancedOptions]);

  // Derived metrics for UI backwards compatibility during processing
  const duplicatesFound = clusters.reduce((acc, c) => acc + (c.instances.length - 1), 0);
  const arabicTracksCount = 0; // Legacy
  const extractedArabicTracks: any[] = []; // Legacy

  const addFinding = (type: 'duplicate' | 'arabic', title: string, message: string) => {
    setRecentFindings(prev => {
      const newFinding = { id: Math.random().toString(), type, title, message, timestamp: new Date() };
      return [newFinding, ...prev].slice(0, 50);
    });
  };

  useEffect(() => {
    cancelledRef.current = false;
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Reset state
    setIsFinished(false);
    setCurrentPlaylistIndex(0);
    setCurrentTrackIndex(0);
    setScannedTracks(0);
    setDownloadedTracks([]);
    setRecentFindings([]);

    const runProcessingLoop = async () => {
      const allInstances: TrackInstance[] = [];
      let globalScannedTracks = 0;

      for (let i = 0; i < initialPlaylists.length; i++) {
        if (cancelledRef.current) break;
        
        const playlist = initialPlaylists[i];
        setCurrentPlaylistIndex(i);
        setCurrentTrackIndex(0);
        
        const expectedTotal = playlist.tracks?.total === -1 ? 9999999 : (playlist.tracks?.total ?? 0);
        
        if (expectedTotal === 0) {
          // Instantly skip empty playlists
          continue;
        }

        let hasMore = true;
        
        // --- PRODUCER-CONSUMER CONCURRENCY MODEL ---
        const trackQueue: any[] = [];
        let fetchOffset = 0;

        const fillQueue = async () => {
          const CONCURRENCY_LIMIT = 30;
          const activePromises: Promise<void>[] = [];

          const fetchChunk = async (offset: number, limit: number, streamId: number) => {
            let retries = 3;
            while (retries > 0 && !cancelledRef.current) {
              try {
                const reqId = clientLogger.getLoggerRequestId();
                const userId = clientLogger.getLoggerUser();
                const headers: Record<string, string> = {};
                if (reqId) headers['x-request-id'] = reqId;
                if (userId) headers['x-user-id'] = userId;

                const res = await fetch(`/api/spotify/tracks?playlistId=${playlist.id}&offset=${offset}&limit=${limit}&streamId=${streamId}`, { 
                  signal,
                  headers
                });
                if (!res.ok) {
                  if (res.status === 429) {
                    await new Promise(r => setTimeout(r, 4000));
                    retries--;
                    continue;
                  }
                  throw new Error(`API error ${res.status}`);
                }
                const data = await res.json();
                const tracks = data.items || [];
                trackQueue.push(...tracks);
                
                // If Spotify returns fewer tracks than we asked for, or an empty array,
                // it means we've hit the absolute end of the playlist regardless of expectedTotal.
                if (tracks.length === 0 || !data.next) {
                  // Hack to instantly stop the outer while loop from queuing more fetches
                  fetchOffset = 9999999;
                }
                
                break;
              } catch (err: any) {
                if (err.name === 'AbortError' || cancelledRef.current) break;
                retries--;
                await new Promise(r => setTimeout(r, 1000));
              }
            }
          };

          while (fetchOffset < expectedTotal && !cancelledRef.current) {
            if (activePromises.length >= CONCURRENCY_LIMIT) {
              await Promise.race(activePromises);
              continue;
            }

            const maxLimit = playlist.id === 'liked-songs' ? 50 : 100;
            const limit = Math.min(maxLimit, expectedTotal - fetchOffset);

            if (limit <= 0) break;

            const currentFetchOffset = fetchOffset;
            fetchOffset += limit;

            const p = fetchChunk(currentFetchOffset, limit, activePromises.length + 1).finally(() => {
              const idx = activePromises.indexOf(p);
              if (idx > -1) activePromises.splice(idx, 1);
            });
            
            activePromises.push(p);
          }

          await Promise.all(activePromises);
          hasMore = false;
        };

        fillQueue();

        let processOffset = 0;
        while ((hasMore || trackQueue.length > 0) && !cancelledRef.current) {
          if (trackQueue.length === 0) {
            await new Promise(r => setTimeout(r, 50));
            continue;
          }
          
          const item = trackQueue.shift();
          if (!item || !item.track || !item.track.id) continue;
          
          const track = item.track;
          setCurrentTrack({ track, playlistId: playlist.id });
          setCurrentTrackIndex(processOffset + 1);

          // Add to global instances cache
          allInstances.push({
            playlistId: playlist.id,
            playlistName: playlist.name,
            added_at: item.added_at,
            track: track
          });

          // Log basic live finding
          if (processOffset === 0 || processOffset % 50 === 0) {
            addFinding('duplicate', 'Downloading track', `[${playlist.name}] Downloading track ${processOffset}...`);
          }

          processOffset++;
          globalScannedTracks++;
          setScannedTracks(globalScannedTracks);
          
          if (globalScannedTracks % 50 === 0) {
            // Flush to state every 50 tracks to keep UI responsive but accurate
            setDownloadedTracks([...allInstances]);
            await new Promise(r => setTimeout(r, 5));
          }
        }
      }

      if (!cancelledRef.current) {
        // Final flush
        setDownloadedTracks([...allInstances]);
        setIsFinished(true);
      }
    };

    runProcessingLoop();

    return () => {
      cancelledRef.current = true;
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [initialPlaylists]);

  const cancelProcessing = () => {
    clientLogger.warn("User manually aborted playlist processing", undefined, undefined, true);
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return {
    isFinished,
    currentPlaylistIndex,
    currentTrackIndex,
    currentTrack,
    scannedTracks,
    duplicatesFound,
    arabicTracksCount,
    extractedArabicTracks,
    recentFindings,
    clusters,
    cancelProcessing,
  };
}
