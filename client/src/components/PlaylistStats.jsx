import React, { useMemo } from 'react';
import '../App.css';

const PlaylistStats = ({ tracks, onBack }) => {

    const stats = useMemo(() => {
        let totalDuration = 0;
        let explicitCount = 0;
        let popularitySum = 0;
        let validPopCount = 0;
        const popBuckets = new Array(10).fill(0); // 0-10, 10-20, ... 90-100

        tracks.forEach(item => {
            const t = item.track;
            if (!t) return;

            // Duration
            totalDuration += t.duration_ms || 0;

            // Explicit
            if (t.explicit) explicitCount++;

            // Popularity
            if (typeof t.popularity === 'number') {
                popularitySum += t.popularity;
                validPopCount++;

                // Bucket
                const bucketIndex = Math.min(Math.floor(t.popularity / 10), 9);
                popBuckets[bucketIndex]++;
            }
        });

        const totalTracks = tracks.length || 1;
        const avgPopularity = validPopCount > 0 ? Math.round(popularitySum / validPopCount) : 0;
        const explicitPercent = Math.round((explicitCount / totalTracks) * 100);

        // Format total duration
        const hours = Math.floor(totalDuration / 3600000);
        const minutes = Math.floor((totalDuration % 3600000) / 60000);
        const durationStr = hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;

        return {
            totalTracks,
            durationStr,
            explicitCount,
            explicitPercent,
            avgPopularity,
            popBuckets
        };
    }, [tracks]);

    const maxPopBucket = Math.max(...stats.popBuckets, 0) || 1;

    return (
        <div className="playlist-stats-container" style={{ padding: '2rem', animation: 'fadeIn 0.3s ease-out', maxWidth: '100%' }}>
            {/* Header */}
            <div className="analysis-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', marginRight: '1rem'
                    }}
                >
                    ←
                </button>
                <h2 className="title-gradient" style={{ margin: 0 }}>Playlist Stats</h2>
            </div>

            {/* Overview Grid */}
            <div className="stats-grid" style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem'
            }}>
                <StatCard
                    label="Total Duration"
                    value={stats.durationStr}
                    subtext={`${stats.totalTracks} tracks`}
                    icon="⏱️"
                />
                <StatCard
                    label="Explicit Content"
                    value={`${stats.explicitPercent}%`}
                    subtext={`${stats.explicitCount} explicit tracks`}
                    icon="🤬"
                    alert={stats.explicitPercent > 50}
                />
                <StatCard
                    label="Avg Popularity"
                    value={stats.avgPopularity}
                    subtext="/ 100"
                    icon="🔥"
                />
            </div>

            {/* Popularity Chart */}
            <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '100%' }}>
                <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📈</span> Popularity Distribution
                </h3>
                <div className="popularity-chart" style={{
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', height: '200px',
                    width: '100%', paddingBottom: '10px'
                }}>
                    {stats.popBuckets.map((count, index) => (
                        <div key={index} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1'
                        }}>
                            <div
                                className="chart-bar"
                                title={`${index * 10}-${(index + 1) * 10}: ${count} tracks`}
                                style={{
                                    width: '100%',
                                    height: `${(count / maxPopBucket) * 150}px`,
                                    background: stats.avgPopularity >= (index * 10) && stats.avgPopularity < ((index + 1) * 10) ? '#fff' : 'var(--accent)',
                                    opacity: stats.avgPopularity >= (index * 10) && stats.avgPopularity < ((index + 1) * 10) ? 1 : 0.6,
                                    borderRadius: '4px 4px 0 0',
                                    transition: 'height 0.5s ease-out'
                                }}
                            ></div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                                {index * 10}
                            </span>
                        </div>
                    ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Popularity Score (0-100)
                </div>
            </div>

        </div>
    );
};

const StatCard = ({ label, value, subtext, icon, alert }) => (
    <div className="glass-card" style={{
        padding: '1.5rem',
        border: alert ? '1px solid #ff5555' : undefined,
        background: alert ? 'rgba(255, 85, 85, 0.1)' : undefined
    }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{icon}</div>
        <div style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.2rem' }}>{value}</div>
        <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{label}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{subtext}</div>
    </div>
);

export default PlaylistStats;
