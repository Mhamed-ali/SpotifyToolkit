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
    let active = true;
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
        if (!active || cancelledRef.current) break;
        
        const playlist = initialPlaylists[i];
        setCurrentPlaylistIndex(i);
        setCurrentTrackIndex(0);
        
        const expectedTotal = playlist.tracks?.total === -1 ? 9999999 : (playlist.tracks?.total ?? 0);
        
        if (expectedTotal === 0) {
          // Instantly skip empty playlists
          continue;
        }

        let hasMore = true;
        // --- PARALLEL FETCH MODEL ---
        const trackQueue: any[] = [];
        let fetchOffset = 0;
        let completedStreams = 0;
        const CONCURRENCY = 15;

        const fillQueue = async (streamId: number) => {
          while (fetchOffset < expectedTotal && active && !cancelledRef.current) {
            const currentOffset = fetchOffset;
            const maxLimit = playlist.id === 'liked-songs' ? 50 : 100;
            const limit = Math.min(maxLimit, expectedTotal - currentOffset);
            if (limit <= 0) break;

            fetchOffset += limit;

            let retries = 5;
            let success = false;
            let lastError: any = null;
            
            while (retries > 0 && active && !cancelledRef.current) {
              try {
                const reqId = clientLogger.getLoggerRequestId();
                const userId = clientLogger.getLoggerUser();
                const headers: Record<string, string> = {};
                if (reqId) headers['x-request-id'] = reqId;
                if (userId) headers['x-user-id'] = encodeURIComponent(userId);

                const res = await fetch(`/api/spotify/tracks?playlistId=${encodeURIComponent(playlist.id)}&offset=${currentOffset}&limit=${limit}&streamId=${streamId}`, { 
                  signal,
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
                trackQueue.push(...tracks);
                
                success = true;
                break;
              } catch (err: any) {
                lastError = err;
                if (err.name === 'AbortError' || !active || cancelledRef.current) break;
                console.error(`[Stream ${streamId}] Error at offset ${currentOffset}:`, err);
                retries--;
                if (retries > 0) await new Promise(r => setTimeout(r, 2000));
              }
            }

            if (!success && active && !cancelledRef.current) {
              clientLogger.error(`[Stream ${streamId}] Failed to fetch chunk at offset ${currentOffset} after 5 retries.`, lastError?.message || lastError);
              break; 
            }
          }
          completedStreams++;
          if (completedStreams === CONCURRENCY) {
            hasMore = false;
          }
        };

        for (let s = 1; s <= CONCURRENCY; s++) {
          fillQueue(s);
        }

        let processOffset = 0;
        while ((hasMore || trackQueue.length > 0) && active && !cancelledRef.current) {
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

      if (active && !cancelledRef.current) {
        // Final flush
        setDownloadedTracks([...allInstances]);
        setIsFinished(true);
      }
    };

    runProcessingLoop();

    return () => {
      active = false;
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
