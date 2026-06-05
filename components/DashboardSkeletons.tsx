export default function DashboardSkeletons() {
  return (
    <>
      {/* Search & Sort Toolbar (Disabled during loading) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8 opacity-50 pointer-events-none">
        <div className="relative w-full sm:max-w-md group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          <input 
            type="text" 
            placeholder="Search playlists..." 
            disabled
            className="block w-full pl-10 pr-3 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none transition-all text-sm backdrop-blur-sm"
          />
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          <span className="text-zinc-500 text-sm">Sort by:</span>
          <select disabled className="bg-zinc-900/50 border border-zinc-800 text-white text-sm rounded-lg block px-3 py-2 appearance-none opacity-50">
            <option>Name</option>
          </select>
        </div>
      </div>

      {/* The Grid of Skeletons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="bg-zinc-900/40 backdrop-blur-md rounded-2xl p-3 sm:p-4 animate-pulse border border-zinc-800/80">
            <div className="w-full aspect-square bg-zinc-800/80 rounded-xl mb-3 sm:mb-4 shadow-inner"></div>
            <div className="h-4 sm:h-5 bg-zinc-800 rounded w-3/4 mb-2"></div>
            <div className="h-3 sm:h-4 bg-zinc-800 rounded w-1/2"></div>
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-12 pt-6 border-t border-zinc-800/80">
        <span className="text-zinc-500 text-xs sm:text-sm animate-pulse">
          Loading...
        </span>
        <div className="flex items-center gap-1 sm:gap-2 opacity-50 pointer-events-none">
          <button className="p-2 text-zinc-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
          <button className="w-8 h-8 rounded bg-zinc-800 text-zinc-400 font-medium text-sm">1</button>
          <button className="w-8 h-8 rounded bg-zinc-800 text-zinc-400 font-medium text-sm">2</button>
          <button className="w-8 h-8 rounded bg-zinc-800 text-zinc-400 font-medium text-sm">3</button>
          <button className="p-2 text-zinc-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button>
        </div>
      </div>
    </>
  );
}
