"use client";

import { useState, useRef, useEffect } from "react";
import { SpotifyPlaylist } from "@/lib/types/spotify";
import { useProcessingEngine } from "@/hooks/useProcessingEngine";

import ProcessingStats from "./ProcessingStats";
import ProcessingQueue from "./ProcessingQueue";
import ProcessingFindings from "./ProcessingFindings";
import DuplicateReview from "./DuplicateReview";
import { AdvancedOptionsState } from "./AdvancedOptions";

export default function ProcessingEngine({ 
  initialPlaylists,
  advancedOptions,
  setAdvancedOptions,
  onCancel 
}: { 
  initialPlaylists: SpotifyPlaylist[], 
  advancedOptions?: AdvancedOptionsState,
  setAdvancedOptions?: (opts: AdvancedOptionsState) => void,
  onCancel?: () => void 
}) {
  const {
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
  } = useProcessingEngine(initialPlaylists, advancedOptions);

  // Custom Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const pendingNavigationRef = useRef<string | null>(null);


  
  useEffect(() => {
    const handleRequestCancel = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (isFinished) {
        // If finished, just allow them to navigate away without the warning modal
        if (onCancel) onCancel();
        else window.location.href = customEvent.detail?.target || '/';
        return;
      }
      
      pendingNavigationRef.current = customEvent.detail?.target || '/';
      setShowCancelModal(true);
    };
    window.addEventListener('request-cancel-processing', handleRequestCancel);

    return () => {
      window.removeEventListener('request-cancel-processing', handleRequestCancel);
    };
  }, [isFinished]);

  const totalTracks = initialPlaylists.reduce((acc, p) => acc + (p.tracks?.total || 0), 0);
  const percentage = isFinished ? 100 : (totalTracks === 0 ? 0 : Math.floor((scannedTracks / totalTracks) * 100));

  const currentPlaylist = initialPlaylists[currentPlaylistIndex];
  const queuePlaylists = initialPlaylists.slice(currentPlaylistIndex + 1);

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-8 px-2 sm:px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header */}
      <div className="text-center mb-8 sm:mb-12">
        <div className={`inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#1ED760]/20 mb-4 sm:mb-6 relative ${isFinished ? '' : 'animate-pulse shadow-[0_0_20px_rgba(30,215,96,0.2)]'}`}>
          {isFinished ? (
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#1ED760]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
          ) : (
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#1ED760] animate-[spin_3s_linear_infinite]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
          )}
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-2 sm:mb-3">
          {isFinished ? "Analysis Complete!" : "Processing Playlists"}
        </h2>
        <p className="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto">
          {isFinished 
            ? "We've finished scanning your selected playlists. Check out the results below."
            : "Analyzing tracks for duplicates and Arabic content"}
        </p>
      </div>

      <div className="bg-[#18181B] rounded-3xl p-4 sm:p-8 shadow-2xl">
        {/* Progress Bar Area */}
        <div className="mb-10">
          <div className="flex justify-between items-end mb-3">
            <span className="text-white font-bold tracking-wide">Overall Progress</span>
            <span className="text-2xl font-black text-[#1ED760] tabular-nums">{percentage}%</span>
          </div>
          <div className="h-4 w-full bg-zinc-800 rounded-full overflow-hidden relative">
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#1ED760] to-[#1fdf64] rounded-full transition-all duration-300 ease-out shadow-[0_0_15px_rgba(30,215,96,0.5)]"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Current State Grid OR Duplicate Review */}
        {isFinished ? (
          <DuplicateReview 
            clusters={clusters}
            advancedOptions={advancedOptions || {
              matchCriteria: 'strict',
              durationTolerance: 2,
              keepStrategy: 'oldest',
              scope: 'cross'
            }}
            setAdvancedOptions={setAdvancedOptions || (() => {})} 
            onReturnToDashboard={() => {
              if (onCancel) onCancel();
              else window.location.href = '/';
            }} 
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 relative">
            <div className="bg-zinc-800/60 rounded-xl p-4 sm:p-5 flex flex-col">
              <h3 className="text-white text-sm sm:text-base font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1ED760] animate-pulse"></span>
                Currently Processing
              </h3>
              
              <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-zinc-700 flex-shrink-0 overflow-hidden shadow-lg">
                  {currentPlaylist?.id === 'liked-songs' ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#450af5] to-[#8e8ee5]">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </div>
                  ) : currentPlaylist?.images?.[0]?.url ? (
                    <img src={currentPlaylist.images[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-500">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm sm:text-base truncate mb-0.5 sm:mb-1">
                    {currentPlaylist?.name || 'Loading...'}
                  </p>
                  <p className="text-zinc-400 text-xs mt-0 sm:mt-0.5">
                    Track {currentTrackIndex}{currentPlaylist?.tracks?.total === -1 ? '' : `/${currentPlaylist?.tracks?.total || 0}`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-zinc-300 text-sm pl-2">
                <svg className="w-4 h-4 text-[#1ED760] flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                <span className="truncate">
                  {currentTrack?.track?.name ? `"${currentTrack.track.name}"` : "Initializing..."}
                  {currentTrack?.track?.artists?.length ? ` - ${currentTrack.track.artists[0].name}` : ''}
                </span>
              </div>
            </div>

            <ProcessingQueue queuePlaylists={queuePlaylists} />
          </div>
        )}

        <ProcessingStats 
          scannedTracks={scannedTracks}
          duplicatesFound={duplicatesFound}
          arabicTracksCount={arabicTracksCount}
          totalTracks={totalTracks}
        />
      </div>

      {!isFinished && (
        <>
          <ProcessingFindings recentFindings={recentFindings} />

          {/* Controls */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={() => { 
                pendingNavigationRef.current = '/';
                setShowCancelModal(true);
              }}
              className="w-full sm:w-auto px-8 py-3 bg-zinc-800 hover:bg-red-500/10 text-white hover:text-red-500 rounded-xl text-sm font-bold transition-all duration-300 border border-zinc-700 hover:border-red-500/50 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              Cancel Processing
            </button>
          </div>
        </>
      )}

      {/* Custom Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              </div>
              <h3 className="text-xl font-bold text-white text-center mb-2">Cancel Processing?</h3>
              <p className="text-zinc-400 text-sm text-center mb-6">
                Are you sure you want to leave? All your current processing progress will be permanently lost.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-bold transition-colors border border-zinc-700"
                >
                  No, Keep Processing
                </button>
                <button 
                  onClick={() => {
                    cancelProcessing();
                    if (onCancel) {
                      onCancel();
                    } else if (pendingNavigationRef.current) {
                      if (pendingNavigationRef.current.startsWith('http')) {
                        window.location.href = pendingNavigationRef.current;
                      } else {
                        // Fallback
                        window.location.href = '/';
                      }
                    } else {
                      window.location.href = '/';
                    }
                  }}
                  className="flex-1 py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                >
                  Yes, Leave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
