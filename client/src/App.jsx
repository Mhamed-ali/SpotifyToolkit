import { useState, useEffect, useRef } from 'react';
import './index.css';
import './App.css';
import { getMusicProvider, PROVIDERS } from './providers/ProviderFactory';
import { PLAYLIST_IDS, PlaylistModel } from './models/Playlist';
import { createClientLogger } from './utils/logger';
import ProfileCard from './components/ProfileCard';
import PlaylistsPage from './components/PlaylistsPage';
import PlaylistDetailsPage from './components/PlaylistDetailsPage';

const logger = createClientLogger('App');

const TOOLKIT_FEATURES = [
    { icon: '🧹', title: 'Duplicate Cleaner', desc: 'Detect & batch-remove duplicate songs per playlist or across your library' },
    { icon: '🌙', title: 'Arabic & Era Filter', desc: '3-tier Arabic song detector, artist & release year specifications' },
    { icon: '📥', title: 'Smart Excel Export', desc: 'Export 18 metadata fields with clickable hyperlinks & global playlist map' },
    { icon: '📊', title: 'Vibe & Stats Insights', desc: 'Analyze energy, mood, top artists, collaborations, and timeline eras' }
];

function App() {
    const [serverMessage, setServerMessage] = useState('Checking server connection...');
    const [providerId, setProviderId] = useState(
        () => localStorage.getItem('music_provider') || PROVIDERS.SPOTIFY
    );
    const [token, setToken] = useState(() => localStorage.getItem('spotify_access_token'));
    const [profile, setProfile] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [profileError, setProfileError] = useState(null);
    const [playlistCount, setPlaylistCount] = useState(null);

    const [currentView, setCurrentView] = useState(() => {
        const hash = window.location.hash;
        if (hash === '#playlists') return 'playlists';
        if (hash.startsWith('#playlist/')) return 'details';
        return 'profile';
    });

    const [playlistsData, setPlaylistsData] = useState(null);
    const [likedSongsCount, setLikedSongsCount] = useState(null);
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
    const [selectedPlaylist, setSelectedPlaylist] = useState(null);
    const [playlistTracks, setPlaylistTracks] = useState([]);
    const [playlistError, setPlaylistError] = useState(null);
    const [isFetchingTracks, setIsFetchingTracks] = useState(false);

    const activePlaylistIdRef = useRef(null);
    const fetchOperationIdRef = useRef(0);

    const provider = getMusicProvider(providerId);

    // Sync token state when spotify.service.js automatically refreshes an expired token
    useEffect(() => {
        const handleTokenRefreshed = (e) => {
            if (e.detail) setToken(e.detail);
        };
        window.addEventListener('spotify-token-refreshed', handleTokenRefreshed);
        return () => window.removeEventListener('spotify-token-refreshed', handleTokenRefreshed);
    }, []);

    const loadFullPlaylist = async (activeToken, id, totalTracks, isLiked = false, activeProvider = provider) => {
        activePlaylistIdRef.current = id;
        setIsFetchingTracks(true);

        try {
            const firstPageData = isLiked
                ? await activeProvider.fetchSavedTracks(activeToken, 0, 50)
                : await activeProvider.fetchPlaylistTracks(activeToken, id, 0, 100);

            if (activePlaylistIdRef.current !== id) return;

            setPlaylistTracks(firstPageData.items || []);

            if (firstPageData.items && totalTracks > firstPageData.items.length) {
                const remaining = await activeProvider.fetchRemainingTracks(
                    activeToken,
                    totalTracks,
                    isLiked ? 'me' : null,
                    isLiked ? null : id
                );

                if (activePlaylistIdRef.current !== id) return;

                setPlaylistTracks(prev => {
                    const existingIds = new Set(prev.map(p => p.track ? p.track.id : null).filter(Boolean));
                    const uniqueRemaining = remaining.filter(item => {
                        if (!item.track || !item.track.id) return false;
                        if (existingIds.has(item.track.id)) return false;
                        existingIds.add(item.track.id);
                        return true;
                    });
                    return [...prev, ...uniqueRemaining];
                });
                setIsFetchingTracks(false);
            } else {
                setIsFetchingTracks(false);
            }
        } catch (err) {
            logger.error('Error loading tracks', err);
            if (activePlaylistIdRef.current === id) {
                if (err.status === 429) {
                    setPlaylistError('Rate limit exceeded. Please wait a moment and try again.');
                } else {
                    setPlaylistError('Failed to load tracks. ' + (err.message || ''));
                }
            }
            setIsFetchingTracks(false);
        }
    };

    const restorePlaylistFromHash = async (hash, activeToken, activeProvider = provider) => {
        const playlistId = hash.split('/')[1];
        setPlaylistError(null);
        setSelectedPlaylist(null);
        setPlaylistTracks([]);

        const currentOpId = fetchOperationIdRef.current + 1;
        fetchOperationIdRef.current = currentOpId;

        if (!playlistId) return;

        setCurrentView('details');

        const timeoutId = setTimeout(() => {
            if (fetchOperationIdRef.current === currentOpId) {
                setPlaylistError('Network request timed out. Please refresh or try again.');
            }
        }, 20000);

        if (playlistId === 'liked') {
            try {
                let totalTracks = likedSongsCount;
                if (totalTracks === null || totalTracks === undefined) {
                    const countData = await activeProvider.fetchSavedTracks(activeToken, 0, 1);
                    if (countData.error) throw countData.error;
                    totalTracks = countData.total;
                    setLikedSongsCount(totalTracks);
                }

                if (fetchOperationIdRef.current !== currentOpId) return;

                const likedPlaylist = PlaylistModel.createLikedSongs(totalTracks);
                setSelectedPlaylist(likedPlaylist);
                clearTimeout(timeoutId);

                loadFullPlaylist(activeToken, PLAYLIST_IDS.LIKED_SONGS, totalTracks, true, activeProvider);
            } catch (err) {
                if (fetchOperationIdRef.current !== currentOpId) return;
                clearTimeout(timeoutId);
                setPlaylistError(err.status === 429
                    ? 'Rate limit exceeded. You are refreshing too fast!'
                    : 'Failed to load Liked Songs. ' + (err.message || ''));
            }
        } else {
            try {
                const playlistDetails = await activeProvider.fetchPlaylist(activeToken, playlistId);
                if (fetchOperationIdRef.current !== currentOpId) return;

                if (playlistDetails.error) throw playlistDetails.error;
                setSelectedPlaylist(playlistDetails);
                clearTimeout(timeoutId);

                loadFullPlaylist(activeToken, playlistId, playlistDetails.tracks?.total || 0, false, activeProvider);
            } catch (err) {
                if (fetchOperationIdRef.current !== currentOpId) return;
                clearTimeout(timeoutId);
                setPlaylistError(err.status === 429
                    ? 'Rate limit exceeded. Please wait a moment.'
                    : 'Playlist not found or private. ' + (err.message || ''));
            }
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            const params = new URLSearchParams(window.location.search);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const incomingProvider = params.get('provider');

            let activeToken = token;
            let activeProviderId = providerId;

            if (incomingProvider && (incomingProvider === PROVIDERS.SPOTIFY || incomingProvider === PROVIDERS.ANGHAMI)) {
                activeProviderId = incomingProvider;
                setProviderId(incomingProvider);
                localStorage.setItem('music_provider', incomingProvider);
            }

            if (accessToken) {
                activeToken = accessToken;
                setToken(accessToken);
                localStorage.setItem('spotify_access_token', accessToken);
                if (refreshToken) {
                    localStorage.setItem('spotify_refresh_token', refreshToken);
                }
                window.history.pushState({}, null, '/');
            }

            const activeProvider = getMusicProvider(activeProviderId);

            if (activeToken) {
                setServerMessage(`Connected to ${activeProvider.displayName}!`);
                setIsLoadingProfile(true);
                setProfileError(null);

                activeProvider.fetchProfile(activeToken)
                    .then(data => {
                        if (data.error) {
                            setProfileError(data.error.message || 'Failed to load profile');
                            if (data.error.status === 401) {
                                handleLogout();
                            }
                        } else {
                            setProfile(data);
                        }
                    })
                    .catch(() => setProfileError('Network error loading profile'))
                    .finally(() => setIsLoadingProfile(false));

                activeProvider.fetchUserPlaylists(activeToken, 1)
                    .then(data => {
                        if (!data.error) setPlaylistCount(data.total);
                    })
                    .catch(err => logger.error('Playlist count error', err));

                const hash = window.location.hash;
                if (hash === '#playlists') {
                    setCurrentView('playlists');
                } else if (hash.startsWith('#playlist/')) {
                    restorePlaylistFromHash(hash, activeToken, activeProvider);
                } else if (hash === '' || hash === '#') {
                    setCurrentView('profile');
                }
            } else {
                if (window.location.hash === '#playlists' || window.location.hash.startsWith('#playlist/')) {
                    window.location.hash = '';
                    setCurrentView('profile');
                }
                fetch('/health')
                    .then(res => res.json())
                    .then(data => setServerMessage(data.message))
                    .catch(() => setServerMessage('Backend not connected (Is the server running on port 8888?)'));
            }
        };

        checkAuth();

        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash === '#playlists') {
                setCurrentView('playlists');
            } else if (hash === '' || hash === '#') {
                setCurrentView('profile');
            } else if (hash.startsWith('#playlist/')) {
                restorePlaylistFromHash(hash, token, getMusicProvider(providerId));
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [token, providerId]);

    useEffect(() => {
        if (currentView === 'playlists' && token && !playlistsData && !isLoadingPlaylists) {
            loadPlaylists(token);
        }
    }, [currentView, token, playlistsData, isLoadingPlaylists]);

    const loadPlaylists = (authToken) => {
        setIsLoadingPlaylists(true);
        Promise.all([
            provider.fetchUserPlaylists(authToken, 50).catch(err => ({ error: err })),
            provider.fetchSavedTracks(authToken, 0, 1).catch(err => ({ error: err }))
        ]).then(([playlists, likedTracks]) => {
            setPlaylistsData(!playlists.error ? playlists.items : []);
            setLikedSongsCount(!likedTracks.error ? likedTracks.total : 0);
            setIsLoadingPlaylists(false);
        });
    };

    const handleSpotifyLogin = () => {
        localStorage.setItem('music_provider', PROVIDERS.SPOTIFY);
        window.location.href = '/login';
    };

    const handleAnghamiLogin = () => {
        localStorage.setItem('music_provider', PROVIDERS.ANGHAMI);
        window.location.href = '/anghami/login';
    };

    const handleViewPlaylists = () => {
        if (!token) return;
        window.location.hash = 'playlists';
        setCurrentView('playlists');
    };

    const handlePlaylistClick = async (playlist) => {
        setSelectedPlaylist(playlist);
        setPlaylistTracks([]);
        setCurrentView('details');
        setPlaylistError(null);

        if (PlaylistModel.isLikedSongs(playlist)) {
            window.location.hash = 'playlist/liked';
            loadFullPlaylist(token, PLAYLIST_IDS.LIKED_SONGS, playlist.tracks.total, true);
        } else {
            window.location.hash = `playlist/${playlist.id}`;
            loadFullPlaylist(token, playlist.id, playlist.tracks?.total || 0, false);
        }
    };

    const handleBackToPlaylists = () => {
        window.location.hash = 'playlists';
        setCurrentView('playlists');
        setSelectedPlaylist(null);
        setPlaylistError(null);
    };

    const handleBackToProfile = () => {
        window.location.hash = '';
        setCurrentView('profile');
    };

    const handleManualPlaylist = async () => {
        const input = prompt(`Enter ${provider.displayName} Playlist Link or ID:`);
        if (!input) return;

        try {
            const id = provider.extractPlaylistIdFromInput(input);
            if (!id) throw new Error('Invalid Playlist Link');

            setPlaylistError(null);
            setIsLoadingPlaylists(true);

            const details = await provider.fetchPlaylist(token, id);
            if (details.error) throw details.error;

            handlePlaylistClick(details);
        } catch (err) {
            logger.error('Manual playlist load failed', err);
            alert('Could not load playlist: ' + (err.message || 'Unknown error'));
        } finally {
            setIsLoadingPlaylists(false);
        }
    };

    const handleMultiAnalyze = async (selectedPlaylists) => {
        if (!selectedPlaylists || selectedPlaylists.length === 0) return;

        setIsFetchingTracks(true);
        setCurrentView('details');

        const combinedPlaylist = PlaylistModel.createCombined(selectedPlaylists);
        setSelectedPlaylist(combinedPlaylist);

        try {
            const promises = selectedPlaylists.map(async (p) => {
                try {
                    const items = await provider.fetchAllTracksForPlaylist(token, p.id, p.tracks?.total);
                    return items
                        .filter(i => i && i.track && i.track.id)
                        .map(i => ({
                            ...i,
                            sourcePlaylist: {
                                id: p.id,
                                name: p.name,
                                owner: p.owner,
                                collaborative: p.collaborative
                            }
                        }));
                } catch (e) {
                    logger.error(`Failed to fetch tracks for ${p.name}`, e);
                    return [];
                }
            });

            const results = await Promise.all(promises);
            setPlaylistTracks(results.flat());
        } catch (err) {
            logger.error('Error fetching multi-playlist tracks', err);
            setPlaylistError('Failed to load tracks for some playlists.');
        } finally {
            setIsFetchingTracks(false);
        }
    };

    const handleLogout = () => {
        setToken(null);
        setProfile(null);
        setPlaylistsData(null);
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('music_provider');
        window.location.hash = '';
        window.history.pushState({}, null, '/');
        window.location.href = window.location.origin;
    };

    const isError = serverMessage.includes('Backend not connected');

    const renderView = () => {
        if (!token) {
            return (
                <div className="glass-card landing-card">
                    <h1 className="title-gradient">Spotify & Anghami Toolkit</h1>
                    <p className="description-text" style={{ marginBottom: '1.5rem' }}>
                        Explore, deduplicate, filter Arabic tracks, and export your playlists to Excel.
                    </p>

                    <div className={`status-box ${isError ? 'error' : 'success'}`} style={{ marginBottom: '1.5rem' }}>
                        {serverMessage}
                    </div>

                    <div className="provider-login-buttons">
                        <button className="spotify-btn" onClick={handleSpotifyLogin}>
                            🎧 Connect with Spotify
                        </button>
                        <button className="spotify-btn anghami-btn" onClick={handleAnghamiLogin}>
                            🎵 Connect with Anghami
                        </button>
                    </div>

                    <div className="features-showcase-grid">
                        {TOOLKIT_FEATURES.map((feat) => (
                            <div key={feat.title} className="feature-showcase-item">
                                <span className="feature-showcase-icon">{feat.icon}</span>
                                <div>
                                    <h4 className="feature-showcase-title">{feat.title}</h4>
                                    <p className="feature-showcase-desc">{feat.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        switch (currentView) {
            case 'profile':
                return (
                    <div className="glass-card">
                        <h1 className="title-gradient">Spotify Toolkit</h1>
                        {isLoadingProfile ? (
                            <>
                                <p className="description-text">Loading profile...</p>
                                <div className={`status-box ${isError ? 'error' : 'success'}`}>
                                    {serverMessage}
                                </div>
                            </>
                        ) : profileError ? (
                            <>
                                <p className="description-text" style={{ color: '#ff6b6b' }}>
                                    {profileError}
                                </p>
                                <button className="spotify-btn action-btn-outline" onClick={handleLogout}>
                                    Disconnect & Retry
                                </button>
                            </>
                        ) : !profile ? (
                            <button className="spotify-btn" onClick={handleSpotifyLogin}>
                                Login with Spotify
                            </button>
                        ) : (
                            <ProfileCard
                                profile={profile}
                                playlistCount={playlistCount}
                                onViewPlaylists={handleViewPlaylists}
                                onLogout={handleLogout}
                                isLoading={isLoadingPlaylists}
                                providerName={provider.displayName}
                            />
                        )}
                    </div>
                );
            case 'playlists':
                return (
                    <div className="full-width-container">
                        <PlaylistsPage
                            playlists={playlistsData}
                            onBack={handleBackToProfile}
                            onLogout={handleLogout}
                            onPlaylistClick={handlePlaylistClick}
                            likedSongsCount={likedSongsCount}
                            isLoading={isLoadingPlaylists}
                            onManualPlaylist={handleManualPlaylist}
                            onMultiAnalyze={handleMultiAnalyze}
                            providerName={provider.displayName}
                        />
                    </div>
                );
            case 'details':
                return (
                    <div className="glass-card full-width-card">
                        {playlistError ? (
                            <div className="playlists-container error-container">
                                <div className="playlists-header">
                                    <h2>Error</h2>
                                </div>
                                <div className="status-box error">{playlistError}</div>
                                <button className="spotify-btn action-btn-outline" onClick={handleBackToPlaylists} style={{ marginTop: '1rem' }}>
                                    ← Back to Playlists
                                </button>
                            </div>
                        ) : selectedPlaylist ? (
                            <PlaylistDetailsPage
                                playlist={selectedPlaylist}
                                tracks={playlistTracks}
                                onBack={() => {
                                    window.location.hash = '#playlists';
                                    setCurrentView('playlists');
                                    setSelectedPlaylist(null);
                                }}
                                onHome={() => {
                                    window.location.hash = '';
                                    setCurrentView('profile');
                                    setSelectedPlaylist(null);
                                }}
                                isFetching={isFetchingTracks}
                                token={token}
                                currentUserId={profile ? profile.id : null}
                                providerId={providerId}
                            />
                        ) : (
                            <div className="playlists-container">
                                <div className="playlists-header">
                                    <h2>Loading...</h2>
                                </div>
                                <div className="status-box">Fetching playlist details...</div>
                                <button
                                    className="spotify-btn action-btn-outline"
                                    onClick={handleBackToPlaylists}
                                    style={{ marginTop: '2rem', opacity: 0.8 }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
                );
            default:
                return <div>Unknown View</div>;
        }
    };

    return (
        <div className="app-container">
            {renderView()}
        </div>
    );
}

export default App;
