import React, { useState } from 'react';
import '../App.css';

const PlaylistDetailsPage = ({ playlist, tracks, onBack, isFetching }) => {
    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState({
        index: true,
        art: true,
        title: true,
        album: true,
        dateAdded: false,
        released: false,
        popularity: false,
        duration: true
    });

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('view');

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Helper to format duration (ms -> m:ss)
    const formatDuration = (ms) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString();
    };

    return (
        <div className="playlist-page-layout">
            {/* Toggle Button for Mobile/Closed State */}
            <button
                className="sidebar-toggle-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="Customize View"
            >
                {isMenuOpen ? '×' : '⚙️'}
            </button>

            {/* Sidebar Menu */}
            <div className={`options-sidebar ${isMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-tabs">
                    <button
                        className={`sidebar-tab ${activeTab === 'view' ? 'active' : ''}`}
                        onClick={() => setActiveTab('view')}
                    >
                        View
                    </button>
                    <button
                        className={`sidebar-tab ${activeTab === 'tools' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tools')}
                    >
                        Tools
                    </button>
                </div>

                <div className="sidebar-content-wrapper">
                    {activeTab === 'view' && (
                        <div className="sidebar-content">
                            <p className="sidebar-label">Show Columns:</p>
                            <label className="toggle-option">
                                <input type="checkbox" checked={visibleColumns.dateAdded} onChange={() => toggleColumn('dateAdded')} />
                                Date Added
                            </label>
                            <label className="toggle-option">
                                <input type="checkbox" checked={visibleColumns.released} onChange={() => toggleColumn('released')} />
                                Release Date
                            </label>
                            <label className="toggle-option">
                                <input type="checkbox" checked={visibleColumns.popularity} onChange={() => toggleColumn('popularity')} />
                                Popularity
                            </label>
                            <label className="toggle-option">
                                <input type="checkbox" checked={visibleColumns.album} onChange={() => toggleColumn('album')} />
                                Album
                            </label>
                        </div>
                    )}

                    {activeTab === 'tools' && (
                        <div className="sidebar-content">
                            <p className="sidebar-label">Analysis Tools</p>
                            <button className="spotify-btn full-width" onClick={() => alert("Analysis feature coming soon!")}>
                                📊 Analyze Playlist
                            </button>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem', lineHeight: '1.4' }}>
                                Get insights on reading habits, top artists, and audio features.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="playlist-details-container main-content-area">
                <button className="spotify-btn action-btn-outline back-btn" onClick={onBack}>
                    ← Back
                </button>

                <div className="details-header">
                    <div className="details-image-container">
                        {playlist.images && playlist.images.length > 0 ? (
                            <img
                                src={playlist.images[0].url}
                                alt={playlist.name}
                                className="details-image"
                            />
                        ) : (
                            <div className="playlist-image-placeholder"></div>
                        )}
                    </div>
                    <div className="details-info">
                        <span className="details-type">Playlist</span>
                        <h1 className="details-title">{playlist.name}</h1>
                        <p className="details-desc">{playlist.description}</p>
                        <div className="details-meta">
                            <span className="details-owner">{playlist.owner.display_name}</span>
                            <span className="dot">•</span>
                            <span className="details-count">{playlist.tracks.total} songs</span>
                            <span className={`privacy-badge ${playlist.public ? 'public' : 'private'}`}>
                                {playlist.public ? 'Public' : 'Private'}
                            </span>
                        </div>
                        {isFetching && (
                            <div className="loading-bar-container">
                                <div className="loading-bar-progress"></div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="track-list-container">
                    <table className="track-table">
                        <thead>
                            <tr>
                                {visibleColumns.index && <th>#</th>}
                                <th>Title</th>
                                {visibleColumns.album && <th>Album</th>}
                                {visibleColumns.dateAdded && <th>Date Added</th>}
                                {visibleColumns.released && <th>Released</th>}
                                {visibleColumns.popularity && <th>Pop.</th>}
                                {visibleColumns.duration && <th>Duration</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {tracks.length === 0 && playlist.tracks.total > 0 ? (
                                // Skeleton Loading Rows
                                Array.from({ length: 15 }).map((_, i) => (
                                    <tr key={`skeleton-${i}`} className="track-row skeleton-row">
                                        {visibleColumns.index && (
                                            <td className="track-index">
                                                <div className="skeleton-box" style={{ width: '20px', height: '14px' }}></div>
                                            </td>
                                        )}
                                        <td className="track-main">
                                            <div className="track-info-cell">
                                                <div className="skeleton-box skeleton-thumb"></div>
                                                <div className="track-text" style={{ width: '100%' }}>
                                                    <div className="skeleton-box skeleton-text"></div>
                                                    <div className="skeleton-box skeleton-text short"></div>
                                                </div>
                                            </div>
                                        </td>
                                        {visibleColumns.album && (
                                            <td className="track-album">
                                                <div className="skeleton-box skeleton-text"></div>
                                            </td>
                                        )}
                                        {visibleColumns.dateAdded && <td className="track-date"><div className="skeleton-box skeleton-text short"></div></td>}
                                        {visibleColumns.released && <td className="track-released"><div className="skeleton-box skeleton-text short"></div></td>}
                                        {visibleColumns.popularity && <td className="track-pop"><div className="skeleton-box skeleton-text short"></div></td>}
                                        {visibleColumns.duration && (
                                            <td className="track-duration">
                                                <div className="skeleton-box skeleton-text short" style={{ width: '40px' }}></div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                tracks.map((item, index) => {
                                    if (!item || !item.track) return null; // Handle null items or tracks
                                    const track = item.track;
                                    // Ensure track has minimal required fields
                                    if (!track.id || !track.name || !track.album) return null;

                                    return (
                                        <tr key={`${track.id}-${index}`} className="track-row">
                                            {visibleColumns.index && (
                                                <td className="track-index">
                                                    {index + 1}
                                                </td>
                                            )}
                                            <td className="track-main">
                                                <div className="track-info-cell">
                                                    {visibleColumns.art && track.album.images && track.album.images.length > 0 && (
                                                        <img
                                                            src={track.album.images[track.album.images.length - 1].url}
                                                            alt={track.album.name}
                                                            className="track-thumb"
                                                            loading="lazy"
                                                        />
                                                    )}
                                                    <div className="track-text">
                                                        <span className="track-name">{track.name}</span>
                                                        <span className="track-artist">
                                                            {track.artists.map(a => a.name).join(', ')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>
                                            {visibleColumns.album && (
                                                <td className="track-album">{track.album.name}</td>
                                            )}
                                            {visibleColumns.dateAdded && (
                                                <td className="track-date">{formatDate(item.added_at)}</td>
                                            )}
                                            {visibleColumns.released && (
                                                <td className="track-released">{formatDate(track.album.release_date).split('/')[2]}</td>
                                            )}
                                            {visibleColumns.popularity && (
                                                <td className="track-pop">
                                                    <div className="popularity-bar" title={`${track.popularity}%`}>
                                                        <div className="popularity-fill" style={{ width: `${track.popularity}%` }}></div>
                                                    </div>
                                                </td>
                                            )}
                                            {visibleColumns.duration && (
                                                <td className="track-duration">{formatDuration(track.duration_ms)}</td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {isFetching && (
                    <div className="scroll-loading-indicator">
                        <div className="spinner-small"></div>
                        <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading more songs...</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaylistDetailsPage;
