import { SpotifyPlaylist } from "@/lib/types/spotify";

interface ProcessingQueueProps {
  queuePlaylists: SpotifyPlaylist[];
}

export default function ProcessingQueue({ queuePlaylists }: ProcessingQueueProps) {
  return (
    <div className="bg-zinc-800/60 rounded-xl p-4 sm:p-5 flex flex-col">
      <h3 className="text-white text-sm sm:text-base font-semibold mb-3 sm:mb-4">Processing Queue</h3>
      <div className="flex-1 overflow-y-auto overflow-x-hidden max-h-[140px] pr-2 space-y-3 custom-scrollbar">
        {queuePlaylists.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">No more playlists in queue.</div>
        ) : (
          queuePlaylists.map((p, idx) => (
            <div key={idx} className="flex items-center gap-3 opacity-60">
              <div className="w-8 h-8 rounded-md bg-zinc-700 flex-shrink-0 overflow-hidden shadow-sm">
                {p.images?.[0]?.url && <img src={p.images[0].url} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex flex-col min-w-0">
                <p className="text-white font-medium text-sm truncate">{p.name}</p>
                <p className="text-zinc-500 text-xs">{p.tracks.total} tracks • Pending</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
