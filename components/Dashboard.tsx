"use client";

import { useState, useEffect } from "react";
import { SpotifyPlaylist } from "@/lib/types/spotify";
import { clientLogger } from "@/lib/utils/clientLogger";

import ProcessingEngine from "./ProcessingEngine";
import DashboardToolbar from "./DashboardToolbar";
import PlaylistGrid from "./PlaylistGrid";
import FloatingActionBar from "./FloatingActionBar";

import AdvancedOptions, { AdvancedOptionsState } from "./AdvancedOptions";
import { usePlaylists } from "@/hooks/usePlaylists";

export default function Dashboard({ initialPlaylists, userId }: { initialPlaylists: SpotifyPlaylist[], userId: string }) {
  // Set User Context in Logger synchronously so all hooks have access immediately
  if (userId && clientLogger.getLoggerUser() !== userId) {
    clientLogger.setLoggerUser(userId);
  }

  // Use custom hook to handle background playlist fetching
  const { playlists } = usePlaylists(initialPlaylists);
  
  // Local UI State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Advanced Options State
  const [advancedOptions, setAdvancedOptions] = useState<AdvancedOptionsState>({
    matchCriteria: 'strict',
    durationTolerance: 2,
    keepStrategy: 'oldest',
    scope: 'per'
  });
  
  // SPA Routing State (0ms delay!)
  const [isProcessingMode, setIsProcessingMode] = useState(false);
  const [processingPlaylists, setProcessingPlaylists] = useState<SpotifyPlaylist[]>([]);

  // Derived State
  const filteredPlaylists = playlists.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalPages = Math.ceil(filteredPlaylists.length / itemsPerPage) || 1;
  const currentPlaylists = filteredPlaylists.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleAnalyzePlaylists = () => {
    const selected = playlists.filter(p => selectedIds.has(p.id));
    
    // Generate a Unique Request ID for tracing this specific action
    const newReqId = 'Req-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    clientLogger.setLoggerRequestId(newReqId);

    setProcessingPlaylists(selected);
    setIsProcessingMode(true);
    window.dispatchEvent(new CustomEvent('spa-navigate', { detail: { tab: '/processing' } }));
    clientLogger.info("Starting processing in SPA mode with playlists:", selected.length);
  };

  if (isProcessingMode) {
    return (
      <ProcessingEngine 
        initialPlaylists={processingPlaylists} 
        advancedOptions={advancedOptions}
        setAdvancedOptions={setAdvancedOptions}
        onCancel={() => {
          setIsProcessingMode(false);
          window.dispatchEvent(new CustomEvent('spa-navigate', { detail: { tab: '/' } }));
        }} 
      />
    );
  }

  return (
    <>
      <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">Your Playlists</h1>
        <p className="text-zinc-400 text-sm sm:text-base">Select playlists to remove duplicated or extract Arabic tracks</p>
      </div>

      <AdvancedOptions 
        options={advancedOptions}
        onChange={setAdvancedOptions}
      />

      <DashboardToolbar 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={setItemsPerPage}
        setCurrentPage={setCurrentPage}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        playlists={playlists}
      />

      <PlaylistGrid 
        currentPlaylists={currentPlaylists}
        filteredPlaylistsLength={filteredPlaylists.length}
        selectedIds={selectedIds}
        toggleSelection={toggleSelection}
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
      />

      <FloatingActionBar 
        selectedCount={selectedIds.size}
        onAnalyze={handleAnalyzePlaylists}
      />
    </>
  );
}
