interface ProcessingStatsProps {
  scannedTracks: number;
  duplicatesFound: number;
  arabicTracksCount: number;
  totalTracks: number;
}

export default function ProcessingStats({ scannedTracks, duplicatesFound, arabicTracksCount, totalTracks }: ProcessingStatsProps) {
  const remaining = Math.max(0, totalTracks - scannedTracks);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6 sm:mt-8">
      <div className="bg-zinc-800/60 rounded-xl p-4 sm:p-5 text-center flex flex-col items-center justify-center">
        <div className="text-2xl sm:text-3xl font-bold text-white mb-1 tabular-nums">{scannedTracks.toLocaleString()}</div>
        <div className="text-zinc-400 text-[11px] sm:text-sm font-medium">Tracks Scanned</div>
      </div>
      
      <div className="bg-zinc-800/60 rounded-xl p-4 sm:p-5 text-center flex flex-col items-center justify-center">
        <div className="text-2xl sm:text-3xl font-bold text-red-400 mb-1 tabular-nums">{duplicatesFound.toLocaleString()}</div>
        <div className="text-zinc-400 text-[11px] sm:text-sm font-medium">Duplicates Found</div>
      </div>
      
      <div className="bg-zinc-800/60 rounded-xl p-4 sm:p-5 text-center flex flex-col items-center justify-center">
        <div className="text-2xl sm:text-3xl font-bold text-[#1ED760] mb-1 tabular-nums">{arabicTracksCount.toLocaleString()}</div>
        <div className="text-zinc-400 text-[11px] sm:text-sm font-medium">Arabic Tracks</div>
      </div>

      <div className="bg-zinc-800/60 rounded-xl p-4 sm:p-5 text-center flex flex-col items-center justify-center">
        <div className="text-2xl sm:text-3xl font-bold text-blue-400 mb-1 tabular-nums">{remaining.toLocaleString()}</div>
        <div className="text-zinc-400 text-[11px] sm:text-sm font-medium">Remaining</div>
      </div>
    </div>
  );
}
