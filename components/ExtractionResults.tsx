"use client";

import { useState, useEffect } from "react";
import { SpotifyPlaylist } from "@/lib/types/spotify";

export default function ExtractionResults({
  initialPlaylists,
  extractedTracks,
  recentFindings,
  userId,
  onCancel
}: {
  initialPlaylists: SpotifyPlaylist[];
  extractedTracks: any[];
  recentFindings: any[];
  userId: string;
  onCancel?: () => void;
}) {
  const defaultName = initialPlaylists.length === 1 
    ? `${initialPlaylists[0].name} - Arabic`
    : `Arabic Extraction Mix`;
  const [playlistName, setPlaylistName] = useState(defaultName);
  const [selectedUris, setSelectedUris] = useState<Set<string>>(
    new Set(extractedTracks.map(t => t.track?.uri).filter(Boolean))
  );
  const [collapsedPlaylists, setCollapsedPlaylists] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedUris(new Set(extractedTracks.map(t => t.track?.uri).filter(Boolean)));
  }, [extractedTracks]);

  const toggleSelection = (uri: string) => {
    const newSet = new Set(selectedUris);
    if (newSet.has(uri)) {
      newSet.delete(uri);
    } else {
      newSet.add(uri);
    }
    setSelectedUris(newSet);
  };

  const toggleCollapse = (plName: string) => {
    const newSet = new Set(collapsedPlaylists);
    if (newSet.has(plName)) newSet.delete(plName);
    else newSet.add(plName);
    setCollapsedPlaylists(newSet);
  };

  const handleCreatePlaylist = async () => {
    if (selectedUris.size === 0) {
      setError("Please select at least one track.");
      return;
    }
    if (!playlistName.trim()) {
      setError("Please enter a playlist name.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const createRes = await fetch('/api/spotify/playlists/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, name: playlistName, description: 'Automatically extracted Arabic tracks.' })
      });
      
      if (!createRes.ok) throw new Error("Failed to create playlist.");
      const newPlaylist = await createRes.json();
      
      const trackUris = Array.from(selectedUris);
      
      const addRes = await fetch('/api/spotify/playlists/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playlistId: newPlaylist.id, trackUris })
      });
      
      if (!addRes.ok) throw new Error("Failed to add tracks.");
      
      setCreatedUrl(newPlaylist.external_urls?.spotify);
    } catch (err) {
      console.error(err);
      setError("An error occurred while creating the playlist.");
    } finally {
      setIsCreating(false);
    }
  };

  if (createdUrl) {
    return (
      <div className="bg-zinc-800/60 rounded-2xl p-6 sm:p-10 text-center border border-[#1ED760]/30 shadow-[0_0_40px_rgba(30,215,96,0.1)]">
        <div className="w-20 h-20 bg-[#1ED760]/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-[#1ED760]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Playlist Created Successfully!</h3>
        <p className="text-zinc-400 mb-8 max-w-md mx-auto">
          We've added {selectedUris.size} tracks to "{playlistName}". You can start listening to it right away.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a 
            href={createdUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 bg-[#1ED760] hover:bg-[#1fdf64] text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(30,215,96,0.3)] hover:shadow-[0_0_30px_rgba(30,215,96,0.5)] flex items-center justify-center gap-2"
          >
            Open in Spotify
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
          </a>
          {onCancel && (
            <button 
              onClick={onCancel}
              className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all"
            >
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  if (extractedTracks.length === 0) {
    return (
      <div className="bg-zinc-800/60 rounded-2xl p-6 sm:p-10 text-center border border-zinc-700/50">
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">No Arabic Tracks Found</h3>
        <p className="text-zinc-400 mb-6">
          We couldn't find any Arabic tracks in the selected playlists based on regex or genre matching.
        </p>
        {onCancel && (
          <button 
            onClick={onCancel}
            className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded-lg transition-colors"
          >
            Return to Dashboard
          </button>
        )}
      </div>
    );
  }

  // Group extracted tracks by playlistName
  const groupedTracks: Record<string, any[]> = {};
  extractedTracks.forEach(finding => {
    const plName = finding.playlistName || "Unknown Playlist";
    if (!groupedTracks[plName]) groupedTracks[plName] = [];
    groupedTracks[plName].push(finding);
  });

  return (
    <div className="bg-[#18181B] rounded-2xl p-4 sm:p-6 shadow-2xl border border-zinc-800/50">
      <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Extraction Results</h3>
      <p className="text-zinc-400 text-sm mb-6">
        We found {extractedTracks.length} Arabic tracks. Select the ones you want to keep and create a new playlist.
      </p>

      {/* Playlist Config */}
      <div className="bg-zinc-800/40 rounded-xl p-4 mb-6 border border-zinc-700/50">
        <label className="block text-sm font-medium text-zinc-300 mb-2">New Playlist Name</label>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <input 
            type="text" 
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 sm:py-2 text-white focus:outline-none focus:border-[#1ED760] transition-colors"
            placeholder="e.g., My Arabic Mix"
          />
          <button 
            onClick={handleCreatePlaylist}
            disabled={isCreating || selectedUris.size === 0}
            className="px-6 py-3 sm:py-2 bg-[#1ED760] text-black font-bold rounded-lg hover:bg-[#1fdf64] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isCreating ? "Creating..." : "Create Playlist"}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* Tracks Selection List */}
      <div className="flex justify-between items-center mb-3 px-2">
        <span className="text-sm font-semibold text-white">{selectedUris.size} Tracks Selected</span>
        <button 
          onClick={() => {
            if (selectedUris.size === extractedTracks.length) {
              setSelectedUris(new Set());
            } else {
              setSelectedUris(new Set(extractedTracks.map(t => t.track?.uri).filter(Boolean)));
            }
          }}
          className="text-xs text-[#1ED760] hover:text-[#1fdf64] font-bold uppercase tracking-wider"
        >
          {selectedUris.size === extractedTracks.length ? "Deselect All" : "Select All"}
        </button>
      </div>

      <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
        {Object.entries(groupedTracks).map(([plName, tracks]) => {
          const isCollapsed = collapsedPlaylists.has(plName);
          const selectedInPlaylist = tracks.filter(f => selectedUris.has(f.track.uri)).length;
          
          return (
            <div key={plName}>
              <div 
                className="flex items-center justify-between cursor-pointer group mb-3 pb-2 border-b border-zinc-800"
                onClick={() => toggleCollapse(plName)}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0 pr-2">
                  <h4 className="text-white font-bold text-base sm:text-lg group-hover:text-[#1ED760] transition-colors truncate">{plName}</h4>
                  <span className="text-[10px] sm:text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 w-fit whitespace-nowrap">
                    {selectedInPlaylist} / {tracks.length} Selected
                  </span>
                </div>
                <div className={`p-1 rounded-full bg-zinc-800/50 text-zinc-400 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
              
              {!isCollapsed && (
                <div className="space-y-2 animate-in slide-in-from-top-2 fade-in duration-300">
                  {tracks.map((finding, idx) => {
                    const isSelected = selectedUris.has(finding.track.uri);
                    return (
                      <div 
                        key={`${plName}-${idx}`} 
                        onClick={() => finding.track.uri && toggleSelection(finding.track.uri)}
                        className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all duration-200 border ${
                          isSelected ? 'bg-zinc-800/80 border-[#1ED760]/30' : 'bg-zinc-800/30 border-transparent hover:bg-zinc-800/50'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? 'bg-[#1ED760] border-[#1ED760]' : 'border-zinc-500'
                        }`}>
                          {isSelected && <svg className="w-3.5 h-3.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                        </div>

                        {finding.track.album?.images?.[0]?.url && (
                          <img src={finding.track.album.images[0].url} className="w-10 h-10 rounded shadow-md object-cover" alt="" />
                        )}
                        
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm truncate font-bold ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                            {finding.track.name}
                          </p>
                          <div className="flex items-start sm:items-center justify-between gap-2 mt-1">
                            <p className="text-zinc-500 text-xs whitespace-normal break-words flex-1">
                              {finding.track.artists?.map((a: any) => a.name).join(', ')} • <span className="text-[#1ED760]">{finding.reason}</span>
                            </p>
                            {finding.track.external_urls?.spotify && (
                              <a 
                                href={finding.track.external_urls.spotify} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="flex items-center gap-1.5 text-[10px] sm:text-xs font-medium text-zinc-400 hover:text-[#1ED760] transition-colors bg-zinc-800/80 px-2 py-1 rounded flex-shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                Listen
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
