import { SpotifyPlaylist } from "@/lib/types/spotify";

interface PlaylistGridProps {
  currentPlaylists: SpotifyPlaylist[];
  filteredPlaylistsLength: number;
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number | ((p: number) => number)) => void;
}

export default function PlaylistGrid({
  currentPlaylists,
  filteredPlaylistsLength,
  selectedIds,
  toggleSelection,
  currentPage,
  totalPages,
  setCurrentPage
}: PlaylistGridProps) {
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
        {filteredPlaylistsLength === 0 ? (
          /* Empty State */
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 mb-6 text-zinc-800">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Playlists Found</h3>
            <p className="text-zinc-400 max-w-md">It looks like you don't have any Spotify playlists yet. Create some on Spotify and refresh this page!</p>
          </div>
        ) : (
          /* Real Playlists */
          currentPlaylists.map((playlist) => {
            const isSelected = selectedIds.has(playlist.id);
            const isLikedSongs = playlist.id === 'liked-songs';

            return (
              <div 
                key={playlist.id}
                onClick={() => toggleSelection(playlist.id)}
                className={`group relative rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 transform outline-none outline-2 outline-offset-2 focus:outline-[#1ED760] ${
                  isSelected 
                    ? 'ring-2 ring-[#1ED760] scale-[0.98] bg-zinc-800/80 shadow-[0_0_20px_rgba(30,215,96,0.15)]' 
                    : 'bg-zinc-900/50 hover:bg-zinc-800/80 hover:-translate-y-1 hover:shadow-xl ring-1 ring-zinc-800'
                }`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleSelection(playlist.id);
                  }
                }}
              >
                <div className="aspect-square w-full relative overflow-hidden bg-zinc-800/50">
                  {isLikedSongs ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#450af5] to-[#8e8ee5]">
                      <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                      </svg>
                    </div>
                  ) : playlist.images?.[0]?.url ? (
                    <img 
                      src={playlist.images[0].url} 
                      alt={playlist.name}
                      className="object-cover w-full h-full transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                    </div>
                  )}

                  <div className={`absolute top-2 sm:top-3 right-2 sm:right-3 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-all flex items-center justify-center z-10 shadow-sm ${
                    isSelected ? 'bg-[#1ED760] border-[#1ED760] text-black' : 'border-zinc-400/80 bg-black/40 backdrop-blur-md group-hover:border-white group-hover:bg-black/60'
                  }`}>
                    {isSelected && <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity pointer-events-none" />
                </div>
                
                <div className="p-3 sm:p-4">
                  <h3 className={`font-bold text-sm sm:text-base truncate mb-1 transition-colors ${isSelected ? 'text-[#1ED760]' : 'text-white group-hover:text-[#1ED760]'}`}>
                    {playlist.name}
                  </h3>
                  <div className="flex items-center text-xs sm:text-sm text-zinc-400">
                    <span className="truncate">{playlist.tracks?.total || 0} tracks</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {filteredPlaylistsLength > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center mt-12 mb-8 sm:mb-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-2 transition-colors ${currentPage === 1 ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            
            {Array.from({ length: totalPages }).map((_, i) => {
              const pageNum = i + 1;
              if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                return (
                  <button 
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded text-sm transition-colors ${
                      currentPage === pageNum 
                        ? 'bg-[#1ED760] text-black font-bold' 
                        : 'bg-transparent hover:bg-zinc-800 text-zinc-400 font-medium'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                return <span key={pageNum} className="text-zinc-600">...</span>;
              }
              return null;
            })}

            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-2 transition-colors ${currentPage === totalPages ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-white'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
