import React, { useState } from 'react';
import '../App.css';
import ExportOptionsModal from './ExportOptionsModal';
import AnalysisModal from './AnalysisModal';
import TrackTable from './TrackTable';
import VibeAnalysis from './VibeAnalysis';
import ArtistAnalysis from './ArtistAnalysis';
import TimelineAnalysis from './TimelineAnalysis';
import PlaylistStats from './PlaylistStats';
import DeepAnalysis from './DeepAnalysis';
import PlaylistAccordion from './common/PlaylistAccordion';
import { analyzeVibe } from '../services/analysis.utils';
import { ExcelExporter, EXPORT_FIELDS } from '../services/ExcelExporter';
import { PlaylistModel } from '../models/Playlist';
import { ANALYSIS_MODULE_MAP } from '../config/analysisRegistry';
import { formatDuration, formatDate } from '../utils/formatters';
import { getMusicProvider } from '../providers/ProviderFactory';
import { createClientLogger } from '../utils/logger';

const logger = createClientLogger('PlaylistDetails');

const PlaylistDetailsPage = ({
    playlist,
    tracks,
    onBack,
    onHome,
    isFetching,
    token,
    currentUserId,
    providerId = 'spotify'
}) => {
    const provider = getMusicProvider(providerId);

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
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportProgress, setExportProgress] = useState(null);

    const [activeAnalysis, setActiveAnalysis] = useState(null);
    const [activeModules, setActiveModules] = useState([]);
    const [analysisSettings, setAnalysisSettings] = useState({});
    const [analysisProgress, setAnalysisProgress] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [analysisError, setAnalysisError] = useState(null);

    const handleAnalysisSelect = async (selectionConfig) => {
        setShowAnalysisModal(false);
        const selectedModules = Object.keys(selectionConfig);

        setActiveModules(selectedModules);
        setAnalysisResult(null);
        setAnalysisError(null);
        setAnalysisSettings({});

        let nextActive = selectedModules[0];

        if (selectedModules.includes('vibe')) {
            nextActive = 'vibe';
            setAnalysisProgress({ current: 0, total: 100, message: 'Starting analysis...' });

            try {
                const result = await analyzeVibe(token, tracks, (current, total, message) => {
                    setAnalysisProgress({ current, total, message });
                });
                setAnalysisResult(result);
                setAnalysisProgress(null);
            } catch (err) {
                logger.error('Analysis failed', err);
                setAnalysisError(err.message || 'Failed to analyze playlist.');
                setAnalysisProgress(null);
            }
        }

        if (selectedModules.includes('artists')) {
            setAnalysisSettings(selectionConfig['artists'] || []);
        }

        if (selectedModules.includes('cleaner')) {
            const subOpts = selectionConfig['cleaner'] || [];
            const initialTab = subOpts.includes('advanced_filter') ? 'advanced_filter' : 'duplicates';
            setAnalysisSettings(prev => ({ ...prev, initialTab }));
            if (!nextActive || nextActive === 'cleaner') {
                nextActive = 'cleaner';
            }
        }

        setActiveAnalysis(nextActive);
    };

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const exitAnalysis = () => {
        setActiveAnalysis(null);
        setActiveModules([]);
    };

    const executeExport = async (selectedFieldKeys) => {
        if (!tracks || tracks.length === 0) return;

        let finalTracks = tracks;

        if (selectedFieldKeys.includes('available_in_playlists')) {
            setShowExportModal(false);
            setExportProgress('Initializing global library scan...');

            try {
                const globalMap = await provider.buildGlobalTrackMap(token, currentUserId, (curr, total) => {
                    setExportProgress(`Scanning playlists: ${curr}/${total}...`);
                });

                finalTracks = tracks.map(item => {
                    if (!item.track || !item.track.uri) return item;
                    const playlists = globalMap[item.track.uri];
                    return playlists ? { ...item, sourcePlaylists: playlists } : item;
                });
            } catch (err) {
                logger.error('Global scan failed', err);
                alert('Global playlist scan failed. Exporting with current view only.');
            } finally {
                setExportProgress(null);
            }
        }

        const safeName = PlaylistModel.getSafeExportName(playlist);
        new ExcelExporter(finalTracks)
            .withFields(selectedFieldKeys)
            .withContextPlaylist(playlist)
            .withSheetName('Playlist Tracks')
            .download(`${safeName}_Export.xlsx`);
    };

    return (
        <div className="playlist-page-layout">
            <button
                className="sidebar-toggle-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="Customize View"
            >
                {isMenuOpen ? '×' : '⚙️'}
            </button>

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

            <div className="playlist-details-container main-content-area">
                {!activeAnalysis && (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <button className="spotify-btn action-btn-outline back-btn" onClick={onHome}>
                            🏠 Main Menu
                        </button>
                        <button className="spotify-btn action-btn-outline back-btn" onClick={onBack}>
                            ← Back
                        </button>
                    </div>
                )}

                {!activeAnalysis && (
                    <div className="details-header">
                        <div className="details-image-container">
                            {PlaylistModel.isLikedSongs(playlist) ? (
                                <div className="playlist-image-placeholder liked-songs-image">
                                    <span className="liked-heart">♥</span>
                                </div>
                            ) : playlist.images && playlist.images.length > 0 ? (
                                <img
                                    src={playlist.images[0].url}
                                    alt={playlist.name}
                                    className="details-image"
                                />
                            ) : (
                                <div className="playlist-image-placeholder">
                                    <span style={{ fontSize: '4rem' }}>🎵</span>
                                </div>
                            )}
                        </div>
                        <div className="details-info">
                            <span className="details-type">{provider.displayName} Playlist</span>
                            <h1 className="details-title">{playlist.name}</h1>
                            <p className="details-desc">{playlist.description}</p>
                            <div className="details-meta">
                                <span className="details-owner">{playlist.owner?.display_name || 'You'}</span>
                                <span className="dot">•</span>
                                <span className="details-count">{playlist.tracks?.total || tracks.length} songs</span>
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

                        <div className="header-actions-area">
                            <button
                                className="spotify-btn header-secondary-btn"
                                onClick={() => setShowExportModal(true)}
                            >
                                📥 Export Excel
                            </button>
                            <button
                                className="spotify-btn header-secondary-btn"
                                onClick={() => {
                                    setShowAnalysisModal(false);
                                    setActiveModules(['cleaner']);
                                    setAnalysisSettings({ initialTab: 'duplicates' });
                                    setActiveAnalysis('cleaner');
                                }}
                                disabled={Boolean(analysisProgress)}
                            >
                                🧹 Deep Analysis
                            </button>
                            <button
                                className="spotify-btn header-analyze-btn"
                                onClick={() => setShowAnalysisModal(true)}
                                disabled={Boolean(analysisProgress)}
                            >
                                {analysisProgress ? 'Analyzing...' : '📊 Analyze Playlist'}
                            </button>
                        </div>
                    </div>
                )}

                <ExportOptionsModal
                    isOpen={showExportModal}
                    onClose={() => setShowExportModal(false)}
                    onConfirm={executeExport}
                    availableFields={EXPORT_FIELDS}
                />

                <AnalysisModal
                    isOpen={showAnalysisModal}
                    onClose={() => setShowAnalysisModal(false)}
                    onRun={handleAnalysisSelect}
                />

                {exportProgress && (
                    <div className="modal-overlay">
                        <div className="glass-card" style={{ padding: '2rem' }}>
                            <div className="spinner-small" style={{ margin: '0 auto 1rem auto', width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent)' }}></div>
                            <h3>Exporting...</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>{exportProgress}</p>
                            <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Checking all your playlists for matches.</p>
                        </div>
                    </div>
                )}

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

                        {activeModules.map(moduleKey => (
                            <button
                                key={moduleKey}
                                className={`spotify-btn ${activeAnalysis === moduleKey ? '' : 'action-btn-outline'}`}
                                style={{
                                    padding: '6px 16px', fontSize: '0.9rem',
                                    background: activeAnalysis === moduleKey ? 'var(--accent)' : 'transparent',
                                    color: activeAnalysis === moduleKey ? '#000' : '#fff',
                                    border: activeAnalysis === moduleKey ? 'none' : '1px solid transparent'
                                }}
                                onClick={() => setActiveAnalysis(moduleKey)}
                            >
                                {ANALYSIS_MODULE_MAP[moduleKey]?.tabLabel || moduleKey}
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
                        providerId={providerId}
                    />
                ) : (
                    <>
                        {PlaylistModel.isCombined(playlist) ? (
                            <div className="combined-playlists-view">
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
                        {isFetching && !PlaylistModel.isCombined(playlist) && (
                            <div className="scroll-loading-indicator">
                                <div className="spinner-small"></div>
                                <span style={{ marginLeft: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    Loading more songs...
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PlaylistDetailsPage;
