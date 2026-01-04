import React, { useState } from 'react';
import '../App.css';
import AnalysisModal from './AnalysisModal';
import TrackTable from './TrackTable';
import VibeAnalysis from './VibeAnalysis';
import ArtistAnalysis from './ArtistAnalysis';
import TimelineAnalysis from './TimelineAnalysis';
import PlaylistStats from './PlaylistStats';
import DeepAnalysis from './DeepAnalysis';
import { analyzeVibe } from '../services/analysis.utils';

const PlaylistAccordion = ({ title, tracks, playlist, visibleColumns, formatDate, formatDuration }) => {
    const [isOpen, setIsOpen] = React.useState(true);

    return (
        <div className="playlist-accordion" style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', overflow: 'hidden' }}>
            <div
                className="accordion-header"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderBottom: isOpen ? '1px solid rgba(255,255,255,0.1)' : 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ transform: `rotate(${isOpen ? 90 : 0}deg)`, transition: 'transform 0.2s' }}>▶</span>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>({tracks.length})</span>
                </div>
            </div>

            {isOpen && (
                <div className="accordion-content">
                    <TrackTable
                        tracks={tracks}
                        playlist={playlist}
                        visibleColumns={visibleColumns}
                        formatDate={formatDate}
                        formatDuration={formatDuration}
                    />
                </div>
            )}
        </div>
    );
};

