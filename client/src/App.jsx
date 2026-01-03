import { useState, useEffect } from 'react'
import './index.css'
import './App.css'
import { fetchProfile, fetchUserPlaylists } from './services/spotify.service'
import ProfileCard from './components/ProfileCard'
import PlaylistsPage from './components/PlaylistsPage'

function App() {
    const [serverMessage, setServerMessage] = useState('Checking server connection...')
    // Initialize token from localStorage
    const [token, setToken] = useState(localStorage.getItem('spotify_access_token'))
    const [profile, setProfile] = useState(null)
    const [playlistCount, setPlaylistCount] = useState(null)

    // Initialize view from URL hash
    const [currentView, setCurrentView] = useState(window.location.hash === '#playlists' ? 'playlists' : 'profile')
    const [playlistsData, setPlaylistsData] = useState([])
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false)

    useEffect(() => {
        const checkAuth = async () => {
            // 1. Check for token in URL (New Login)
            const params = new URLSearchParams(window.location.search);
            const accessToken = params.get('access_token');

            let activeToken = token;

            if (accessToken) {
                // New login: save token and clean URL
                activeToken = accessToken;
                setToken(accessToken);
                localStorage.setItem('spotify_access_token', accessToken);
                window.history.pushState({}, null, '/');
            }

            if (activeToken) {
                setServerMessage('Connected to Spotify!');

                try {
                    // Fetch Profile
                    const profileData = await fetchProfile(activeToken);
                    if (profileData.error) throw profileData.error;
                    setProfile(profileData);

                    // Fetch Playlist Count (for profile view)
                    const playlistsData = await fetchUserPlaylists(activeToken, 1);
                    setPlaylistCount(playlistsData.total);

                    // If we are already on playlists view (from refresh), fetch the data
                    if (window.location.hash === '#playlists') {
                        loadPlaylists(activeToken);
                    }

                } catch (err) {
                    console.error('Error fetching data:', err);
                    // If token is invalid/expired, clear it
                    if (err.status === 401) {
                        setToken(null);
                        localStorage.removeItem('spotify_access_token');
                        setServerMessage('Session expired. Please log in again.');
                    }
                }
            } else {
                // No token? Redirect to home if on playlists
                if (window.location.hash === '#playlists') {
                    window.location.hash = '';
                    setCurrentView('profile');
                }

                // No token, check server health
                fetch('http://127.0.0.1:8888/')
                    .then(res => res.json())
                    .then(data => setServerMessage(data.message))
                    .catch(() => setServerMessage('Backend not connected (Is the server running on port 8888?)'))
            }
        };

        checkAuth();

        // Listen for hash changes to update view (e.g. browser back button)
        const handleHashChange = () => {
            setCurrentView(window.location.hash === '#playlists' ? 'playlists' : 'profile');
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []); // Run once on mount

    const loadPlaylists = (authToken) => {
        setIsLoadingPlaylists(true);
        fetchUserPlaylists(authToken, 50)
            .then(data => {
                setPlaylistsData(data.items);
                setIsLoadingPlaylists(false);
            })
            .catch(err => {
                console.error('Error fetching user playlists:', err);
                setIsLoadingPlaylists(false);
            });
    };

    const handleLogin = () => {
        window.location.href = 'http://127.0.0.1:8888/login';
    }

    const handleViewPlaylists = () => {
        if (!token) return;
        window.location.hash = 'playlists';
        setCurrentView('playlists');
        if (playlistsData.length === 0) {
            loadPlaylists(token);
        }
    }

    const handleBackToProfile = () => {
        window.location.hash = ''; // Clears hash
        setCurrentView('profile');
    }

    const handleLogout = () => {
        setToken(null);
        setProfile(null);
        localStorage.removeItem('spotify_access_token');
        window.location.hash = '';
        window.history.pushState({}, null, '/');
        window.location.href = 'http://localhost:5173'; // Force reload/redirect to clean URL
    }

    const isError = serverMessage.includes('Backend not connected');

    return (
        <div className="app-container">
            {currentView === 'profile' ? (
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
                        <ProfileCard
                            profile={profile}
                            playlistCount={playlistCount}
                            onViewPlaylists={handleViewPlaylists}
                            isLoading={isLoadingPlaylists}
                        />
                    )}
                </div>
            ) : (
                <div className="glass-card full-width-card">
                    <PlaylistsPage
                        playlists={playlistsData}
                        onBack={handleBackToProfile}
                        onLogout={handleLogout}
                    />
                </div>
            )}
        </div>
    )
}

export default App
