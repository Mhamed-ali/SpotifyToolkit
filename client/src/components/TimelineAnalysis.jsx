import React, { useMemo } from 'react';
import '../App.css';
import { calculateTimelineStats } from '../services/analysis.utils';

const TimelineAnalysis = ({ tracks, onBack }) => {
    const { years, decades, oldest, newest, totalWithDate } = useMemo(
        () => calculateTimelineStats(tracks),
        [tracks]
    );

    const maxYearCount = useMemo(() => Math.max(...years.map(y => y.count), 0), [years]);

    if (!totalWithDate) {
        return (
            <div className="flex-center" style={{ height: '50vh', flexDirection: 'column' }}>
                <p style={{ color: 'var(--text-secondary)' }}>No release date data found for these tracks.</p>
                <button className="spotify-btn" onClick={onBack}>Go Back</button>
            </div>
        );
    }

    return (
        <div className="timeline-analysis-container" style={{ padding: '2rem', animation: 'fadeIn 0.3s ease-out', maxWidth: '100%' }}>
            <div className="analysis-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', marginRight: '1rem'
                    }}
                >
                    ←
                </button>
                <h2 className="title-gradient" style={{ margin: 0 }}>Timeline Analysis</h2>
            </div>

            <div className="time-capsule-grid" style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem', width: '100%'
            }}>
                <TrackCard title="Oldest Track" track={oldest} />
                <TrackCard title="Newest Track" track={newest} />
            </div>

            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem', width: '100%', maxWidth: '100%' }}>
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📅</span> Release Year Distribution
                </h3>
                <div className="timeline-chart" style={{
                    display: 'flex', alignItems: 'flex-end', gap: '4px', height: '200px',
                    overflowX: 'auto', paddingBottom: '10px', width: '100%'
                }}>
                    {years.map(({ year, count }) => (
                        <div key={year} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '0 0 auto', minWidth: '30px'
                        }}>
                            <div
                                className="chart-bar"
                                title={`${year}: ${count} tracks`}
                                style={{
                                    width: '100%',
                                    height: `${(count / maxYearCount) * 150}px`,
                                    background: 'var(--accent)',
                                    borderRadius: '4px 4px 0 0',
                                    opacity: 0.8,
                                    transition: 'height 0.5s ease-out'
                                }}
                            ></div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', transform: 'rotate(-45deg)' }}>
                                {year}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '100%' }}>
                <h3 style={{ marginBottom: '1rem' }}>Decade Breakdown</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    {decades.map(({ decade, count }) => (
                        <div key={decade} style={{
                            background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', flex: '1 0 120px'
                        }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{decade}s</div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{count} tracks</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TrackCard = ({ title, track }) => {
    if (!track) return null;
    const year = track.album.release_date ? track.album.release_date.split('-')[0] : 'Unknown';
    const image = track.album.images && track.album.images.length > 0 ? track.album.images[0].url : null;

    return (
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
            {image ? (
                <img src={image} alt={track.name} style={{ width: '80px', height: '80px', borderRadius: '4px', objectFit: 'cover' }} />
            ) : (
                <div style={{ width: '80px', height: '80px', background: '#333', borderRadius: '4px' }}></div>
            )}
            <div style={{ overflow: 'hidden' }}>
                <div style={{
                    fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)', marginBottom: '4px'
                }}>
                    {title}
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {track.name}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {track.artists.map(a => a.name).join(', ')}
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', display: 'inline-block', padding: '2px 8px', borderRadius: '10px' }}>
                    {year}
                </div>
            </div>
        </div>
    );
};

export default TimelineAnalysis;
