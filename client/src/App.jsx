import { useState, useEffect, useRef } from 'react'
import './index.css'
import './App.css'
import { fetchProfile, fetchUserPlaylists, fetchPlaylistTracks, fetchSavedTracks, fetchPlaylist, fetchRemainingTracks } from './services/spotify.service'
import ProfileCard from './components/ProfileCard'
import PlaylistsPage from './components/PlaylistsPage'
import PlaylistDetailsPage from './components/PlaylistDetailsPage'

function App() {
    const [serverMessage, setServerMessage] = useState('Checking server connection...')
    // Initialize token from localStorage
    const [token, setToken] = useState(localStorage.getItem('spotify_access_token'))
    const [profile, setProfile] = useState(null)
    const [isLoadingProfile, setIsLoadingProfile] = useState(false)
    const [profileError, setProfileError] = useState(null)
    const [playlistCount, setPlaylistCount] = useState(null)

    // Initialize view from URL hash
    const [currentView, setCurrentView] = useState(() => {
        const hash = window.location.hash;
        if (hash === '#playlists') return 'playlists';
        if (hash.startsWith('#playlist/')) return 'details';
        return 'profile';
    })

    const [playlistsData, setPlaylistsData] = useState(null)
    const [likedSongsCount, setLikedSongsCount] = useState(null)
    const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false)
    const [selectedPlaylist, setSelectedPlaylist] = useState(null)
    const [playlistTracks, setPlaylistTracks] = useState([])
    const [playlistError, setPlaylistError] = useState(null)
    // Loading state specifically for the background track fetching
    const [isFetchingTracks, setIsFetchingTracks] = useState(false);

    // Track the currently loading playlist to prevent race conditions
    const activePlaylistIdRef = useRef(null);

    // Helper for progressive loading
    const loadFullPlaylist = async (token, id, totalTracks, isLiked = false) => {
        // Update the ref to claim this as the active load
        activePlaylistIdRef.current = id;
        setIsFetchingTracks(true);

        try {
            // Updated to fetch only first page initially
            let firstPageData;
            if (isLiked) {
                firstPageData = await fetchSavedTracks(token, 0, 50);
            } else {
                // Use 100 for playlists
                firstPageData = await fetchPlaylistTracks(token, id, 0, 100);
            }

            // If the user switched playlists while we were fetching the first page, stop.
            if (activePlaylistIdRef.current !== id) return;

            // Render immediately
            setPlaylistTracks(firstPageData.items);

            // Fetch the rest in parallel if needed
            if (firstPageData.items && totalTracks > firstPageData.items.length) {
                import('./services/spotify.service').then(async (module) => {
                    const remaining = await module.fetchRemainingTracks(token, totalTracks, isLiked ? 'me' : null, isLiked ? null : id);

                    // Final check before updating state
                    if (activePlaylistIdRef.current !== id) return;

                    setPlaylistTracks(prev => {
                        // Safely deduplicate based on track ID + index to be sure
                        // Ideally just [...prev, ...remaining] but let's be safe
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
                });
            } else {
                setIsFetchingTracks(false);
            }
        } catch (err) {
            console.error('Error loading tracks:', err);
            // If we failed completely
            if (activePlaylistIdRef.current === id && playlistTracks.length === 0) {
                if (err.status === 429) {
                    setPlaylistError('Rate limit exceeded. Please wait a moment and try again.');
                } else {
                    setPlaylistError('Failed to load tracks. ' + (err.message || ''));
                }
            }
            setIsFetchingTracks(false);
        }
    }

    // Track current fetch operation ID to prevent stale timeouts
    const fetchOperationIdRef = useRef(0);

    const restorePlaylistFromHash = async (hash, activeToken) => {
        const playlistId = hash.split('/')[1];
        setPlaylistError(null);
        setSelectedPlaylist(null);
        setPlaylistTracks([]);

        // increment op ID
        const currentOpId = fetchOperationIdRef.current + 1;
        fetchOperationIdRef.current = currentOpId;

        if (playlistId) {
            setCurrentView('details');

            // Reduced to 5 seconds as requested
            // UPDATE: Increased to 20s because we now technically "buffer" (auto-retry)
            // so we expect it might take longer if rate limited.
            const timeoutId = setTimeout(() => {
                console.log(`[Timeout] Checking OpId: ${fetchOperationIdRef.current} vs Current: ${currentOpId}`);
                // Check if we are still on the SAME operation and it hasn't finished (implied by state)
                // We trust the ref ensures we don't error out a LATER successful request
                if (fetchOperationIdRef.current === currentOpId) {
                    console.warn('Timeout triggered for OpId:', currentOpId);
                    setPlaylistError("Network request timed out. Please refresh or try again.");
                }
            }, 20000);

            if (playlistId === 'liked') {
                try {
                    // Check if we already have the count from the initial load
                    let totalTracks = likedSongsCount;

                    // If NOT available yet (direct deeplink load), fetch it now
                    if (totalTracks === null || totalTracks === undefined) {
                        const countData = await fetchSavedTracks(activeToken, 0, 1);
                        if (countData.error) throw countData.error;
                        totalTracks = countData.total;
                        setLikedSongsCount(totalTracks);
                    }

                    if (fetchOperationIdRef.current !== currentOpId) return; // Cleanup check

                    const dummyPlaylist = {
                        id: 'LIKED_SONGS',
                        name: 'Liked Songs',
                        description: 'Your saved tracks',
                        images: [],
                        owner: { display_name: 'You' },
                        tracks: { total: totalTracks },
                        public: false
                    };
                    setSelectedPlaylist(dummyPlaylist);
                    clearTimeout(timeoutId);

                    // Trigger progressive load
                    loadFullPlaylist(activeToken, 'LIKED_SONGS', totalTracks, true);
                } catch (err) {
                    if (fetchOperationIdRef.current !== currentOpId) return;
                    clearTimeout(timeoutId);
                    console.error('Error fetching liked songs:', err);
                    if (err.status === 429) {
                        setPlaylistError('Rate limit exceeded. You are refreshing too fast!');
                    } else {
                        setPlaylistError('Failed to load Liked Songs. ' + (err.message || ''));
                    }
                }
            } else {
                try {
                    console.log('Fetching playlist details for:', playlistId);
                    const playlistDetails = await fetchPlaylist(activeToken, playlistId);
                    console.log('Playlist details fetched:', playlistDetails);
                    if (fetchOperationIdRef.current !== currentOpId) return;

                    if (playlistDetails.error) throw playlistDetails.error;
                    setSelectedPlaylist(playlistDetails);
                    clearTimeout(timeoutId);

                    // Trigger progressive load
                    loadFullPlaylist(activeToken, playlistId, playlistDetails.tracks.total, false);
                } catch (err) {
                    if (fetchOperationIdRef.current !== currentOpId) return;
                    clearTimeout(timeoutId);
                    console.error('Error restoring playlist:', err);
                    if (err.status === 429) {
                        setPlaylistError('Rate limit exceeded. Please wait a moment.');
                    } else {
                        setPlaylistError('Playlist not found or private. ' + (err.message || ''));
                    }
                }
            }
        }
    }

    useEffect(() => {
        // ... (checkAuth logic remains same) ...
        const checkAuth = async () => {
            // ... (existing auth check) ...
            const params = new URLSearchParams(window.location.search);
            const accessToken = params.get('access_token');
            let activeToken = token;
            if (accessToken) {
                activeToken = accessToken;
                setToken(accessToken);
                localStorage.setItem('spotify_access_token', accessToken);
                window.history.pushState({}, null, '/');
            }

            if (activeToken) {
                setServerMessage('Connected to Spotify!');

                // 1. Kick off Profile/Metadata fetching in background
                setIsLoadingProfile(true);
                setProfileError(null);

                // Don't await them here, just let them update state when ready
                fetchProfile(activeToken)
                    .then(data => {
                        if (data.error) {
                            console.error('Profile fetch error:', data.error);
                            setProfileError(data.error.message || 'Failed to load profile');
                            if (data.error.status === 401) {
                                handleLogout(); // Token expired
                            }
                        }
                        else setProfile(data);
                    })
                    .catch(err => {
                        console.error('Profile network error:', err);
                        setProfileError('Network error loading profile');
                    })
                    .finally(() => setIsLoadingProfile(false));

                fetchUserPlaylists(activeToken, 1).then(data => {
                    if (data.error) console.error('Playlist count fetch error:', data.error);
                    else setPlaylistCount(data.total);
                }).catch(err => console.error('Playlist count network error:', err));

                // 2. Immediately handle Valid Views (Routing)
                // This ensures we don't get stuck waiting for the above
                const hash = window.location.hash;
                if (hash === '#playlists') {
                    setCurrentView('playlists');
                } else if (hash.startsWith('#playlist/')) {
                    restorePlaylistFromHash(hash, activeToken);
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
                    .catch(() => setServerMessage('Backend not connected (Is the server running on port 8888?)'))
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
                // If we're already viewing this playlist, do nothing?
                // But selectedPlaylist might be null if we came from back button
                // So always try to restore if needed
                restorePlaylistFromHash(hash, token);
            }
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, [token]);

    // Reactive Data Loading
    useEffect(() => {
        if (currentView === 'playlists' && token && !playlistsData && !isLoadingPlaylists) {
            loadPlaylists(token);
        }
    }, [currentView, token, playlistsData, isLoadingPlaylists]);

    const loadPlaylists = (authToken) => {
        setIsLoadingPlaylists(true);
        Promise.all([
            fetchUserPlaylists(authToken, 50).catch(err => ({ error: err })),
            fetchSavedTracks(authToken, 0, 1).catch(err => ({ error: err }))
        ])
            .then(([playlists, likedTracks]) => {
                if (!playlists.error) setPlaylistsData(playlists.items);
                else setPlaylistsData([]); // Fallback to empty

                if (!likedTracks.error) setLikedSongsCount(likedTracks.total);
                else setLikedSongsCount(0); // Fallback

                setIsLoadingPlaylists(false);
            });
    };

    const handleLogin = () => {
        window.location.href = '/login';
    }

    const handleViewPlaylists = () => {
        if (!token) return;
        window.location.hash = 'playlists';
        setCurrentView('playlists');
        // Effect will handle loading
    }

    const handlePlaylistClick = async (playlist) => {
        setSelectedPlaylist(playlist);
        setPlaylistTracks([]); // Clear previous
        setCurrentView('details');
        setPlaylistError(null);

        // Handle Liked Songs special case
        if (playlist.id === 'LIKED_SONGS') {
            window.location.hash = `playlist/liked`;
            loadFullPlaylist(token, 'LIKED_SONGS', playlist.tracks.total, true);
        } else {
            window.location.hash = `playlist/${playlist.id}`;
            loadFullPlaylist(token, playlist.id, playlist.tracks.total, false);
        }
    }

    const handleBackToPlaylists = () => {
        window.location.hash = 'playlists';
        setCurrentView('playlists');
        setSelectedPlaylist(null);
        setPlaylistError(null);
    }

    const handleBackToProfile = () => {
        window.location.hash = ''; // Clears hash
        setCurrentView('profile');
    }

    const handleManualPlaylist = async () => {
        const input = prompt("Enter Spotify Playlist Link or URI:");
        if (!input) return;

        // Simple extraction: try to get ID from URL or use as is
        let id = input;
        try {
            if (input.includes('spotify.com/playlist/')) {
                const url = new URL(input);
                const pathParts = url.pathname.split('/');
                id = pathParts[pathParts.indexOf('playlist') + 1];
            } else if (input.includes('spotify:playlist:')) {
                id = input.split(':')[2];
            }

            // Clean up queries?
            if (id.includes('?')) id = id.split('?')[0];

            if (!id) throw new Error("Invalid Playlist Link");

            setPlaylistError(null);
            setIsLoadingPlaylists(true); // Show some loading state if visible

            const details = await fetchPlaylist(token, id);
            if (details.error) throw details.error;

            handlePlaylistClick(details);
        } catch (err) {
            console.error(err);
            alert("Could not load playlist: " + (err.message || "Unknown error"));
        } finally {
            setIsLoadingPlaylists(false);
        }
    };

    const handleMultiAnalyze = async (selectedPlaylists) => {
        if (!selectedPlaylists || selectedPlaylists.length === 0) return;

        setIsFetchingTracks(true);
        setCurrentView('details');

        // Create a temporary combined playlist object
        const combinedPlaylist = {
            id: 'COMBINED_ANALYSIS',
            name: `Combined Analysis (${selectedPlaylists.length})`,
            description: `Analysis of: ${selectedPlaylists.map(p => p.name).join(', ')}`,
            images: [],
            tracks: { total: selectedPlaylists.reduce((acc, p) => acc + p.tracks.total, 0) },
            owner: { display_name: 'You' }
        };

        setSelectedPlaylist(combinedPlaylist); // Show details page immediately

        try {
            // Fetch all tracks in parallel
            const promises = selectedPlaylists.map(async (p) => {
                try {
                    let items = [];
                    // 1. Fetch First Page
                    if (p.id === 'LIKED_SONGS') {
                        const firstPage = await fetchSavedTracks(token, 0, 50);
                        items = firstPage.items; // Keep wrapper

                        // 2. Fetch Remaining
                        if (p.tracks.total > 50) {
                            const remaining = await fetchRemainingTracks(token, p.tracks.total, 'me');
                            // fetchRemainingTracks for 'me' endpoint returns the wrapping object {added_at, track}.
                            items = [...items, ...remaining];
                        }
                    } else {
                        const firstPage = await fetchPlaylistTracks(token, p.id, 0, 100);
                        items = firstPage.items; // Keep wrapper

                        if (p.tracks.total > 100) {
                            const remaining = await fetchRemainingTracks(token, p.tracks.total, null, p.id);
                            // fetchRemainingTracks for playlist also returns wrapped objects
                            items = [...items, ...remaining];
                        }
                    }

                    // Tag with source playlist and ensure valid track
                    return items
                        .filter(i => i && i.track && i.track.id)
                        .map(i => ({ ...i, sourcePlaylist: { id: p.id, name: p.name, owner: p.owner, collaborative: p.collaborative } }));

                } catch (e) {
                    console.error(`Failed to fetch tracks for ${p.name}`, e);
                    return [];
                }
            });

            const results = await Promise.all(promises);
            // Flatten results
            const allTracks = results.flat();

            console.log("Combined analysis tracks:", allTracks.length);
            setPlaylistTracks(allTracks);
        } catch (err) {
            console.error("Error fetching multi-playlist tracks:", err);
            setPlaylistError("Failed to load tracks for some playlists.");
        } finally {
            setIsFetchingTracks(false);
        }
    };

    const handleLogout = () => {
        setToken(null);
        setProfile(null);
        localStorage.removeItem('spotify_access_token');
        window.location.hash = '';
        window.history.pushState({}, null, '/');
        window.location.href = 'http://localhost:5173'; // Force reload/redirect to clean URL
    }

    const isError = serverMessage.includes('Backend not connected');

    const renderView = () => {
        if (!token) {
            return (
                <div className="glass-card">
                    <h1 className="title-gradient">Spotify Toolkit</h1>
                    <p className="description-text">nothing is perfect but some things are good enough.</p>
                    <div className={`status-box ${isError ? 'error' : 'success'}`}>
                        {serverMessage}
                    </div>
                    <button className="spotify-btn" onClick={handleLogin}>Connect with Spotify</button>
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
                                <p className="description-text">
                                    Loading profile...
                                </p>
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
                            <>
                                {/* Fallback if we have no profile and no error yet, likely initial render before effect */}
                                <a href="/login" className="login-button">
                                    Login with Spotify
                                </a>
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
                        />
                    </div>);
            case 'details':
                return (
                    <div className="glass-card full-width-card">
                        {playlistError ? (
                            <div className="playlists-container error-container">
                                <div className="playlists-header">
                                    <h2>Error</h2>
                                </div>
                                <div className="status-box error">
                                    {playlistError}
                                </div>
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
    )
}

export default App
