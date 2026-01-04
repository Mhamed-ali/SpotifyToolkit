import React, { useMemo, useState, useCallback } from 'react';
import '../App.css';
import TrackTable from './TrackTable';

const ArtistAnalysis = ({ tracks, settings, onBack }) => {
    const [visibleCount, setVisibleCount] = useState(20);
    const [selectedArtists, setSelectedArtists] = useState(new Set());

    const topArtists = useMemo(() => {
        if (!tracks || tracks.length === 0) return [];

        const artistCounts = {};
        const includeCollabs = settings && settings.includes('collabs');

        tracks.forEach(item => {
            if (!item.track || !item.track.artists) return;

            if (includeCollabs) {
                // Count every artist on the track
                item.track.artists.forEach(artist => {
                    artistCounts[artist.name] = (artistCounts[artist.name] || 0) + 1;
                });
            } else {
                // Count primary artist only
                const primaryArtist = item.track.artists[0].name;
                artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
            }
        });

        // Convert to array and sort
        return Object.entries(artistCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
    }, [tracks, settings]);

    const maxCount = topArtists.length > 0 ? topArtists[0].count : 1;
    const visibleArtists = topArtists.slice(0, visibleCount);

    const toggleArtist = (artistName) => {
        const newSelected = new Set(selectedArtists);
        if (newSelected.has(artistName)) {
            newSelected.delete(artistName);
        } else {
            newSelected.add(artistName);
        }
        setSelectedArtists(newSelected);
    };

    // Filter tracks based on selection
    const filteredTracks = useMemo(() => {
        if (selectedArtists.size === 0) return [];
        const includeCollabs = settings && settings.includes('collabs');

        return tracks.filter(item => {
            if (!item.track || !item.track.artists) return false;

            if (includeCollabs) {
                // Check if ANY of the selected artists are in the track's artists
                return item.track.artists.some(a => selectedArtists.has(a.name));
            } else {
                // Check if the PRIMARY artist is selected
                return selectedArtists.has(item.track.artists[0].name);
            }
        });
    }, [tracks, selectedArtists, settings]);

    // Helpers for TrackTable
    const formatDuration = useCallback((ms) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
    }, []);

    const formatDate = useCallback((dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString();
    }, []);

    // Simplified columns for analysis view
    const tableColumns = {
        index: true,
        art: true,
        title: true,
        album: true,
        dateAdded: false,
        released: false,
        popularity: false,
        duration: true
    };

    return (
        <div className="analysis-container" style={{
            position: 'absolute', // Changed from fixed to absolute to scroll with page
            top: 0,
            left: 0,
            width: '100%',
            minHeight: '100vh', // Allow growing
            background: '#121212',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem 3rem 1rem',
            boxSizing: 'border-box',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            {/* Header */}
            <div className="analysis-header" style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexShrink: 0
            }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#fff',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        marginRight: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                >
                    ←
                </button>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 className="title-gradient" style={{ margin: 0, fontSize: '1.8rem' }}>Artist Breakdown</h2>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Top Artists in this Playlist ({tracks.length} songs)
                    </span>
                </div>
            </div>

            {/* Content Split View */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: '350px 1fr',
                gap: '1.5rem',
                flex: 1,
                alignItems: 'start' // Items align to top, don't stretch to max height
            }}>

                {/* Left Column: Artist List */}
                <div className="glass-card" style={{
                    padding: '0',
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: 'none',
                    width: '100%'
                }}>
                    <div style={{
                        padding: '1.5rem',
                        flexShrink: 0,
                        // Removed zIndex/border as we are no longer internally scrolling
                    }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Select Artists</h3>
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Click to filter songs
                        </p>
                    </div>

                    <div style={{ padding: '1rem', width: '100%', boxSizing: 'border-box' }}>
                        {topArtists.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No data available.</div>
                        ) : (
                            <div className="chart-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {visibleArtists.map((artist, index) => {
                                    const isSelected = selectedArtists.has(artist.name);
                                    return (
                                        <div
                                            key={artist.name}
                                            className="chart-row"
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.8rem',
                                                cursor: 'pointer',
                                                padding: '0.8rem',
                                                borderRadius: '8px',
                                                background: isSelected ? 'rgba(29, 185, 84, 0.15)' : 'rgba(255,255,255,0.03)',
                                                border: isSelected ? '1px solid rgba(29, 185, 84, 0.3)' : '1px solid transparent',
                                                transition: 'all 0.2s ease',
                                                boxSizing: 'border-box',
                                                overflow: 'hidden',
                                                width: '100%' // Ensure explicit width constraint
                                            }}
                                            onClick={() => toggleArtist(artist.name)}
                                        >
                                            <div style={{ width: '25px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                                                #{index + 1}
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', fontSize: '0.9rem' }}>
                                                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                                                        {artist.name}
                                                    </span>
                                                    <span style={{ fontSize: '0.85rem', color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }}>
                                                        {artist.count}
                                                    </span>
                                                </div>
                                                <div className="bar-bg" style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
                                                    <div
                                                        className="bar-fill"
                                                        style={{
                                                            width: `${(artist.count / maxCount) * 100}%`,
                                                            height: '100%',
                                                            background: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                                                            borderRadius: '2px',
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Minimal Check Indicator */}
                                            {isSelected && (
                                                <div style={{ color: 'var(--accent)', fontSize: '1.2rem', marginLeft: '0.2rem' }}>•</div>
                                            )}
                                        </div>
                                    );
                                })}

                                {visibleCount < topArtists.length && (
                                    <button
                                        className="spotify-btn action-btn-outline"
                                        style={{ width: '100%', marginTop: '1rem', padding: '0.8rem', boxSizing: 'border-box' }}
                                        onClick={(e) => { e.stopPropagation(); setVisibleCount(topArtists.length); }}
                                    >
                                        Show All Artists
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Song List */}
                <div className="glass-card" style={{
                    padding: '0',
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: 'none',
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)'
                }}>
                    {selectedArtists.size === 0 ? (
                        <div style={{
                            padding: '4rem 1rem', // Added padding instead of relying on flex center
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            color: 'var(--text-secondary)',
                            opacity: 0.6,
                            width: '100%'
                        }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎹</div>
                            <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>Select artists to view tracks</p>
                            <p style={{ fontSize: '0.9rem' }}>Combine multiple artists to compare</p>
                        </div>
                    ) : (
                        <>
                            <div style={{
                                padding: '1.5rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(255,255,255,0.02)',
                                gap: '1rem',
                                flexWrap: 'wrap' // Allow wrapping on very small screens
                            }}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                                        Selected Tracks
                                        <span style={{ marginLeft: '0.5rem', background: 'var(--accent)', color: '#000', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', verticalAlign: 'middle' }}>
                                            {filteredTracks.length}
                                        </span>
                                    </h3>
                                    <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '500px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        Filtering: {Array.from(selectedArtists).join(', ')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedArtists(new Set())}
                                    style={{
                                        background: 'rgba(255,107,107,0.1)',
                                        border: '1px solid rgba(255,107,107,0.3)',
                                        color: '#ff6b6b',
                                        cursor: 'pointer',
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '4px',
                                        fontSize: '0.85rem',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0
                                    }}
                                    onMouseOver={(e) => e.target.style.background = 'rgba(255,107,107,0.2)'}
                                    onMouseOut={(e) => e.target.style.background = 'rgba(255,107,107,0.1)'}
                                >
                                    Clear Selection
                                </button>
                            </div>
                            <div className="track-list-container" style={{ width: '100%' }}>
                                <TrackTable
                                    tracks={filteredTracks}
                                    playlist={{ tracks: { total: filteredTracks.length } }}
                                    visibleColumns={tableColumns}
                                    formatDate={formatDate}
                                    formatDuration={formatDuration}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div >
    );
};

export default ArtistAnalysis;
