import { SpotifyPlaylist } from "@/lib/types/spotify";

interface DashboardToolbarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  itemsPerPage: number;
  setItemsPerPage: (items: number) => void;
  setCurrentPage: (page: number) => void;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
  playlists: SpotifyPlaylist[];
}

export default function DashboardToolbar({
  searchQuery,
  setSearchQuery,
  itemsPerPage,
  setItemsPerPage,
  setCurrentPage,
  selectedIds,
  setSelectedIds,
  playlists
}: DashboardToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
      {/* Search Input */}
      <div className="relative w-full sm:max-w-md group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-zinc-400 group-focus-within:text-[#1ED760] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input 
          type="text" 
          placeholder="Search playlists..." 
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="block w-full pl-10 pr-3 py-2.5 bg-zinc-800/80 border border-zinc-700 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#1ED760]/50 focus:border-[#1ED760]/50 transition-all text-sm backdrop-blur-sm shadow-sm"
        />
      </div>

      {/* Toolbar Right Side Controls */}
      <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 shrink-0 bg-zinc-900/60 sm:bg-transparent border border-zinc-800 sm:border-none p-1.5 sm:p-0 rounded-xl">
        {/* Select All Toggle */}
        <button
          onClick={() => {
            if (selectedIds.size === playlists.length) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(playlists.map(p => p.id)));
            }
          }}
          className="text-sm font-medium transition-colors flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white border border-transparent hover:border-zinc-700"
        >
          {selectedIds.size > 0 && selectedIds.size === playlists.length ? (
            <>
              <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              Deselect All
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-[#1ED760]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              Select All
            </>
          )}
        </button>

        <div className="w-px h-6 bg-zinc-800 sm:hidden"></div>

        {/* Items Per Page Dropdown */}
        <div className="relative flex items-center gap-2 sm:gap-3 px-2 sm:px-0">
          <span className="text-zinc-400 text-sm hidden sm:inline">Show:</span>
          <select 
            value={itemsPerPage}
            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
            className="bg-transparent sm:bg-zinc-900/50 sm:border border-zinc-800 text-zinc-300 sm:text-white text-sm font-medium rounded-lg focus:ring-[#1ED760] focus:border-[#1ED760] block pl-2 pr-6 sm:px-3 py-1.5 sm:py-2 outline-none appearance-none cursor-pointer hover:text-white transition-colors relative"
          >
            <option value={12}>12</option>
            <option value={24}>24</option>
            <option value={48}>48</option>
            <option value={100}>100</option>
          </select>
          {/* Custom chevron for the select */}
          <div className="absolute right-2 sm:right-2.5 pointer-events-none sm:hidden flex items-center h-full">
            <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>
    </div>
  );
}
