import { cookies } from 'next/headers';
import { Suspense } from 'react';
import LandingPage from '@/components/LandingPage';
import Navbar from '@/components/Navbar';
import DashboardSkeletons from '@/components/DashboardSkeletons';
import DashboardWrapper from '@/components/DashboardWrapper';
import { ServiceFactory } from '@/lib/core/ServiceFactory';
import { calculateDataSize } from '@/lib/utils/formatBytes';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('spotify_access_token');

  if (token) {
    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    
    const t0 = Date.now();
    const logger = ServiceFactory.getLoggerService();
    logger.info("[PageLoader] page.tsx started rendering");

    const userPromise = apiService.getUserProfile().then(res => {
      const userStr = res.display_name || res.id || 'unknown';
      const sizeStr = calculateDataSize(res);
      logger.info(`[PageLoader] getUserProfile resolved in ${Date.now() - t0}ms (${sizeStr})`, undefined, { user: userStr });
      return res;
    });

    const initialPlaylistsPromise = Promise.all([
      apiService.getInitialPlaylists(),
      userPromise
    ]).then(([playlists, user]) => {
      const userStr = user.display_name || user.id || 'unknown';
      const sizeStr = calculateDataSize(playlists);
      logger.info(`[PageLoader] getInitialPlaylists resolved in ${Date.now() - t0}ms (${sizeStr})`, undefined, { user: userStr });
      return playlists;
    });

    return (
      <div className="min-h-screen bg-zinc-950 font-sans selection:bg-[#1ED760]/30 flex flex-col pb-24 relative overflow-x-hidden">
        <Navbar userPromise={userPromise} />
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-8">
          <Suspense fallback={<DashboardSkeletons />}>
            <DashboardWrapper initialPlaylistsPromise={initialPlaylistsPromise} userPromise={userPromise} />
          </Suspense>
        </main>
      </div>
    );
  }

  return <LandingPage />;
}