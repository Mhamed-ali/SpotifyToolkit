import { SpotifyUserProfile } from '@/lib/types/spotify';
import { AppLogo } from '@/components/AppLogo';
import { Suspense } from 'react';

import NavLinks from './NavLinks';

async function UserProfileBadge({ userPromise }: { userPromise: Promise<SpotifyUserProfile> }) {
  let user;
  try {
    user = await userPromise;
  } catch (error) {
    return null; // Fallback if API fails
  }

  const displayName = user?.display_name || "User";
  const initials = displayName.substring(0, 2).toUpperCase();
  const avatarUrl = user?.images?.[0]?.url;

  return (
    <div className="flex items-center gap-2 md:gap-3 bg-zinc-900/50 rounded-full pl-1 pr-3 md:pr-4 py-1 border border-zinc-800/80">
      <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
      <span className="text-white text-xs md:text-sm font-medium truncate max-w-[80px] md:max-w-none">
        {displayName}
      </span>
    </div>
  );
}

function UserProfileSkeleton() {
  return (
    <div className="flex items-center gap-2 md:gap-3 bg-zinc-900/50 rounded-full pl-1 pr-3 md:pr-4 py-1 border border-zinc-800/80 animate-pulse">
      <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-zinc-800" />
      <div className="w-16 h-4 bg-zinc-800 rounded" />
    </div>
  );
}

export default function Navbar({ userPromise }: { userPromise?: Promise<SpotifyUserProfile> }) {
  return (
    <header className="sticky top-0 z-40 w-full bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 px-4 py-3 sm:px-6 sm:py-4">
      <div className="max-w-[1400px] mx-auto flex items-center justify-between">
        
        {/* Left: Logo & Links */}
        <div className="flex items-center gap-6 md:gap-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center">
              <AppLogo className="w-8 h-8 drop-shadow-[0_0_8px_rgba(30,215,96,0.5)]" />
            </div>
            <span className="text-white font-bold tracking-tight text-lg hidden sm:block">Playlist Manager</span>
          </div>

          {/* Desktop Navigation */}
          <NavLinks />
        </div>
        
        {/* Right: User Profile */}
        <div className="flex items-center gap-3">
          {userPromise && (
            <Suspense fallback={<UserProfileSkeleton />}>
              <UserProfileBadge userPromise={userPromise} />
            </Suspense>
          )}
          
          <a 
            href="/api/auth/logout"
            title="Log out"
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </a>
        </div>
      </div>
    </header>
  );
}
