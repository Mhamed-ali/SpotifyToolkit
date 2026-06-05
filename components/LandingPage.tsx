import { AppLogo } from '@/components/AppLogo';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 font-sans selection:bg-[#1ED760]/30">
      
      {/* --- HERO SECTION --- */}
      <section className="relative flex-1 flex flex-col items-center justify-center pt-10 sm:pt-24 pb-8 sm:pb-16 px-4">
        {/* Ambient Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bg-[#1ED760]/15 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl w-full">
          {/* Logo */}
          <div className="mb-4 sm:mb-8 flex items-center justify-center">
            <AppLogo className="w-12 h-12 sm:w-16 sm:h-16 drop-shadow-[0_0_15px_rgba(30,215,96,0.5)]" />
          </div>

          <h1 className="text-[1.6rem] leading-tight sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-2 sm:mb-4 whitespace-nowrap">
            <span className="text-white">Spotify Playlist </span>
            <span className="text-zinc-500">Manager</span>
          </h1>
          
          <h2 className="text-base sm:text-lg md:text-xl font-medium text-white mb-3 sm:mb-6">
            Clean up your music library, discover hidden gems in your Spotify playlists.
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm md:text-base max-w-lg mb-6 sm:mb-10 leading-relaxed">
            Deduplicate your playlists and extract Arabic tracks with ease. Streamline your Spotify experience in just a few clicks.
          </p>

          {/* Feature List (Bento-style Glassmorphism) */}
          <div className="flex flex-col gap-2 sm:gap-3 w-full max-w-md mb-6 sm:mb-10 text-left">
            <div className="group flex items-center gap-3 sm:gap-4 bg-zinc-900/40 border border-zinc-800/80 hover:border-[#1ED760]/50 p-3 sm:p-4 rounded-xl transition-colors duration-300 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-[#1ED760] shadow-[0_0_8px_rgba(30,215,96,0.8)] group-hover:scale-125 transition-transform duration-300 shrink-0"></div>
              <span className="text-zinc-300 text-xs sm:text-sm font-medium">Remove duplicate songs from playlists</span>
            </div>
            <div className="group flex items-center gap-3 sm:gap-4 bg-zinc-900/40 border border-zinc-800/80 hover:border-[#1ED760]/50 p-3 sm:p-4 rounded-xl transition-colors duration-300 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-[#1ED760] shadow-[0_0_8px_rgba(30,215,96,0.8)] group-hover:scale-125 transition-transform duration-300 shrink-0"></div>
              <span className="text-zinc-300 text-xs sm:text-sm font-medium">Extract and organize Arabic tracks</span>
            </div>
            <div className="group flex items-center gap-3 sm:gap-4 bg-zinc-900/40 border border-zinc-800/80 hover:border-[#1ED760]/50 p-3 sm:p-4 rounded-xl transition-colors duration-300 backdrop-blur-sm">
              <div className="w-2 h-2 rounded-full bg-[#1ED760] shadow-[0_0_8px_rgba(30,215,96,0.8)] group-hover:scale-125 transition-transform duration-300 shrink-0"></div>
              <span className="text-zinc-300 text-xs sm:text-sm font-medium">Preserve your original playlists</span>
            </div>
          </div>

          {/* CTA Button */}
          <a 
            href="/api/auth/login"
            className="w-full max-w-md flex items-center justify-center gap-3 bg-[#1ED760] hover:bg-[#1fdf64] text-black font-bold py-3.5 sm:py-4 rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(30,215,96,0.15)] hover:shadow-[0_0_30px_rgba(30,215,96,0.3)] hover:scale-[1.02] active:scale-95 mb-4 sm:mb-6"
          >
            <svg width="20" height="20" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.24 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.84.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Log in with Spotify
          </a>

          <p className="text-zinc-500 text-[10px] sm:text-xs text-center max-w-sm mb-3 sm:mb-4 leading-relaxed">
            We'll only request access to view and modify your playlists. Your personal data stays private and secure.
          </p>
          
          <a href="#faq" className="text-[#1ED760] hover:text-[#1fdf64] text-xs font-medium hover:underline underline-offset-4 transition-colors">
            Learn more about permissions
          </a>
        </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section id="faq" className="w-full bg-zinc-900/50 border-t border-zinc-800 py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">Frequently Asked Questions</h2>
          
          <div className="flex flex-col gap-1 border-t border-zinc-800">
            {/* FAQ 1 */}
            <details className="group border-b border-zinc-800 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between py-6 font-semibold text-zinc-100 outline-none transition-colors hover:text-white">
                What permissions do you need?
                <span className="ml-6 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 group-open:bg-[#1ED760]/10 group-open:text-[#1ED760] transition-colors">
                  <svg className="h-3 w-3 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </span>
              </summary>
              <div className="pb-6 text-sm text-zinc-400 leading-relaxed">
                We only request access to view your playlists and modify them to remove duplicates. We cannot access your personal information, listening history, or other private data.
              </div>
            </details>

            {/* FAQ 2 */}
            <details className="group border-b border-zinc-800 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between py-6 font-semibold text-zinc-100 outline-none transition-colors hover:text-white">
                Will my original playlists be deleted?
                <span className="ml-6 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 group-open:bg-[#1ED760]/10 group-open:text-[#1ED760] transition-colors">
                  <svg className="h-3 w-3 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </span>
              </summary>
              <div className="pb-6 text-sm text-zinc-400 leading-relaxed">
                No, we create new cleaned playlists and leave your originals untouched. You can always delete the new ones if you're not satisfied.
              </div>
            </details>

            {/* FAQ 3 */}
            <details className="group border-b border-zinc-800 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between py-6 font-semibold text-zinc-100 outline-none transition-colors hover:text-white">
                How do you detect Arabic tracks?
                <span className="ml-6 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 group-open:bg-[#1ED760]/10 group-open:text-[#1ED760] transition-colors">
                  <svg className="h-3 w-3 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </span>
              </summary>
              <div className="pb-6 text-sm text-zinc-400 leading-relaxed">
                We use Spotify's audio features and metadata to identify Arabic language tracks, including artist information and track characteristics.
              </div>
            </details>

            {/* FAQ 4 */}
            <details className="group border-b border-zinc-800 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between py-6 font-semibold text-zinc-100 outline-none transition-colors hover:text-white">
                Is this service free?
                <span className="ml-6 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 group-open:bg-[#1ED760]/10 group-open:text-[#1ED760] transition-colors">
                  <svg className="h-3 w-3 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </span>
              </summary>
              <div className="pb-6 text-sm text-zinc-400 leading-relaxed">
                Yes, our playlist management tool is completely free to use. No hidden fees or premium subscriptions required.
              </div>
            </details>
          </div>

          <div className="mt-12 text-center">
            <a 
              href="#"
              className="text-[#1ED760] hover:text-[#1fdf64] text-sm font-medium transition-colors"
            >
              Back to top
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
