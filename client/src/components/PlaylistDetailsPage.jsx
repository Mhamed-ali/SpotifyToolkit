import React, { useState } from 'react';
import '../App.css';
import AnalysisModal from './AnalysisModal';
import TrackTable from './TrackTable';
import VibeAnalysis from './VibeAnalysis';
import ArtistAnalysis from './ArtistAnalysis';
import { analyzeVibe } from '../services/analysis.utils';

const PlaylistDetailsPage = ({ playlist, tracks, onBack, isFetching, token }) => {
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
    const [analysisSettings, setAnalysisSettings] = useState({});
    const [analysisProgress, setAnalysisProgress] = useState(null); // { current, total, message }
    const [analysisResult, setAnalysisResult] = useState(null);
    const [analysisError, setAnalysisError] = useState(null);

    const handleAnalysisSelect = async (selectionConfig) => {
        setShowAnalysisModal(false);
        const selectedModules = Object.keys(selectionConfig);

        // Reset previous states
        setAnalysisResult(null);
        setAnalysisError(null);
        setAnalysisSettings({});

        if (selectedModules.includes('vibe')) {
            // Start Vibe Analysis
            setAnalysisProgress({ current: 0, total: 100, message: 'Starting analysis...' });

            try {
                const result = await analyzeVibe(token, tracks, (current, total, message) => {
                    setAnalysisProgress({ current, total, message });
                });

                // Done
                setAnalysisResult(result);
                setActiveAnalysis('vibe');
                setAnalysisProgress(null);
            } catch (err) {
                console.error("Analysis failed", err);
                setAnalysisError(err.message || "Failed to analyze playlist.");
                setAnalysisProgress(null);
            }
        }
        else if (selectedModules.includes('artists')) {
            // Start Artist Analysis (Instant, no API calls needed)
            setActiveAnalysis('artists');
            setAnalysisSettings(selectionConfig['artists'] || []);
        }
        else {
            alert(`Analysis module not implemented yet: ${selectedModules.join(', ')}`);
        }
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

                {activeAnalysis === 'vibe' ? (
                    analysisResult ? (
                        <VibeAnalysis
                            stats={analysisResult.stats}
                            warning={analysisResult.warning}
                            trackCount={tracks.length}
                            onBack={() => setActiveAnalysis(null)}
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
                        onBack={() => setActiveAnalysis(null)}
                    />
                ) : (
                    <>
                        <div className="track-list-container">
                            <TrackTable
                                tracks={tracks}
                                playlist={playlist}
                                visibleColumns={visibleColumns}
                                formatDate={formatDate}
                                formatDuration={formatDuration}
                            />
                        </div>
                        {isFetching && (
                            <div className="scroll-loading-indicator">
                                <div className="spinner-small"></div>
                                <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading more songs...</span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PlaylistDetailsPage;
