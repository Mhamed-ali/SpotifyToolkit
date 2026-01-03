import React from 'react';
import '../App.css';

const PlaylistsPage = ({ playlists, onBack, onLogout }) => {
    return (
        <div className="playlists-container">
            <div className="playlists-header">
                <div className="header-actions">
                    <button className="spotify-btn action-btn-outline" onClick={onBack}>
                        ← Profile
                    </button>
                    <button className="spotify-btn action-btn-outline logout-btn" onClick={onLogout}>
                        Log Out
                    </button>
                </div>
                <h2>Your Playlists</h2>
            </div>

            <div className="playlists-grid">
                {playlists.map(playlist => (
                    <div key={playlist.id} className="playlist-card">
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
        </div>
    );
};

export default PlaylistsPage;
