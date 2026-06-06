import { useState, useMemo } from 'react';
import { TrackCluster, TrackInstance } from '@/lib/utils/clustering';
import { clientLogger } from "@/lib/utils/clientLogger";
import AdvancedOptions, { AdvancedOptionsState } from './AdvancedOptions';

interface DuplicateReviewProps {
  clusters: TrackCluster[];
  advancedOptions: AdvancedOptionsState;
  setAdvancedOptions: (opts: AdvancedOptionsState) => void;
  onReturnToDashboard: () => void;
}

export default function DuplicateReview({ 
  clusters, 
  advancedOptions, 
  setAdvancedOptions, 
  onReturnToDashboard 
}: DuplicateReviewProps) {
  // Store user's selected keep actions per cluster. Array of selected indices.
  const [decisions, setDecisions] = useState<Record<string, Set<number>>>({});
  const [expandedId, setExpandedId] = useState<string | null>(clusters.length > 0 ? clusters[0].id : null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeSuccess, setRemoveSuccess] = useState(false);
  const [removalStats, setRemovalStats] = useState({ tracks: 0, playlists: 0 });

  const getRemovalData = () => {
    let totalRemovals = 0;
    const removals: Record<string, { uris?: string[], ids?: string[] }> = {};

    clusters.forEach(cluster => {
      const keptIndices = decisions[cluster.id] || new Set<number>();
      
      cluster.instances.forEach((inst, idx) => {
        if (!keptIndices.has(idx)) {
          totalRemovals++;
          if (!removals[inst.playlistId]) {
            removals[inst.playlistId] = inst.playlistId === 'liked-songs' ? { ids: [] } : { uris: [] };
          }
          
          if (inst.playlistId === 'liked-songs') {
            removals[inst.playlistId].ids!.push(inst.track.id);
          } else {
            removals[inst.playlistId].uris!.push(`spotify:track:${inst.track.id}`);
          }
        }
      });
    });

    return { totalRemovals, removals, playlistCount: Object.keys(removals).length };
  };

  const handleApplyClick = () => {
    const { totalRemovals } = getRemovalData();
    if (totalRemovals === 0) {
      alert("No tracks are selected for removal.");
      return;
    }
    setShowConfirmModal(true);
  };

  const confirmRemoval = async () => {
    const { totalRemovals, removals, playlistCount } = getRemovalData();
    setIsRemoving(true);
    
    try {
      const reqId = clientLogger.getLoggerRequestId();
      const userId = clientLogger.getLoggerUser();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (reqId) headers['x-request-id'] = reqId;
      if (userId) headers['x-user-id'] = userId;

      const res = await fetch('/api/spotify/remove', {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ removals })
      });
      
      if (!res.ok) throw new Error("Failed to remove tracks");
      
      setRemovalStats({ tracks: totalRemovals, playlists: playlistCount });
      setRemoveSuccess(true);
    } catch (err) {
      console.error(err);
      alert("An error occurred while removing tracks. Please try again.");
    } finally {
      setIsRemoving(false);
      setShowConfirmModal(false);
    }
  };

  // Pre-fill decisions based on keepStrategy when clusters change
  useMemo(() => {
    const initialDecisions: Record<string, Set<number>> = {};
    clusters.forEach(cluster => {
      // Find the index of the oldest/newest instance
      let targetIndex = 0;
      let targetDate = new Date(cluster.instances[0].added_at || 0).getTime() || 0;
      
      for (let i = 1; i < cluster.instances.length; i++) {
        const date = new Date(cluster.instances[i].added_at || 0).getTime() || 0;
        if (advancedOptions.keepStrategy === 'newest') {
          if (date > targetDate) {
            targetDate = date;
            targetIndex = i;
          }
        } else {
          // Oldest
          if (date < targetDate) {
            targetDate = date;
            targetIndex = i;
          }
        }
      }
      initialDecisions[cluster.id] = new Set([targetIndex]);
    });
    setDecisions(initialDecisions);
  }, [clusters, advancedOptions.keepStrategy]);

  const toggleDecision = (clusterId: string, idx: number) => {
    setDecisions(prev => {
      const currentSet = prev[clusterId] ? new Set(prev[clusterId]) : new Set<number>();
      if (currentSet.has(idx)) {
        currentSet.delete(idx);
      } else {
        currentSet.add(idx);
      }
      
      // Prevent user from unchecking the absolute last item, they must keep at least 1
      if (currentSet.size === 0) {
        currentSet.add(idx);
      }
      
      return { ...prev, [clusterId]: currentSet };
    });
  };

  const setKeepAll = (clusterId: string, instanceCount: number) => {
    setDecisions(prev => {
      const allIndices = new Set(Array.from({ length: instanceCount }, (_, i) => i));
      return { ...prev, [clusterId]: allIndices };
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === '1970-01-01T00:00:00Z') return 'Unknown Date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Unknown Date';
    return date.toLocaleDateString();
  };

  if (removeSuccess) {
    return (
      <div className="w-full max-w-2xl mx-auto mt-12 text-center animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-[#1ED760]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-[#1ED760]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h2 className="text-3xl font-bold text-white mb-4">Clean Up Complete!</h2>
        <p className="text-zinc-400 text-lg mb-8">
          Successfully removed <span className="text-white font-bold">{removalStats.tracks}</span> duplicate tracks across <span className="text-white font-bold">{removalStats.playlists}</span> playlists.
        </p>
        <button 
          onClick={onReturnToDashboard}
          className="px-8 py-4 bg-[#1ED760] hover:bg-[#1ed760]/80 text-black font-bold rounded-xl transition-colors shadow-lg shadow-[#1ED760]/20"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-bold text-white mb-2">Confirm Deletion</h3>
            <p className="text-zinc-400 mb-6">
              You are about to remove <span className="text-white font-bold">{getRemovalData().totalRemovals}</span> duplicate tracks from your Spotify playlists. This action cannot be undone. Are you sure you want to proceed?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                disabled={isRemoving}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={confirmRemoval}
                disabled={isRemoving}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isRemoving ? (
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="30" strokeDashoffset="0" className="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : 'Delete Tracks'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AdvancedOptions options={advancedOptions} onChange={setAdvancedOptions} />

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="p-4 sm:p-6 border-b border-zinc-800">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-1">
            Found {clusters.length} Songs with Duplicates
          </h2>
          <p className="text-sm text-zinc-400">Review each track and choose which playlist should keep it</p>
        </div>

        {clusters.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full border-4 border-zinc-800 mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h4 className="text-lg font-bold text-white">No duplicates found!</h4>
            <p className="text-zinc-500 mt-2">Your playlists are completely clean based on these settings.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800 max-h-[600px] overflow-y-auto">
            {clusters.map((cluster) => {
              const isExpanded = expandedId === cluster.id;
              const decisionSet = decisions[cluster.id] || new Set();
              const isKeepAll = decisionSet.size === cluster.instances.length;

              return (
                <div key={cluster.id} className="bg-zinc-900">
                  {/* Header */}
                  <button 
                    onClick={() => toggleExpand(cluster.id)}
                    className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-zinc-800/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pr-2">
                      <svg className={`w-4 h-4 flex-shrink-0 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 text-zinc-500 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path></svg>
                      <div className="text-left flex-1 min-w-0">
                        <h4 className="text-zinc-200 font-semibold group-hover:text-white transition-colors truncate">{cluster.name}</h4>
                        <p className="text-zinc-500 text-xs sm:text-sm truncate">{cluster.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="px-2 sm:px-3 py-1 bg-zinc-800 text-zinc-400 text-xs sm:text-sm font-medium rounded-full whitespace-nowrap">
                        {cluster.instances.length} locs
                      </span>
                    </div>
                  </button>

                  {/* Body */}
                  {isExpanded && (
                    <div className="bg-zinc-800/20 border-t border-zinc-800">
                      <div className="divide-y divide-zinc-800/50">
                        {cluster.instances.map((inst, idx) => {
                          const isSuggested = decisionSet.has(idx);
                          const isChecked = decisionSet.has(idx);
                          return (
                            <label 
                              key={idx} 
                              className={`flex items-start gap-3 p-3 sm:px-6 sm:py-3 cursor-pointer transition-colors group ${idx % 2 === 0 ? 'bg-zinc-800/20' : 'bg-transparent'} hover:bg-zinc-700/30`}
                            >
                              <div className="flex-shrink-0 pt-0.5">
                                <input 
                                  type="checkbox" 
                                  className="hidden" 
                                  checked={isChecked} 
                                  onChange={() => toggleDecision(cluster.id, idx)} 
                                />
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isChecked ? 'border-[#1ED760] bg-[#1ED760]/20' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
                                  {isChecked && <svg className="w-3 h-3 text-[#1ED760]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className={`text-sm sm:text-base font-medium truncate transition-colors ${isChecked ? 'text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                                    {inst.playlistName}
                                  </span>
                                  {isSuggested && (
                                    <span className="text-[#1ED760] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-[#1ED760]/10 px-1.5 py-0.5 rounded flex-shrink-0">
                                      Suggested
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500 font-mono">
                                  <span className="flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    Added {formatDate(inst.added_at)}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    {Math.floor((inst.track.duration_ms || 0) / 60000)}:{(Math.floor(((inst.track.duration_ms || 0) % 60000) / 1000)).toString().padStart(2, '0')}
                                  </span>
                                  {inst.track.external_urls?.spotify && (
                                    <a 
                                      href={inst.track.external_urls.spotify} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="flex items-center gap-1.5 font-medium text-zinc-400 hover:text-[#1ED760] transition-colors bg-zinc-800/50 px-2 py-1 rounded ml-auto sm:ml-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                      Listen
                                    </a>
                                  )}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                        
                        {/* Footer row for Keep in All */}
                        <label className="flex items-center gap-3 p-3 sm:px-6 sm:py-3 cursor-pointer group bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors border-t border-zinc-800">
                          <div className="flex-shrink-0">
                            <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={isKeepAll} 
                              onChange={() => {
                                if (!isKeepAll) setKeepAll(cluster.id, cluster.instances.length);
                              }} 
                            />
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isKeepAll ? 'border-[#1ED760] bg-[#1ED760]/20' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
                              {isKeepAll && <svg className="w-3 h-3 text-[#1ED760]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                            </div>
                          </div>
                          <span className={`text-sm font-medium transition-colors ${isKeepAll ? 'text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                            Keep in all playlists (no removal)
                          </span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <button 
          onClick={handleApplyClick}
          className="w-full sm:w-auto flex-1 bg-[#1ED760] hover:bg-[#1ed760]/80 text-black font-bold py-3 sm:py-4 rounded-xl transition-all shadow-lg hover:shadow-[#1ED760]/20 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={clusters.length === 0}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          Apply Changes
        </button>
        <button 
          onClick={onReturnToDashboard}
          className="w-full sm:w-auto px-8 py-3 sm:py-4 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-white font-semibold rounded-xl transition-colors"
        >
          Discard & Return
        </button>
      </div>
    </div>
  );
}
