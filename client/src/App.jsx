import { useState, useEffect } from 'react'
import './index.css'
import './App.css'
import { fetchProfile } from './services/spotify.service'
import ProfileCard from './components/ProfileCard'

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

            // Fetch Profile using service
            fetchProfile(accessToken)
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
                    <ProfileCard profile={profile} />
                )}
            </div>
        </div>
    )
}

export default App
