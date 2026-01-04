import React from 'react';
import '../App.css';

const PlaylistsPage = ({ playlists, onBack, onLogout, onPlaylistClick, likedSongsCount, isLoading, onManualPlaylist, onMultiAnalyze }) => {
    const [isSelectionMode, setIsSelectionMode] = React.useState(false);
    const [selectedPlaylists, setSelectedPlaylists] = React.useState(new Set());

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedPlaylists(new Set()); // Clear on toggle
    };

    const handleCardClick = (playlist) => {
        if (isSelectionMode) {
            const newSet = new Set(selectedPlaylists);
            if (newSet.has(playlist.id)) {
                newSet.delete(playlist.id);
            } else {
                newSet.add(playlist.id);
            }
            setSelectedPlaylists(newSet);
        } else {
            onPlaylistClick(playlist);
        }
    };

    const handleAnalyze = () => {
        const selected = playlists.filter(p => selectedPlaylists.has(p.id));
        if (selectedPlaylists.has('LIKED_SONGS')) {
            selected.push({
                id: 'LIKED_SONGS',
                name: 'Liked Songs',
                tracks: { total: likedSongsCount }
            });
        }
        onMultiAnalyze(selected);
    };
    const toggleSelectAll = () => {
        if (selectedPlaylists.size === (playlists.length + (likedSongsCount ? 1 : 0))) {
            setSelectedPlaylists(new Set());
        } else {
            const allIds = playlists.map(p => p.id);
            if (likedSongsCount) allIds.push('LIKED_SONGS');
            setSelectedPlaylists(new Set(allIds));
        }
    };

    if ((!playlists && isLoading) || (!playlists && !likedSongsCount && isLoading)) { // Simple loading check
        return (
            <div className="playlists-container">
                <div className="playlists-header">
                    <h2>Loading Library...</h2>
                </div>
                <div className="status-box">Fetching your playlists...</div>
            </div>
        )
    }

    return (
        <div className="playlists-container">
            <div className="playlists-header" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
                <div>
                    <button className="spotify-btn action-btn-outline" onClick={onBack}>
                        ← Profile
                    </button>
                </div>

                <h2 style={{ margin: 0, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {isSelectionMode ? `${selectedPlaylists.size} Selected` : 'Your Playlists'}
                </h2>

                <div className="header-actions" style={{ justifyContent: 'flex-end', gap: '1rem' }}>
                    {isSelectionMode && (
                        <button
                            className="spotify-btn action-btn-outline"
                            onClick={toggleSelectAll}
                            style={{ animation: 'fadeIn 0.2s' }}
                        >
                            {selectedPlaylists.size === (playlists.length + (likedSongsCount ? 1 : 0)) ? 'Deselect All' : 'Select All'}
                        </button>
                    )}
                    {isSelectionMode && selectedPlaylists.size > 0 && (
                        <button
                            className="spotify-btn"
                            onClick={handleAnalyze}
                            style={{ background: 'var(--accent)', animation: 'fadeIn 0.2s' }}
                        >
                            Analyze ({selectedPlaylists.size})
                        </button>
                    )}
                    <button
                        className={`spotify-btn ${isSelectionMode ? 'action-btn-outline' : ''}`}
                        onClick={toggleSelectionMode}
                        style={{
                            background: isSelectionMode ? 'transparent' : 'var(--accent)',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {isSelectionMode ? 'Cancel' : 'Select Playlist'}
                    </button>
                    <button className="spotify-btn action-btn-outline logout-btn" onClick={onLogout}>
                        Log Out
                    </button>
                </div>
            </div>

            <div className="playlists-grid">
                {likedSongsCount !== null && (
                    <div
                        className={`playlist-card clickable liked-songs-card ${isSelectionMode && selectedPlaylists.has('LIKED_SONGS') ? 'selected' : ''}`}
                        style={{
                            border: isSelectionMode && selectedPlaylists.has('LIKED_SONGS') ? '2px solid var(--accent)' : '2px solid transparent',
                            opacity: isSelectionMode && !selectedPlaylists.has('LIKED_SONGS') ? 0.7 : 1
                        }}
                        onClick={() => handleCardClick({
                            id: 'LIKED_SONGS',
                            name: 'Liked Songs',
                            description: 'Your saved tracks',
                            images: [],
                            owner: { display_name: 'You' },
                            tracks: { total: likedSongsCount },
                            public: false
                        })}
                    >
                        <div className="playlist-image-container liked-songs-image">
                            <span className="liked-heart">♥</span>
                        </div>
                        <div className="playlist-info">
                            <h3 className="playlist-title">Liked Songs</h3>
                            <p className="playlist-stats">{likedSongsCount} Tracks</p>
                        </div>
                    </div>
                )}
                {(playlists || []).map(playlist => (
                    <div
                        key={playlist.id}
                        className={`playlist-card clickable ${isSelectionMode && selectedPlaylists.has(playlist.id) ? 'selected' : ''}`}
                        style={{
                            border: isSelectionMode && selectedPlaylists.has(playlist.id) ? '2px solid var(--accent)' : '2px solid transparent',
                            opacity: isSelectionMode && !selectedPlaylists.has(playlist.id) ? 0.7 : 1
                        }}
                        onClick={() => handleCardClick(playlist)}
                    >
                        <div className="playlist-image-container">
                            {playlist.images && playlist.images.length > 0 ? (
                                <img
                                    src={playlist.images.length > 1 ? playlist.images[1].url : playlist.images[0].url}
                                    alt={playlist.name}
                                    className="playlist-image"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="playlist-image-placeholder"></div>
                            )}
                        </div>
                        <div className="playlist-info">
                            <h3 className="playlist-title">{playlist.name}</h3>
                            <div className="playlist-meta">
                                <span className={`privacy-badge ${playlist.public ? 'public' : 'private'}`}>
                                    {playlist.public ? 'Public' : 'Private'}
                                </span>
                                <p className="playlist-stats">{playlist.tracks.total} Tracks</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div >
    );
};

export default PlaylistsPage;
