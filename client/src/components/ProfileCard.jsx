import React from 'react';
import '../App.css'; // Ensure it has access to styles

const ProfileCard = ({ profile }) => {
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
                {profile.followers.total} Followers • {profile.product === 'premium' ? 'Premium' : 'Free'}
            </p>

            <div className="action-buttons">
                <button className="spotify-btn full-width" onClick={() => alert('Feature coming soon!')}>
                    Find Duplicates
                </button>
                <button className="spotify-btn action-btn-outline full-width">
                    Analyze Library
                </button>
            </div>
        </div>
    );
};

export default ProfileCard;
