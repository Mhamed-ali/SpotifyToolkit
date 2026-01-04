import React from 'react';
import '../App.css';

const VibeAnalysis = ({ stats, warning, onBack, trackCount }) => {

    // Safety check
    if (!stats || typeof stats.energy === 'undefined') {
        return (
            <div className="flex-center" style={{ height: '50vh', flexDirection: 'column' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Analysis data unavailable.</p>
                <button className="spotify-btn" onClick={onBack}>Go Back</button>
            </div>
        );
    }

    // Determine Logic textual description
    const getVibeDescription = (s) => {
        if (s.energy > 0.7 && s.danceability > 0.7) return "Total Party Starter 🎉";
        if (s.energy > 0.8) return "High Octane ⚡";
        if (s.valence < 0.3 && s.energy < 0.4) return "Sad Boi Hours 🌧️";
        if (s.acousticness > 0.7) return "Campfire Vibes 🏕️";
        if (s.danceability > 0.8) return "Club Banger 🕺";
        return "Chill Mix ☕";
    };

    return (
        <div className="vibe-analysis-container" style={{ padding: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
            <div className="analysis-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                <button
                    onClick={onBack}
                    style={{
                        background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', marginRight: '1rem'
                    }}
                >
                    ←
                </button>
                <h2 className="title-gradient" style={{ margin: 0 }}>Vibe Check Results</h2>
            </div>

            <div className="vibe-summary glass-card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{getVibeDescription(stats)}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Based on {trackCount} tracks</p>
            </div>

            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                <StatCard label="Energy" value={stats.energy} emoji="⚡" />
                <StatCard label="Mood (Valence)" value={stats.valence} emoji="🎭" />
                <StatCard label="Danceability" value={stats.danceability} emoji="💃" />
                <StatCard label="Acousticness" value={stats.acousticness} emoji="🎸" />
            </div>
        </div>
    );
};

const StatCard = ({ label, value, emoji }) => {
    const percent = Math.round(value * 100);
    return (
        <div className="stat-card" style={{
            background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
        }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{emoji}</div>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>{label}</h3>
            <div className="progress-bar-bg" style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                    className="progress-bar-fill"
                    style={{
                        width: `${percent}%`, height: '100%', background: 'var(--accent)',
                        transition: 'width 1s ease-out'
                    }}
                />
            </div>
            <p style={{ marginTop: '0.5rem', fontWeight: 'bold' }}>{percent}%</p>
        </div>
    );
};

export default VibeAnalysis;
