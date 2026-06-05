import { Finding } from "@/hooks/useProcessingEngine";

interface ProcessingFindingsProps {
  recentFindings: Finding[];
}

export default function ProcessingFindings({ recentFindings }: ProcessingFindingsProps) {
  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds} sec ago`;
    return `${Math.floor(seconds / 60)} min ago`;
  };

  return (
    <div className="mt-8 bg-zinc-900/50 rounded-2xl p-4 sm:p-8">
      <h3 className="text-white font-bold text-xl sm:text-2xl mb-6">
        Recent Findings
      </h3>
      <div className="h-[300px] overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-2">
        {recentFindings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 opacity-50">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
            <p className="text-sm font-medium">No findings yet</p>
          </div>
        ) : (
          recentFindings.map((finding) => (
            <div key={finding.id} className="bg-zinc-800/60 rounded-xl p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  finding.type === 'duplicate' ? 'bg-red-400' : 'bg-[#1ED760]'
                }`} />
                <div className="min-w-0 flex flex-col">
                  <h4 className="text-white font-bold text-sm sm:text-base truncate">
                    {finding.type === 'duplicate' ? 'Duplicate detected' : 'Arabic track found'}
                  </h4>
                  <p className="text-zinc-400 text-xs sm:text-sm truncate mt-0.5">
                    {finding.message}
                  </p>
                </div>
              </div>
              <span className="text-zinc-500 text-xs whitespace-nowrap font-medium">{getTimeAgo(finding.timestamp)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
