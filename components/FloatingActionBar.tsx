interface FloatingActionBarProps {
  selectedCount: number;
  onAnalyze: () => void;
}

export default function FloatingActionBar({ selectedCount, onAnalyze }: FloatingActionBarProps) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 transform transition-transform duration-500 ease-in-out ${
      selectedCount > 0 ? 'translate-y-0' : 'translate-y-full'
    }`}>
      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 pb-6 sm:pb-8">
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-[#1ED760]/30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-8 h-8 rounded-full bg-[#1ED760]/20 text-[#1ED760] flex items-center justify-center font-bold text-sm">
              {selectedCount}
            </div>
            <span className="text-white font-medium text-sm sm:text-base">Playlists selected</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={onAnalyze}
              className="px-8 py-2.5 bg-[#1ED760] hover:bg-[#1fdf64] text-black font-bold text-sm rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(30,215,96,0.3)] hover:shadow-[0_0_25px_rgba(30,215,96,0.6)] hover:scale-105 active:scale-95 w-full sm:w-auto text-center"
            >
              Analyze Playlists
            </button>
          </div>
          
        </div>
      </div>
    </div>
  );
}
