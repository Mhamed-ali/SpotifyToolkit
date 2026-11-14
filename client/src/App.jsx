import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './index.css';
import './App.css';
import { getMusicProvider, PROVIDERS } from './providers/ProviderFactory';
import { PLAYLIST_IDS, PlaylistModel } from './models/Playlist';
import { ArabicDetector } from './services/filters/ArabicDetector';
import { DuplicateDetector } from './services/DuplicateDetector';
import { ExcelExporter, EXPORT_FIELDS } from './services/ExcelExporter';
import {
    calculateTopArtists,
    calculateTimelineStats,
    calculatePlaylistStats,
    computeSmartSplitBuckets,
    comparePlaylistTracks,
    isTrackUnplayableOrLocal,
    matchLocalLibraryReplacements,
    resolveSpotifyTrackReplacement
} from './services/analysis.utils';
import { formatDuration, extractReleaseYear } from './utils/formatters';
import { createClientLogger } from './utils/logger';

const logger = createClientLogger('AppV2');

function App() {
    // =========================================================================
    // AUTH & PROVIDER STATE
    // =========================================================================
    const [serverMessage, setServerMessage] = useState('Checking server connection...');
    const [providerId, setProviderId] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const urlProvider = params.get('provider');
        if (urlProvider && (urlProvider === PROVIDERS.SPOTIFY || urlProvider === PROVIDERS.ANGHAMI)) {
            localStorage.setItem('music_provider', urlProvider);
            return urlProvider;
        }
        return localStorage.getItem('music_provider') || PROVIDERS.SPOTIFY;
    });
    const [token, setToken] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const urlAccess = params.get('access_token');
        const urlRefresh = params.get('refresh_token');
        if (urlAccess) {
            localStorage.setItem('spotify_access_token', urlAccess);
            if (urlRefresh) {
                localStorage.setItem('spotify_refresh_token', urlRefresh);
            }
            window.history.replaceState({}, document.title, '/');
            return urlAccess;
        }
        return localStorage.getItem('spotify_access_token');
    });
    const [profile, setProfile] = useState(null);
    const [authAccessForbidden, setAuthAccessForbidden] = useState(false);

    // =========================================================================
    // LIBRARY & PLAYLISTS STATE
    // =========================================================================
    const [playlistsData, setPlaylistsData] = useState([]);
    const [likedSongsCount, setLikedSongsCount] = useState(0);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
    const [playlistSearch, setPlaylistSearch] = useState('');
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [isMobilePlaylistsExpanded, setIsMobilePlaylistsExpanded] = useState(false);
    const [selectedPlaylistIds, setSelectedPlaylistIds] = useState(() => new Set(['ALL']));

    // =========================================================================
    // WORKFLOW, ADVANCED OPTIONS & FILTER STATE
    // =========================================================================
    const [activeWorkflow, setActiveWorkflow] = useState(
        () => localStorage.getItem('pending_workflow') || 'arabic-all'
    );
    const [isAdvOpen, setIsAdvOpen] = useState(false);
    const [advancedOptions, setAdvancedOptions] = useState({
        matchCriteria: 'fuzzy',          // 'strict' | 'fuzzy'
        durationTolerance: 2,            // 0 .. 5 seconds
        scope: 'per',                    // 'per' (default) | 'cross'
        keepStrategy: 'oldest',          // 'oldest' | 'newest' | 'popular'
        strictArabicExtraction: false    // false = Standard (includes Artist Script + Genres), true = Strict
    });

    const [activeArtistFilter, setActiveArtistFilter] = useState(null);
    const [activeDecadeFilter, setActiveDecadeFilter] = useState(null);
    const [activeGenreBucketId, setActiveGenreBucketId] = useState(null);
    const [onlyDeadTracksFilter, setOnlyDeadTracksFilter] = useState(false);
    const [trackSearch, setTrackSearch] = useState('');
    const [sortBy, setSortBy] = useState('default');
    const [isSavingSortOrder, setIsSavingSortOrder] = useState(false);

    // Dead / Locked Track 3-Stage Replacement Engine State
    const [deadReplacementsMap, setDeadReplacementsMap] = useState({});
    const [searchedNoMatchIds, setSearchedNoMatchIds] = useState(() => new Set());
    const [isSearchingReplacements, setIsSearchingReplacements] = useState(false);
    const [deadSearchProgress, setDeadSearchProgress] = useState(null); // { done, total } | null
    const [isReplacingDeadTracks, setIsReplacingDeadTracks] = useState(false);

    // Compare & Sync State ('compare' workflow)
    const [comparePlaylistA, setComparePlaylistA] = useState(PLAYLIST_IDS.LIKED_SONGS);
    const [comparePlaylistB, setComparePlaylistB] = useState('');
    const [compareOp, setCompareOp] = useState('diff'); // 'diff' | 'shared' | 'union'
    const [compareTracksState, setCompareTracksState] = useState({ tracksA: [], tracksB: [], loading: false });
    const [isSyncingCompare, setIsSyncingCompare] = useState(false);

    // Top 50 & History State ('top50' workflow)
    const [topRange, setTopRange] = useState('short_term'); // 'short_term' | 'medium_term' | 'long_term' | 'recent'
    const [topTracksState, setTopTracksState] = useState({
        items: [],
        topArtists: [],
        loading: false,
        needsReauth: false
    });

    // Inline Docked Spotify Mini-Player State
    const [previewTrack, setPreviewTrack] = useState(null); // { id, name, artist } | null

    // Insights State
    const [includeCollabs, setIncludeCollabs] = useState(false);

    // Loaded Tracks, Artist Genre Cache & Selection State
    const [rawScopeTracks, setRawScopeTracks] = useState([]);
    const [genreCacheVersion, setGenreCacheVersion] = useState(0);
    const [selectedKeys, setSelectedKeys] = useState(() => new Set());
    const [scanProgress, setScanProgress] = useState(null); // { current, total, label }
    const [allLibraryArabicCount, setAllLibraryArabicCount] = useState(null);
    const [visibleLimit, setVisibleLimit] = useState(120);

    // =========================================================================
    // MODALS & TOAST STATE
    // =========================================================================
    const [activeModal, setActiveModal] = useState(null); // 'save' | 'export' | 'remove' | 'link' | null
    const [newPlaylistName, setNewPlaylistName] = useState('🌙 Extracted Arabic Favorites');
    const [isSubmittingModal, setIsSubmittingModal] = useState(false);
    const [linkInputUrl, setLinkInputUrl] = useState('');
    const [loginQuickUrl, setLoginQuickUrl] = useState('');
    const [selectedExportFields, setSelectedExportFields] = useState(
        () => EXPORT_FIELDS.map(f => f.key)
    );
    const [toastMessage, setToastMessage] = useState(null);

    // Caches so switching views/playlists is instant
    const tracksCacheRef = useRef({});
    const inFlightPromisesRef = useRef({});
    const genreCacheRef = useRef(new Map());
    const arabicEvalCacheRef = useRef(new Map());
    const loadOperationRef = useRef(0);
    const toastTimerRef = useRef(null);

    const provider = getMusicProvider(providerId);

    const showToast = useCallback((msg) => {
        setToastMessage(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage(null);
        }, 3200);
    }, []);

    const updateAdvancedOption = (key, value) => {
        setAdvancedOptions(prev => ({ ...prev, [key]: value }));
    };

    // Sync token when spotify.service.js automatically refreshes an expired access token
    useEffect(() => {
        const handleTokenRefreshed = (e) => {
            if (e.detail) setToken(e.detail);
        };
        window.addEventListener('spotify-token-refreshed', handleTokenRefreshed);
        return () => window.removeEventListener('spotify-token-refreshed', handleTokenRefreshed);
    }, []);

    // =========================================================================
    // ENRICH TRACK ITEM HELPER (Unique _instanceKey per playlist instance)
    // =========================================================================
    const enrichTrackItem = useCallback((item, sourcePlaylist, instanceIdx = 0) => {
        if (!item || !item.track || !item.track.id) return null;
        const pid = sourcePlaylist?.id || item.sourcePlaylist?.id || 'SINGLE';
        const uri = item.track.uri || `spotify:track:${item.track.id}`;
        const releaseYear = parseInt(extractReleaseYear(item.track.album?.release_date), 10) || 0;
        const addedAtMs = item.added_at ? (new Date(item.added_at).getTime() || 0) : 0;

        return {
            ...item,
            sourcePlaylist: item.sourcePlaylist || sourcePlaylist,
            _releaseYear: releaseYear,
            _addedAtMs: addedAtMs,
            _selectionKey: `${pid}::${uri}::${instanceIdx}`
        };
    }, []);

    // =========================================================================
    // FETCH TRACKS FOR A SINGLE PLAYLIST (WITH CACHE & IN-FLIGHT DEDUPLICATION)
    // =========================================================================
    const fetchTracksForPlaylistCached = useCallback(async (activeToken, playlistObj, activeProvider, onBatchProgress = null) => {
        const pid = playlistObj.id;
        if (tracksCacheRef.current[pid]) {
            return tracksCacheRef.current[pid];
        }

        const existingInFlight = inFlightPromisesRef.current[pid];
        if (existingInFlight) {
            if (typeof onBatchProgress === 'function') {
                existingInFlight.listeners.add(onBatchProgress);
                if (existingInFlight.lastLoaded > 0) {
                    onBatchProgress(existingInFlight.lastLoaded, existingInFlight.lastTotal);
                }
            }
            return existingInFlight.promise;
        }

        const total = playlistObj.tracks?.total || 0;
        const sourceMeta = {
            id: pid,
            name: playlistObj.name,
            owner: playlistObj.owner,
            collaborative: playlistObj.collaborative
        };

        const listeners = new Set();
        if (typeof onBatchProgress === 'function') {
            listeners.add(onBatchProgress);
        }

        const inFlightEntry = {
            promise: null,
            listeners,
            lastLoaded: 0,
            lastTotal: total
        };

        const notifyProgress = (loaded, actualTotal) => {
            inFlightEntry.lastLoaded = loaded;
            inFlightEntry.lastTotal = actualTotal;
            inFlightEntry.listeners.forEach(fn => {
                try {
                    fn(loaded, actualTotal);
                } catch (_) {
                    // Ignore listener errors
                }
            });
        };

        const fetchPromise = (async () => {
            let rawItems = [];
            if (pid === PLAYLIST_IDS.LIKED_SONGS) {
                const firstPage = await activeProvider.fetchSavedTracks(activeToken, 0, 50);
                const firstItems = firstPage?.items || [];
                const actualTotal = firstPage?.total ?? total;
                notifyProgress(firstItems.length, actualTotal);
                if (actualTotal > firstItems.length) {
                    const rest = await activeProvider.fetchRemainingTracks(
                        activeToken,
                        actualTotal,
                        'me',
                        null,
                        notifyProgress
                    );
                    rawItems = [...firstItems, ...(rest || [])];
                } else {
                    rawItems = firstItems;
                }
            } else {
                rawItems = await activeProvider.fetchAllTracksForPlaylist(
                    activeToken,
                    pid,
                    total,
                    notifyProgress
                );
            }

            const enriched = (rawItems || [])
                .map((item, idx) => enrichTrackItem(item, sourceMeta, idx))
                .filter(Boolean);

            tracksCacheRef.current[pid] = enriched;
            delete inFlightPromisesRef.current[pid];
            return enriched;
        })().catch(err => {
            delete inFlightPromisesRef.current[pid];
            throw err;
        });

        inFlightEntry.promise = fetchPromise;
        inFlightPromisesRef.current[pid] = inFlightEntry;
        return fetchPromise;
    }, [enrichTrackItem]);

    // =========================================================================
    // LOAD TRACKS + PASS 2/3 ARTIST GENRE ANALYSIS FOR CURRENT SCOPE
    // =========================================================================
    const loadScopeTracks = useCallback(async (
        scopeSet,
        playlistsList,
        likedCount,
        activeToken,
        activeProvider
    ) => {
        if (!activeToken) return;

        const opId = ++loadOperationRef.current;

        const likedPlaylistObj = PlaylistModel.createLikedSongs(likedCount || 0);
        const allAvailablePlaylists = [
            ...(likedCount > 0 ? [likedPlaylistObj] : []),
            ...(playlistsList || [])
        ];

        const targetPlaylists = scopeSet.has('ALL')
            ? allAvailablePlaylists
            : allAvailablePlaylists.filter(p => scopeSet.has(p.id));

        if (targetPlaylists.length === 0) {
            setRawScopeTracks([]);
            setScanProgress(null);
            return;
        }

        const totalPlaylists = targetPlaylists.length;
        const totalExpectedTracks = Math.max(
            1,
            targetPlaylists.reduce((sum, p) => sum + (p.tracks?.total || 0), 0)
        );

        // Pass 1 maps smoothly from 2% -> 78% weighted by actual tracks analyzed
        const calcPass1Pct = (analyzedCount) => {
            const ratio = Math.min(1, Math.max(0, analyzedCount / totalExpectedTracks));
            return Math.max(2, Math.min(78, Math.round(2 + ratio * 76)));
        };

        // FAST-PATH: If all target playlists are already in memory cache, combine in 1 render!
        const allCached = targetPlaylists.every(pl => Boolean(tracksCacheRef.current[pl.id]));
        let accumulated = [];

        try {
            if (allCached) {
                for (let i = 0; i < totalPlaylists; i++) {
                    accumulated.push(...tracksCacheRef.current[targetPlaylists[i].id]);
                }
                setRawScopeTracks(accumulated);
                setScanProgress(null);
            } else {
                // Immediately display any already-cached playlists in targetPlaylists (or clear old playlist)
                const initialCached = [];
                for (let i = 0; i < totalPlaylists; i++) {
                    const cached = tracksCacheRef.current[targetPlaylists[i].id];
                    if (cached) initialCached.push(...cached);
                }
                setRawScopeTracks(initialCached);

                for (let i = 0; i < totalPlaylists; i++) {
                    if (loadOperationRef.current !== opId) return;
                    const pl = targetPlaylists[i];

                    if (tracksCacheRef.current[pl.id]) {
                        accumulated.push(...tracksCacheRef.current[pl.id]);
                        continue;
                    }

                    const expectedPlTotal = pl.tracks?.total || 0;
                    const baseAccumulatedCount = accumulated.length;

                    setScanProgress({
                        phase: 'tracks',
                        phaseBadge: 'PASS 1/2 • TRACK & METADATA ANALYSIS',
                        playlistName: pl.name,
                        pct: calcPass1Pct(baseAccumulatedCount),
                        tracksAnalyzed: baseAccumulatedCount,
                        label: `Analyzing tracks in "${pl.name}" (${i + 1}/${totalPlaylists})`,
                        subLabel: expectedPlTotal > 0
                            ? `Scanning 0 / ${expectedPlTotal.toLocaleString()} tracks in "${pl.name}"...`
                            : `Scanning track titles, Franco-Arab keywords, artist script & release metadata`
                    });

                    try {
                        const items = await fetchTracksForPlaylistCached(
                            activeToken,
                            pl,
                            activeProvider,
                            (loadedInPl, totalInPl) => {
                                if (loadOperationRef.current !== opId) return;
                                const totalAnalyzedNow = baseAccumulatedCount + loadedInPl;
                                setScanProgress({
                                    phase: 'tracks',
                                    phaseBadge: 'PASS 1/2 • TRACK & METADATA ANALYSIS',
                                    playlistName: pl.name,
                                    pct: calcPass1Pct(totalAnalyzedNow),
                                    tracksAnalyzed: totalAnalyzedNow,
                                    label: `Analyzing tracks in "${pl.name}" (${i + 1}/${totalPlaylists})`,
                                    subLabel: `Scanning ${loadedInPl.toLocaleString()} / ${totalInPl.toLocaleString()} tracks in "${pl.name}"...`
                                });
                            }
                        );
                        if (loadOperationRef.current !== opId) return;
                        accumulated.push(...items);
                        setRawScopeTracks([...accumulated]);
                    } catch (err) {
                        logger.warn(`Skipping playlist ${pl.name}`, err);
                    }
                }
            }

            if (loadOperationRef.current !== opId) return;

            // PASS 2: Collect uncached artist IDs for tracks that did not match Pass 1 Regex
            // so we can run Spotify Artist Genre detection (matching all 76/76 tracks!)
            const missingArtistIds = [];
            accumulated.forEach(item => {
                const pass1Reason = ArabicDetector.detectTrack(item, { strictMode: false });
                if (!pass1Reason && Array.isArray(item.track?.artists)) {
                    item.track.artists.forEach(a => {
                        if (a?.id && !genreCacheRef.current.has(a.id)) {
                            missingArtistIds.push(a.id);
                        }
                    });
                }
            });

            const uniqueMissingArtistIds = Array.from(new Set(missingArtistIds));
            if (uniqueMissingArtistIds.length > 0 && activeProvider.fetchArtistsBatch) {
                const totalArtistsToClassify = uniqueMissingArtistIds.length;
                setScanProgress({
                    phase: 'genres',
                    phaseBadge: 'PASS 2/2 • ARTIST GENRE CLASSIFICATION',
                    playlistName: `${totalArtistsToClassify} Artists`,
                    pct: 80,
                    tracksAnalyzed: accumulated.length,
                    label: `Analyzing genres for ${totalArtistsToClassify.toLocaleString()} artists...`,
                    subLabel: `Classified 0 / ${totalArtistsToClassify.toLocaleString()} artists across ${accumulated.length.toLocaleString()} analyzed tracks...`
                });

                try {
                    const artistObjs = await activeProvider.fetchArtistsBatch(
                        activeToken,
                        uniqueMissingArtistIds,
                        (classifiedCount, totalArtists) => {
                            if (loadOperationRef.current !== opId) return;
                            const ratio = Math.min(1, Math.max(0, classifiedCount / Math.max(1, totalArtists)));
                            const pct = Math.max(80, Math.min(99, Math.round(80 + ratio * 19)));
                            setScanProgress({
                                phase: 'genres',
                                phaseBadge: 'PASS 2/2 • ARTIST GENRE CLASSIFICATION',
                                playlistName: `${totalArtists} Artists`,
                                pct,
                                tracksAnalyzed: accumulated.length,
                                label: `Analyzing genres for ${totalArtists.toLocaleString()} artists...`,
                                subLabel: `Classified ${classifiedCount.toLocaleString()} / ${totalArtists.toLocaleString()} artists across ${accumulated.length.toLocaleString()} analyzed tracks...`
                            });
                        }
                    );
                    if (loadOperationRef.current !== opId) return;
                    artistObjs.forEach(artist => {
                        if (artist?.id) {
                            genreCacheRef.current.set(artist.id, artist.genres || []);
                        }
                    });
                    setGenreCacheVersion(v => v + 1);
                } catch (err) {
                    logger.warn('Artist genre batch lookup failed', err);
                }
            }
        } finally {
            if (loadOperationRef.current === opId) {
                setScanProgress(null);
            }
        }
    }, [fetchTracksForPlaylistCached]);

    // =========================================================================
    // INITIAL AUTH & LIBRARY BOOTSTRAP
    // =========================================================================
    const handleLogout = useCallback(() => {
        setToken(null);
        setProfile(null);
        setPlaylistsData([]);
        setRawScopeTracks([]);
        tracksCacheRef.current = {};
        inFlightPromisesRef.current = {};
        genreCacheRef.current.clear();
        arabicEvalCacheRef.current.clear();
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('music_provider');
        localStorage.removeItem('pending_workflow');
        localStorage.removeItem('pending_playlist_link');
        window.location.hash = '';
        window.history.pushState({}, null, '/');
    }, []);

    useEffect(() => {
        const initAuthAndLibrary = async () => {
            const params = new URLSearchParams(window.location.search);
            const authError = params.get('error');
            if (authError) {
                window.history.replaceState({}, document.title, '/');
                showToast(`Spotify login error (${authError}). Please tap Continue with Spotify again.`);
            }

            const activeToken = token;
            const activeProvider = getMusicProvider(providerId);

            if (!activeToken) {
                fetch('/health')
                    .then(res => res.json())
                    .then(data => setServerMessage(data.message || 'Server Online • Spotify OAuth & Anghami SDK Ready'))
                    .catch(() => setServerMessage('Backend not connected (Is the server running on port 8888?)'));
                return;
            }

            setServerMessage(`Connected to ${activeProvider.displayName}`);
            setIsLoadingLibrary(true);
            setAuthAccessForbidden(false);

            try {
                const [profData, playlistsRes, likedRes] = await Promise.all([
                    activeProvider.fetchProfile(activeToken).catch(err => ({ error: err })),
                    activeProvider.fetchUserPlaylists(activeToken, 50).catch(err => ({ error: err })),
                    activeProvider.fetchSavedTracks(activeToken, 0, 1).catch(err => ({ error: err }))
                ]);

                const profStatus = profData?.status || profData?.error?.status;
                const plStatus = playlistsRes?.status || playlistsRes?.error?.status;

                if (profStatus === 401) {
                    handleLogout();
                    return;
                }
                if (profStatus === 403 || plStatus === 403) {
                    setAuthAccessForbidden(true);
                }
                if (!profData?.error) {
                    setProfile(profData);
                }

                let loadedPlaylists = !playlistsRes?.error ? (playlistsRes.items || []) : [];
                const likedTotal = !likedRes?.error ? (likedRes.total || 0) : 0;

                const pendingLink = localStorage.getItem('pending_playlist_link');
                let initialScope = new Set(['ALL']);
                let initialWorkflow = localStorage.getItem('pending_workflow') || 'arabic-all';
                localStorage.removeItem('pending_workflow');

                if (pendingLink) {
                    localStorage.removeItem('pending_playlist_link');
                    const extractedId = activeProvider.extractPlaylistIdFromInput(pendingLink);
                    if (extractedId) {
                        try {
                            const importedPl = await activeProvider.fetchPlaylist(activeToken, extractedId);
                            if (importedPl && !importedPl.error) {
                                loadedPlaylists = [
                                    importedPl,
                                    ...loadedPlaylists.filter(p => p.id !== importedPl.id)
                                ];
                                initialScope = new Set([importedPl.id]);
                                initialWorkflow = 'arabic-playlist';
                                showToast(`Loaded "${importedPl.name}" & extracted Arabic tracks!`);
                            }
                        } catch (e) {
                            logger.warn('Failed to load pending playlist link', e);
                        }
                    }
                } else if (initialWorkflow === 'arabic-playlist') {
                    const firstId = likedTotal > 0
                        ? PLAYLIST_IDS.LIKED_SONGS
                        : (loadedPlaylists[0]?.id || 'ALL');
                    initialScope = new Set([firstId]);
                }

                setPlaylistsData(loadedPlaylists);
                setLikedSongsCount(likedTotal);
                setSelectedPlaylistIds(initialScope);
                setActiveWorkflow(initialWorkflow);
                if (loadedPlaylists.length > 0) {
                    setComparePlaylistB(loadedPlaylists[0].id);
                }
            } catch (err) {
                logger.error('Failed to initialize library', err);
            } finally {
                setIsLoadingLibrary(false);
            }
        };

        initAuthAndLibrary();
    }, [token, providerId, handleLogout, showToast]);

    // Trigger track loading whenever selectedPlaylistIds or library changes
    useEffect(() => {
        if (!token || isLoadingLibrary) return;
        if (playlistsData.length === 0 && likedSongsCount === 0) return;
        loadScopeTracks(selectedPlaylistIds, playlistsData, likedSongsCount, token, provider);
    }, [token, isLoadingLibrary, selectedPlaylistIds, playlistsData, likedSongsCount, provider, loadScopeTracks]);

    // Load Playlist A & Playlist B when in Compare & Sync workflow
    useEffect(() => {
        if (!token || activeWorkflow !== 'compare') return;
        let cancelled = false;

        const resolvePlaylistObj = (pid) => {
            if (pid === PLAYLIST_IDS.LIKED_SONGS) {
                return PlaylistModel.createLikedSongs(likedSongsCount || 0);
            }
            return playlistsData.find(p => p.id === pid) || null;
        };

        const loadComparePlaylists = async () => {
            const plA = resolvePlaylistObj(comparePlaylistA);
            const plB = resolvePlaylistObj(comparePlaylistB);
            if (!plA || !plB) return;

            setCompareTracksState(prev => ({ ...prev, loading: true }));
            try {
                const [tracksA, tracksB] = await Promise.all([
                    fetchTracksForPlaylistCached(token, plA, provider),
                    fetchTracksForPlaylistCached(token, plB, provider)
                ]);
                if (!cancelled) {
                    setCompareTracksState({ tracksA: tracksA || [], tracksB: tracksB || [], loading: false });
                }
            } catch (err) {
                logger.warn('Failed to load playlists for comparison', err);
                if (!cancelled) {
                    setCompareTracksState(prev => ({ ...prev, loading: false }));
                }
            }
        };

        loadComparePlaylists();
        return () => {
            cancelled = true;
            setCompareTracksState(prev => (prev.loading ? { ...prev, loading: false } : prev));
        };
    }, [token, activeWorkflow, comparePlaylistA, comparePlaylistB, playlistsData, likedSongsCount, provider, fetchTracksForPlaylistCached]);

    // Load Top 50 Tracks / Artists or Recently Played when in Top 50 & History workflow
    useEffect(() => {
        if (!token || activeWorkflow !== 'top50') return;
        let cancelled = false;

        const loadTopData = async () => {
            setTopTracksState(prev => ({ ...prev, loading: true, needsReauth: false }));
            try {
                const rangeLabel = topRange === 'short_term'
                    ? 'Top 50 (4 Weeks)'
                    : topRange === 'medium_term'
                        ? 'Top 50 (6 Months)'
                        : topRange === 'long_term'
                            ? 'All-Time Top 50'
                            : 'Recently Played';

                if (topRange === 'recent') {
                    const res = await provider.fetchRecentlyPlayed(token, 50);
                    if (cancelled) return;
                    const enriched = (res.items || [])
                        .map((item, idx) => enrichTrackItem(item, { id: 'RECENT', name: rangeLabel }, idx))
                        .filter(Boolean);
                    setTopTracksState({
                        items: enriched,
                        topArtists: calculateTopArtists(enriched, false).slice(0, 5),
                        loading: false,
                        needsReauth: false
                    });
                } else {
                    const [tracksRes, artistsRes] = await Promise.all([
                        provider.fetchTopTracks(token, topRange, 50),
                        provider.fetchTopArtists(token, topRange, 10).catch(() => [])
                    ]);
                    if (cancelled) return;
                    const enriched = (tracksRes.items || [])
                        .map((item, idx) => enrichTrackItem(item, { id: `TOP_${topRange}`, name: rangeLabel }, idx))
                        .filter(Boolean);
                    setTopTracksState({
                        items: enriched,
                        topArtists: artistsRes || [],
                        loading: false,
                        needsReauth: false
                    });
                }
            } catch (err) {
                if (cancelled) return;
                const isForbidden = err?.status === 403 || err?.status === 401;
                setTopTracksState({
                    items: [],
                    topArtists: [],
                    loading: false,
                    needsReauth: isForbidden
                });
            }
        };

        loadTopData();
        return () => {
            cancelled = true;
            setTopTracksState(prev => (prev.loading ? { ...prev, loading: false } : prev));
        };
    }, [token, activeWorkflow, topRange, provider, enrichTrackItem]);

    // =========================================================================
    // EVALUATE ARABIC DETECTION (PASS 1 REGEX + PASS 3 GENRES) & DUPLICATE CLUSTERS
    // =========================================================================
    const evaluateArabicOnList = useCallback((list) => {
        const strictMode = Boolean(advancedOptions.strictArabicExtraction);
        const evalCache = arabicEvalCacheRef.current;

        return list.map(item => {
            const tid = item?.track?.id || item?.track?.uri || '';
            const cacheKey = tid ? `${tid}::${strictMode ? 1 : 0}::${genreCacheVersion}` : null;

            let arabicReason;
            if (cacheKey && evalCache.has(cacheKey)) {
                arabicReason = evalCache.get(cacheKey);
            } else {
                const artistGenres = [];
                if (!strictMode && Array.isArray(item.track?.artists)) {
                    item.track.artists.forEach(a => {
                        const cached = genreCacheRef.current.get(a?.id);
                        if (cached) artistGenres.push(...cached);
                    });
                }
                arabicReason = ArabicDetector.detectTrack(item, { strictMode, artistGenres });
                if (cacheKey) {
                    evalCache.set(cacheKey, arabicReason);
                }
            }

            return {
                ...item,
                _arabicReason: arabicReason,
                _isArabic: Boolean(arabicReason)
            };
        });
    }, [advancedOptions.strictArabicExtraction, genreCacheVersion]);

    const evaluatedRawTracks = useMemo(
        () => evaluateArabicOnList(rawScopeTracks),
        [rawScopeTracks, evaluateArabicOnList]
    );

    // Update global Arabic match badge when viewing 'ALL'
    useEffect(() => {
        if (selectedPlaylistIds.has('ALL') && evaluatedRawTracks.length > 0) {
            const uniqueArabicIds = new Set(
                evaluatedRawTracks.filter(t => t._isArabic).map(t => t.track.id)
            );
            setAllLibraryArabicCount(uniqueArabicIds.size);
        }
    }, [selectedPlaylistIds, evaluatedRawTracks]);

    const { scopeTracks, duplicateStatusMap, duplicateRemoveCount } = useMemo(() => {
        const isMultiScope = selectedPlaylistIds.has('ALL') || selectedPlaylistIds.size > 1;
        const effectiveScope = isMultiScope ? advancedOptions.scope : 'per';

        const {
            duplicateInstanceOrder,
            duplicateStatusMap: statusMap,
            duplicateRemoveCount: removeCount
        } = DuplicateDetector.resolveDuplicateClusters(evaluatedRawTracks, {
            matchCriteria: advancedOptions.matchCriteria,
            durationTolerance: advancedOptions.durationTolerance,
            scope: effectiveScope,
            keepStrategy: advancedOptions.keepStrategy
        });

        // In 'duplicates' workflow, show every duplicate cluster instance in grouped order (KEEP followed by REMOVE)
        if (activeWorkflow === 'duplicates') {
            return {
                scopeTracks: duplicateInstanceOrder,
                duplicateStatusMap: statusMap,
                duplicateRemoveCount: removeCount
            };
        }

        // In other workflows, deduplicate identical track IDs when scanning multiple playlists ('ALL')
        // while preserving all source playlist names for Excel export
        const byTrackId = new Map();
        evaluatedRawTracks.forEach(item => {
            const tid = item.track?.id;
            if (!tid) return;
            const plName = item.sourcePlaylist?.name || 'Playlist';
            const canEditSource = PlaylistModel.canEdit(item.sourcePlaylist, profile?.id, provider.supportsWrite);
            if (!byTrackId.has(tid)) {
                byTrackId.set(tid, {
                    ...item,
                    sourcePlaylists: [plName],
                    _hasEditableSource: canEditSource
                });
            } else {
                const existing = byTrackId.get(tid);
                if (!existing.sourcePlaylists.includes(plName)) {
                    existing.sourcePlaylists.push(plName);
                }
                if (canEditSource && !existing._hasEditableSource) {
                    existing._hasEditableSource = true;
                    existing.sourcePlaylist = item.sourcePlaylist;
                }
            }
        });

        return {
            scopeTracks: Array.from(byTrackId.values()),
            duplicateStatusMap: statusMap,
            duplicateRemoveCount: removeCount
        };
    }, [evaluatedRawTracks, selectedPlaylistIds, advancedOptions, activeWorkflow, profile?.id, provider.supportsWrite]);

    // Genre Family Splitter Buckets (Integrated inside Insights & Splitter)
    const genreSplitBuckets = useMemo(
        () => computeSmartSplitBuckets(scopeTracks, 'genre', genreCacheRef.current),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [scopeTracks, genreCacheVersion]
    );

    const activeGenreBucket = useMemo(
        () => (activeGenreBucketId ? genreSplitBuckets.find(b => b.id === activeGenreBucketId) || null : null),
        [genreSplitBuckets, activeGenreBucketId]
    );

    const activeGenreTrackIdSet = useMemo(() => {
        if (!activeGenreBucket) return null;
        return new Set(activeGenreBucket.tracks.map(item => item._selectionKey));
    }, [activeGenreBucket]);

    // STAGE 1 (0 API Calls): Automatically cross-match any dead/locked tracks against playable tracks in local cache
    const localDeadReplacementsMap = useMemo(() => {
        const cachedLists = Object.values(tracksCacheRef.current);
        const allItems = cachedLists.length > 0 ? cachedLists.flat() : rawScopeTracks;
        return matchLocalLibraryReplacements(scopeTracks, allItems);
    }, [scopeTracks, rawScopeTracks]);

    const effectiveDeadReplacements = useMemo(
        () => ({ ...localDeadReplacementsMap, ...deadReplacementsMap }),
        [localDeadReplacementsMap, deadReplacementsMap]
    );

    // Compare & Sync Result Tracks
    const compareResultTracks = useMemo(() => {
        if (activeWorkflow !== 'compare') return [];
        const rawCompared = comparePlaylistTracks(
            compareTracksState.tracksA,
            compareTracksState.tracksB,
            compareOp
        );
        return evaluateArabicOnList(rawCompared);
    }, [activeWorkflow, compareTracksState.tracksA, compareTracksState.tracksB, compareOp, evaluateArabicOnList]);

    // Top 50 & History Evaluated Tracks
    const evaluatedTopTracks = useMemo(() => {
        if (activeWorkflow !== 'top50') return [];
        return evaluateArabicOnList(topTracksState.items);
    }, [activeWorkflow, topTracksState.items, evaluateArabicOnList]);

    // =========================================================================
    // FILTERED & SORTED TRACKS (Driven Directly by Active Workflow + Search)
    // =========================================================================
    const isArabicWorkflow = activeWorkflow === 'arabic-all' || activeWorkflow === 'arabic-playlist';

    const filteredTracks = useMemo(() => {
        const q = trackSearch.trim().toLowerCase();

        let baseCandidates = scopeTracks;
        if (activeWorkflow === 'compare') {
            baseCandidates = compareResultTracks;
        } else if (activeWorkflow === 'top50') {
            baseCandidates = evaluatedTopTracks;
        }

        const list = baseCandidates.filter(item => {
            const t = item.track;
            if (!t) return false;

            // In Arabic workflows, show only Arabic matches
            if (isArabicWorkflow && !item._isArabic) return false;

            // In Insights workflow when "Unplayable / Local" filter is active
            if (onlyDeadTracksFilter && !isTrackUnplayableOrLocal(item)) return false;

            // Genre Family Splitter filter inside Insights & Splitter
            if (activeGenreTrackIdSet && !activeGenreTrackIdSet.has(item._selectionKey)) return false;

            if (activeArtistFilter) {
                const matchesArtist = includeCollabs
                    ? t.artists?.some(a => a.name === activeArtistFilter)
                    : t.artists?.[0]?.name === activeArtistFilter;
                if (!matchesArtist) return false;
            }

            if (activeDecadeFilter !== null) {
                const dec = Math.floor((item._releaseYear || 0) / 10) * 10;
                if (dec !== activeDecadeFilter) return false;
            }

            if (q) {
                const artistStr = t.artists?.map(a => a.name).join(' ') || '';
                const albumStr = t.album?.name || '';
                const reasonStr = item._arabicReason || '';
                const plStr = item.sourcePlaylist?.name || '';
                const haystack = `${t.name} ${artistStr} ${albumStr} ${reasonStr} ${plStr}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }

            return true;
        });

        if (sortBy === 'title') {
            list.sort((a, b) => (a.track.name || '').localeCompare(b.track.name || ''));
        } else if (sortBy === 'artist') {
            list.sort((a, b) => (a.track.artists?.[0]?.name || '').localeCompare(b.track.artists?.[0]?.name || ''));
        } else if (sortBy === 'year-desc') {
            list.sort((a, b) => (b._releaseYear || 0) - (a._releaseYear || 0));
        } else if (sortBy === 'year-asc') {
            list.sort((a, b) => (a._releaseYear || 9999) - (b._releaseYear || 9999));
        } else if (sortBy === 'pop-desc') {
            list.sort((a, b) => (b.track.popularity || 0) - (a.track.popularity || 0));
        }

        return list;
    }, [
        scopeTracks,
        activeWorkflow,
        compareResultTracks,
        evaluatedTopTracks,
        isArabicWorkflow,
        onlyDeadTracksFilter,
        activeGenreTrackIdSet,
        activeArtistFilter,
        activeDecadeFilter,
        includeCollabs,
        trackSearch,
        sortBy
    ]);

    // Auto-select appropriate tracks when workflow, options, or filtered tracks change
    useEffect(() => {
        if (activeWorkflow === 'duplicates') {
            const toRemove = new Set(
                filteredTracks
                    .filter(item => duplicateStatusMap[item._selectionKey] === 'REMOVE')
                    .map(item => item._selectionKey)
            );
            setSelectedKeys(toRemove);
        } else {
            const allVisible = new Set(filteredTracks.map(item => item._selectionKey));
            setSelectedKeys(allVisible);
        }
    }, [activeWorkflow, advancedOptions, filteredTracks, duplicateStatusMap]);

    // =========================================================================
    // INSIGHTS & STATS CALCULATIONS
    // =========================================================================
    const insightsData = useMemo(() => {
        const baseList = scopeTracks;
        const topArtists = calculateTopArtists(baseList, includeCollabs).slice(0, 6);
        const timeline = calculateTimelineStats(baseList);
        const generalStats = calculatePlaylistStats(baseList);
        const arabicCount = baseList.filter(i => i._isArabic).length;
        const arabicPct = baseList.length > 0 ? Math.round((arabicCount / baseList.length) * 100) : 0;
        const deadTracks = baseList.filter(isTrackUnplayableOrLocal);
        const deadTracksCount = deadTracks.length;
        const deadReplaceableCount = deadTracks.filter(
            item => item?.track?.id && Boolean(effectiveDeadReplacements[item.track.id])
        ).length;

        return {
            topArtists,
            timeline,
            generalStats,
            arabicCount,
            arabicPct,
            deadTracks,
            deadTracksCount,
            deadReplaceableCount
        };
    }, [scopeTracks, includeCollabs, effectiveDeadReplacements]);

    // =========================================================================
    // WORKFLOW & PLAYLIST HANDLERS
    // =========================================================================
    const activateWorkflow = (workflow) => {
        setActiveWorkflow(workflow);
        setActiveArtistFilter(null);
        setActiveDecadeFilter(null);
        setActiveGenreBucketId(null);
        setOnlyDeadTracksFilter(false);
        setVisibleLimit(120);

        if (workflow === 'arabic-all') {
            if (!selectedPlaylistIds.has('ALL') || selectedPlaylistIds.size !== 1) {
                setSelectedPlaylistIds(new Set(['ALL']));
            }
            setNewPlaylistName('🌙 Extracted Arabic Favorites');
        } else if (workflow === 'arabic-playlist') {
            setNewPlaylistName('🌙 Extracted Arabic Playlist');
        } else if (workflow === 'compare') {
            setNewPlaylistName('🔀 Synced & Merged Playlist');
        } else if (workflow === 'top50') {
            setNewPlaylistName('🏆 My Spotify Top 50');
        } else if (workflow === 'insights') {
            setNewPlaylistName('📊 Filtered Insights Mix');
        }
    };

    const handleSelectGenreBucket = (bucket) => {
        setVisibleLimit(120);
        if (activeGenreBucketId === bucket.id) {
            setActiveGenreBucketId(null);
            setNewPlaylistName('📊 Filtered Insights Mix');
        } else {
            setActiveGenreBucketId(bucket.id);
            setNewPlaylistName(bucket.playlistTitle || bucket.name);
        }
    };

    // STAGE 2 & STAGE 3: Search Spotify by ISRC and by Title+Artist+Duration for any unresolved dead tracks
    const handleFindDeadTrackReplacements = async () => {
        if (!token || !provider.searchTracks || isSearchingReplacements) return;
        const unresolvedDead = scopeTracks.filter(
            item =>
                isTrackUnplayableOrLocal(item) &&
                !item.track?.is_local &&
                item.track?.id &&
                !effectiveDeadReplacements[item.track.id]
        );

        if (unresolvedDead.length === 0) {
            const alreadyFound = insightsData.deadReplaceableCount;
            showToast(
                alreadyFound > 0
                    ? `All ${alreadyFound} available replacement(s) are already matched and ready!`
                    : 'No searchable unavailable Spotify tracks found in this scope.'
            );
            return;
        }

        setIsSearchingReplacements(true);
        setDeadSearchProgress({ done: 0, total: unresolvedDead.length });
        let newlyFoundCount = 0;

        try {
            const searchFn = (query, limit) => provider.searchTracks(token, query, limit);
            const BATCH_SIZE = 3;

            for (let i = 0; i < unresolvedDead.length; i += BATCH_SIZE) {
                const batch = unresolvedDead.slice(i, i + BATCH_SIZE);
                const batchDiscovered = {};
                const batchNoMatch = [];

                await Promise.all(
                    batch.map(async (deadItem) => {
                        const tid = deadItem.track?.id;
                        if (!tid) return;
                        const match = await resolveSpotifyTrackReplacement(deadItem, searchFn);
                        if (match) {
                            batchDiscovered[tid] = match;
                            newlyFoundCount++;
                        } else {
                            batchNoMatch.push(tid);
                        }
                    })
                );

                if (Object.keys(batchDiscovered).length > 0) {
                    setDeadReplacementsMap(prev => ({ ...prev, ...batchDiscovered }));
                }
                if (batchNoMatch.length > 0) {
                    setSearchedNoMatchIds(prev => {
                        const next = new Set(prev);
                        batchNoMatch.forEach(id => next.add(id));
                        return next;
                    });
                }

                setDeadSearchProgress({
                    done: Math.min(i + batch.length, unresolvedDead.length),
                    total: unresolvedDead.length
                });
            }

            const totalReady = insightsData.deadReplaceableCount + newlyFoundCount;
            showToast(
                totalReady > 0
                    ? `Found playable replacements for ${totalReady} unavailable track(s)!`
                    : 'No playable replacements found on Spotify for these delisted tracks.'
            );
        } finally {
            setIsSearchingReplacements(false);
            setDeadSearchProgress(null);
        }
    };

    // 1-Click Replace Dead Track(s) with Playable Versions in their Source Playlists
    const handleReplaceDeadTracks = async (targetDeadItems = null) => {
        if (!provider.supportsWrite) return;
        const itemsToReplace = (targetDeadItems || insightsData.deadTracks).filter(
            item => item?.track?.id && Boolean(effectiveDeadReplacements[item.track.id])
        );
        if (itemsToReplace.length === 0) return;

        const targetDeadIdSet = new Set(itemsToReplace.map(item => item.track.id));
        const rawInstancesToSwap = rawScopeTracks.filter(
            item => item?.track?.id && targetDeadIdSet.has(item.track.id)
        );
        if (rawInstancesToSwap.length === 0) return;

        setIsReplacingDeadTracks(true);
        try {
            const byPlaylist = {};
            const readOnlyFallbackUris = new Set();
            const allSwapsByDeadId = {};

            rawInstancesToSwap.forEach(item => {
                const pid = item.sourcePlaylist?.id;
                const deadUri = item.track?.uri || `spotify:track:${item.track.id}`;
                const rep = effectiveDeadReplacements[item.track.id];
                const newTrack = rep?.track;
                const newUri = newTrack?.uri || (newTrack?.id ? `spotify:track:${newTrack.id}` : null);
                if (!pid || !deadUri || !newUri) return;

                allSwapsByDeadId[item.track.id] = newTrack;

                // Only attempt in-place playlist modification if the user owns/can edit the playlist
                // (e.g. skip third-party followed playlists like Lofi Girl, and save to Liked Songs instead)
                const isEditable =
                    !profile?.id || PlaylistModel.canEdit(item.sourcePlaylist, profile.id, provider.supportsWrite);

                if (isEditable) {
                    if (!byPlaylist[pid]) {
                        byPlaylist[pid] = { deadUris: new Set(), newUris: new Set(), swapsByDeadId: {} };
                    }
                    byPlaylist[pid].deadUris.add(deadUri);
                    byPlaylist[pid].newUris.add(newUri);
                    byPlaylist[pid].swapsByDeadId[item.track.id] = newTrack;
                } else {
                    readOnlyFallbackUris.add(newUri);
                }
            });

            const playlistIds = Object.keys(byPlaylist);
            let succeededPlaylists = 0;
            let likedNeedsScope = false;

            for (const pid of playlistIds) {
                const { deadUris, newUris, swapsByDeadId } = byPlaylist[pid];
                try {
                    await provider.addTracksToPlaylist(token, pid, Array.from(newUris));
                    await provider.removeTracksFromPlaylist(token, pid, Array.from(deadUris));
                    succeededPlaylists++;

                    if (tracksCacheRef.current[pid]) {
                        tracksCacheRef.current[pid] = tracksCacheRef.current[pid].map((cachedItem, idx) => {
                            const replacementTrack = swapsByDeadId[cachedItem?.track?.id];
                            if (!replacementTrack) return cachedItem;
                            return enrichTrackItem(
                                { ...cachedItem, track: replacementTrack },
                                cachedItem.sourcePlaylist,
                                idx
                            );
                        });
                    }
                } catch (plErr) {
                    logger.warn(`Skipping dead-track swap on playlist ${pid}`, plErr);
                    if (pid === PLAYLIST_IDS.LIKED_SONGS && (plErr?.status === 403 || plErr?.status === 401)) {
                        likedNeedsScope = true;
                    }
                }
            }

            // If any dead tracks only existed inside a read-only third-party playlist (e.g. Lofi Girl),
            // save their playable replacements into Liked Songs so the user still gets the working songs!
            if (readOnlyFallbackUris.size > 0 && !likedNeedsScope) {
                try {
                    await provider.addTracksToPlaylist(
                        token,
                        PLAYLIST_IDS.LIKED_SONGS,
                        Array.from(readOnlyFallbackUris)
                    );
                    succeededPlaylists++;
                } catch (fallbackErr) {
                    logger.warn('Could not save read-only playlist replacements to Liked Songs', fallbackErr);
                    if (fallbackErr?.status === 403 || fallbackErr?.status === 401) {
                        likedNeedsScope = true;
                    }
                }
            }

            if (succeededPlaylists === 0) {
                if (likedNeedsScope) {
                    showToast(
                        'Please click Log Out and Continue with Spotify once to approve Liked Songs write permission!'
                    );
                } else {
                    showToast(
                        'Cannot modify read-only playlists owned by other Spotify users (e.g. Lofi Girl).'
                    );
                }
                return;
            }

            // Update in-memory caches and rawScopeTracks for all replaced tracks
            Object.keys(tracksCacheRef.current).forEach(pid => {
                if (!tracksCacheRef.current[pid]) return;
                tracksCacheRef.current[pid] = tracksCacheRef.current[pid].map((cachedItem, idx) => {
                    const replacementTrack = allSwapsByDeadId[cachedItem?.track?.id];
                    if (!replacementTrack) return cachedItem;
                    return enrichTrackItem(
                        { ...cachedItem, track: replacementTrack },
                        cachedItem.sourcePlaylist,
                        idx
                    );
                });
            });

            setRawScopeTracks(prev =>
                prev.map((item, idx) => {
                    const rep = effectiveDeadReplacements[item?.track?.id];
                    if (!rep?.track || !targetDeadIdSet.has(item.track.id)) return item;
                    return enrichTrackItem(
                        { ...item, track: rep.track },
                        item.sourcePlaylist,
                        idx
                    );
                })
            );

            showToast(
                `Replaced ${itemsToReplace.length} locked track(s) with playable versions across ${succeededPlaylists} playlist(s)!`
            );
        } catch (err) {
            logger.error('Failed to replace dead tracks', err);
            showToast(`Could not replace track: ${err.message || 'Check playlist write permissions'}`);
        } finally {
            setIsReplacingDeadTracks(false);
        }
    };

    // 1-Click Sync Missing Tracks (A - B) directly into Target Playlist B
    const handleSyncMissingToPlaylistB = async () => {
        if (!comparePlaylistB || comparePlaylistB === PLAYLIST_IDS.LIKED_SONGS) {
            showToast('Select a user-created Target Playlist B to sync tracks into!');
            return;
        }
        const uris = Array.from(new Set(compareResultTracks.map(i => i.track?.uri).filter(Boolean)));
        if (uris.length === 0) return;

        setIsSyncingCompare(true);
        try {
            await provider.addTracksToPlaylist(token, comparePlaylistB, uris);
            const targetPl = playlistsData.find(p => p.id === comparePlaylistB);
            const targetName = targetPl?.name || 'Playlist B';

            // Update cache & sidebar count for Playlist B
            delete tracksCacheRef.current[comparePlaylistB];
            setPlaylistsData(prev =>
                prev.map(pl =>
                    pl.id === comparePlaylistB
                        ? { ...pl, tracks: { ...pl.tracks, total: (pl.tracks?.total || 0) + uris.length } }
                        : pl
                )
            );
            // Reload Playlist B so A - B updates to 0 missing
            if (targetPl) {
                const updatedB = await fetchTracksForPlaylistCached(token, targetPl, provider);
                setCompareTracksState(prev => ({ ...prev, tracksB: updatedB || [] }));
            }
            showToast(`Synced ${uris.length} missing tracks into "${targetName}"!`);
        } catch (err) {
            logger.error('Failed to sync tracks to Playlist B', err);
            showToast(`Sync failed: ${err.message || 'Check playlist write permissions'}`);
        } finally {
            setIsSyncingCompare(false);
        }
    };

    // Permanently Save Current Sort Order to the Selected Spotify Playlist
    const singleEditablePlaylistId = useMemo(() => {
        if (selectedPlaylistIds.size !== 1) return null;
        const onlyId = Array.from(selectedPlaylistIds)[0];
        if (!onlyId || onlyId === 'ALL' || onlyId === PLAYLIST_IDS.LIKED_SONGS) return null;
        return onlyId;
    }, [selectedPlaylistIds]);

    const handleApplySortToSpotify = async () => {
        if (!singleEditablePlaylistId || sortBy === 'default') return;
        const uris = filteredTracks.map(i => i.track?.uri).filter(Boolean);
        if (uris.length === 0) return;

        setIsSavingSortOrder(true);
        try {
            await provider.replacePlaylistTracks(token, singleEditablePlaylistId, uris);
            const plName = playlistsData.find(p => p.id === singleEditablePlaylistId)?.name || 'Playlist';
            const reorderedItems = filteredTracks.map((item, idx) =>
                enrichTrackItem(item, item.sourcePlaylist, idx)
            );
            tracksCacheRef.current[singleEditablePlaylistId] = reorderedItems;
            setRawScopeTracks(reorderedItems);
            setSortBy('default');
            showToast(`Permanently saved new track order to "${plName}" on Spotify!`);
        } catch (err) {
            logger.error('Failed to reorder playlist on Spotify', err);
            showToast(`Could not save sort order: ${err.message || 'Check playlist ownership'}`);
        } finally {
            setIsSavingSortOrder(false);
        }
    };

    const handlePlaylistClick = (id) => {
        setVisibleLimit(120);
        if (activeWorkflow === 'top50' || activeWorkflow === 'compare') {
            setActiveWorkflow('arabic-playlist');
        }
        if (!isMultiSelectMode) {
            setIsMobilePlaylistsExpanded(false);
        }
        if (id === 'ALL') {
            setIsMultiSelectMode(false);
            if (!selectedPlaylistIds.has('ALL') || selectedPlaylistIds.size !== 1) {
                setSelectedPlaylistIds(new Set(['ALL']));
            }
            return;
        }

        if (isMultiSelectMode) {
            const next = new Set(selectedPlaylistIds);
            next.delete('ALL');
            if (next.has(id)) {
                next.delete(id);
                if (next.size === 0) next.add('ALL');
            } else {
                next.add(id);
            }
            setSelectedPlaylistIds(next);
        } else {
            if (!selectedPlaylistIds.has(id) || selectedPlaylistIds.size !== 1) {
                setSelectedPlaylistIds(new Set([id]));
            }
        }
    };

    const handleToggleTrackKey = (selectionKey) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(selectionKey)) {
                next.delete(selectionKey);
            } else {
                next.add(selectionKey);
            }
            return next;
        });
    };

    const handleSelectAllVisible = () => {
        const allSelected = filteredTracks.length > 0 && filteredTracks.every(t => selectedKeys.has(t._selectionKey));
        if (allSelected) {
            setSelectedKeys(new Set());
        } else {
            setSelectedKeys(new Set(filteredTracks.map(t => t._selectionKey)));
        }
    };

    // =========================================================================
    // LOGIN SCREEN HANDLERS
    // =========================================================================
    const handleSpotifyLogin = () => {
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.setItem('music_provider', PROVIDERS.SPOTIFY);
        window.location.href = '/login';
    };

    const handleLoginWorkflowLaunch = (workflow) => {
        localStorage.setItem('pending_workflow', workflow);
        handleSpotifyLogin();
    };

    const handleLoginQuickUrlAnalyze = () => {
        const url = loginQuickUrl.trim();
        if (!url) return;
        localStorage.setItem('pending_playlist_link', url);
        handleSpotifyLogin();
    };

    // =========================================================================
    // MODAL ACTIONS: SAVE PLAYLIST, EXPORT EXCEL, REMOVE TRACKS, LOAD LINK
    // =========================================================================
    const selectedTrackItems = useMemo(
        () => filteredTracks.filter(item => selectedKeys.has(item._selectionKey)),
        [filteredTracks, selectedKeys]
    );

    const handleConfirmSavePlaylist = async () => {
        if (!provider.supportsWrite) {
            showToast('Anghami SDK is read-only. Use Export Excel instead!');
            setActiveModal(null);
            return;
        }
        const uris = Array.from(new Set(selectedTrackItems.map(i => i.track?.uri).filter(Boolean)));
        if (uris.length === 0) return;

        setIsSubmittingModal(true);
        try {
            const userId = profile?.id;
            if (!userId) throw new Error('User profile not loaded yet');
            const title = newPlaylistName.trim() || '🌙 Extracted Arabic Favorites';
            const created = await provider.createPlaylist(
                token,
                userId,
                title,
                'Created with Spotify & Anghami Toolkit 2.0'
            );
            if (created.error) throw created.error;

            await provider.addTracksToPlaylist(token, created.id, uris);

            const newPlObj = {
                ...created,
                name: title,
                tracks: { total: uris.length },
                owner: { id: userId, display_name: profile?.display_name || 'You' }
            };
            tracksCacheRef.current[created.id] = selectedTrackItems.map((item, idx) =>
                enrichTrackItem(item, { id: created.id, name: title }, idx)
            );
            setPlaylistsData(prev => [newPlObj, ...prev]);
            setActiveModal(null);
            showToast(`Created playlist "${title}" with ${uris.length} tracks!`);
        } catch (err) {
            logger.error('Failed to create playlist', err);
            showToast(`Error: ${err.message || 'Could not create playlist'}`);
        } finally {
            setIsSubmittingModal(false);
        }
    };

    const handleConfirmExportExcel = (quickMode = false) => {
        const exportList = selectedTrackItems.length > 0 ? selectedTrackItems : filteredTracks;
        if (exportList.length === 0) return;

        const fileSafeName = `Toolkit_${activeWorkflow}_${new Date().toISOString().slice(0, 10)}.xlsx`;

        if (quickMode) {
            const withReasons = exportList.map(item => ({
                ...item,
                matchReasons: item._arabicReason ? [item._arabicReason] : []
            }));
            ExcelExporter.exportQuickTrackList(withReasons, fileSafeName);
        } else {
            new ExcelExporter(exportList)
                .withFields(selectedExportFields)
                .withContextPlaylist({ name: 'Toolkit 2.0 Workspace' })
                .download(fileSafeName);
        }

        setActiveModal(null);
        showToast(`Downloaded ${fileSafeName} (${exportList.length} tracks)!`);
    };

    const handleConfirmRemoveTracks = async () => {
        if (!provider.supportsWrite) {
            showToast('This provider is read-only.');
            setActiveModal(null);
            return;
        }
        if (selectedTrackItems.length === 0) return;

        setIsSubmittingModal(true);
        try {
            const removedKeys = new Set(selectedTrackItems.map(i => i._selectionKey));

            // Group selected items by sourcePlaylist.id (Supports both regular playlists and LIKED_SONGS!)
            const byPlaylist = {};
            selectedTrackItems.forEach(item => {
                const pid = item.sourcePlaylist?.id;
                const uri = DuplicateDetector.extractUriFromKey(item._selectionKey) || item.track?.uri;
                if (!pid || !uri) return;
                const isEditable =
                    !profile?.id || PlaylistModel.canEdit(item.sourcePlaylist, profile.id, provider.supportsWrite);
                if (!isEditable) return;
                if (!byPlaylist[pid]) byPlaylist[pid] = [];
                byPlaylist[pid].push(uri);
            });

            const playlistIds = Object.keys(byPlaylist);
            if (playlistIds.length === 0) {
                setActiveModal(null);
                showToast('Cannot remove tracks from read-only playlists owned by other Spotify users.');
                return;
            }
            const removedCountByPlaylist = {};

            for (const pid of playlistIds) {
                const uniqueUrisToDelete = Array.from(new Set(byPlaylist[pid]));
                const deletedUriSet = new Set(uniqueUrisToDelete);

                // Check if this playlist has unselected (KEEP) copies of any URI being deleted.
                // Because Spotify's DELETE /playlists/{id}/tracks removes ALL occurrences of a URI,
                // we re-insert the exact number of unselected (KEEP) copies for that URI!
                const playlistAllItems = tracksCacheRef.current[pid] ||
                    rawScopeTracks.filter(i => i.sourcePlaylist?.id === pid);

                const urisToRestore = [];
                if (pid !== PLAYLIST_IDS.LIKED_SONGS) {
                    playlistAllItems.forEach(item => {
                        if (!removedKeys.has(item._selectionKey)) {
                            const itemUri = DuplicateDetector.extractUriFromKey(item._selectionKey) || item.track?.uri;
                            if (itemUri && deletedUriSet.has(itemUri)) {
                                urisToRestore.push(itemUri);
                            }
                        }
                    });
                }

                try {
                    await provider.removeTracksFromPlaylist(token, pid, uniqueUrisToDelete);

                    if (urisToRestore.length > 0) {
                        await provider.addTracksToPlaylist(token, pid, urisToRestore);
                    }

                    const removedInThisPlaylist = selectedTrackItems.filter(i => i.sourcePlaylist?.id === pid).length;
                    removedCountByPlaylist[pid] = removedInThisPlaylist;

                    if (tracksCacheRef.current[pid]) {
                        tracksCacheRef.current[pid] = tracksCacheRef.current[pid].filter(
                            item => !removedKeys.has(item._selectionKey)
                        );
                    }
                } catch (plErr) {
                    logger.warn(`Skipping track removal on playlist ${pid}`, plErr);
                }
            }

            // Update sidebar track counts for modified playlists and Liked Songs
            if (removedCountByPlaylist[PLAYLIST_IDS.LIKED_SONGS]) {
                setLikedSongsCount(prev => Math.max(0, prev - removedCountByPlaylist[PLAYLIST_IDS.LIKED_SONGS]));
            }
            setPlaylistsData(prev =>
                prev.map(pl =>
                    removedCountByPlaylist[pl.id]
                        ? {
                            ...pl,
                            tracks: {
                                ...pl.tracks,
                                total: Math.max(0, (pl.tracks?.total || 0) - removedCountByPlaylist[pl.id])
                            }
                        }
                        : pl
                )
            );

            setRawScopeTracks(prev => prev.filter(item => !removedKeys.has(item._selectionKey)));
            setSelectedKeys(new Set());
            setActiveModal(null);
            showToast(`Removed ${selectedTrackItems.length} tracks across ${playlistIds.length} playlist(s)!`);
        } catch (err) {
            logger.error('Failed to remove tracks', err);
            showToast(`Error removing tracks: ${err.message || 'Check playlist ownership permissions'}`);
        } finally {
            setIsSubmittingModal(false);
        }
    };

    const handleConfirmLoadLink = async () => {
        const raw = linkInputUrl.trim();
        if (!raw) return;

        setIsSubmittingModal(true);
        try {
            const id = provider.extractPlaylistIdFromInput(raw);
            if (!id) throw new Error('Invalid playlist URL or ID');

            const details = await provider.fetchPlaylist(token, id);
            if (!details || details.error) {
                throw new Error(details?.error?.message || 'Playlist not found or private');
            }

            setPlaylistsData(prev => [details, ...prev.filter(p => p.id !== details.id)]);
            setSelectedPlaylistIds(new Set([details.id]));
            if (activeWorkflow === 'arabic-all') {
                setActiveWorkflow('arabic-playlist');
            }
            setLinkInputUrl('');
            setActiveModal(null);
            showToast(`Loaded "${details.name}"!`);
        } catch (err) {
            logger.error('Manual playlist load error', err);
            showToast(`Could not load link: ${err.message}`);
        } finally {
            setIsSubmittingModal(false);
        }
    };

    // =========================================================================
    // SIDEBAR PLAYLIST ITEMS LIST
    // =========================================================================
    const sidebarItems = useMemo(() => {
        const q = playlistSearch.trim().toLowerCase();
        const totalLibraryCount = likedSongsCount + playlistsData.reduce((s, p) => s + (p.tracks?.total || 0), 0);

        const base = [
            {
                id: 'ALL',
                name: '🔥 All Songs (Combined)',
                count: totalLibraryCount,
                badge: 'Library',
                icon: '🌐'
            },
            ...(likedSongsCount > 0
                ? [{
                    id: PLAYLIST_IDS.LIKED_SONGS,
                    name: '♥ Liked Songs',
                    count: likedSongsCount,
                    badge: 'Saved',
                    icon: '💜'
                }]
                : []),
            ...playlistsData.map(p => ({
                id: p.id,
                name: p.name || 'Untitled Playlist',
                count: p.tracks?.total || 0,
                badge: p.public ? 'Public' : 'Private',
                icon: '🎵'
            }))
        ];

        if (!q) return base;
        return base.filter(item => item.name.toLowerCase().includes(q));
    }, [playlistsData, likedSongsCount, playlistSearch]);

    const scopeDisplayName = useMemo(() => {
        if (selectedPlaylistIds.has('ALL')) return 'All Songs (Library)';
        const names = Array.from(selectedPlaylistIds).map(id => {
            if (id === PLAYLIST_IDS.LIKED_SONGS) return '♥ Liked Songs';
            return playlistsData.find(p => p.id === id)?.name || 'Selected Playlist';
        });
        return names.join(' + ');
    }, [selectedPlaylistIds, playlistsData]);

    const scopeArabicCount = useMemo(() => {
        const uniqueArabicIds = new Set(
            evaluatedRawTracks.filter(t => t._isArabic).map(t => t.track.id)
        );
        return uniqueArabicIds.size;
    }, [evaluatedRawTracks]);

    // Global library Arabic matches count across all cached playlists (for the top workflow card)
    const globalArabicCount = useMemo(() => {
        const cachedLists = Object.values(tracksCacheRef.current);
        const allCachedItems = cachedLists.length > 0 ? cachedLists.flat() : rawScopeTracks;
        if (allCachedItems.length === 0) {
            return allLibraryArabicCount ?? scopeArabicCount;
        }
        const evaluatedAll = evaluateArabicOnList(allCachedItems);
        const uniqueArabicIds = new Set(
            evaluatedAll.filter(t => t._isArabic && t.track?.id).map(t => t.track.id)
        );
        return Math.max(uniqueArabicIds.size, allLibraryArabicCount || 0);
    }, [rawScopeTracks, evaluateArabicOnList, allLibraryArabicCount, scopeArabicCount]);

    const isCurrentViewLoading =
        isLoadingLibrary ||
        (activeWorkflow === 'compare'
            ? compareTracksState.loading
            : activeWorkflow === 'top50'
                ? topTracksState.loading
                : Boolean(scanProgress));

    const isServerOffline = serverMessage.includes('Backend not connected');

    // =========================================================================
    // RENDER SCREEN 1: V2.0 LOGIN & INSTANT LAUNCH PAGE
    // =========================================================================
    if (!token) {
        return (
            <div className="v2-root" data-provider={providerId}>
                <div className="v2-login-wrapper">
                    <div className="obsidian-card v2-login-card">
                        <div className="v2-status-pill">
                            <span className={`v2-status-dot ${isServerOffline ? 'error' : ''}`} />
                            <span>{serverMessage}</span>
                        </div>

                        <h1 className="v2-hero-title">
                            Spotify <span className="brand-text">Toolkit 2.0</span>
                        </h1>
                        <p className="v2-hero-subtitle">
                            Extract Arabic songs across your entire library in <strong>1 click</strong>, clean duplicate tracks with smart presets, and export 19-field Excel reports.
                        </p>

                        <div style={{ maxWidth: '360px', margin: '1.5rem auto 0' }}>
                            <button className="v2-btn-spotify" onClick={handleSpotifyLogin}>
                                <span>🎧</span>
                                <span>Continue with Spotify</span>
                            </button>
                        </div>

                        {/* Direct Public Playlist Link Box */}
                        <div className="obsidian-card v2-quick-url-box">
                            <div className="v2-quick-url-header">
                                <span>🔗 Or analyze a public playlist URL directly:</span>
                                <span style={{ color: 'var(--text-muted)' }}>Instant import</span>
                            </div>
                            <div className="v2-quick-url-row">
                                <input
                                    type="text"
                                    value={loginQuickUrl}
                                    onChange={e => setLoginQuickUrl(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleLoginQuickUrlAnalyze()}
                                    placeholder="Paste Spotify playlist link or ID..."
                                    className="v2-input"
                                />
                                <button
                                    onClick={handleLoginQuickUrlAnalyze}
                                    className="v2-btn-primary brand-bg"
                                >
                                    Analyze →
                                </button>
                            </div>
                        </div>

                        {/* 1-Click Direct Workflow Launchers */}
                        <div className="v2-login-workflows">
                            <div className="v2-section-label" style={{ textAlign: 'center' }}>
                                ⚡ Jump Straight to a 1-Click Workflow
                            </div>
                            <div className="v2-login-workflow-grid">
                                <button
                                    onClick={() => handleLoginWorkflowLaunch('arabic-all')}
                                    className="obsidian-card-interactive v2-login-wf-card"
                                >
                                    <span className="v2-wf-icon">🌙</span>
                                    <div>
                                        <div className="v2-qa-title">Extract Arabic from All Songs</div>
                                        <div className="v2-qa-sub" style={{ whiteSpace: 'normal' }}>
                                            Scans Liked Songs + all playlists &amp; creates a clean Arabic playlist in 1 click.
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleLoginWorkflowLaunch('arabic-playlist')}
                                    className="obsidian-card-interactive v2-login-wf-card"
                                >
                                    <span className="v2-wf-icon">🎯</span>
                                    <div>
                                        <div className="v2-qa-title">Extract Arabic from a Playlist</div>
                                        <div className="v2-qa-sub" style={{ whiteSpace: 'normal' }}>
                                            Multi-pass detection: Arabic script, Franco-Arab, MENA artists &amp; Spotify genres.
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleLoginWorkflowLaunch('duplicates')}
                                    className="obsidian-card-interactive v2-login-wf-card"
                                >
                                    <span className="v2-wf-icon">🧹</span>
                                    <div>
                                        <div className="v2-qa-title">1-Click Duplicate Cleaner</div>
                                        <div className="v2-qa-sub" style={{ whiteSpace: 'normal' }}>
                                            Strict or Fuzzy clustering keeps your oldest/newest copy and removes extras.
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleLoginWorkflowLaunch('insights')}
                                    className="obsidian-card-interactive v2-login-wf-card"
                                >
                                    <span className="v2-wf-icon">📥</span>
                                    <div>
                                        <div className="v2-qa-title">Excel Export &amp; Deep Insights</div>
                                        <div className="v2-qa-sub" style={{ whiteSpace: 'normal' }}>
                                            Export 19 fields with clickable hyperlinks, top artists, decades &amp; vibe stats.
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // =========================================================================
    // RENDER SCREEN 2: UNIFIED V2.0 WORKSPACE APP
    // =========================================================================
    return (
        <div className="v2-root" data-provider={providerId}>
            <div className="v2-app-shell">

                {/* 1. TOP APPLICATION HEADER */}
                <header className="v2-header">
                    <div className="v2-header-left">
                        <div className="v2-logo-mark brand-pill">♫</div>
                        <div className="v2-header-title-row">
                            <span className="v2-app-name">
                                Toolkit <span className="brand-text">2.0</span>
                            </span>
                            <span className="v2-provider-badge brand-pill">
                                {provider.displayName}
                            </span>
                        </div>
                    </div>

                    <div className="v2-header-right">
                        <button
                            onClick={() => setActiveModal('link')}
                            className="v2-btn-secondary"
                            title="Load any playlist by URL or ID"
                        >
                            <span>🔗</span>
                            <span className="v2-paste-label">Load Link</span>
                        </button>

                        <div className="v2-user-area">
                            {profile?.images?.[0]?.url ? (
                                <img
                                    src={profile.images[0].url}
                                    alt={profile.display_name || 'User'}
                                    className="v2-avatar"
                                />
                            ) : (
                                <div className="v2-avatar brand-bg">
                                    {(profile?.display_name || 'U').charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="v2-user-meta">
                                <div className="v2-user-name">{profile?.display_name || 'Connected'}</div>
                                <div className="v2-user-sub">
                                    {playlistsData.length} Playlists • {rawScopeTracks.length} Loaded
                                </div>
                            </div>
                            <button onClick={handleLogout} className="v2-btn-logout">
                                Log Out
                            </button>
                        </div>
                    </div>
                </header>

                {/* 2. 1-CLICK QUICK ACTIONS DOCK (5-Card Workflow Bar) */}
                <section className="v2-quick-dock">
                    <div className="v2-quick-dock-header">
                        <span className="v2-section-label">⚡ 1-Click Spotify Workflows</span>
                        <span className="brand-text" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                            {isArabicWorkflow && 'Active: 🌙 Arabic Extractor'}
                            {activeWorkflow === 'duplicates' && 'Active: 🧹 1-Click Duplicate Cleaner'}
                            {activeWorkflow === 'compare' && 'Active: 🔀 Compare & Sync Playlists'}
                            {activeWorkflow === 'top50' && 'Active: 🏆 Top 50 & Listening History'}
                            {activeWorkflow === 'insights' && 'Active: 📊 Insights, Genre Splitter & Dead Track Cleaner'}
                        </span>
                    </div>

                    <div className="v2-quick-grid">
                        <button
                            onClick={() => activateWorkflow('arabic-playlist')}
                            className={`obsidian-card-interactive v2-qa-card ${isArabicWorkflow ? 'brand-active-card' : ''}`}
                        >
                            <span className="v2-qa-icon">🌙</span>
                            <div style={{ minWidth: 0 }}>
                                <div className="v2-qa-title">Arabic Extractor</div>
                                <div className="v2-qa-sub">
                                    {globalArabicCount} Arabic matches
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => activateWorkflow('duplicates')}
                            className={`obsidian-card-interactive v2-qa-card ${activeWorkflow === 'duplicates' ? 'brand-active-card' : ''}`}
                        >
                            <span className="v2-qa-icon">🧹</span>
                            <div style={{ minWidth: 0 }}>
                                <div className="v2-qa-title">Clean Duplicates</div>
                                <div className="v2-qa-sub">{duplicateRemoveCount} extra copies found</div>
                            </div>
                        </button>

                        <button
                            onClick={() => activateWorkflow('compare')}
                            className={`obsidian-card-interactive v2-qa-card ${activeWorkflow === 'compare' ? 'brand-active-card' : ''}`}
                        >
                            <span className="v2-qa-icon">🔀</span>
                            <div style={{ minWidth: 0 }}>
                                <div className="v2-qa-title">
                                    Compare &amp; Sync
                                    <span className="v2-new-badge">NEW</span>
                                </div>
                                <div className="v2-qa-sub">Diff A−B, Shared &amp; Merge</div>
                            </div>
                        </button>

                        <button
                            onClick={() => activateWorkflow('top50')}
                            className={`obsidian-card-interactive v2-qa-card ${activeWorkflow === 'top50' ? 'brand-active-card' : ''}`}
                        >
                            <span className="v2-qa-icon">🏆</span>
                            <div style={{ minWidth: 0 }}>
                                <div className="v2-qa-title">
                                    Top 50 &amp; History
                                    <span className="v2-new-badge">NEW</span>
                                </div>
                                <div className="v2-qa-sub">Live Wrapped &amp; Recent</div>
                            </div>
                        </button>

                        <button
                            onClick={() => activateWorkflow('insights')}
                            className={`obsidian-card-interactive v2-qa-card ${activeWorkflow === 'insights' ? 'brand-active-card' : ''}`}
                        >
                            <span className="v2-qa-icon">📊</span>
                            <div style={{ minWidth: 0 }}>
                                <div className="v2-qa-title">
                                    Insights &amp; Splitter
                                    <span className="v2-new-badge">NEW</span>
                                </div>
                                <div className="v2-qa-sub">Genres, Eras &amp; Dead Tracks</div>
                            </div>
                        </button>
                    </div>
                </section>

                {/* 3. MAIN WORKSPACE: Left Playlist Rail + Right Content Area */}
                <div className="v2-workspace-body">

                    {/* LEFT PLAYLIST RAIL (Always visible so playlists are accessible from any workflow) */}
                    <aside className={`v2-playlist-sidebar ${isMobilePlaylistsExpanded ? 'mobile-expanded' : ''}`}>
                        <div className="v2-sidebar-top">
                            <span className="v2-section-label">
                                Select Scope ({ playlistsData.length + (likedSongsCount > 0 ? 1 : 0) })
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsMobilePlaylistsExpanded(prev => !prev)}
                                    className="v2-multi-btn v2-mobile-expand-btn"
                                >
                                    {isMobilePlaylistsExpanded ? '▲ Collapse' : `📋 All (${playlistsData.length})`}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsMultiSelectMode(prev => !prev)}
                                    className={`v2-multi-btn ${isMultiSelectMode ? 'active' : ''}`}
                                >
                                    {isMultiSelectMode ? '✓ Done' : '☑ Multi-Select'}
                                </button>
                            </div>
                        </div>

                        <div className="v2-playlist-search-wrap">
                            <input
                                type="text"
                                value={playlistSearch}
                                onChange={e => setPlaylistSearch(e.target.value)}
                                placeholder="Search playlists..."
                                className="v2-input"
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className="v2-playlist-list">
                            {sidebarItems.map(pl => {
                                const isSelected = selectedPlaylistIds.has(pl.id);
                                return (
                                    <button
                                        type="button"
                                        key={pl.id}
                                        onClick={() => handlePlaylistClick(pl.id)}
                                        className={`v2-playlist-item ${isSelected ? 'selected' : ''}`}
                                        title={`${pl.name} (${pl.count} tracks)`}
                                    >
                                        <div className="v2-playlist-item-left">
                                            {isMultiSelectMode ? (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    readOnly
                                                    style={{ accentColor: 'var(--brand)', pointerEvents: 'none' }}
                                                />
                                            ) : (
                                                <span>{pl.icon}</span>
                                            )}
                                            <div className="v2-playlist-item-text">
                                                <div className="v2-playlist-item-name">{pl.name}</div>
                                                <div className="v2-playlist-item-count">{pl.count} tracks</div>
                                            </div>
                                        </div>
                                        <span className="v2-playlist-item-badge">{pl.badge}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    {/* RIGHT MAIN WORKSPACE */}
                    <main className="v2-main-content">

                        {/* Warning Banner if Spotify Developer Dashboard Development Mode blocks an unregistered user (HTTP 403) */}
                        {authAccessForbidden && (
                            <div className="obsidian-card v2-kpi-card-danger" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                                <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fca5a5' }}>
                                        ⚠️ Spotify Account Not Registered in App Dashboard (403)
                                    </div>
                                    <div style={{ fontSize: '0.73rem', color: '#e4e4e7', marginTop: '0.2rem', lineHeight: 1.4 }}>
                                        Spotify apps in Development Mode only return playlists &amp; tracks for accounts whose email is added under <strong>Spotify Developer Dashboard → Users and Access</strong>. Add this account&apos;s email or switch to an authorized Spotify account.
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSpotifyLogin}
                                    className="v2-btn-primary brand-bg"
                                >
                                    🔄 Switch Spotify Account
                                </button>
                            </div>
                        )}

                        {/* Live Track Analysis Visualizer Card */}
                        {scanProgress && (
                            <div className="v2-scan-banner">
                                <div className="v2-scan-top">
                                    <div className="v2-scan-left">
                                        <div className="v2-eq-bars" aria-hidden="true">
                                            <span className="v2-eq-bar" />
                                            <span className="v2-eq-bar" />
                                            <span className="v2-eq-bar" />
                                            <span className="v2-eq-bar" />
                                        </div>
                                        <div className="v2-scan-info">
                                            <div className="v2-scan-title-row">
                                                <span className="v2-scan-phase-badge">
                                                    {scanProgress.phaseBadge || 'LIVE ANALYSIS'}
                                                </span>
                                                <span className="v2-scan-title">{scanProgress.label}</span>
                                            </div>
                                            {scanProgress.subLabel && (
                                                <div className="v2-scan-sub">{scanProgress.subLabel}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="v2-scan-right">
                                        <span className="v2-scan-stat-pill">
                                            🎵 {Math.max(scopeTracks.length, scanProgress.tracksAnalyzed || 0).toLocaleString()} analyzed
                                        </span>
                                        {isArabicWorkflow && (
                                            <span className="v2-scan-stat-pill v2-scan-stat-accent">
                                                🌙 {scopeArabicCount} matches
                                            </span>
                                        )}
                                        {activeWorkflow === 'duplicates' && (
                                            <span className="v2-scan-stat-pill v2-scan-stat-accent">
                                                🧹 {duplicateRemoveCount} duplicates
                                            </span>
                                        )}
                                        <span className="v2-scan-pct brand-text">
                                            {scanProgress.pct ?? 5}%
                                        </span>
                                    </div>
                                </div>
                                <div className="v2-scan-progress-track">
                                    <div
                                        className={`v2-scan-progress-fill ${scanProgress.phase === 'genres' ? 'pulsing' : ''}`}
                                        style={{
                                            width: `${Math.max(4, scanProgress.pct ?? 5)}%`
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Active View Header + 1-Click Output Actions */}
                        <div className="v2-view-header">
                            <div className="v2-view-title-wrap">
                                <div className="v2-view-title-row">
                                    <h2 className="v2-view-title">
                                        {isArabicWorkflow && `🌙 Arabic Tracks — ${scopeDisplayName}`}
                                        {activeWorkflow === 'duplicates' && `🧹 Duplicate Tracks — ${scopeDisplayName}`}
                                        {activeWorkflow === 'compare' && '🔀 Compare & Sync Playlists'}
                                        {activeWorkflow === 'top50' && '🏆 Personal Top 50 & Recently Played'}
                                        {activeWorkflow === 'insights' && `📊 Insights, Genre Splitter & Health — ${scopeDisplayName}`}
                                    </h2>
                                    <span className="v2-count-badge brand-bg">
                                        {filteredTracks.length} Songs
                                    </span>
                                </div>
                                <p className="v2-view-subtitle">
                                    {activeWorkflow === 'duplicates' &&
                                        `${advancedOptions.matchCriteria === 'fuzzy' ? `Fuzzy Clustering (±${advancedOptions.durationTolerance}s)` : 'Strict Track ID Matching'} • Playable-First + Keep ${advancedOptions.keepStrategy} • ${advancedOptions.scope === 'cross' ? 'Cross-Playlist' : 'Per-Playlist'}`}
                                    {activeWorkflow === 'compare' &&
                                        'Find missing tracks (A − B), shared tracks (A ∩ B), or merge & deduplicate multiple playlists (A ∪ B).'}
                                    {activeWorkflow === 'top50' &&
                                        'Your real-time Spotify Wrapped across Last 4 Weeks, Last 6 Months, All-Time, and Recently Played.'}
                                    {activeWorkflow === 'insights' &&
                                        'Split by Genre Family, Release Decade, or Artist in 1 click, or find & replace unavailable/locked tracks with playable versions.'}
                                    {isArabicWorkflow &&
                                        (advancedOptions.strictArabicExtraction
                                            ? 'Strict Arabic Mode (Title & Known Artists Only)'
                                            : 'Standard 3-Pass Detection: Script, Franco-Arab, Known Artists & Spotify Genres')}
                                </p>
                            </div>

                            <div className="v2-action-bar">
                                <button
                                    onClick={() => setActiveModal('save')}
                                    disabled={!provider.supportsWrite || selectedTrackItems.length === 0}
                                    className="v2-btn-primary brand-bg"
                                >
                                    <span>➕</span>
                                    <span>
                                        {`Create New Playlist (${selectedTrackItems.length})`}
                                    </span>
                                </button>

                                <button
                                    onClick={() => setActiveModal('export')}
                                    disabled={filteredTracks.length === 0}
                                    className="v2-btn-secondary"
                                >
                                    <span>📥</span>
                                    <span>Export Excel</span>
                                </button>

                                {activeWorkflow !== 'top50' && activeWorkflow !== 'compare' && (
                                    <button
                                        onClick={() => setActiveModal('remove')}
                                        disabled={!provider.supportsWrite || selectedTrackItems.length === 0}
                                        className="v2-btn-danger"
                                    >
                                        <span>🗑️</span>
                                        <span>Remove ({selectedTrackItems.length})</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* =========================================================
                            NEW WORKFLOW PANEL 2: COMPARE & SYNC PLAYLISTS
                            ========================================================= */}
                        {activeWorkflow === 'compare' && (
                            <div className="obsidian-card v2-feature-panel">
                                <div className="v2-compare-grid">
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                            Source Playlist A
                                        </label>
                                        <select
                                            value={comparePlaylistA}
                                            onChange={e => setComparePlaylistA(e.target.value)}
                                            className="v2-select"
                                            style={{ width: '100%' }}
                                        >
                                            {likedSongsCount > 0 && (
                                                <option value={PLAYLIST_IDS.LIKED_SONGS}>
                                                    💜 Liked Songs ({likedSongsCount} tracks)
                                                </option>
                                            )}
                                            {playlistsData.map(pl => (
                                                <option key={pl.id} value={pl.id}>
                                                    🎵 {pl.name} ({pl.tracks?.total || 0} tracks)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                            Comparison Operation
                                        </label>
                                        <div className="v2-seg-group">
                                            <button
                                                type="button"
                                                onClick={() => setCompareOp('diff')}
                                                className={`v2-seg-btn ${compareOp === 'diff' ? 'active' : ''}`}
                                            >
                                                A − B (Missing)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCompareOp('shared')}
                                                className={`v2-seg-btn ${compareOp === 'shared' ? 'active' : ''}`}
                                            >
                                                A ∩ B (Shared)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCompareOp('union')}
                                                className={`v2-seg-btn ${compareOp === 'union' ? 'active' : ''}`}
                                            >
                                                A ∪ B (Merge)
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                                            Target Playlist B
                                        </label>
                                        <select
                                            value={comparePlaylistB}
                                            onChange={e => setComparePlaylistB(e.target.value)}
                                            className="v2-select"
                                            style={{ width: '100%' }}
                                        >
                                            {playlistsData.map(pl => (
                                                <option key={pl.id} value={pl.id}>
                                                    🎵 {pl.name} ({pl.tracks?.total || 0} tracks)
                                                </option>
                                            ))}
                                            {likedSongsCount > 0 && (
                                                <option value={PLAYLIST_IDS.LIKED_SONGS}>
                                                    💜 Liked Songs ({likedSongsCount} tracks)
                                                </option>
                                            )}
                                        </select>
                                    </div>
                                </div>

                                <div className="v2-compare-footer">
                                    <span style={{ color: '#d4d4d8' }}>
                                        {compareTracksState.loading ? (
                                            'Loading playlists A and B for comparison...'
                                        ) : compareOp === 'diff' ? (
                                            <>
                                                Showing <strong>{compareResultTracks.length} tracks</strong> present in{' '}
                                                <strong>Playlist A</strong> but missing from <strong>Playlist B</strong>.
                                            </>
                                        ) : compareOp === 'shared' ? (
                                            <>
                                                Showing <strong>{compareResultTracks.length} common tracks</strong> found in BOTH{' '}
                                                <strong>Playlist A</strong> and <strong>Playlist B</strong>.
                                            </>
                                        ) : (
                                            <>
                                                Showing <strong>{compareResultTracks.length} merged &amp; deduplicated tracks</strong>{' '}
                                                combining <strong>Playlist A + Playlist B</strong>.
                                            </>
                                        )}
                                    </span>

                                    {compareOp === 'diff' && comparePlaylistB !== PLAYLIST_IDS.LIKED_SONGS && compareResultTracks.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleSyncMissingToPlaylistB}
                                            disabled={isSyncingCompare}
                                            className="v2-btn-primary brand-pill"
                                            style={{ fontWeight: 700 }}
                                        >
                                            ⚡ {isSyncingCompare ? 'Syncing...' : `Sync ${compareResultTracks.length} Missing Tracks to Playlist B`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* =========================================================
                            NEW WORKFLOW PANEL 3: TOP 50 & LISTENING HISTORY
                            ========================================================= */}
                        {activeWorkflow === 'top50' && (
                            <div className="obsidian-card v2-feature-panel">
                                <div className="v2-feature-top-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#d4d4d8' }}>Time Range:</span>
                                        <div className="v2-seg-group">
                                            <button
                                                type="button"
                                                onClick={() => setTopRange('short_term')}
                                                className={`v2-seg-btn ${topRange === 'short_term' ? 'active' : ''}`}
                                            >
                                                🔥 Last 4 Weeks
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTopRange('medium_term')}
                                                className={`v2-seg-btn ${topRange === 'medium_term' ? 'active' : ''}`}
                                            >
                                                📅 Last 6 Months
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTopRange('long_term')}
                                                className={`v2-seg-btn ${topRange === 'long_term' ? 'active' : ''}`}
                                            >
                                                👑 All-Time Top 50
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTopRange('recent')}
                                                className={`v2-seg-btn ${topRange === 'recent' ? 'active' : ''}`}
                                            >
                                                🕒 Recently Played (Last 50)
                                            </button>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                        Live Spotify Listening History &amp; Personal Top Charts
                                    </span>
                                </div>

                                {topTracksState.needsReauth ? (
                                    <div className="v2-top50-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                        <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>
                                                🔓 Approve Spotify Top 50 &amp; History Permission
                                            </div>
                                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                                Please reconnect your Spotify account in 1 click to grant permission to load your personal Top 50 &amp; recently played tracks.
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleLoginWorkflowLaunch('top50')}
                                            className="v2-btn-primary brand-bg"
                                        >
                                            🔄 Re-authenticate with Spotify
                                        </button>
                                    </div>
                                ) : (
                                    <div className="v2-top50-kpi-grid">
                                        <div className="v2-top50-card">
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                {topRange === 'recent' ? 'Most Recent Stream' : '#1 Most Played Track'}
                                            </div>
                                            <div className="brand-text" style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {evaluatedTopTracks[0]
                                                    ? `${evaluatedTopTracks[0].track?.name} — ${evaluatedTopTracks[0].track?.artists?.[0]?.name || ''}`
                                                    : topTracksState.loading ? 'Loading...' : '-'}
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                {evaluatedTopTracks.length} tracks loaded
                                            </div>
                                        </div>

                                        <div className="v2-top50-card">
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Top Artists in Period</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 800, marginTop: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {topTracksState.topArtists.length > 0
                                                    ? topTracksState.topArtists.slice(0, 3).map(a => a.name).join(' • ')
                                                    : topTracksState.loading ? 'Loading...' : '-'}
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                Ranked by stream frequency
                                            </div>
                                        </div>

                                        <div className="v2-top50-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.65rem' }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>1-Click Archive</div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {topRange === 'short_term' ? '4-Week Top 50' : topRange === 'medium_term' ? '6-Month Top 50' : topRange === 'long_term' ? 'All-Time Top 50' : 'Recent 50'}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={evaluatedTopTracks.length === 0}
                                                onClick={() => {
                                                    setNewPlaylistName(
                                                        topRange === 'short_term'
                                                            ? `🔥 My Top 50 — Last 4 Weeks`
                                                            : topRange === 'medium_term'
                                                                ? `📅 My Top 50 — Last 6 Months`
                                                                : topRange === 'long_term'
                                                                    ? `👑 My All-Time Top 50`
                                                                    : `🕒 Recently Played 50`
                                                    );
                                                    setActiveModal('save');
                                                }}
                                                className="v2-btn-primary brand-bg"
                                            >
                                                ➕ Create New Playlist
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* COLLAPSIBLE ADVANCED OPTIONS CONFIGURATION PANEL (Context-Aware per Active Feature) */}
                        {(activeWorkflow === 'duplicates' || isArabicWorkflow) && (
                            <div className="v2-adv-panel">
                                <button
                                    onClick={() => setIsAdvOpen(prev => !prev)}
                                    className="v2-adv-header"
                                >
                                    <div className="v2-adv-header-left">
                                        <span style={{ fontSize: '0.9rem' }}>⚙️</span>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Advanced Options</span>
                                        <span className="v2-provider-badge brand-pill">Configure</span>
                                        <span className="v2-adv-summary">
                                            {activeWorkflow === 'duplicates' ? (
                                                <>
                                                    {advancedOptions.matchCriteria === 'fuzzy'
                                                        ? `Fuzzy • ±${advancedOptions.durationTolerance}s • `
                                                        : 'Strict ID • '}
                                                    Keep {advancedOptions.keepStrategy} •{' '}
                                                    {advancedOptions.scope === 'cross' ? 'Cross-playlist' : 'Per-playlist'}
                                                </>
                                            ) : (
                                                advancedOptions.strictArabicExtraction
                                                    ? 'Strict Arabic (Title & Known Artists Only)'
                                                    : 'Standard Arabic (with Genres)'
                                            )}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {isAdvOpen ? '▲ Hide' : '▼ Configure'}
                                    </span>
                                </button>

                                {isAdvOpen && (
                                    <div className="v2-adv-body">
                                        {activeWorkflow === 'duplicates' && (
                                            <>
                                                {/* 1. Match Criteria */}
                                                <div className="v2-adv-col">
                                                    <h4 className="v2-adv-title">Match Criteria</h4>
                                                    <div className="v2-toggle-pill-group">
                                                        <button
                                                            onClick={() => updateAdvancedOption('matchCriteria', 'strict')}
                                                            className={`v2-toggle-pill-btn ${advancedOptions.matchCriteria === 'strict' ? 'active' : ''}`}
                                                        >
                                                            Strict
                                                        </button>
                                                        <button
                                                            onClick={() => updateAdvancedOption('matchCriteria', 'fuzzy')}
                                                            className={`v2-toggle-pill-btn ${advancedOptions.matchCriteria === 'fuzzy' ? 'active' : ''}`}
                                                        >
                                                            Fuzzy
                                                        </button>
                                                    </div>
                                                    <p className="v2-adv-desc">
                                                        {advancedOptions.matchCriteria === 'strict'
                                                            ? 'Match exact Spotify track IDs only.'
                                                            : 'Match by normalized track name, artist & duration.'}
                                                    </p>
                                                </div>

                                                {/* 2. Duration Tolerance */}
                                                <div className="v2-adv-col">
                                                    <h4 className="v2-adv-title">
                                                        Duration Tolerance (±{advancedOptions.durationTolerance}s)
                                                    </h4>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="5"
                                                            step="1"
                                                            disabled={advancedOptions.matchCriteria === 'strict'}
                                                            value={advancedOptions.durationTolerance}
                                                            onChange={e => updateAdvancedOption('durationTolerance', parseInt(e.target.value, 10))}
                                                            style={{ flex: 1, accentColor: 'var(--brand)', cursor: 'pointer' }}
                                                        />
                                                        <span style={{ fontSize: '0.76rem', fontWeight: 700 }}>
                                                            ±{advancedOptions.durationTolerance}s
                                                        </span>
                                                    </div>
                                                    <p className="v2-adv-desc">
                                                        Allow duration difference when fuzzy matching duplicates.
                                                    </p>
                                                </div>

                                                {/* 3. Deduplication Scope */}
                                                <div className="v2-adv-col">
                                                    <h4 className="v2-adv-title">Deduplication Scope</h4>
                                                    <div className="v2-toggle-pill-group">
                                                        <button
                                                            onClick={() => updateAdvancedOption('scope', 'cross')}
                                                            className={`v2-toggle-pill-btn ${advancedOptions.scope === 'cross' ? 'active' : ''}`}
                                                        >
                                                            Cross-List
                                                        </button>
                                                        <button
                                                            onClick={() => updateAdvancedOption('scope', 'per')}
                                                            className={`v2-toggle-pill-btn ${advancedOptions.scope === 'per' ? 'active' : ''}`}
                                                        >
                                                            Per-List
                                                        </button>
                                                    </div>
                                                    <p className="v2-adv-desc">
                                                        {advancedOptions.scope === 'cross'
                                                            ? 'Find duplicates across all selected playlists.'
                                                            : 'Only find duplicates within the same playlist.'}
                                                    </p>
                                                </div>

                                                {/* 4. Default Keep Strategy */}
                                                <div className="v2-adv-col">
                                                    <h4 className="v2-adv-title">Default Keep Strategy</h4>
                                                    <div className="v2-toggle-pill-group">
                                                        <button
                                                            onClick={() => updateAdvancedOption('keepStrategy', 'oldest')}
                                                            className={`v2-toggle-pill-btn ${advancedOptions.keepStrategy === 'oldest' ? 'active' : ''}`}
                                                        >
                                                            Oldest
                                                        </button>
                                                        <button
                                                            onClick={() => updateAdvancedOption('keepStrategy', 'newest')}
                                                            className={`v2-toggle-pill-btn ${advancedOptions.keepStrategy === 'newest' ? 'active' : ''}`}
                                                        >
                                                            Newest
                                                        </button>
                                                        <button
                                                            onClick={() => updateAdvancedOption('keepStrategy', 'popular')}
                                                            className={`v2-toggle-pill-btn ${advancedOptions.keepStrategy === 'popular' ? 'active' : ''}`}
                                                        >
                                                            Popular
                                                        </button>
                                                    </div>
                                                    <p className="v2-adv-desc">
                                                        Determines which copy is marked KEEP vs REMOVE.
                                                    </p>
                                                </div>
                                            </>
                                        )}

                                        {/* Strict Arabic Extraction (Shown ONLY in Arabic Workflows) */}
                                        {isArabicWorkflow && (
                                            <div
                                                className="v2-adv-col-full"
                                                style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}
                                            >
                                                <div>
                                                    <h4 className="v2-adv-title">Strict Arabic Extraction</h4>
                                                    <p className="v2-adv-desc">
                                                        Exclude purely English songs by Arabic artists. Ignores artist name script and Spotify artist genres, relying only on Track Title or explicitly known artists.
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => updateAdvancedOption('strictArabicExtraction', !advancedOptions.strictArabicExtraction)}
                                                    className={`v2-switch ${advancedOptions.strictArabicExtraction ? 'on' : ''}`}
                                                    title="Toggle Strict Arabic Extraction"
                                                >
                                                    <span className="v2-switch-knob" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Inline Search + Sort + Permanent Spotify Reorder + Selection Summary Bar */}
                        <div className="v2-toolbar">
                            <div className="v2-toolbar-top">
                                <input
                                    type="text"
                                    value={trackSearch}
                                    onChange={e => setTrackSearch(e.target.value)}
                                    placeholder="Search by song title, artist, album, or match reason..."
                                    className="v2-input"
                                />

                                {activeGenreBucket && (
                                    <button
                                        onClick={() => setActiveGenreBucketId(null)}
                                        className="v2-chip v2-chip-filter-active"
                                    >
                                        🎸 {activeGenreBucket.name} ✕
                                    </button>
                                )}

                                {activeArtistFilter && (
                                    <button
                                        onClick={() => setActiveArtistFilter(null)}
                                        className="v2-chip v2-chip-filter-active"
                                    >
                                        🎤 {activeArtistFilter} ✕
                                    </button>
                                )}

                                {activeDecadeFilter !== null && (
                                    <button
                                        onClick={() => setActiveDecadeFilter(null)}
                                        className="v2-chip v2-chip-filter-active"
                                    >
                                        📅 {activeDecadeFilter}s ✕
                                    </button>
                                )}

                                {onlyDeadTracksFilter && (
                                    <button
                                        onClick={() => setOnlyDeadTracksFilter(false)}
                                        className="v2-chip v2-chip-filter-active"
                                    >
                                        👻 Unplayable / Local Only ✕
                                    </button>
                                )}

                                {onlyDeadTracksFilter && insightsData.deadTracksCount > 0 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={handleFindDeadTrackReplacements}
                                            disabled={isSearchingReplacements}
                                            className="v2-btn-secondary"
                                            title="Search Spotify by ISRC and Multi-Pass Title + Co-Artists + Duration for playable versions"
                                        >
                                            <span>🔍</span>
                                            <span>
                                                {isSearchingReplacements
                                                    ? deadSearchProgress
                                                        ? `Searching (${deadSearchProgress.done}/${deadSearchProgress.total})...`
                                                        : 'Searching Spotify...'
                                                    : 'Find Replacements on Spotify'}
                                            </span>
                                        </button>

                                        {insightsData.deadReplaceableCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleReplaceDeadTracks()}
                                                disabled={isReplacingDeadTracks}
                                                className="v2-btn-primary brand-bg"
                                                title="Replace all matched dead tracks with playable versions in their source playlists"
                                            >
                                                <span>🔄</span>
                                                <span>
                                                    {isReplacingDeadTracks
                                                        ? 'Replacing...'
                                                        : `Replace All Found (${insightsData.deadReplaceableCount})`}
                                                </span>
                                            </button>
                                        )}
                                    </>
                                )}

                                <select
                                    value={sortBy}
                                    onChange={e => setSortBy(e.target.value)}
                                    className="v2-select"
                                >
                                    <option value="default">Sort: Default Order</option>
                                    <option value="title">Sort: Title (A–Z)</option>
                                    <option value="artist">Sort: Artist (A–Z)</option>
                                    <option value="year-desc">Sort: Newest Release</option>
                                    <option value="year-asc">Sort: Oldest Release</option>
                                    <option value="pop-desc">Sort: Highest Popularity</option>
                                </select>

                                {/* NEW FEATURE: Permanently Save Sort Order to Spotify Playlist */}
                                {singleEditablePlaylistId && sortBy !== 'default' && (
                                    <button
                                        type="button"
                                        onClick={handleApplySortToSpotify}
                                        disabled={isSavingSortOrder}
                                        className="v2-btn-secondary brand-pill"
                                        style={{ fontWeight: 700 }}
                                        title="Permanently reorder this playlist inside your Spotify account"
                                    >
                                        <span>💾</span>
                                        <span>{isSavingSortOrder ? 'Saving Order...' : 'Save Order to Spotify'}</span>
                                    </button>
                                )}

                                <button onClick={handleSelectAllVisible} className="v2-btn-secondary">
                                    {filteredTracks.length > 0 && filteredTracks.every(t => selectedKeys.has(t._selectionKey))
                                        ? 'Deselect All'
                                        : 'Select All'}
                                </button>

                                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                                    {selectedTrackItems.length} of {filteredTracks.length} selected
                                </span>
                            </div>
                        </div>

                        {/* INTERACTIVE INSIGHTS, GENRE SPLITTER & LIBRARY HEALTH DRAWER */}
                        {activeWorkflow === 'insights' && (
                            <div className="v2-insights-panel">
                                <div className="v2-kpi-grid">
                                    <div className="obsidian-card v2-kpi-card">
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Popularity Profile</div>
                                        <div className="brand-text" style={{ fontSize: '0.88rem', fontWeight: 800, marginTop: '0.25rem' }}>
                                            {insightsData.generalStats.avgPopularity >= 60
                                                ? '🔥 Mainstream Hits'
                                                : insightsData.generalStats.avgPopularity >= 35
                                                    ? '✨ Balanced Mix'
                                                    : '💎 Deep Cuts & Gems'}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            Avg Popularity: {insightsData.generalStats.avgPopularity}%
                                        </div>
                                    </div>

                                    <div className="obsidian-card v2-kpi-card">
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Arabic Tracks</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, marginTop: '0.25rem' }}>
                                            {insightsData.arabicPct}% Arabic
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            {insightsData.arabicCount} of {scopeTracks.length} tracks
                                        </div>
                                    </div>

                                    <div className="obsidian-card v2-kpi-card">
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Library Duration</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, marginTop: '0.25rem' }}>
                                            {insightsData.generalStats.durationStr}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            Explicit: {insightsData.generalStats.explicitPercent}%
                                        </div>
                                    </div>

                                    {/* Unplayable / Locked Track Cleaner & 3-Stage Replacement Engine Card */}
                                    <div className={`obsidian-card v2-kpi-card ${insightsData.deadTracksCount > 0 ? 'v2-kpi-card-danger' : ''}`}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: '0.72rem', color: insightsData.deadTracksCount > 0 ? '#fca5a5' : 'var(--text-secondary)', fontWeight: 700 }}>
                                                👻 Unplayable / Locked
                                            </span>
                                            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: insightsData.deadTracksCount > 0 ? '#f87171' : '#4ade80' }}>
                                                {insightsData.deadTracksCount} found
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            {isSearchingReplacements && deadSearchProgress
                                                ? `🔍 Scanning (${deadSearchProgress.done}/${deadSearchProgress.total}) • ${insightsData.deadReplaceableCount} matched`
                                                : insightsData.deadReplaceableCount > 0
                                                    ? `✅ ${insightsData.deadReplaceableCount} playable replacement(s) ready!`
                                                    : 'Delisted, region-locked & local files'}
                                        </div>
                                        {insightsData.deadTracksCount > 0 && (
                                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const nextState = !onlyDeadTracksFilter;
                                                        setOnlyDeadTracksFilter(nextState);
                                                        if (nextState) {
                                                            handleFindDeadTrackReplacements();
                                                        }
                                                    }}
                                                    className="v2-btn-secondary"
                                                    style={{ flex: 1, justifyContent: 'center', padding: '0.25rem 0.45rem', fontSize: '0.68rem' }}
                                                >
                                                    {onlyDeadTracksFilter ? 'Show All' : `Filter & Find (${insightsData.deadTracksCount})`}
                                                </button>
                                                {(isSearchingReplacements || insightsData.deadReplaceableCount < insightsData.deadTracksCount) && (
                                                    <button
                                                        type="button"
                                                        onClick={handleFindDeadTrackReplacements}
                                                        disabled={isSearchingReplacements}
                                                        className="v2-btn-secondary"
                                                        style={{ flex: 1, justifyContent: 'center', padding: '0.25rem 0.45rem', fontSize: '0.68rem' }}
                                                    >
                                                        {isSearchingReplacements
                                                            ? deadSearchProgress
                                                                ? `Searching (${deadSearchProgress.done}/${deadSearchProgress.total})...`
                                                                : 'Searching...'
                                                            : '🔍 Search Spotify'}
                                                    </button>
                                                )}
                                                {insightsData.deadReplaceableCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleReplaceDeadTracks()}
                                                        disabled={isReplacingDeadTracks}
                                                        className="v2-btn-primary brand-bg"
                                                        style={{ flex: 1, justifyContent: 'center', padding: '0.25rem 0.45rem', fontSize: '0.68rem' }}
                                                    >
                                                        {isReplacingDeadTracks
                                                            ? 'Replacing...'
                                                            : `🔄 Replace (${insightsData.deadReplaceableCount})`}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* INTEGRATED SMART GENRE FAMILY SPLITTER */}
                                <div className="obsidian-card v2-chart-card">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <span className="v2-section-label">🎸 Smart Genre Family Splitter (Click to Filter &amp; Create New Playlist)</span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                            {activeGenreBucket
                                                ? `Filtering by ${activeGenreBucket.name} (${activeGenreBucket.count} tracks) — Click again to show all`
                                                : 'Select any genre bucket to isolate tracks & create a new playlist'}
                                        </span>
                                    </div>
                                    <div className="v2-splitter-buckets">
                                        {genreSplitBuckets.map(bucket => {
                                            const isActive = activeGenreBucketId === bucket.id;
                                            return (
                                                <button
                                                    type="button"
                                                    key={bucket.id}
                                                    onClick={() => handleSelectGenreBucket(bucket)}
                                                    className={`v2-bucket-card ${isActive ? 'active' : ''}`}
                                                >
                                                    <div className="v2-bucket-top">
                                                        <span className="v2-bucket-name">{bucket.name}</span>
                                                        <span className="v2-bucket-pct">{bucket.pct}%</span>
                                                    </div>
                                                    <div className="v2-bucket-count">
                                                        {bucket.count.toLocaleString()}{' '}
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-secondary)' }}>tracks</span>
                                                    </div>
                                                    <div className="v2-bucket-bar">
                                                        <div className="v2-bucket-bar-fill" style={{ width: `${Math.max(4, bucket.pct)}%` }} />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="v2-charts-grid">
                                    {/* Top Artists Interactive Chart */}
                                    <div className="obsidian-card v2-chart-card">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                                            <span className="v2-section-label">🎤 Top Artists (Click to Filter)</span>
                                            <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={includeCollabs}
                                                    onChange={e => setIncludeCollabs(e.target.checked)}
                                                    style={{ accentColor: 'var(--brand)' }}
                                                />
                                                <span>Include Collabs</span>
                                            </label>
                                        </div>
                                        {insightsData.topArtists.map(artist => {
                                            const maxCount = insightsData.topArtists[0]?.count || 1;
                                            const isSelected = activeArtistFilter === artist.name;
                                            return (
                                                <div
                                                    key={artist.name}
                                                    onClick={() => setActiveArtistFilter(isSelected ? null : artist.name)}
                                                    className="v2-bar-row"
                                                >
                                                    <div className="v2-bar-labels">
                                                        <span className={isSelected ? 'brand-text' : ''} style={{ fontWeight: 600 }}>
                                                            {artist.name}
                                                        </span>
                                                        <span style={{ color: 'var(--text-secondary)' }}>{artist.count} tracks</span>
                                                    </div>
                                                    <div className="v2-bar-track">
                                                        <div
                                                            className="v2-bar-fill"
                                                            style={{ width: `${(artist.count / maxCount) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Release Decades Interactive Chart */}
                                    <div className="obsidian-card v2-chart-card">
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                                            <span className="v2-section-label">📅 Release Decades (Click to Filter)</span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Timeline</span>
                                        </div>
                                        {[...insightsData.timeline.decades].reverse().slice(0, 6).map(d => {
                                            const maxDec = Math.max(...insightsData.timeline.decades.map(x => x.count), 1);
                                            const decNum = parseInt(d.decade, 10);
                                            const isSelected = activeDecadeFilter === decNum;
                                            return (
                                                <div
                                                    key={d.decade}
                                                    onClick={() => setActiveDecadeFilter(isSelected ? null : decNum)}
                                                    className="v2-bar-row"
                                                >
                                                    <div className="v2-bar-labels">
                                                        <span className={isSelected ? 'brand-text' : ''} style={{ fontWeight: 600 }}>
                                                            {d.decade}s Era
                                                        </span>
                                                        <span style={{ color: 'var(--text-secondary)' }}>{d.count} tracks</span>
                                                    </div>
                                                    <div className="v2-bar-track">
                                                        <div
                                                            className="v2-bar-fill"
                                                            style={{ width: `${(d.count / maxDec) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TRACK LIST CONTAINER */}
                        <div className="v2-tracks-list">
                            {isCurrentViewLoading && filteredTracks.length === 0 ? (
                                <div className="obsidian-card v2-analyzing-empty">
                                    <div className="v2-eq-bars v2-eq-bars-lg" aria-hidden="true">
                                        <span className="v2-eq-bar" />
                                        <span className="v2-eq-bar" />
                                        <span className="v2-eq-bar" />
                                        <span className="v2-eq-bar" />
                                    </div>
                                    <div style={{ fontWeight: 700, color: '#f4f4f5', fontSize: '0.88rem' }}>
                                        {scanProgress ? scanProgress.label : 'Analyzing your music library...'}
                                    </div>
                                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                        {scanProgress?.subLabel || 'Scanning playlist metadata, artist scripts & genres in real time...'}
                                    </div>
                                </div>
                            ) : filteredTracks.length === 0 ? (
                                <div className="obsidian-card" style={{ padding: '2.5rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    {activeWorkflow === 'duplicates'
                                        ? `No duplicate tracks found in "${scopeDisplayName}" with the current Advanced Options! Try switching Deduplication Scope to Cross-List or Match Criteria to Fuzzy.`
                                        : isArabicWorkflow
                                            ? `No Arabic tracks found in "${scopeDisplayName}" (${scopeTracks.length} tracks scanned).`
                                            : 'No tracks match the current filter.'}
                                </div>
                            ) : (
                                <>
                                    {filteredTracks.slice(0, visibleLimit).map((item, idx) => {
                                        const t = item.track;
                                        const isChecked = selectedKeys.has(item._selectionKey);
                                        // ONLY show KEEP / REMOVE badges when in the Clean Duplicates workflow!
                                        const dupeStatus = activeWorkflow === 'duplicates'
                                            ? duplicateStatusMap[item._selectionKey]
                                            : null;
                                        const isDeadTrack = isTrackUnplayableOrLocal(item);
                                        const deadReplacement = isDeadTrack && t.id ? effectiveDeadReplacements[t.id] : null;
                                        const thumbUrl = t.album?.images?.[t.album.images.length - 1]?.url || t.album?.images?.[0]?.url;
                                        const artistNames = t.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                                        const releaseYear = item._releaseYear || '';
                                        const sourcePlaylistsList = Array.isArray(item.sourcePlaylists) && item.sourcePlaylists.length > 0
                                            ? item.sourcePlaylists
                                            : (item.sourcePlaylist?.name ? [item.sourcePlaylist.name] : []);
                                        const hasMultiPlaylists = activeWorkflow !== 'duplicates' && sourcePlaylistsList.length > 1;
                                        const plLabel = hasMultiPlaylists
                                            ? `${sourcePlaylistsList[0]} +${sourcePlaylistsList.length - 1}`
                                            : (item.sourcePlaylist?.name || '');
                                        const plTooltipText = sourcePlaylistsList.length > 1
                                            ? `Found in ${sourcePlaylistsList.length} playlists: ${sourcePlaylistsList.join(' • ')}`
                                            : (sourcePlaylistsList[0] ? `Playlist: ${sourcePlaylistsList[0]}` : '');
                                        const isPlayingPreview = previewTrack?.id === t.id;
                                        const isPlayingReplacementPreview =
                                            Boolean(deadReplacement?.track?.id) && previewTrack?.id === deadReplacement.track.id;

                                        return (
                                            <div
                                                key={item._selectionKey}
                                                onClick={() => handleToggleTrackKey(item._selectionKey)}
                                                className={`obsidian-card-interactive v2-track-row ${isChecked ? 'selected' : ''}`}
                                            >
                                                <div className="v2-track-left">
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        style={{ width: 15, height: 15, accentColor: 'var(--brand)', flexShrink: 0, cursor: 'pointer' }}
                                                    />
                                                    {t.id && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPreviewTrack(
                                                                    isPlayingPreview
                                                                        ? null
                                                                        : { id: t.id, name: t.name, artist: artistNames }
                                                                );
                                                            }}
                                                            title={isPlayingPreview ? 'Close Preview Player' : 'Preview Track in Spotify Mini-Player'}
                                                            className={`v2-preview-btn ${isPlayingPreview ? 'playing' : ''}`}
                                                        >
                                                            {isPlayingPreview ? '♫' : '▶'}
                                                        </button>
                                                    )}
                                                    {thumbUrl ? (
                                                        <img src={thumbUrl} alt="" className="v2-track-thumb" loading="lazy" />
                                                    ) : (
                                                        <div className="v2-track-thumb">{idx + 1}</div>
                                                    )}
                                                    <div className="v2-track-info">
                                                        <div className="v2-track-title-line">
                                                            <span className="v2-track-title">{t.name}</span>
                                                            {dupeStatus === 'KEEP' && <span className="v2-badge-keep">KEEP</span>}
                                                            {dupeStatus === 'REMOVE' && <span className="v2-badge-remove">REMOVE</span>}
                                                            {isDeadTrack && (
                                                                <span className="v2-badge-remove" title="This track is unplayable, region-locked, or a local file">
                                                                    {t.is_local ? '📁 Local File' : '🔒 Unavailable'}
                                                                </span>
                                                            )}
                                                            {deadReplacement && (
                                                                <span
                                                                    className="v2-badge-keep"
                                                                    title={`Playable replacement found: ${deadReplacement.track.name} (${deadReplacement.matchReason})`}
                                                                >
                                                                    🔄 {deadReplacement.matchReason} (🔥 {deadReplacement.track.popularity ?? 0}%)
                                                                </span>
                                                            )}
                                                            {isDeadTrack && !t.is_local && !deadReplacement && (
                                                                isSearchingReplacements && !searchedNoMatchIds.has(t.id) ? (
                                                                    <span
                                                                        className="v2-badge-reason"
                                                                        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.12)' }}
                                                                    >
                                                                        ⏳ Scanning Spotify...
                                                                    </span>
                                                                ) : searchedNoMatchIds.has(t.id) ? (
                                                                    <span
                                                                        className="v2-badge-reason"
                                                                        style={{ background: 'rgba(239,68,68,0.08)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.22)' }}
                                                                        title="Searched Spotify by ISRC, Title + Co-Artists, and Core Title — no playable version exists on Spotify"
                                                                    >
                                                                        ❌ No Match on Spotify
                                                                    </span>
                                                                ) : null
                                                            )}
                                                            {item._arabicReason && (
                                                                <span className="v2-badge-reason brand-pill">{item._arabicReason}</span>
                                                            )}
                                                        </div>
                                                        <div className="v2-track-sub">
                                                            <span className="v2-track-sub-text">
                                                                <strong style={{ color: '#e4e4e7', fontWeight: 500 }}>{artistNames}</strong>
                                                                {t.album?.name ? ` • ${t.album.name}` : ''}
                                                                {releaseYear ? ` (${releaseYear})` : ''}
                                                            </span>
                                                            {plLabel && (
                                                                <>
                                                                    <span style={{ flexShrink: 0 }}>{'•'}</span>
                                                                    <span
                                                                        className={`v2-playlist-source-wrap ${hasMultiPlaylists ? 'has-multi' : ''}`}
                                                                        title={plTooltipText}
                                                                    >
                                                                        <span className="brand-text v2-playlist-source-pill">{plLabel}</span>
                                                                        {hasMultiPlaylists && (
                                                                            <span className="v2-playlist-tooltip" role="tooltip">
                                                                                <span className="v2-playlist-tooltip-header">
                                                                                    Found in {sourcePlaylistsList.length} playlists:
                                                                                </span>
                                                                                {sourcePlaylistsList.map((pName, pIdx) => (
                                                                                    <span key={`${pName}-${pIdx}`} className="v2-playlist-tooltip-item">
                                                                                        • {pName}
                                                                                    </span>
                                                                                ))}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="v2-track-right">
                                                    {deadReplacement && (
                                                        <div
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            {deadReplacement.track?.id && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setPreviewTrack(
                                                                            isPlayingReplacementPreview
                                                                                ? null
                                                                                : {
                                                                                    id: deadReplacement.track.id,
                                                                                    name: deadReplacement.track.name,
                                                                                    artist: artistNames
                                                                                }
                                                                        )
                                                                    }
                                                                    className="v2-btn-secondary"
                                                                    style={{ padding: '0.2rem 0.48rem', fontSize: '0.68rem' }}
                                                                    title="Preview playable replacement track in the mini-player"
                                                                >
                                                                    {isPlayingReplacementPreview ? '♫ Playing' : '▶ Test New'}
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReplaceDeadTracks([item])}
                                                                disabled={isReplacingDeadTracks}
                                                                className="v2-btn-primary brand-bg"
                                                                style={{ padding: '0.2rem 0.55rem', fontSize: '0.68rem' }}
                                                                title="Replace this locked track with the playable version in its playlist"
                                                            >
                                                                ⚡ Replace
                                                            </button>
                                                        </div>
                                                    )}
                                                    {typeof t.popularity === 'number' && (
                                                        <span className="v2-track-pop" title="Popularity">
                                                            🔥 {t.popularity}%
                                                        </span>
                                                    )}
                                                    <span className="v2-track-dur">{formatDuration(t.duration_ms)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {filteredTracks.length > visibleLimit && (
                                        <div className="obsidian-card" style={{ padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                                Showing <strong style={{ color: '#fff' }}>{visibleLimit}</strong> of{' '}
                                                <strong style={{ color: '#fff' }}>{filteredTracks.length.toLocaleString()}</strong> tracks
                                                {' '}({selectedTrackItems.length.toLocaleString()} selected for action)
                                            </span>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => setVisibleLimit(prev => prev + 250)}
                                                    className="v2-btn-secondary"
                                                >
                                                    Show +250 More
                                                </button>
                                                <button
                                                    onClick={() => setVisibleLimit(filteredTracks.length)}
                                                    className="v2-btn-primary brand-bg"
                                                >
                                                    Show All ({filteredTracks.length.toLocaleString()})
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </main>
                </div>

                {/* DOCKED BOTTOM SPOTIFY MINI-PLAYER BAR */}
                {previewTrack && (
                    <div className="v2-mini-player">
                        <iframe
                            title={`Spotify Preview: ${previewTrack.name}`}
                            src={`https://open.spotify.com/embed/track/${previewTrack.id}?utm_source=generator&theme=0`}
                            className="v2-mini-player-embed"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                        />
                        <button
                            type="button"
                            onClick={() => setPreviewTrack(null)}
                            className="v2-btn-secondary"
                            style={{ flexShrink: 0 }}
                        >
                            ✕ Close Player
                        </button>
                    </div>
                )}

                {/* MOBILE STICKY BOTTOM NAVIGATION (Shown on Phone < 768px) */}
                <nav className="v2-mobile-bottom-nav">
                    <button
                        onClick={() => activateWorkflow('arabic-playlist')}
                        className={`v2-mnav-btn ${isArabicWorkflow ? 'active' : ''}`}
                    >
                        <span style={{ fontSize: '1rem' }}>🌙</span>
                        <span>Arabic</span>
                    </button>
                    <button
                        onClick={() => activateWorkflow('duplicates')}
                        className={`v2-mnav-btn ${activeWorkflow === 'duplicates' ? 'active' : ''}`}
                    >
                        <span style={{ fontSize: '1rem' }}>🧹</span>
                        <span>Dupes</span>
                    </button>
                    <button
                        onClick={() => activateWorkflow('compare')}
                        className={`v2-mnav-btn ${activeWorkflow === 'compare' ? 'active' : ''}`}
                    >
                        <span style={{ fontSize: '1rem' }}>🔀</span>
                        <span>Compare</span>
                    </button>
                    <button
                        onClick={() => activateWorkflow('top50')}
                        className={`v2-mnav-btn ${activeWorkflow === 'top50' ? 'active' : ''}`}
                    >
                        <span style={{ fontSize: '1rem' }}>🏆</span>
                        <span>Top 50</span>
                    </button>
                    <button
                        onClick={() => activateWorkflow('insights')}
                        className={`v2-mnav-btn ${activeWorkflow === 'insights' ? 'active' : ''}`}
                    >
                        <span style={{ fontSize: '1rem' }}>📊</span>
                        <span>Insights</span>
                    </button>
                </nav>

                {/* =================================================================
                    CUSTOM MODALS (Save Playlist, Export Excel, Confirm Remove, Load Link)
                    ================================================================= */}

                {/* 1. SAVE AS NEW PLAYLIST MODAL */}
                {activeModal === 'save' && (
                    <div className="v2-modal-backdrop" onClick={() => setActiveModal(null)}>
                        <div className="v2-modal-card" onClick={e => e.stopPropagation()}>
                            <div className="v2-modal-header">
                                <h3 className="v2-modal-title">➕ Create New Playlist</h3>
                                <button onClick={() => setActiveModal(null)} className="v2-btn-logout">✕</button>
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                                Creates a new playlist in your {provider.displayName} account with the{' '}
                                <strong style={{ color: '#fff' }}>{selectedTrackItems.length}</strong> selected tracks.
                            </p>
                            <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                                New Playlist Title
                            </label>
                            <input
                                type="text"
                                value={newPlaylistName}
                                onChange={e => setNewPlaylistName(e.target.value)}
                                className="v2-input"
                                style={{ width: '100%', marginBottom: '1rem' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button onClick={() => setActiveModal(null)} className="v2-btn-secondary">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmSavePlaylist}
                                    disabled={isSubmittingModal}
                                    className="v2-btn-primary brand-bg"
                                >
                                    {isSubmittingModal ? 'Creating...' : 'Create Playlist'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. EXCEL EXPORT MODAL */}
                {activeModal === 'export' && (
                    <div className="v2-modal-backdrop" onClick={() => setActiveModal(null)}>
                        <div className="v2-modal-card" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
                            <div className="v2-modal-header">
                                <h3 className="v2-modal-title">📥 Export to Excel (.xlsx)</h3>
                                <button onClick={() => setActiveModal(null)} className="v2-btn-logout">✕</button>
                            </div>
                            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                Exporting <strong>{selectedTrackItems.length || filteredTracks.length}</strong> tracks with clickable{' '}
                                <code className="brand-text">=HYPERLINK()</code> formulas and playlist sources.
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <span className="v2-section-label">Columns ({selectedExportFields.length}/{EXPORT_FIELDS.length})</span>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button
                                        onClick={() => setSelectedExportFields(EXPORT_FIELDS.map(f => f.key))}
                                        className="v2-btn-secondary"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={() => setSelectedExportFields(['track_name', 'artist_names', 'album_name', 'available_in_playlists'])}
                                        className="v2-btn-secondary"
                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem' }}
                                    >
                                        Minimal
                                    </button>
                                </div>
                            </div>

                            <div className="v2-export-fields-grid">
                                {EXPORT_FIELDS.map(field => {
                                    const checked = selectedExportFields.includes(field.key);
                                    return (
                                        <label key={field.key} className="v2-field-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => {
                                                    setSelectedExportFields(prev =>
                                                        prev.includes(field.key)
                                                            ? prev.filter(k => k !== field.key)
                                                            : [...prev, field.key]
                                                    );
                                                }}
                                                style={{ accentColor: 'var(--brand)' }}
                                            />
                                            <span>{field.label}</span>
                                        </label>
                                    );
                                })}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => handleConfirmExportExcel(true)}
                                    className="v2-btn-secondary"
                                >
                                    ⚡ Quick Export (with Match Reasons)
                                </button>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => setActiveModal(null)} className="v2-btn-secondary">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handleConfirmExportExcel(false)}
                                        className="v2-btn-primary brand-bg"
                                    >
                                        Download .xlsx
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. CONFIRM REMOVE TRACKS MODAL */}
                {activeModal === 'remove' && (
                    <div className="v2-modal-backdrop" onClick={() => setActiveModal(null)}>
                        <div className="v2-modal-card" onClick={e => e.stopPropagation()}>
                            <div className="v2-modal-header">
                                <h3 className="v2-modal-title" style={{ color: '#f87171' }}>
                                    🗑️ Remove Selected Tracks?
                                </h3>
                                <button onClick={() => setActiveModal(null)} className="v2-btn-logout">✕</button>
                            </div>
                            <p style={{ fontSize: '0.78rem', color: '#d4d4d8', marginBottom: '1.1rem' }}>
                                Are you sure you want to remove the <strong>{selectedTrackItems.length}</strong> selected tracks from their source playlists?
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button onClick={() => setActiveModal(null)} className="v2-btn-secondary">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmRemoveTracks}
                                    disabled={isSubmittingModal}
                                    className="v2-btn-danger"
                                    style={{ background: '#ef4444', color: '#fff', fontWeight: 700 }}
                                >
                                    {isSubmittingModal ? 'Removing...' : 'Yes, Remove Tracks'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. LOAD PLAYLIST LINK MODAL */}
                {activeModal === 'link' && (
                    <div className="v2-modal-backdrop" onClick={() => setActiveModal(null)}>
                        <div className="v2-modal-card" onClick={e => e.stopPropagation()}>
                            <div className="v2-modal-header">
                                <h3 className="v2-modal-title">🔗 Load Any Playlist by Link or ID</h3>
                                <button onClick={() => setActiveModal(null)} className="v2-btn-logout">✕</button>
                            </div>
                            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                Paste a public {provider.displayName} playlist URL or ID to import its tracks into your workspace.
                            </p>
                            <input
                                type="text"
                                value={linkInputUrl}
                                onChange={e => setLinkInputUrl(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleConfirmLoadLink()}
                                placeholder="https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
                                className="v2-input"
                                style={{ width: '100%', marginBottom: '1rem' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button onClick={() => setActiveModal(null)} className="v2-btn-secondary">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmLoadLink}
                                    disabled={isSubmittingModal}
                                    className="v2-btn-primary brand-bg"
                                >
                                    {isSubmittingModal ? 'Loading...' : 'Import Playlist'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* TOAST NOTIFICATION */}
                {toastMessage && (
                    <div className="v2-toast brand-bg">
                        ✓ {toastMessage}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
