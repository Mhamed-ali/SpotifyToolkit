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
    analyzeVibe,
    getVibeDescription
} from './services/analysis.utils';
import { formatDuration, extractReleaseYear } from './utils/formatters';
import { createClientLogger } from './utils/logger';

const logger = createClientLogger('AppV2');

function App() {
    // =========================================================================
    // AUTH & PROVIDER STATE
    // =========================================================================
    const [serverMessage, setServerMessage] = useState('Checking server connection...');
    const [providerId, setProviderId] = useState(
        () => localStorage.getItem('music_provider') || PROVIDERS.SPOTIFY
    );
    const [token, setToken] = useState(() => localStorage.getItem('spotify_access_token'));
    const [profile, setProfile] = useState(null);

    // =========================================================================
    // LIBRARY & PLAYLISTS STATE
    // =========================================================================
    const [playlistsData, setPlaylistsData] = useState([]);
    const [likedSongsCount, setLikedSongsCount] = useState(0);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
    const [playlistSearch, setPlaylistSearch] = useState('');
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [selectedPlaylistIds, setSelectedPlaylistIds] = useState(() => new Set(['ALL']));

    // =========================================================================
    // WORKFLOW, FILTERS & TRACKS STATE
    // =========================================================================
    const [activeWorkflow, setActiveWorkflow] = useState(
        () => localStorage.getItem('pending_workflow') || 'arabic-all'
    );
    const [activeFilterChip, setActiveFilterChip] = useState('arabic'); // 'all' | 'arabic' | '2020s' | 'classic'
    const [activeArtistFilter, setActiveArtistFilter] = useState(null);
    const [activeDecadeFilter, setActiveDecadeFilter] = useState(null);
    const [trackSearch, setTrackSearch] = useState('');
    const [sortBy, setSortBy] = useState('default');

    // Duplicate Cleaner State
    const [duplicateStrategy, setDuplicateStrategy] = useState('oldest'); // 'oldest' | 'popular'
    const [matchDuration, setMatchDuration] = useState(false);

    // Insights / Vibe State
    const [includeCollabs, setIncludeCollabs] = useState(false);
    const [vibeStats, setVibeStats] = useState(null);
    const [isAnalyzingVibe, setIsAnalyzingVibe] = useState(false);

    // Loaded Tracks & Selection State
    const [rawScopeTracks, setRawScopeTracks] = useState([]);
    const [selectedKeys, setSelectedKeys] = useState(() => new Set());
    const [scanProgress, setScanProgress] = useState(null); // { current, total, label }
    const [allLibraryArabicCount, setAllLibraryArabicCount] = useState(null);

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

    // Cache of loaded tracks per playlistId so switching views is instant
    const tracksCacheRef = useRef({});
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

    // Sync token when spotify.service.js automatically refreshes an expired access token
    useEffect(() => {
        const handleTokenRefreshed = (e) => {
            if (e.detail) setToken(e.detail);
        };
        window.addEventListener('spotify-token-refreshed', handleTokenRefreshed);
        return () => window.removeEventListener('spotify-token-refreshed', handleTokenRefreshed);
    }, []);

    // =========================================================================
    // ENRICH TRACK ITEM HELPER
    // =========================================================================
    const enrichTrackItem = useCallback((item, sourcePlaylist) => {
        if (!item || !item.track || !item.track.id) return null;
        const arabicReason = ArabicDetector.detectTrack(item);
        const releaseYear = parseInt(extractReleaseYear(item.track.album?.release_date), 10) || 0;
        const enriched = {
            ...item,
            sourcePlaylist: item.sourcePlaylist || sourcePlaylist,
            _arabicReason: arabicReason,
            _isArabic: Boolean(arabicReason),
            _releaseYear: releaseYear
        };
        enriched._selectionKey = DuplicateDetector.getSelectionKey(
            enriched,
            sourcePlaylist?.id || 'SINGLE'
        );
        return enriched;
    }, []);

    // =========================================================================
    // FETCH TRACKS FOR A SINGLE PLAYLIST (WITH CACHE)
    // =========================================================================
    const fetchTracksForPlaylistCached = useCallback(async (activeToken, playlistObj, activeProvider) => {
        const pid = playlistObj.id;
        if (tracksCacheRef.current[pid]) {
            return tracksCacheRef.current[pid];
        }

        const total = playlistObj.tracks?.total || 0;
        const sourceMeta = {
            id: pid,
            name: playlistObj.name,
            owner: playlistObj.owner,
            collaborative: playlistObj.collaborative
        };

        let rawItems = [];
        if (pid === PLAYLIST_IDS.LIKED_SONGS) {
            const firstPage = await activeProvider.fetchSavedTracks(activeToken, 0, 50);
            const firstItems = firstPage?.items || [];
            if (total > firstItems.length) {
                const rest = await activeProvider.fetchRemainingTracks(activeToken, total, 'me', null);
                rawItems = [...firstItems, ...(rest || [])];
            } else {
                rawItems = firstItems;
            }
        } else {
            rawItems = await activeProvider.fetchAllTracksForPlaylist(activeToken, pid, total);
        }

        const enriched = (rawItems || [])
            .map(item => enrichTrackItem(item, sourceMeta))
            .filter(Boolean);

        tracksCacheRef.current[pid] = enriched;
        return enriched;
    }, [enrichTrackItem]);

    // =========================================================================
    // LOAD TRACKS FOR CURRENT PLAYLIST SCOPE ('ALL' OR SPECIFIC PLAYLISTS)
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

        const accumulated = [];
        const totalPlaylists = targetPlaylists.length;

        for (let i = 0; i < totalPlaylists; i++) {
            if (loadOperationRef.current !== opId) return;
            const pl = targetPlaylists[i];

            if (totalPlaylists > 1 && !tracksCacheRef.current[pl.id]) {
                setScanProgress({
                    current: i + 1,
                    total: totalPlaylists,
                    label: `Scanning ${pl.name} (${i + 1}/${totalPlaylists})...`
                });
            }

            try {
                const items = await fetchTracksForPlaylistCached(activeToken, pl, activeProvider);
                if (loadOperationRef.current !== opId) return;
                accumulated.push(...items);
                setRawScopeTracks([...accumulated]);
            } catch (err) {
                logger.warn(`Skipping playlist ${pl.name}`, err);
            }
        }

        if (loadOperationRef.current === opId) {
            setScanProgress(null);
            if (scopeSet.has('ALL')) {
                const uniqueArabicIds = new Set(
                    accumulated.filter(t => t._isArabic).map(t => t.track.id)
                );
                setAllLibraryArabicCount(uniqueArabicIds.size);
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

            if (!activeToken) {
                fetch('/health')
                    .then(res => res.json())
                    .then(data => setServerMessage(data.message || 'Server Online • Spotify OAuth & Anghami SDK Ready'))
                    .catch(() => setServerMessage('Backend not connected (Is the server running on port 8888?)'));
                return;
            }

            setServerMessage(`Connected to ${activeProvider.displayName}`);
            setIsLoadingLibrary(true);

            try {
                const [profData, playlistsRes, likedRes] = await Promise.all([
                    activeProvider.fetchProfile(activeToken).catch(err => ({ error: err })),
                    activeProvider.fetchUserPlaylists(activeToken, 50).catch(err => ({ error: err })),
                    activeProvider.fetchSavedTracks(activeToken, 0, 1).catch(err => ({ error: err }))
                ]);

                if (profData?.error?.status === 401) {
                    handleLogout();
                    return;
                }
                if (!profData?.error) {
                    setProfile(profData);
                }

                let loadedPlaylists = !playlistsRes?.error ? (playlistsRes.items || []) : [];
                const likedTotal = !likedRes?.error ? (likedRes.total || 0) : 0;

                // Check if user submitted a playlist link from the Login page
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
                setActiveFilterChip(
                    initialWorkflow === 'arabic-all' || initialWorkflow === 'arabic-playlist'
                        ? 'arabic'
                        : 'all'
                );
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

    // =========================================================================
    // DEDUPLICATED VS RAW TRACKS IN SCOPE + DUPLICATE STATUS MAP
    // =========================================================================
    const { scopeTracks, duplicateStatusMap, duplicateRemoveCount } = useMemo(() => {
        // Compute duplicate groups across rawScopeTracks
        const isCombined = selectedPlaylistIds.has('ALL') || selectedPlaylistIds.size > 1;
        const dupeGroups = DuplicateDetector.findDuplicates(rawScopeTracks, {
            isCombined,
            scope: isCombined ? 'global' : 'playlist',
            matchDuration
        });

        const statusMap = {};
        let removeCount = 0;

        dupeGroups.forEach(group => {
            const sorted = [...group].sort((a, b) => {
                if (duplicateStrategy === 'popular') {
                    return (b.track?.popularity || 0) - (a.track?.popularity || 0);
                }
                return (a._releaseYear || 9999) - (b._releaseYear || 9999);
            });
            sorted.forEach((item, idx) => {
                if (idx === 0) {
                    statusMap[item._selectionKey] = 'KEEP';
                } else {
                    statusMap[item._selectionKey] = 'REMOVE';
                    removeCount++;
                }
            });
        });

        // In 'duplicates' workflow, show every duplicate track instance so user sees KEEP vs REMOVE copies
        if (activeWorkflow === 'duplicates') {
            const onlyDupes = rawScopeTracks.filter(item => Boolean(statusMap[item._selectionKey]));
            return {
                scopeTracks: onlyDupes,
                duplicateStatusMap: statusMap,
                duplicateRemoveCount: removeCount
            };
        }

        // In other workflows, merge identical track IDs when scanning multiple playlists ('ALL')
        // so the user doesn't get duplicate songs in their extracted Arabic playlist,
        // while preserving all source playlist names for Excel export!
        const byTrackId = new Map();
        rawScopeTracks.forEach(item => {
            const tid = item.track?.id;
            if (!tid) return;
            const plName = item.sourcePlaylist?.name || 'Playlist';
            if (!byTrackId.has(tid)) {
                byTrackId.set(tid, {
                    ...item,
                    sourcePlaylists: [plName]
                });
            } else {
                const existing = byTrackId.get(tid);
                if (!existing.sourcePlaylists.includes(plName)) {
                    existing.sourcePlaylists.push(plName);
                }
            }
        });

        return {
            scopeTracks: Array.from(byTrackId.values()),
            duplicateStatusMap: statusMap,
            duplicateRemoveCount: removeCount
        };
    }, [rawScopeTracks, selectedPlaylistIds, matchDuration, duplicateStrategy, activeWorkflow]);

    // =========================================================================
    // FILTERED & SORTED TRACKS
    // =========================================================================
    const filteredTracks = useMemo(() => {
        const q = trackSearch.trim().toLowerCase();

        const list = scopeTracks.filter(item => {
            const t = item.track;
            if (!t) return false;

            if (activeFilterChip === 'arabic' && !item._isArabic) return false;
            if (activeFilterChip === '2020s' && item._releaseYear < 2020) return false;
            if (activeFilterChip === 'classic' && (item._releaseYear === 0 || item._releaseYear > 2005)) return false;

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
                const haystack = `${t.name} ${artistStr} ${albumStr} ${reasonStr}`.toLowerCase();
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
        activeFilterChip,
        activeArtistFilter,
        activeDecadeFilter,
        includeCollabs,
        trackSearch,
        sortBy
    ]);

    // Auto-select appropriate tracks when workflow, filter, or duplicate strategy changes
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
    }, [activeWorkflow, activeFilterChip, duplicateStrategy, matchDuration, filteredTracks, duplicateStatusMap]);

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

        return {
            topArtists,
            timeline,
            generalStats,
            arabicCount,
            arabicPct
        };
    }, [scopeTracks, includeCollabs]);

    // =========================================================================
    // WORKFLOW & PLAYLIST HANDLERS
    // =========================================================================
    const activateWorkflow = (workflow) => {
        setActiveWorkflow(workflow);
        setActiveArtistFilter(null);
        setActiveDecadeFilter(null);

        if (workflow === 'arabic-all') {
            setSelectedPlaylistIds(new Set(['ALL']));
            setActiveFilterChip('arabic');
            setNewPlaylistName('🌙 Extracted Arabic Favorites');
        } else if (workflow === 'arabic-playlist') {
            if (selectedPlaylistIds.has('ALL')) {
                const firstSpecificId = likedSongsCount > 0
                    ? PLAYLIST_IDS.LIKED_SONGS
                    : (playlistsData[0]?.id || 'ALL');
                setSelectedPlaylistIds(new Set([firstSpecificId]));
            }
            setActiveFilterChip('arabic');
            setNewPlaylistName('🎯 Extracted Arabic Playlist');
        } else if (workflow === 'duplicates') {
            setActiveFilterChip('all');
        } else if (workflow === 'insights') {
            setActiveFilterChip('all');
        }
    };

    const handlePlaylistClick = (id) => {
        if (id === 'ALL') {
            setSelectedPlaylistIds(new Set(['ALL']));
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
            setSelectedPlaylistIds(new Set([id]));
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

    const handleRunVibeAnalysis = async () => {
        if (!token || scopeTracks.length === 0) return;
        setIsAnalyzingVibe(true);
        try {
            const result = await analyzeVibe(token, scopeTracks);
            setVibeStats(result.stats);
            showToast('Audio vibe analysis complete!');
        } catch (err) {
            logger.warn('Vibe analysis error', err);
            showToast('Could not analyze audio features');
        } finally {
            setIsAnalyzingVibe(false);
        }
    };

    // =========================================================================
    // LOGIN SCREEN HANDLERS
    // =========================================================================
    const handleSpotifyLogin = () => {
        localStorage.setItem('music_provider', PROVIDERS.SPOTIFY);
        window.location.href = '/login';
    };

    const handleAnghamiLogin = () => {
        localStorage.setItem('music_provider', PROVIDERS.ANGHAMI);
        window.location.href = '/anghami/login';
    };

    const handleLoginWorkflowLaunch = (workflow) => {
        localStorage.setItem('pending_workflow', workflow);
        if (providerId === PROVIDERS.ANGHAMI) {
            handleAnghamiLogin();
        } else {
            handleSpotifyLogin();
        }
    };

    const handleLoginQuickUrlAnalyze = () => {
        const url = loginQuickUrl.trim();
        if (!url) return;
        localStorage.setItem('pending_playlist_link', url);
        if (url.toLowerCase().includes('anghami')) {
            handleAnghamiLogin();
        } else {
            handleSpotifyLogin();
        }
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
            tracksCacheRef.current[created.id] = selectedTrackItems.map(item =>
                enrichTrackItem(item, { id: created.id, name: title })
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
            showToast('Anghami SDK is read-only.');
            setActiveModal(null);
            return;
        }
        if (selectedTrackItems.length === 0) return;

        setIsSubmittingModal(true);
        try {
            // Group URIs by sourcePlaylist.id
            const byPlaylist = {};
            selectedTrackItems.forEach(item => {
                const pid = item.sourcePlaylist?.id;
                const uri = DuplicateDetector.extractUriFromKey(item._selectionKey) || item.track?.uri;
                if (!pid || !uri || pid === PLAYLIST_IDS.LIKED_SONGS) return;
                if (!byPlaylist[pid]) byPlaylist[pid] = [];
                byPlaylist[pid].push(uri);
            });

            const playlistIds = Object.keys(byPlaylist);
            for (const pid of playlistIds) {
                await provider.removeTracksFromPlaylist(token, pid, byPlaylist[pid]);
                if (tracksCacheRef.current[pid]) {
                    const removedSet = new Set(byPlaylist[pid]);
                    tracksCacheRef.current[pid] = tracksCacheRef.current[pid].filter(
                        item => !removedSet.has(item.track?.uri)
                    );
                }
            }

            const removedKeys = new Set(selectedTrackItems.map(i => i._selectionKey));
            setRawScopeTracks(prev => prev.filter(item => !removedKeys.has(item._selectionKey)));
            setSelectedKeys(new Set());
            setActiveModal(null);
            showToast(`Removed ${selectedTrackItems.length} tracks!`);
        } catch (err) {
            logger.error('Failed to remove tracks', err);
            showToast(`Error removing tracks: ${err.message || 'Check permissions'}`);
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

    const scopeArabicCount = useMemo(
        () => scopeTracks.filter(t => t._isArabic).length,
        [scopeTracks]
    );

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
                            Spotify &amp; Anghami <span className="brand-text">Toolkit 2.0</span>
                        </h1>
                        <p className="v2-hero-subtitle">
                            Extract Arabic songs across your entire library in <strong>1 click</strong>, clean duplicate tracks with smart presets, and export 19-field Excel reports.
                        </p>

                        <div className="v2-login-btn-grid">
                            <button className="v2-btn-spotify" onClick={handleSpotifyLogin}>
                                <span>🎧</span>
                                <span>Continue with Spotify</span>
                            </button>
                            <button className="v2-btn-anghami" onClick={handleAnghamiLogin}>
                                <span>🎵</span>
                                <span>Continue with Anghami</span>
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
                                    placeholder="Paste Spotify or Anghami playlist link..."
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
                                            3-tier detection: Arabic script, Franco-Arab keywords, &amp; MENA artist registry.
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
                                            Smart auto-select keeps your oldest or most popular copy and removes extras.
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
                                    {playlistsData.length} Playlists • {scopeTracks.length} Tracks
                                </div>
                            </div>
                            <button onClick={handleLogout} className="v2-btn-logout">
                                Log Out
                            </button>
                        </div>
                    </div>
                </header>

                {/* 2. 1-CLICK QUICK ACTIONS DOCK (Laptop Top Bar) */}
                <section className="v2-quick-dock">
                    <div className="v2-quick-dock-header">
                        <span className="v2-section-label">⚡ 1-Click Workflows</span>
                        <span className="brand-text" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                            {activeWorkflow === 'arabic-all' && 'Active: Extract Arabic (All Songs)'}
                            {activeWorkflow === 'arabic-playlist' && 'Active: Extract Arabic (Selected Playlist)'}
                            {activeWorkflow === 'duplicates' && 'Active: 1-Click Duplicate Cleaner'}
                            {activeWorkflow === 'insights' && 'Active: Artists, Era & Vibe Insights'}
                        </span>
                    </div>

                    <div className="v2-quick-grid">
                        <button
                            onClick={() => activateWorkflow('arabic-all')}
                            className={`obsidian-card-interactive v2-qa-card ${activeWorkflow === 'arabic-all' ? 'brand-active-card' : ''}`}
                        >
                            <span className="v2-qa-icon">🌙</span>
                            <div style={{ minWidth: 0 }}>
                                <div className="v2-qa-title">Arabic (All Songs)</div>
                                <div className="v2-qa-sub">
                                    {allLibraryArabicCount !== null
                                        ? `${allLibraryArabicCount} Arabic matches`
                                        : 'Scan entire library'}
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={() => activateWorkflow('arabic-playlist')}
                            className={`obsidian-card-interactive v2-qa-card ${activeWorkflow === 'arabic-playlist' ? 'brand-active-card' : ''}`}
                        >
                            <span className="v2-qa-icon">🎯</span>
                            <div style={{ minWidth: 0 }}>
                                <div className="v2-qa-title">Arabic (Playlist)</div>
                                <div className="v2-qa-sub">{scopeArabicCount} in selected scope</div>
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
                            onClick={() => activateWorkflow('insights')}
                            className={`obsidian-card-interactive v2-qa-card ${activeWorkflow === 'insights' ? 'brand-active-card' : ''}`}
                        >
                            <span className="v2-qa-icon">📊</span>
                            <div style={{ minWidth: 0 }}>
                                <div className="v2-qa-title">Artists, Era &amp; Vibe</div>
                                <div className="v2-qa-sub">Interactive charts</div>
                            </div>
                        </button>
                    </div>
                </section>

                {/* 3. MAIN WORKSPACE: Left Playlist Rail + Right Content Area */}
                <div className="v2-workspace-body">

                    {/* LEFT PLAYLIST RAIL (Hidden in "Arabic (All Songs)" mode; Compact 1-line pills on Phone) */}
                    {activeWorkflow !== 'arabic-all' && (
                        <aside className="v2-playlist-sidebar">
                            <div className="v2-sidebar-top">
                                <span className="v2-section-label">Select Playlist</span>
                                <button
                                    onClick={() => setIsMultiSelectMode(prev => !prev)}
                                    className={`v2-multi-btn ${isMultiSelectMode ? 'active' : ''}`}
                                >
                                    {isMultiSelectMode ? '✓ Done' : '☑ Multi-Select'}
                                </button>
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
                                            key={pl.id}
                                            onClick={() => handlePlaylistClick(pl.id)}
                                            className={`v2-playlist-item ${isSelected ? 'selected' : ''}`}
                                        >
                                            <div className="v2-playlist-item-left">
                                                {isMultiSelectMode && pl.id !== 'ALL' ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        readOnly
                                                        style={{ accentColor: 'var(--brand)', pointerEvents: 'none' }}
                                                    />
                                                ) : (
                                                    <span>{pl.icon}</span>
                                                )}
                                                <div style={{ minWidth: 0 }}>
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
                    )}

                    {/* RIGHT MAIN WORKSPACE */}
                    <main className="v2-main-content">

                        {/* Scanning Progress Banner */}
                        {scanProgress && (
                            <div className="v2-scan-banner">
                                <span>⚡ {scanProgress.label}</span>
                                <span className="brand-text" style={{ fontWeight: 700 }}>
                                    {Math.round((scanProgress.current / scanProgress.total) * 100)}%
                                </span>
                            </div>
                        )}

                        {/* Active View Header + 1-Click Output Actions */}
                        <div className="v2-view-header">
                            <div className="v2-view-title-wrap">
                                <div className="v2-view-title-row">
                                    <h2 className="v2-view-title">
                                        {(activeWorkflow === 'arabic-all' || activeFilterChip === 'arabic') && `🌙 Arabic Tracks — ${scopeDisplayName}`}
                                        {activeWorkflow === 'duplicates' && `🧹 Duplicate Tracks — ${scopeDisplayName}`}
                                        {activeWorkflow === 'insights' && activeFilterChip !== 'arabic' && `📊 Insights & Breakdown — ${scopeDisplayName}`}
                                        {activeWorkflow === 'arabic-playlist' && activeFilterChip !== 'arabic' && scopeDisplayName}
                                    </h2>
                                    <span className="v2-count-badge brand-bg">
                                        {filteredTracks.length} Songs
                                    </span>
                                </div>
                                <p className="v2-view-subtitle">
                                    {activeWorkflow === 'duplicates'
                                        ? 'Smart Duplicate Cleaner: Extra copies are auto-selected for 1-click removal'
                                        : '3-Tier Detection: Arabic Script, Franco-Arab Keywords & MENA Artists'}
                                </p>
                            </div>

                            <div className="v2-action-bar">
                                <button
                                    onClick={() => setActiveModal('save')}
                                    disabled={!provider.supportsWrite || selectedTrackItems.length === 0}
                                    className="v2-btn-primary brand-bg"
                                >
                                    <span>➕</span>
                                    <span>Save as Playlist ({selectedTrackItems.length})</span>
                                </button>

                                <button
                                    onClick={() => setActiveModal('export')}
                                    disabled={filteredTracks.length === 0}
                                    className="v2-btn-secondary"
                                >
                                    <span>📥</span>
                                    <span>Export Excel</span>
                                </button>

                                <button
                                    onClick={() => setActiveModal('remove')}
                                    disabled={!provider.supportsWrite || selectedTrackItems.length === 0}
                                    className="v2-btn-danger"
                                >
                                    <span>🗑️</span>
                                    <span>Remove ({selectedTrackItems.length})</span>
                                </button>
                            </div>
                        </div>

                        {/* Inline Search + Instant Filter Chips + Sort Bar */}
                        <div className="v2-toolbar">
                            <div className="v2-toolbar-top">
                                <input
                                    type="text"
                                    value={trackSearch}
                                    onChange={e => setTrackSearch(e.target.value)}
                                    placeholder="Filter by song title, artist (Amr Diab, Wegz, Cairokee, Fairuz), or album..."
                                    className="v2-input"
                                />

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

                                <button onClick={handleSelectAllVisible} className="v2-btn-secondary">
                                    {filteredTracks.length > 0 && filteredTracks.every(t => selectedKeys.has(t._selectionKey))
                                        ? 'Deselect All'
                                        : 'Select All'}
                                </button>
                            </div>

                            <div className="v2-chips-row">
                                <div className="v2-chips-scroll">
                                    <button
                                        onClick={() => setActiveFilterChip('all')}
                                        className={`v2-chip ${activeFilterChip === 'all' ? 'active' : ''}`}
                                    >
                                        All Songs
                                    </button>
                                    <button
                                        onClick={() => setActiveFilterChip('arabic')}
                                        className={`v2-chip ${activeFilterChip === 'arabic' ? 'active' : ''}`}
                                    >
                                        🌙 Arabic Only
                                    </button>
                                    <button
                                        onClick={() => setActiveFilterChip('2020s')}
                                        className={`v2-chip ${activeFilterChip === '2020s' ? 'active' : ''}`}
                                    >
                                        🔥 2020s Era
                                    </button>
                                    <button
                                        onClick={() => setActiveFilterChip('classic')}
                                        className={`v2-chip ${activeFilterChip === 'classic' ? 'active' : ''}`}
                                    >
                                        📼 90s &amp; Classics
                                    </button>

                                    {activeArtistFilter && (
                                        <button
                                            onClick={() => setActiveArtistFilter(null)}
                                            className="v2-chip v2-chip-filter-active"
                                        >
                                            🎤 Artist: {activeArtistFilter} ✕
                                        </button>
                                    )}

                                    {activeDecadeFilter !== null && (
                                        <button
                                            onClick={() => setActiveDecadeFilter(null)}
                                            className="v2-chip v2-chip-filter-active"
                                        >
                                            📅 Era: {activeDecadeFilter}s ✕
                                        </button>
                                    )}
                                </div>

                                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                    {selectedTrackItems.length} of {filteredTracks.length} selected
                                </span>
                            </div>
                        </div>

                        {/* SMART DUPLICATE STRATEGY BAR (Visible in Clean Duplicates Workflow) */}
                        {activeWorkflow === 'duplicates' && (
                            <div className="v2-dupe-bar">
                                <div style={{ fontSize: '0.76rem', color: '#fde68a' }}>
                                    🧹 <strong>Smart Duplicate Cleaner:</strong> Choose which copy to{' '}
                                    <span style={{ color: '#34d399', fontWeight: 700 }}>KEEP</span>; extra copies are auto-selected to{' '}
                                    <span style={{ color: '#f87171', fontWeight: 700 }}>REMOVE</span>.
                                </div>
                                <div className="v2-dupe-controls">
                                    <button
                                        onClick={() => setDuplicateStrategy('oldest')}
                                        className={`v2-strat-btn ${duplicateStrategy === 'oldest' ? 'active' : ''}`}
                                    >
                                        Keep Oldest Copy
                                    </button>
                                    <button
                                        onClick={() => setDuplicateStrategy('popular')}
                                        className={`v2-strat-btn ${duplicateStrategy === 'popular' ? 'active' : ''}`}
                                    >
                                        Keep Most Popular
                                    </button>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={matchDuration}
                                            onChange={e => setMatchDuration(e.target.checked)}
                                            style={{ accentColor: 'var(--brand)' }}
                                        />
                                        <span>Exact Duration Match</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* INTERACTIVE INSIGHTS DRAWER (Visible in Insights Workflow) */}
                        {activeWorkflow === 'insights' && (
                            <div className="v2-insights-panel">
                                <div className="v2-kpi-grid">
                                    <div className="obsidian-card v2-kpi-card">
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Vibe Profile</div>
                                        <div className="brand-text" style={{ fontSize: '0.88rem', fontWeight: 800, marginTop: '0.25rem' }}>
                                            {vibeStats ? getVibeDescription(vibeStats) : '🎉 Ready to Scan'}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span>Avg Pop: {insightsData.generalStats.avgPopularity}%</span>
                                            <button
                                                onClick={handleRunVibeAnalysis}
                                                disabled={isAnalyzingVibe}
                                                style={{ background: 'transparent', color: 'var(--brand)', fontSize: '0.68rem', fontWeight: 700, padding: 0 }}
                                            >
                                                {isAnalyzingVibe ? 'Scanning...' : '⚡ Scan Vibe'}
                                            </button>
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
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Top Artist</div>
                                        <div style={{ fontSize: '0.88rem', fontWeight: 800, marginTop: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {insightsData.topArtists[0]
                                                ? `${insightsData.topArtists[0].name} (${insightsData.topArtists[0].count})`
                                                : '-'}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            Tap bars below to filter
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
                            {isLoadingLibrary && filteredTracks.length === 0 ? (
                                <div className="obsidian-card" style={{ padding: '2.5rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    Loading your music library...
                                </div>
                            ) : filteredTracks.length === 0 ? (
                                <div className="obsidian-card" style={{ padding: '2.5rem', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    No tracks match the current filter. Try clicking <strong>All Songs</strong> or clearing your search.
                                </div>
                            ) : (
                                filteredTracks.map((item, idx) => {
                                    const t = item.track;
                                    const isChecked = selectedKeys.has(item._selectionKey);
                                    const dupeStatus = duplicateStatusMap[item._selectionKey];
                                    const thumbUrl = t.album?.images?.[t.album.images.length - 1]?.url || t.album?.images?.[0]?.url;
                                    const artistNames = t.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
                                    const releaseYear = item._releaseYear || '';
                                    const plLabel = item.sourcePlaylists?.length > 1
                                        ? `${item.sourcePlaylists[0]} +${item.sourcePlaylists.length - 1}`
                                        : (item.sourcePlaylist?.name || '');

                                    return (
                                        <div
                                            key={item._selectionKey + '_' + idx}
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
                                                        {item._arabicReason && (
                                                            <span className="v2-badge-reason brand-pill">{item._arabicReason}</span>
                                                        )}
                                                    </div>
                                                    <div className="v2-track-sub">
                                                        <strong style={{ color: '#e4e4e7', fontWeight: 500 }}>{artistNames}</strong>
                                                        {t.album?.name ? ` • ${t.album.name}` : ''}
                                                        {releaseYear ? ` (${releaseYear})` : ''}
                                                        {plLabel && (
                                                            <>
                                                                {' • '}
                                                                <span className="brand-text">{plLabel}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="v2-track-right">
                                                {typeof t.popularity === 'number' && (
                                                    <span className="v2-track-pop" title="Popularity">
                                                        🔥 {t.popularity}%
                                                    </span>
                                                )}
                                                <span className="v2-track-dur">{formatDuration(t.duration_ms)}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </main>
                </div>

                {/* MOBILE STICKY BOTTOM NAVIGATION (Shown on Phone < 768px) */}
                <nav className="v2-mobile-bottom-nav">
                    <button
                        onClick={() => activateWorkflow('arabic-all')}
                        className={`v2-mnav-btn ${activeWorkflow === 'arabic-all' ? 'active' : ''}`}
                    >
                        <span style={{ fontSize: '1rem' }}>🌙</span>
                        <span>Arabic All</span>
                    </button>
                    <button
                        onClick={() => activateWorkflow('arabic-playlist')}
                        className={`v2-mnav-btn ${activeWorkflow === 'arabic-playlist' ? 'active' : ''}`}
                    >
                        <span style={{ fontSize: '1rem' }}>🎯</span>
                        <span>By Playlist</span>
                    </button>
                    <button
                        onClick={() => activateWorkflow('duplicates')}
                        className={`v2-mnav-btn ${activeWorkflow === 'duplicates' ? 'active' : ''}`}
                    >
                        <span style={{ fontSize: '1rem' }}>🧹</span>
                        <span>Duplicates</span>
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
                                <h3 className="v2-modal-title">➕ Save Selected Tracks as New Playlist</h3>
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
