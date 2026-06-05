import { SpotifyPlaylist, SpotifyTrack } from "@/lib/types/spotify";
import { AdvancedOptionsState } from "@/components/AdvancedOptions";

export interface TrackInstance {
  playlistId: string;
  playlistName: string;
  added_at: string;
  track: SpotifyTrack;
}

export interface TrackCluster {
  id: string; // The primary ID or fuzzy key
  name: string;
  artist: string;
  instances: TrackInstance[];
}

function normalize(str: string) {
  // Use Unicode property escapes to keep any language letter (\p{L}) and any number (\p{N})
  return str.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function clusterTracks(
  allDownloadedTracks: TrackInstance[],
  options: AdvancedOptionsState
): TrackCluster[] {
  // PASS 1: Group by Exact Spotify ID (Strict Pass)
  const idMap = new Map<string, TrackInstance[]>();
  
  for (const instance of allDownloadedTracks) {
    let key = instance.track.id || 'local-file';
    if (options.scope === 'per') {
      key = `${instance.playlistId}::${key}`;
    }
    if (!idMap.has(key)) idMap.set(key, []);
    idMap.get(key)!.push(instance);
  }

  // If user only wanted Strict match, we return right now
  if (options.matchCriteria === 'strict') {
    const finalClusters: TrackCluster[] = [];
    for (const [key, instances] of idMap.entries()) {
      if (instances.length > 1) {
        finalClusters.push({
          id: key,
          name: instances[0].track.name,
          artist: instances[0].track.artists?.[0]?.name || 'Unknown',
          instances: instances
        });
      }
    }
    return finalClusters;
  }

  // PASS 2: Fuzzy Grouping
  // We take the indivisible blocks from Pass 1 and group them by normalized name + artist
  const fuzzyMap = new Map<string, TrackInstance[][]>();

  for (const block of idMap.values()) {
    const rep = block[0]; // Representative track for this block
    const normName = normalize(rep.track.name);
    const normArtist = rep.track.artists?.[0] ? normalize(rep.track.artists[0].name) : 'unknown';
    
    let key = `${normName}::${normArtist}`;
    if (options.scope === 'per') {
      key = `${rep.playlistId}::${key}`;
    }

    if (!fuzzyMap.has(key)) fuzzyMap.set(key, []);
    fuzzyMap.get(key)!.push(block);
  }

  const finalClusters: TrackCluster[] = [];
  const toleranceMs = options.durationTolerance * 1000;

  for (const [key, blockArray] of fuzzyMap.entries()) {
    // Sort the blocks by the duration of their representative track
    blockArray.sort((a, b) => (a[0].track.duration_ms || 0) - (b[0].track.duration_ms || 0));

    let currentSubCluster: TrackInstance[] = [];

    for (const block of blockArray) {
      if (currentSubCluster.length === 0) {
        currentSubCluster.push(...block);
      } else {
        const firstInst = currentSubCluster[0];
        const durA = block[0].track.duration_ms || 0;
        const durB = firstInst.track.duration_ms || 0;
        
        if (Math.abs(durA - durB) <= toleranceMs) {
          // It's a fuzzy match! Merge this block into the running cluster.
          currentSubCluster.push(...block);
        } else {
          // Duration drifted too far. Finalize the current cluster if it has > 1 track.
          if (currentSubCluster.length > 1) {
            finalClusters.push({
              id: `${key}::${currentSubCluster[0].track.id}`,
              name: currentSubCluster[0].track.name,
              artist: currentSubCluster[0].track.artists?.[0]?.name || 'Unknown',
              instances: [...currentSubCluster]
            });
          }
          // Start a new running cluster
          currentSubCluster = [...block];
        }
      }
    }
    
    // Don't forget to push the final running cluster!
    if (currentSubCluster.length > 1) {
      finalClusters.push({
        id: `${key}::${currentSubCluster[0].track.id}`,
        name: currentSubCluster[0].track.name,
        artist: currentSubCluster[0].track.artists?.[0]?.name || 'Unknown',
        instances: currentSubCluster
      });
    }
  }

  return finalClusters;
}
