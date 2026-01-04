import React from 'react';
import '../App.css'; // Ensure it has access to styles

const ProfileCard = ({ profile, playlistCount, onViewPlaylists, isLoading }) => {
    return (
        <div className="profile-container">
            {profile.images && profile.images.length > 0 && (
                <img
                    src={profile.images[0].url}
                    alt="Profile"
                    className="profile-image"
                />
            )}
            <h2 className="profile-name">{profile.display_name}</h2>
            <p className="profile-stats">
                {profile.product === 'premium' ? 'Premium' : 'Free'}
            </p>

            <div className={`status-box ${playlistCount !== null ? 'clickable' : ''}`}
                style={{ marginBottom: '1rem', cursor: playlistCount !== null ? 'pointer' : 'default' }}
                onClick={playlistCount !== null ? onViewPlaylists : undefined}>
                {isLoading ? 'Loading...' : (playlistCount !== null ? `${playlistCount} Playlists found` : 'Loading playlists...')}
            </div>


        </div>
    );
};

export default ProfileCard;
