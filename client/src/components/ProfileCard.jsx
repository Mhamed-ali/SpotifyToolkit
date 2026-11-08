import React from 'react';
import '../App.css';

const ProfileCard = ({ profile, playlistCount, onViewPlaylists, onLogout, isLoading, providerName = 'Spotify' }) => {
    const isAnghami = providerName.toLowerCase() === 'anghami';

    return (
        <div className="profile-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {profile.images && profile.images.length > 0 ? (
                <img
                    src={profile.images[0].url}
                    alt="Profile"
                    className="profile-image"
                    style={{ borderColor: isAnghami ? '#a855f7' : 'var(--accent)' }}
                />
            ) : (
                <div
                    className="profile-image"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2.5rem',
                        background: isAnghami ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'linear-gradient(135deg, #1db954, #1ed760)',
                        borderColor: isAnghami ? '#a855f7' : 'var(--accent)'
                    }}
                >
                    {isAnghami ? '🎵' : '🎧'}
                </div>
            )}
            <span className={`provider-pill ${isAnghami ? 'anghami' : 'spotify'}`}>
                {providerName} Connected
            </span>
            <h2 className="profile-name">{profile.display_name}</h2>
            <p className="profile-stats">
                {profile.product === 'premium' || profile.product === 'plus' ? 'Premium / Plus' : 'Free Tier'}
            </p>

            <div
                className={`status-box ${playlistCount !== null ? 'clickable' : ''}`}
                style={{ marginBottom: '1rem', cursor: playlistCount !== null ? 'pointer' : 'default' }}
                onClick={playlistCount !== null ? onViewPlaylists : undefined}
            >
                {isLoading ? 'Loading...' : (playlistCount !== null ? `📂 ${playlistCount} Playlists found — Click to Open` : 'Loading playlists...')}
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', width: '100%', justifyContent: 'center' }}>
                <button className="spotify-btn" onClick={onViewPlaylists} style={{ flex: 1, padding: '12px 24px' }}>
                    Explore Playlists
                </button>
                {onLogout && (
                    <button className="spotify-btn action-btn-outline logout-btn" onClick={onLogout} style={{ padding: '12px 20px' }}>
                        Switch / Logout
                    </button>
                )}
            </div>
        </div>
    );
};

export default ProfileCard;
