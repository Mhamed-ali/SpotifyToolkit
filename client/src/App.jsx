import { useState, useEffect } from 'react'
import './index.css'
import './App.css'

function App() {
    const [serverMessage, setServerMessage] = useState('Checking server connection...')
    const [token, setToken] = useState(null)
    const [profile, setProfile] = useState(null)

    useEffect(() => {
        // Check for token in URL
        const params = new URLSearchParams(window.location.search);
        const accessToken = params.get('access_token');
        if (accessToken) {
            setToken(accessToken);
            setServerMessage('Connected to Spotify!');
            // Clean up URL
            window.history.pushState({}, null, '/');

            // Fetch Profile
            fetch('https://api.spotify.com/v1/me', {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })
                .then(res => res.json())
                .then(data => setProfile(data))
                .catch(err => console.error('Error fetching profile:', err));

        } else {
            fetch('http://127.0.0.1:8888/')
                .then(res => res.json())
                .then(data => setServerMessage(data.message))
                .catch(() => setServerMessage('Backend not connected (Is the server running on port 8888?)'))
        }
    }, [])

    const handleLogin = () => {
        window.location.href = 'http://127.0.0.1:8888/login';
    }

    const isError = serverMessage.includes('Backend not connected');

    return (
        <div className="app-container">
            <div className="glass-card">
                <h1 className="title-gradient">
                    Spotify Toolkit
                </h1>

                {!profile ? (
                    <>
                        <p className="description-text">
                            nothing is perfect but some things are good enough.
                        </p>

                        <div className={`status-box ${isError ? 'error' : 'success'}`}>
                            {serverMessage}
                        </div>

                        <button className="spotify-btn" onClick={handleLogin}>
                            {token ? 'Connected' : 'Connect with Spotify'}
                        </button>
                    </>
                ) : (
                    <div className="profile-container">
                        {profile.images && profile.images.length > 0 && (
                            <img
                                src={profile.images[0].url}
                                alt="Profile"
                                style={{
                                    width: '120px',
                                    height: '120px',
                                    borderRadius: '50%',
                                    marginBottom: '1rem',
                                    border: '4px solid var(--accent)'
                                }}
                            />
                        )}
                        <h2 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>{profile.display_name}</h2>
                        <p style={{ color: 'var(--text-secondary)', margin: '0 0 2rem 0' }}>
                            {profile.followers.total} Followers • {profile.product === 'premium' ? 'Premium' : 'Free'}
                        </p>

                        <div style={{ display: 'grid', gap: '1rem', width: '100%' }}>
                            <button className="spotify-btn" style={{ width: '100%' }} onClick={() => alert('Feature coming soon!')}>
                                Find Duplicates
                            </button>
                            <button className="spotify-btn" style={{ width: '100%', background: 'transparent', border: '1px solid var(--text-secondary)', color: 'var(--text-primary)' }}>
                                Analyze Library
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default App
