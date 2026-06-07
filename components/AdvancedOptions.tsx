import { useState } from 'react';

export type MatchCriteria = 'strict' | 'fuzzy';
export type KeepStrategy = 'oldest' | 'newest';
export type Scope = 'cross' | 'per';

export interface AdvancedOptionsState {
  matchCriteria: MatchCriteria;
  durationTolerance: number; // in seconds
  keepStrategy: KeepStrategy;
  scope: Scope;
  strictArabicExtraction: boolean;
}

interface AdvancedOptionsProps {
  options: AdvancedOptionsState;
  onChange: (newOptions: AdvancedOptionsState) => void;
  mode?: 'all' | 'dedupe-only' | 'arabic-only';
}

export default function AdvancedOptions({ options, onChange, mode = 'all' }: AdvancedOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleUpdate = (key: keyof AdvancedOptionsState, value: any) => {
    onChange({ ...options, [key]: value });
  };

  return (
    <div className="w-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mb-6 transition-all duration-300 shadow-lg">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between bg-zinc-900 hover:bg-zinc-800/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
          <span className="text-white font-medium">Advanced Options</span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1ED760]/20 text-[#1ED760] uppercase tracking-wider">New</span>
          <span className="text-xs text-zinc-500 hidden sm:inline-block">
            {mode !== 'arabic-only' && (
              <>{options.matchCriteria === 'fuzzy' ? `Fuzzy • ±${options.durationTolerance}s • ` : 'Strict • '} 
              Keep {options.keepStrategy} • {options.scope === 'cross' ? 'Cross-playlist' : 'Per-playlist'}
              {mode === 'all' && ' • '}
              </>
            )}
            {mode !== 'dedupe-only' && (
              <>{options.strictArabicExtraction ? 'Strict Arabic' : 'Standard Arabic'}</>
            )}
          </span>
        </div>
        <svg 
          className={`w-5 h-5 text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {isOpen && (
        <div className="p-5 border-t border-zinc-800 bg-zinc-900/50 animate-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4 md:gap-4 md:divide-x divide-zinc-800">
            
            {/* Dedupe Options */}
            {mode !== 'arabic-only' && (
              <>
                {/* Match Criteria */}
            <div className="flex flex-col md:pr-4">
              <h4 className="text-white font-semibold text-xs sm:text-sm mb-3 sm:mb-4">Match Criteria</h4>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <span className={`text-xs sm:text-sm ${options.matchCriteria === 'strict' ? 'text-zinc-300' : 'text-zinc-500'}`}>Strict</span>
                <button 
                  onClick={() => handleUpdate('matchCriteria', options.matchCriteria === 'strict' ? 'fuzzy' : 'strict')}
                  className={`w-10 h-5 sm:w-12 sm:h-6 flex-shrink-0 rounded-full relative transition-colors ${options.matchCriteria === 'fuzzy' ? 'bg-[#1ED760]' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full absolute top-0.5 transition-transform ${options.matchCriteria === 'fuzzy' ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0.5'}`} />
                </button>
                <span className={`text-xs sm:text-sm ${options.matchCriteria === 'fuzzy' ? 'text-white font-medium' : 'text-zinc-500'}`}>Fuzzy</span>
              </div>
              <p className="text-[10px] sm:text-xs text-zinc-500 hidden sm:block">
                {options.matchCriteria === 'strict' 
                  ? 'Match exact Spotify track IDs.' 
                  : 'Match by track name, artist & duration.'}
              </p>
            </div>

            {/* Duration Tolerance */}
            <div className="flex flex-col md:px-4">
              <h4 className={`font-semibold text-xs sm:text-sm mb-3 sm:mb-4 ${options.matchCriteria === 'fuzzy' ? 'text-white' : 'text-zinc-600'}`}>Duration Tolerance</h4>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <input 
                  type="range" 
                  min="0" 
                  max="5" 
                  step="1"
                  value={options.durationTolerance}
                  onChange={(e) => handleUpdate('durationTolerance', parseInt(e.target.value))}
                  disabled={options.matchCriteria === 'strict'}
                  className="w-full h-1 sm:h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed accent-[#1ED760]"
                />
                <span className={`text-xs sm:text-sm font-medium w-6 ${options.matchCriteria === 'fuzzy' ? 'text-white' : 'text-zinc-600'}`}>
                  ±{options.durationTolerance}s
                </span>
              </div>
              <p className={`text-[10px] sm:text-xs hidden sm:block ${options.matchCriteria === 'fuzzy' ? 'text-zinc-500' : 'text-zinc-700'}`}>
                Allow duration difference when fuzzy matching.
              </p>
            </div>

            {/* Scope Strategy */}
            <div className="flex flex-col md:px-4">
              <h4 className="text-white font-semibold text-xs sm:text-sm mb-3 sm:mb-4">Deduplication Scope</h4>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <span className={`text-xs sm:text-sm ${options.scope === 'cross' ? 'text-zinc-300' : 'text-zinc-500'}`}>Cross</span>
                <button 
                  onClick={() => handleUpdate('scope', options.scope === 'cross' ? 'per' : 'cross')}
                  className={`w-10 h-5 sm:w-12 sm:h-6 flex-shrink-0 rounded-full relative transition-colors ${options.scope === 'per' ? 'bg-[#1ED760]' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full absolute top-0.5 transition-transform ${options.scope === 'per' ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0.5'}`} />
                </button>
                <span className={`text-xs sm:text-sm ${options.scope === 'per' ? 'text-white font-medium' : 'text-zinc-500'}`}>Per-List</span>
              </div>
              <p className="text-[10px] sm:text-xs text-zinc-500 hidden sm:block">
                {options.scope === 'cross' 
                  ? 'Find duplicates across all selected lists.' 
                  : 'Only find duplicates within the same list.'}
              </p>
            </div>

            {/* Keep Strategy */}
            <div className="flex flex-col md:pl-4">
              <h4 className="text-white font-semibold text-xs sm:text-sm mb-3 sm:mb-4">Default Keep Strategy</h4>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                <span className={`text-xs sm:text-sm ${options.keepStrategy === 'oldest' ? 'text-zinc-300' : 'text-zinc-500'}`}>Oldest</span>
                <button 
                  onClick={() => handleUpdate('keepStrategy', options.keepStrategy === 'oldest' ? 'newest' : 'oldest')}
                  className={`w-10 h-5 sm:w-12 sm:h-6 flex-shrink-0 rounded-full relative transition-colors ${options.keepStrategy === 'newest' ? 'bg-[#1ED760]' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full absolute top-0.5 transition-transform ${options.keepStrategy === 'newest' ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0.5'}`} />
                </button>
                <span className={`text-xs sm:text-sm ${options.keepStrategy === 'newest' ? 'text-white font-medium' : 'text-zinc-500'}`}>Newest</span>
              </div>
              <p className="text-[10px] sm:text-xs text-zinc-500 hidden sm:block">
                Determines which version is pre-selected to keep.
              </p>
            </div>
            </>
            )}

            {/* Strict Arabic Extraction */}
            {mode !== 'dedupe-only' && (
            <div className={`flex flex-col md:pr-4 col-span-2 md:col-span-4 ${mode === 'all' ? 'mt-2 md:mt-4 pt-4 md:pt-6 border-t border-zinc-800' : ''}`}>
              <div className="flex items-start justify-between w-full">
                <div>
                  <h4 className="text-white font-semibold text-xs sm:text-sm mb-1 sm:mb-2">Strict Arabic Extraction</h4>
                  <p className="text-[10px] sm:text-xs text-zinc-500 max-w-md">
                    Exclude purely English songs by Arabic artists. Ignores artist's name characters and genres, relying only on Track Title or explicitly known artists.
                  </p>
                </div>
                <button 
                  onClick={() => handleUpdate('strictArabicExtraction', !options.strictArabicExtraction)}
                  className={`w-10 h-5 sm:w-12 sm:h-6 flex-shrink-0 rounded-full relative transition-colors ${options.strictArabicExtraction ? 'bg-[#1ED760]' : 'bg-zinc-700'}`}
                >
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full absolute top-0.5 transition-transform ${options.strictArabicExtraction ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