const PlaylistDetailsPage = ({ playlist, tracks, onBack, isFetching, token, currentUserId }) => {
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
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);

    // Analysis State
    const [activeAnalysis, setActiveAnalysis] = useState(null); // 'vibe', 'timeline', 'artists', 'stats'
    const [activeModules, setActiveModules] = useState([]); // List of currently active modules ['vibe', 'stats']
    const [analysisSettings, setAnalysisSettings] = useState({});
    const [analysisProgress, setAnalysisProgress] = useState(null); // { current, total, message }
    const [analysisResult, setAnalysisResult] = useState(null);
    const [analysisError, setAnalysisError] = useState(null);

    const handleAnalysisSelect = async (selectionConfig) => {
        setShowAnalysisModal(false);
        const selectedModules = Object.keys(selectionConfig);

        // Save all selected modules
        setActiveModules(selectedModules);

        // Reset previous states
        setAnalysisResult(null);
        setAnalysisError(null);
        setAnalysisSettings({});

        // Default to first selected module
        let nextActive = selectedModules[0];

        // Specific handling if Vibe is included (needs async)
        if (selectedModules.includes('vibe')) {
            // If vibe is present, prioritize showing it or at least start it
            nextActive = 'vibe';

            // Start Vibe Analysis
            setAnalysisProgress({ current: 0, total: 100, message: 'Starting analysis...' });

            try {
                const result = await analyzeVibe(token, tracks, (current, total, message) => {
                    setAnalysisProgress({ current, total, message });
                });

                // Done
                setAnalysisResult(result);
                // Don't force set active here if user switched tabs, but initial load sets it
                setAnalysisProgress(null);
            } catch (err) {
                console.error("Analysis failed", err);
                setAnalysisError(err.message || "Failed to analyze playlist.");
                setAnalysisProgress(null);
            }
        }

        // Handle settings for artists if present
        if (selectedModules.includes('artists')) {
            setAnalysisSettings(selectionConfig['artists'] || []);
        }

        if (selectedModules.includes('cleaner')) {
            const subOpts = selectionConfig['cleaner'] || [];
            if (subOpts.includes('advanced_filter')) {
                setAnalysisSettings(prev => ({ ...prev, initialTab: 'advanced_filter' }));
            } else {
                setAnalysisSettings(prev => ({ ...prev, initialTab: 'duplicates' }));
            }
            // Prioritize cleaner if it's the only one or explicitly selected?
            // If activeAnalysis is not set yet (by vibe), set it.
            if (!nextActive || nextActive === 'cleaner') {
                nextActive = 'cleaner';
            }
        }

        setActiveAnalysis(nextActive);
    };

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

    const handleBack = () => {
        setActiveAnalysis(null);
        setActiveModules([]);
        setAnalysisResult(null);
        onBack(); // Calls parent back if needed, but here we just reset analysis mode usually
        // Actually onBack usually goes back to Playlist List. 
        // If we are in analysis mode, we want to go back to Track List first.
    };

    const exitAnalysis = () => {
        setActiveAnalysis(null);
        setActiveModules([]);
    }

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
                    <span className="sidebar-tab active" style={{ cursor: 'default' }}>
                        View Options
                    </span>
                    <button
                        className="sidebar-tab"
                        onClick={() => setIsMenuOpen(false)}
                        style={{ flex: '0 0 auto', marginLeft: 'auto', color: '#ff6b6b' }}
                        title="Close Sidebar"
                    >
                        ×
                    </button>
                </div>

                <div className="sidebar-content-wrapper">
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
                </div>
            </div>

            {/* Main Content Area */}
            <div className="playlist-details-container main-content-area">
                {!activeAnalysis && (
                    <button className="spotify-btn action-btn-outline back-btn" onClick={onBack}>
                        ← Back
                    </button>
                )}

                {!activeAnalysis && (
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
                        {/* Header Action Buttons */}
                        <div className="header-actions-area">
                            <button
                                className="spotify-btn header-analyze-btn"
                                onClick={() => {
                                    // Direct Deep Analysis
                                    setShowAnalysisModal(false);
                                    setActiveModules(['cleaner']);
                                    setAnalysisSettings({ initialTab: 'duplicates' });
                                    setActiveAnalysis('cleaner');
                                }}
                                disabled={!!analysisProgress}
                                style={{ marginRight: '1rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                            >
                                🧹 Deep Analysis
                            </button>
                            <button className="spotify-btn header-analyze-btn" onClick={() => setShowAnalysisModal(true)} disabled={!!analysisProgress}>
                                {analysisProgress ? 'Analyzing...' : '📊 Analyze Playlist'}
                            </button>
                        </div>
                    </div>
                )}

                <AnalysisModal
                    isOpen={showAnalysisModal}
                    onClose={() => setShowAnalysisModal(false)}
                    onRun={handleAnalysisSelect}
                />

                {/* Progress Overlay */}
                {analysisProgress && (
                    <div className="analysis-progress-overlay glass-card" style={{
                        position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000,
                        padding: '1.5rem', width: '300px', animation: 'slideUp 0.3s ease-out'
                    }}>
                        <h4 style={{ margin: '0 0 0.5rem 0' }}>Analyzing Playlist...</h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{analysisProgress.message}</p>
                        <div className="progress-bar-bg" style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                            <div className="progress-bar-fill" style={{
                                width: `${(analysisProgress.current / analysisProgress.total) * 100}%`,
                                height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease'
                            }}></div>
                        </div>
                    </div>
                )}

                {analysisError && (
                    <div className="status-box error" style={{ margin: '1rem 0' }}>{analysisError}</div>
                )}

                {/* Analysis Tab Bar */}
                {activeModules.length > 0 && (
                    <div className="analysis-tab-bar" style={{
                        display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap',
                        background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '8px'
                    }}>
                        <button
                            className="spotify-btn action-btn-outline"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', border: 'none' }}
                            onClick={exitAnalysis}
                        >
                            ← Back
                        </button>
                        <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)', margin: '0 0.5rem' }}></div>

                        {activeModules.map(module => (
                            <button
                                key={module}
                                className={`spotify-btn ${activeAnalysis === module ? '' : 'action-btn-outline'}`}
                                style={{
                                    padding: '6px 16px', fontSize: '0.9rem',
                                    background: activeAnalysis === module ? 'var(--accent)' : 'transparent',
                                    color: activeAnalysis === module ? '#000' : '#fff',
                                    border: activeAnalysis === module ? 'none' : '1px solid transparent'
                                }}
                                onClick={() => setActiveAnalysis(module)}
                            >
                                {module === 'vibe' && 'Vibe Check'}
                                {module === 'artists' && 'Artist Breakdown'}
                                {module === 'timeline' && 'Timeline'}
                                {module === 'stats' && 'Playlist Stats'}
                                {module === 'cleaner' && 'Deep Analysis'}
                            </button>
                        ))}
                    </div>
                )}

                {activeAnalysis === 'vibe' ? (
                    analysisResult ? (
                        <VibeAnalysis
                            stats={analysisResult.stats}
                            warning={analysisResult.warning}
                            trackCount={tracks.length}
                            onBack={exitAnalysis}
                        />
                    ) : (
                        <div className="flex-center" style={{ height: '50vh' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Preparing results...</span>
                        </div>
                    )
                ) : activeAnalysis === 'artists' ? (
                    <ArtistAnalysis
                        tracks={tracks}
                        settings={analysisSettings}
                        onBack={exitAnalysis}
                    />
                ) : activeAnalysis === 'timeline' ? (
                    <TimelineAnalysis
                        tracks={tracks}
                        onBack={exitAnalysis}
                    />
                ) : activeAnalysis === 'stats' ? (
                    <PlaylistStats
                        tracks={tracks}
                        onBack={exitAnalysis}
                    />
                ) : activeAnalysis === 'cleaner' ? (
                    <DeepAnalysis
                        tracks={tracks}
                        playlist={playlist}
                        token={token}
                        initialTab={analysisSettings.initialTab || 'duplicates'}
                        onBack={() => {
                            setActiveAnalysis(null);
                            setAnalysisResult(null);
                        }}
                        isLoading={isFetching}
                        currentUserId={currentUserId}
                    />
                ) : (
                    <>

                        {playlist.id === 'COMBINED_ANALYSIS' ? (
                            <div className="combined-playlists-view">
                                <div className="combined-controls" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                    <button
                                        className="spotify-btn action-btn-outline"
                                        onClick={() => {
                                            // Toggle all logic could go here, for now just a helper
                                            // We'll implement individual toggles first
                                            const allGroups = Object.values(
                                                tracks.reduce((acc, t) => {
                                                    const id = t.sourcePlaylist?.id || 'unknown';
                                                    if (!acc[id]) acc[id] = true;
                                                    return acc;
                                                }, {})
                                            );
                                            // Implementation detail: we need state for this. 
                                            // Let's rely on the internal state of the map below or lift it.
                                            // Easier to just inline the map and use a simple local state for the list? 
                                            // Actually, simplest is to make a small component for each group that manages its own state.
                                        }}
                                        style={{ fontSize: '0.8rem', padding: '4px 8px', display: 'none' }} // Hidden for now, self-managing
                                    >
                                        Toggle All
                                    </button>
                                </div>

                                {Object.values(tracks.reduce((groups, track) => {
                                    const source = track.sourcePlaylist || { id: 'unknown', name: 'Unknown Source' };
                                    if (!groups[source.id]) {
                                        groups[source.id] = {
                                            info: source,
                                            tracks: []
                                        };
                                    }
                                    groups[source.id].tracks.push(track);
                                    return groups;
                                }, {})).map(group => (
                                    <PlaylistAccordion
                                        key={group.info.id}
                                        title={group.info.name}
                                        tracks={group.tracks}
                                        playlist={playlist}
                                        visibleColumns={visibleColumns}
                                        formatDate={formatDate}
                                        formatDuration={formatDuration}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="track-list-container">
                                <TrackTable
                                    tracks={tracks}
                                    playlist={playlist}
                                    visibleColumns={visibleColumns}
                                    formatDate={formatDate}
                                    formatDuration={formatDuration}
                                />
                            </div>
                        )}
                        {/* Scroll Loading Indicator for flat lists (or combined if we want infinite scroll there too, but combined is usually fully fetched) */}
                        {isFetching && playlist.id !== 'COMBINED_ANALYSIS' && (
                            <div className="scroll-loading-indicator">
                                <div className="spinner-small"></div>
                                <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading more songs...</span>
                            </div>
                        )}

                    </>
                )}
            </div>
        </div >
    );
};

export default PlaylistDetailsPage;
