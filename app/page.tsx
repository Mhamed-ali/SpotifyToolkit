import { cookies } from 'next/headers';
import { Suspense } from 'react';
import LandingPage from '@/components/LandingPage';
import Navbar from '@/components/Navbar';
import DashboardSkeletons from '@/components/DashboardSkeletons';
import DashboardWrapper from '@/components/DashboardWrapper';
import { ServiceFactory } from '@/lib/core/ServiceFactory';

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get('spotify_access_token');

  if (token) {
    const apiService = ServiceFactory.getSpotifyApiService(token.value);
    
    const t0 = Date.now();
    const logger = ServiceFactory.getLoggerService();
    logger.info("[PageLoader] page.tsx started rendering");

    const initialPlaylistsPromise = apiService.getInitialPlaylists().then(res => {
      logger.info(`[PageLoader] getInitialPlaylists resolved in ${Date.now() - t0}ms`);
      return res;
    });

    const userPromise = apiService.getUserProfile().then(res => {
      logger.info(`[PageLoader] getUserProfile resolved in ${Date.now() - t0}ms`);
      return res;
    });

    return (
      <div className="min-h-screen bg-zinc-950 font-sans selection:bg-[#1ED760]/30 flex flex-col pb-24 relative overflow-x-hidden">
        <Navbar userPromise={userPromise} />
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-8">
          <Suspense fallback={<DashboardSkeletons />}>
            <DashboardWrapper initialPlaylistsPromise={initialPlaylistsPromise} />
          </Suspense>
        </main>
      </div>
    );
  }

  return <LandingPage />;
}