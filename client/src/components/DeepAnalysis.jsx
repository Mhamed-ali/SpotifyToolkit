import React, { useMemo, useState, useEffect } from 'react';
import '../App.css';
import MultiSelect from './common/MultiSelect';
import { DuplicateDetector } from '../services/DuplicateDetector';
import { TrackFilterEngine } from '../services/filters/TrackSpecifications';
import { ExcelExporter } from '../services/ExcelExporter';
import { PlaylistModel } from '../models/Playlist';
import { formatDurationMinutes, extractReleaseYear } from '../utils/formatters';
import { getMusicProvider } from '../providers/ProviderFactory';
import { createClientLogger } from '../utils/logger';

const logger = createClientLogger('DeepAnalysis');

const ERA_PRESETS = [
    { label: 'Recent Bangers', years: ['2023', '2024', '2025', '2026'] },
    { label: '2020s Era', years: ['2020', '2021', '2022', '2023', '2024', '2025', '2026'] },
    { label: 'Standard 2010s', years: Array.from({ length: 10 }, (_, i) => String(2010 + i)) },
    { label: '90s Throwback', years: Array.from({ length: 10 }, (_, i) => String(1990 + i)) }
];

const DeepAnalysis = ({
    tracks,
    playlist,
    token,
    onBack,
    initialTab = 'duplicates',
    isLoading = false,
    currentUserId,
    providerId = 'spotify'
}) => {
    const provider = getMusicProvider(providerId);
    const supportsWrite = provider.supportsWrite;
    const isCombined = PlaylistModel.isCombined(playlist);

    const [analysisScope, setAnalysisScope] = useState('playlist'); // 'playlist' | 'overall'
    const [activeTab, setActiveTab] = useState(initialTab); // 'duplicates' | 'advanced_filter'
    const [matchDuration, setMatchDuration] = useState(false);

    // Duplicates State (stores composite keys `${playlistId}::${uri}` to avoid cross-playlist deletion bugs)
    const [duplicates, setDuplicates] = useState([]);
    const [selectedDuplicates, setSelectedDuplicates] = useState(new Set());

    // Advanced Filter State
    const [filterCriteria, setFilterCriteria] = useState({
        primaryArtists: [],
        collabArtists: [],
        years: [],
        arabicOnly: false
    });
    const [filterLogic, setFilterLogic] = useState('AND'); // 'AND' | 'OR'
    const [filteredTracks, setFilteredTracks] = useState([]);
    const [selectedFiltered, setSelectedFiltered] = useState(new Set());
    const [filterViewMode, setFilterViewMode] = useState('unified'); // 'unified' | 'per_playlist'

    // Processing State
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    // --- 1. Duplicate Detection via DuplicateDetector Service ---
    useEffect(() => {
        if (!tracks || tracks.length === 0) {
            setDuplicates([]);
            setSelectedDuplicates(new Set());
            return;
        }

        const foundGroups = DuplicateDetector.findDuplicates(tracks, {
            isCombined,
            scope: analysisScope,
            matchDuration
        });

        setDuplicates(foundGroups);
        setSelectedDuplicates(new Set());
    }, [tracks, matchDuration, analysisScope, isCombined]);

    // --- 2. Track Filtering via Specification Pattern Engine ---
    useEffect(() => {
        const results = TrackFilterEngine.filterTracks(tracks, filterCriteria, filterLogic);
        setFilteredTracks(results);
        setSelectedFiltered(new Set());
    }, [filterCriteria, tracks, filterLogic]);

    const allArtists = useMemo(() => {
        const artists = new Set();
        tracks.forEach(item => {
            item.track?.artists?.forEach(a => artists.add(a.name));
        });
        return Array.from(artists).sort();
    }, [tracks]);

    const allYears = useMemo(() => {
        const years = new Set();
        tracks.forEach(item => {
            const y = extractReleaseYear(item.track?.album?.release_date);
            if (y) years.add(y);
        });
        return Array.from(years).sort().reverse();
    }, [tracks]);

    const duplicateUris = useMemo(() => {
        const uris = new Set();
        duplicates.forEach(group => {
            group.forEach(item => uris.add(item.track.uri));
        });
        return uris;
    }, [duplicates]);

    // --- Selection Helpers (Composite Key Safe) ---
    const getItemKey = (item) => DuplicateDetector.getSelectionKey(item, playlist.id);

    const toggleDuplicateSelection = (selectionKey) => {
        const next = new Set(selectedDuplicates);
        if (next.has(selectionKey)) next.delete(selectionKey);
        else next.add(selectionKey);
        setSelectedDuplicates(next);
    };

    const selectAllDuplicates = () => {
        const allExtraKeys = new Set();
        duplicates.forEach(group => {
            for (let i = 1; i < group.length; i++) {
                allExtraKeys.add(getItemKey(group[i]));
            }
        });

        const isAllSelected = Array.from(allExtraKeys).every(k => selectedDuplicates.has(k)) &&
            selectedDuplicates.size === allExtraKeys.size;

        setSelectedDuplicates(isAllSelected ? new Set() : allExtraKeys);
    };

    const allExtrasCount = duplicates.reduce((acc, group) => acc + (group.length - 1), 0);
    const isAllExtrasSelected = selectedDuplicates.size === allExtrasCount && allExtrasCount > 0;

    const toggleFilteredSelection = (selectionKey) => {
        const next = new Set(selectedFiltered);
        if (next.has(selectionKey)) next.delete(selectionKey);
        else next.add(selectionKey);
        setSelectedFiltered(next);
    };

    const selectAllFiltered = () => {
        if (selectedFiltered.size === filteredTracks.length) {
            setSelectedFiltered(new Set());
        } else {
            setSelectedFiltered(new Set(filteredTracks.map(item => getItemKey(item))));
        }
    };

    // --- Mutation Actions ---
    const handleRemove = async (selectedKeysSet) => {
        if (!supportsWrite || selectedKeysSet.size === 0) return;

        const count = selectedKeysSet.size;
        if (!window.confirm(`Are you sure you want to remove ${count} tracks? This cannot be undone.`)) {
            return;
        }

        setIsProcessing(true);
        setStatusMessage('Analyzing permissions...');

        try {
            const tracksByPlaylist = {};
            const skippedPlaylists = new Set();
            let editableCount = 0;

            const searchList = activeTab === 'advanced_filter'
                ? filteredTracks
                : duplicates.flat();

            searchList.forEach(item => {
                const itemKey = getItemKey(item);
                if (selectedKeysSet.has(itemKey)) {
                    const source = item.sourcePlaylist || playlist;

                    if (PlaylistModel.canEdit(source, currentUserId, supportsWrite)) {
                        if (!tracksByPlaylist[source.id]) {
                            tracksByPlaylist[source.id] = {
                                source,
                                uris: new Set(),
                                keys: new Set()
                            };
                        }
                        if (!tracksByPlaylist[source.id].uris.has(item.track.uri)) {
                            tracksByPlaylist[source.id].uris.add(item.track.uri);
                            tracksByPlaylist[source.id].keys.add(itemKey);
                            editableCount++;
                        }
                    } else {
                        skippedPlaylists.add(source.name);
                    }
                }
            });

            if (Object.keys(tracksByPlaylist).length === 0 && skippedPlaylists.size > 0) {
                alert(`Cannot remove tracks: You do not have permission to edit: ${Array.from(skippedPlaylists).join(', ')}`);
                setIsProcessing(false);
                return;
            }

            if (skippedPlaylists.size > 0) {
                const proceed = window.confirm(
                    `Some tracks cannot be removed because you don't own the playlists:\n` +
                    `${Array.from(skippedPlaylists).join(', ')}\n\n` +
                    `Proceed with removing the remaining ${editableCount} tracks?`
                );
                if (!proceed) {
                    setIsProcessing(false);
                    return;
                }
            }

            setStatusMessage(`Removing ${editableCount} tracks...`);

            await Promise.all(
                Object.values(tracksByPlaylist).map(({ source, uris }) =>
                    provider.removeTracksFromPlaylist(token, source.id, Array.from(uris))
                )
            );

            const removedKeys = new Set();
            Object.values(tracksByPlaylist).forEach(g => g.keys.forEach(k => removedKeys.add(k)));

            if (activeTab === 'duplicates') {
                setDuplicates(prev =>
                    prev
                        .map(group => group.filter(item => !removedKeys.has(getItemKey(item))))
                        .filter(group => group.length > 1)
                );
                setSelectedDuplicates(prev => {
                    const next = new Set(prev);
                    removedKeys.forEach(k => next.delete(k));
                    return next;
                });
            } else {
                setFilteredTracks(prev => prev.filter(item => !removedKeys.has(getItemKey(item))));
                setSelectedFiltered(prev => {
                    const next = new Set(prev);
                    removedKeys.forEach(k => next.delete(k));
                    return next;
                });
            }

            setStatusMessage('Done!');
            setTimeout(() => setIsProcessing(false), 1000);
        } catch (err) {
            logger.error('Removal failed', err);
            alert('Failed to remove some tracks: ' + (err.message || 'Unknown error'));
            setIsProcessing(false);
        }
    };

    const handleCreatePlaylist = async (selectedKeysSet) => {
        if (!supportsWrite || selectedKeysSet.size === 0) return;

        const uniqueUris = Array.from(
            new Set(Array.from(selectedKeysSet).map(DuplicateDetector.extractUriFromKey).filter(Boolean))
        );

        const name = prompt(`Enter a name for your new playlist (${uniqueUris.length} tracks):`);
        if (!name) return;

        setIsProcessing(true);
        setStatusMessage('Creating playlist...');

        try {
            const description = `Autogenerated by Spotify Toolkit. Contains ${uniqueUris.length} tracks from analysis.`;
            const newPlaylist = await provider.createPlaylist(token, currentUserId, name, description, false);

            setStatusMessage(`Adding ${uniqueUris.length} tracks...`);
            await provider.addTracksToPlaylist(token, newPlaylist.id, uniqueUris);

            setStatusMessage('Done! Playlist Created.');
            setTimeout(() => {
                setIsProcessing(false);
                setStatusMessage('');
            }, 2000);
        } catch (err) {
            logger.error('Playlist creation failed', err);
            alert('Failed to create playlist: ' + (err.message || 'Unknown error'));
            setIsProcessing(false);
        }
    };

    return (
        <div className="analysis-container" style={{ padding: '2rem', animation: 'fadeIn 0.3s ease-out', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            {/* Header */}
            <div className="analysis-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', marginRight: '0.5rem' }}>←</button>
                <div style={{ flex: 1 }}>
                    <h2 className="title-gradient" style={{ margin: 0 }}>Deep Analysis</h2>
                    <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Manager & Cleaner Tool {!supportsWrite && `(${provider.displayName} Read-Only Mode — Export to Excel Supported)`}
                    </p>
                </div>

                {isCombined && activeTab === 'duplicates' && (
                    <div style={{
                        display: 'flex', alignItems: 'center',
                        background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px'
                    }}>
                        <button
                            onClick={() => setAnalysisScope('playlist')}
                            style={{
                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                background: analysisScope === 'playlist' ? 'var(--accent)' : 'transparent',
                                color: analysisScope === 'playlist' ? '#000' : 'var(--text-secondary)',
                                fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer'
                            }}
                        >
                            Per Playlist
                        </button>
                        <button
                            onClick={() => setAnalysisScope('overall')}
                            style={{
                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                background: analysisScope === 'overall' ? 'var(--accent)' : 'transparent',
                                color: analysisScope === 'overall' ? '#000' : 'var(--text-secondary)',
                                fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer'
                            }}
                        >
                            Overall
                        </button>
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '4px',
                    borderRadius: '12px'
                }}>
                    <button
                        onClick={() => setActiveTab('duplicates')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: activeTab === 'duplicates' ? 'var(--accent)' : 'transparent',
                            color: activeTab === 'duplicates' ? '#000' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Duplicates
                    </button>
                    <button
                        onClick={() => setActiveTab('advanced_filter')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: activeTab === 'advanced_filter' ? 'var(--accent)' : 'transparent',
                            color: activeTab === 'advanced_filter' ? '#000' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Advanced Filter
                    </button>
                </div>
            </div>

            {isProcessing && (
                <div className="status-box success" style={{ marginBottom: '1rem', textAlign: 'center' }}>
                    {statusMessage}
                </div>
            )}

            {/* TAB 1: DUPLICATES */}
            {activeTab === 'duplicates' && (
                <div className="max-w-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>
                                {analysisScope === 'playlist' && isCombined ? 'Per-Playlist Duplicates' : 'Duplicate Groups'}
                            </h3>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Found {duplicates.length} groups of potential duplicates
                            </span>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginTop: '0.5rem',
                                fontSize: '0.9rem',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={matchDuration}
                                    onChange={(e) => setMatchDuration(e.target.checked)}
                                    style={{ marginRight: '8px', accentColor: 'var(--accent)' }}
                                />
                                Match Duration (Exact play time)
                            </label>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                className="spotify-btn action-btn-outline"
                                onClick={() => ExcelExporter.exportQuickTrackList(duplicates.flat(), 'Duplicates_Export.xlsx')}
                                disabled={duplicates.length === 0}
                                style={{ borderColor: '#2e7d32', color: '#4caf50' }}
                            >
                                📥 Export
                            </button>
                            {supportsWrite && (
                                <>
                                    <button
                                        className="spotify-btn action-btn-outline"
                                        onClick={() => handleCreatePlaylist(selectedDuplicates)}
                                        disabled={selectedDuplicates.size === 0 || isProcessing}
                                        style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                                    >
                                        + New Playlist
                                    </button>
                                    <button className="spotify-btn action-btn-outline" onClick={selectAllDuplicates} disabled={duplicates.length === 0}>
                                        {isAllExtrasSelected ? 'Deselect All' : 'Select All'}
                                    </button>
                                    <button
                                        className="spotify-btn"
                                        style={{ background: '#ff5555', color: '#fff' }}
                                        onClick={() => handleRemove(selectedDuplicates)}
                                        disabled={selectedDuplicates.size === 0 || isProcessing}
                                    >
                                        Remove Selected ({selectedDuplicates.size})
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {duplicates.length === 0 ? (
                        (isLoading || (playlist.tracks?.total && tracks.length < playlist.tracks.total)) ? (
                            <div className="glass-card flex-center" style={{ padding: '4rem', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                                <div className="spinner-small" style={{ width: '40px', height: '40px', marginBottom: '1rem' }}></div>
                                <p>Analyzing playlist...</p>
                                <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
                                    Scanned {tracks.length} of {playlist.tracks?.total || '?'} tracks
                                </p>
                            </div>
                        ) : (
                            <div className="glass-card flex-center" style={{ padding: '4rem', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
                                <p>Your playlist is clean! No exact name+artist duplicates found.</p>
                            </div>
                        )
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {duplicates.map((group, i) => {
                                const groupPlaylistName = group[0].sourcePlaylist?.name;
                                return (
                                    <div key={i} className="glass-card" style={{ padding: 0, overflow: 'hidden', width: '100%', maxWidth: '800px', alignItems: 'stretch' }}>
                                        <div style={{
                                            padding: '1rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                                                <span style={{ fontWeight: 600, marginRight: '1rem' }}>{group[0].track.name}</span>
                                                {isCombined && (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '2px' }}>
                                                        {analysisScope === 'overall' ? 'Found across playlists' : groupPlaylistName}
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{group.length} copies</span>
                                        </div>
                                        <div>
                                            {group.map((item, idx) => {
                                                const itemKey = getItemKey(item);
                                                const isSelected = selectedDuplicates.has(itemKey);
                                                return (
                                                    <div
                                                        key={`${itemKey}-${idx}`}
                                                        onClick={() => toggleDuplicateSelection(itemKey)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', padding: '1rem',
                                                            borderBottom: idx < group.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                                            background: isSelected ? 'rgba(255, 85, 85, 0.15)' : 'transparent',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.2s',
                                                            width: '100%',
                                                            boxSizing: 'border-box',
                                                            textAlign: 'left'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '20px', height: '20px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.3)',
                                                            background: isSelected ? '#ff5555' : 'transparent', marginRight: '1rem',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                        }}>
                                                            {isSelected && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                                                        </div>

                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                            {item.track.album?.images?.[0]?.url ? (
                                                                <img src={item.track.album.images.at(-1).url} style={{ width: '40px', height: '40px', borderRadius: '4px' }} alt="" />
                                                            ) : (
                                                                <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <span style={{ fontSize: '10px' }}>🎵</span>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div style={{ fontSize: '0.95rem' }}>{item.track.name}</div>
                                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                                    {item.track.artists?.map(a => a.name).join(', ') || 'Unknown Artist'} • {item.track.album?.name || 'Unknown Album'}
                                                                    {isCombined && item.sourcePlaylist?.name ? ` • [${item.sourcePlaylist.name}]` : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
                                                            {formatDurationMinutes(item.track.duration_ms)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: ADVANCED FILTER */}
            {activeTab === 'advanced_filter' && (
                <div className="filter-split-layout">
                    {/* Left Column: Filters */}
                    <div className="glass-card filter-sidebar-card">
                        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Filter Options</h3>

                        <div style={{ marginBottom: '1.5rem', width: '100%' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Quick Filters
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {ERA_PRESETS.map((preset) => {
                                    const availablePresetYears = preset.years.filter(y => allYears.includes(y));
                                    const isActive = availablePresetYears.length > 0 &&
                                        availablePresetYears.length === filterCriteria.years.length &&
                                        availablePresetYears.every(y => filterCriteria.years.includes(y));

                                    return (
                                        <button
                                            key={preset.label}
                                            onClick={() => {
                                                setFilterCriteria(prev => ({
                                                    ...prev,
                                                    years: isActive ? [] : availablePresetYears
                                                }));
                                            }}
                                            style={{
                                                background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                                                color: isActive ? 'black' : 'var(--text-secondary)',
                                                border: isActive ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '4px',
                                                padding: '6px 10px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                transition: 'all 0.2s',
                                                fontWeight: isActive ? 600 : 400
                                            }}
                                        >
                                            {preset.label}
                                        </button>
                                    );
                                })}

                                <button
                                    onClick={() => setFilterCriteria(prev => ({ ...prev, arabicOnly: !prev.arabicOnly }))}
                                    style={{
                                        gridColumn: '1 / -1',
                                        background: filterCriteria.arabicOnly ? '#1db954' : 'rgba(255,255,255,0.05)',
                                        color: filterCriteria.arabicOnly ? 'black' : 'var(--text-secondary)',
                                        border: filterCriteria.arabicOnly ? '1px solid #1db954' : '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        padding: '8px',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        fontWeight: filterCriteria.arabicOnly ? 600 : 400
                                    }}
                                >
                                    <span>🌙</span> Arabic Songs Only
                                </button>

                                <button
                                    onClick={() => setFilterCriteria({ primaryArtists: [], collabArtists: [], years: [], arabicOnly: false })}
                                    style={{
                                        gridColumn: '1 / -1',
                                        background: 'transparent',
                                        color: '#ff5555',
                                        border: '1px dashed rgba(255, 85, 85, 0.3)',
                                        borderRadius: '4px',
                                        padding: '6px 10px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        marginTop: '4px'
                                    }}
                                >
                                    Clear Config
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem', width: '100%' }}>
                            <MultiSelect
                                label="Primary Artists"
                                options={allArtists}
                                selected={filterCriteria.primaryArtists}
                                onChange={(val) => setFilterCriteria({ ...filterCriteria, primaryArtists: val })}
                                placeholder="Any Artist"
                            />
                            <MultiSelect
                                label="Collaborators"
                                options={allArtists}
                                selected={filterCriteria.collabArtists}
                                onChange={(val) => setFilterCriteria({ ...filterCriteria, collabArtists: val })}
                                placeholder="Any Artist"
                            />
                            <MultiSelect
                                label="Release Years"
                                options={allYears}
                                selected={filterCriteria.years}
                                onChange={(val) => setFilterCriteria({ ...filterCriteria, years: val })}
                                placeholder="Any Year"
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', width: '100%' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: 'auto' }}>Match Mode:</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                {['AND', 'OR'].map(mode => (
                                    <button
                                        key={mode}
                                        onClick={() => setFilterLogic(mode)}
                                        style={{
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            border: '1px solid ' + (filterLogic === mode ? 'var(--accent)' : 'rgba(255,255,255,0.1)'),
                                            background: filterLogic === mode ? 'var(--accent)' : 'transparent',
                                            color: filterLogic === mode ? 'black' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                        }}
                                    >
                                        {mode === 'AND' ? 'ALL' : 'ANY'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Results */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Results ({filteredTracks.length})</h3>
                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <button
                                    className="spotify-btn action-btn-outline"
                                    onClick={() => ExcelExporter.exportQuickTrackList(filteredTracks, 'Filtered_Export.xlsx')}
                                    disabled={filteredTracks.length === 0}
                                    style={{ borderColor: '#2e7d32', color: '#4caf50', padding: '8px 16px', fontSize: '0.9rem' }}
                                >
                                    📥 Export
                                </button>
                                {supportsWrite && (
                                    <>
                                        <button
                                            className="spotify-btn action-btn-outline"
                                            onClick={() => handleCreatePlaylist(selectedFiltered)}
                                            disabled={selectedFiltered.size === 0 || isProcessing}
                                            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', padding: '8px 16px', fontSize: '0.9rem' }}
                                        >
                                            + New Playlist
                                        </button>
                                        <button
                                            className="spotify-btn action-btn-outline"
                                            onClick={selectAllFiltered}
                                            disabled={filteredTracks.length === 0}
                                            style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                                        >
                                            {selectedFiltered.size === filteredTracks.length && filteredTracks.length > 0 ? 'Deselect All' : 'Select All'}
                                        </button>
                                        <button
                                            className="spotify-btn"
                                            style={{ background: '#ff5555', color: '#fff', padding: '8px 16px', fontSize: '0.9rem' }}
                                            onClick={() => handleRemove(selectedFiltered)}
                                            disabled={selectedFiltered.size === 0 || isProcessing}
                                        >
                                            Remove Selected ({selectedFiltered.size})
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {isCombined && (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                                <button
                                    onClick={() => setFilterViewMode('unified')}
                                    style={{
                                        background: filterViewMode === 'unified' ? 'var(--accent)' : 'transparent',
                                        color: filterViewMode === 'unified' ? 'black' : 'var(--text-secondary)',
                                        border: '1px solid ' + (filterViewMode === 'unified' ? 'var(--accent)' : 'rgba(255,255,255,0.2)'),
                                        padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem'
                                    }}
                                >
                                    Unified View (Show Once)
                                </button>
                                <button
                                    onClick={() => setFilterViewMode('per_playlist')}
                                    style={{
                                        background: filterViewMode === 'per_playlist' ? 'var(--accent)' : 'transparent',
                                        color: filterViewMode === 'per_playlist' ? 'black' : 'var(--text-secondary)',
                                        border: '1px solid ' + (filterViewMode === 'per_playlist' ? 'var(--accent)' : 'rgba(255,255,255,0.2)'),
                                        padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem'
                                    }}
                                >
                                    Filter per Playlist
                                </button>
                            </div>
                        )}

                        <div className="glass-card" style={{ padding: 0, width: '100%', maxWidth: '100%', alignItems: 'stretch' }}>
                            {(() => {
                                let tracksToRender = filteredTracks;
                                const groups = {};

                                if (isCombined && filterViewMode === 'unified') {
                                    const seen = new Set();
                                    tracksToRender = filteredTracks.filter(item => {
                                        if (seen.has(item.track.uri)) return false;
                                        seen.add(item.track.uri);
                                        return true;
                                    });
                                } else if (isCombined && filterViewMode === 'per_playlist') {
                                    filteredTracks.forEach(item => {
                                        const pid = item.sourcePlaylist?.id || 'unknown';
                                        if (!groups[pid]) groups[pid] = { name: item.sourcePlaylist?.name || 'Unknown', items: [] };
                                        groups[pid].items.push(item);
                                    });
                                }

                                const renderTrackList = (list) => list.map((item, idx) => {
                                    const itemKey = getItemKey(item);
                                    const isSelected = selectedFiltered.has(itemKey);
                                    return (
                                        <div
                                            key={`${itemKey}-${idx}`}
                                            onClick={() => toggleFilteredSelection(itemKey)}
                                            style={{
                                                display: 'flex', alignItems: 'center', padding: '0.8rem 1rem',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                background: isSelected ? 'rgba(255, 85, 85, 0.15)' : 'transparent',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s',
                                                justifyContent: 'flex-start',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.3)',
                                                background: isSelected ? '#ff5555' : 'transparent', marginRight: '1rem',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                            }}>
                                                {isSelected && <span style={{ color: 'white', fontSize: '10px' }}>✓</span>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, overflow: 'hidden' }}>
                                                {item.track.album?.images?.[0]?.url ? (
                                                    <img src={item.track.album.images.at(-1).url} style={{ width: '40px', height: '40px', borderRadius: '4px' }} alt="" />
                                                ) : (
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span style={{ fontSize: '10px' }}>🎵</span>
                                                    </div>
                                                )}
                                                <div style={{ overflow: 'hidden', flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                        <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: '0.95rem', fontWeight: 500 }}>
                                                            {item.track.name}
                                                        </div>

                                                        {duplicateUris.has(item.track.uri) && (
                                                            <span style={{
                                                                fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px',
                                                                background: 'rgba(255, 85, 85, 0.2)', color: '#ff5555', border: '1px solid rgba(255, 85, 85, 0.3)',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                Duplicate
                                                            </span>
                                                        )}

                                                        {item.matchReasons?.map((reason, i) => (
                                                            <span key={i} style={{
                                                                fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px',
                                                                background: 'rgba(29, 185, 84, 0.15)', color: '#1db954', border: '1px solid rgba(29, 185, 84, 0.3)',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {reason}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                        {item.track.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
                                                {extractReleaseYear(item.track.album?.release_date)}
                                            </div>
                                        </div>
                                    );
                                });

                                if (isCombined && filterViewMode === 'per_playlist') {
                                    return Object.values(groups).map((group) => (
                                        <div key={group.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <div style={{
                                                padding: '1rem',
                                                background: 'rgba(255,255,255,0.05)',
                                                fontWeight: 'bold',
                                                color: 'var(--accent)',
                                                fontSize: '0.9rem',
                                                position: 'sticky', top: 0, zIndex: 1
                                            }}>
                                                {group.name} ({group.items.length})
                                            </div>
                                            {renderTrackList(group.items)}
                                        </div>
                                    ));
                                }

                                return renderTrackList(tracksToRender);
                            })()}
                            {filteredTracks.length === 0 && (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    Use the filters on the left to find tracks.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeepAnalysis;
