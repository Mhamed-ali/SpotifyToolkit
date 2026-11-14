import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Track } from '../src/models/Track.js';
import { PLAYLIST_IDS, PlaylistModel } from '../src/models/Playlist.js';
import { ArabicDetector } from '../src/services/filters/ArabicDetector.js';
import {
    PrimaryArtistSpecification,
    CollaboratorSpecification,
    ReleaseYearSpecification,
    ArabicTrackSpecification,
    TrackFilterEngine
} from '../src/services/filters/TrackSpecifications.js';
import { DuplicateDetector } from '../src/services/DuplicateDetector.js';
import { ExcelExporter, EXPORT_FIELDS } from '../src/services/ExcelExporter.js';
import {
    calculateTopArtists,
    filterTracksByArtists,
    calculateTimelineStats,
    calculatePlaylistStats
} from '../src/services/analysis.utils.js';
import * as spotifyService from '../src/services/spotify.service.js';
import { ANALYSIS_MODULES, ANALYSIS_MODULE_MAP } from '../src/config/analysisRegistry.js';
import { getMusicProvider, PROVIDERS } from '../src/providers/ProviderFactory.js';
import { formatDuration, formatDurationMinutes, formatDate, extractReleaseYear } from '../src/utils/formatters.js';
import { createClientLogger, getRecentClientLogs } from '../src/utils/logger.js';

test('Suite 1 — Formatters (formatDuration, formatDurationMinutes, formatDate, extractReleaseYear)', () => {
    assert.equal(formatDuration(215000), '3:35');
    assert.equal(formatDuration(65000), '1:05');
    assert.equal(formatDuration(0), '0:00');
    assert.equal(formatDuration(-10), '0:00');
    assert.equal(formatDurationMinutes(180000), '3.00m');
    assert.equal(formatDurationMinutes(null), '');
    assert.equal(formatDate(null), '-');
    assert.equal(formatDate('invalid-date'), '-');
    assert.notEqual(formatDate('2024-05-01T00:00:00Z'), '-');
    assert.equal(extractReleaseYear('2022-09-20'), '2022');
    assert.equal(extractReleaseYear(null), '');
});

test('Suite 2 — Track Domain Model (Spotify & Anghami Normalization & Composite Keys)', () => {
    const spotifyTrack = Track.from({
        added_at: '2025-01-01T00:00:00Z',
        track: {
            id: '101',
            uri: 'spotify:track:101',
            name: '  Tamally   Maak ',
            duration_ms: 268000,
            popularity: 91,
            explicit: false,
            artists: [{ id: 'a1', name: 'Amr Diab' }],
            album: { id: 'al1', name: 'Tamally Maak', release_date: '2000-07-15', images: [{ url: 'https://img/1.jpg' }] }
        }
    }, { id: 'playlist_A', name: 'My Playlist' });

    assert.equal(spotifyTrack.isValid, true);
    assert.equal(spotifyTrack.primaryArtist, 'Amr Diab');
    assert.deepEqual(spotifyTrack.artistNames, ['Amr Diab']);
    assert.equal(spotifyTrack.albumName, 'Tamally Maak');
    assert.equal(spotifyTrack.releaseYear, '2000');
    assert.equal(spotifyTrack.formattedDuration, '4:28');
    assert.equal(spotifyTrack.selectionKey, 'playlist_A::spotify:track:101');
    assert.equal(spotifyTrack.getDuplicateFingerprint(false), 'tamally maak|amr diab');
    assert.equal(spotifyTrack.getDuplicateFingerprint(true), 'tamally maak|amr diab|268000');

    // Anghami raw payload normalization & Track.from attaching sourcePlaylist to existing Track instance
    const anghamiTrack = Track.from({
        songId: 'ang_99',
        title: 'El Bakht',
        duration: 215,
        artistName: 'Wegz',
        albumName: 'Single',
        releaseDate: '2022-02-26',
        coverArt: 'https://img/ang.jpg',
        url: 'https://play.anghami.com/song/ang_99'
    });
    assert.equal(anghamiTrack.isValid, true);
    assert.equal(anghamiTrack.durationMs, 215000);
    assert.equal(anghamiTrack.primaryArtist, 'Wegz');
    assert.equal(Track.from(anghamiTrack), anghamiTrack);

    const reattached = Track.from(anghamiTrack, { id: 'p_attached', name: 'Attached Playlist' });
    assert.equal(reattached.sourcePlaylist.id, 'p_attached');
});

test('Suite 3 — PlaylistModel (Liked Songs, Combined Analysis, Edit Permissions, Safe Export Name)', () => {
    const liked = PlaylistModel.createLikedSongs(42);
    assert.equal(liked.id, PLAYLIST_IDS.LIKED_SONGS);
    assert.equal(PlaylistModel.isLikedSongs(liked), true);
    assert.equal(PlaylistModel.canEdit(liked, 'user_1', true), true);
    assert.equal(PlaylistModel.canEdit(liked, 'user_1', false), false);

    const combined = PlaylistModel.createCombined([
        { id: 'p1', name: 'A', tracks: { total: 10 } },
        { id: 'p2', name: 'B', tracks: { total: 15 } }
    ]);
    assert.equal(PlaylistModel.isCombined(combined), true);
    assert.equal(combined.tracks.total, 25);

    const collab = { id: 'p_collab', owner: { id: 'other' }, collaborative: true };
    assert.equal(PlaylistModel.canEdit(collab, 'user_1', true), true);
    assert.equal(PlaylistModel.getSafeExportName({ name: 'My Top Hits! 2026' }), 'My_Top_Hits__2026');
});

test('Suite 4 — ArabicDetector (3-Tier Script, Keyword, Strict & Broad Artist, and Album Matching)', () => {
    assert.match(
        ArabicDetector.detectTrack({ track: { name: 'البخت', artists: [{ name: 'X' }], album: { name: 'Y' } } }),
        /Arabic Script in Title/
    );
    assert.match(
        ArabicDetector.detectTrack({ track: { name: 'My Habibi Song', artists: [{ name: 'DJ' }], album: { name: 'Mix' } } }),
        /Keyword: Habibi/
    );
    assert.equal(
        ArabicDetector.detectTrack({ track: { name: 'Happy Anniversary', artists: [{ name: 'John' }], album: { name: 'Love' } } }),
        null
    );
    assert.match(
        ArabicDetector.detectTrack({ track: { name: 'Roma', artists: [{ name: 'Cairokee' }], album: { name: 'Roma' } } }),
        /Artist Match: cairokee/i
    );
    assert.match(
        ArabicDetector.detectTrack({ track: { name: 'Song', artists: [{ name: 'Ruby' }], album: { name: 'Pop' } } }),
        /Known Artist: Ruby/
    );
    assert.match(
        ArabicDetector.detectTrack({ track: { name: 'Track', artists: [{ name: 'Band' }], album: { name: 'Layali Chill' } } }),
        /Keyword: Layali \(Album\)/
    );
    assert.match(
        ArabicDetector.detectTrack({ track: { name: 'Song', artists: [{ name: 'فرقة كايروكي' }], album: { name: 'Mix' } } }, { strictMode: true }),
        /Known Artist: كايروكي/
    );
    assert.equal(
        ArabicDetector.detectTrack({ track: { name: 'English Song', artists: [{ name: 'Various Artists' }], album: { name: 'Album' } } }),
        null
    );
    assert.match(
        ArabicDetector.detectTrack(
            { track: { name: 'Midnight', artists: [{ name: 'Indie Singer' }], album: { name: 'Live' } } },
            { strictMode: false, artistGenres: ['egyptian pop', 'indie'] }
        ),
        /Genre Match \("egyptian pop"\)/
    );
    assert.equal(
        ArabicDetector.detectByGenres(['egyptian pop'], true),
        null
    );
});

test('Suite 5 — TrackSpecifications & TrackFilterEngine (Primary, Collab, Year, Arabic, AND/OR)', () => {
    const tracks = [
        {
            track: {
                id: '1',
                uri: 'spotify:track:1',
                name: 'Tamally Maak',
                artists: [{ name: 'Amr Diab' }],
                album: { name: 'Tamally Maak', release_date: '2000-07-15' }
            }
        },
        {
            track: {
                id: '2',
                uri: 'spotify:track:2',
                name: 'Saalouni El Nas',
                artists: [{ name: 'Fairuz' }, { name: 'Ziad Rahbani' }],
                album: { name: 'Mais El Reem', release_date: '1975-03-12' }
            }
        },
        {
            track: {
                id: '3',
                uri: 'spotify:track:3',
                name: 'Blinding Lights',
                artists: [{ name: 'The Weeknd' }],
                album: { name: 'After Hours', release_date: '2020-03-20' }
            }
        }
    ];

    assert.equal(new PrimaryArtistSpecification(['Amr Diab']).evaluate(tracks[0]).matches, true);
    assert.equal(new CollaboratorSpecification(['Ziad Rahbani']).evaluate(tracks[1]).matches, true);
    assert.equal(new ReleaseYearSpecification(['2020']).evaluate(tracks[2]).matches, true);
    assert.equal(new ArabicTrackSpecification(true).evaluate(tracks[0]).matches, true);

    assert.equal(TrackFilterEngine.filterTracks(tracks, { primaryArtists: [], collabArtists: [], years: [], arabicOnly: false }).length, 0);

    const arabic1975 = TrackFilterEngine.filterTracks(tracks, {
        primaryArtists: [],
        collabArtists: ['Ziad Rahbani'],
        years: ['1975'],
        arabicOnly: true
    }, 'AND');
    assert.equal(arabic1975.length, 1);
    assert.equal(arabic1975[0].track.id, '2');

    const orMatched = TrackFilterEngine.filterTracks(tracks, {
        primaryArtists: ['Amr Diab'],
        collabArtists: [],
        years: ['2020'],
        arabicOnly: false
    }, 'OR');
    assert.equal(orMatched.length, 2);
});

test('Suite 6 — DuplicateDetector (Per-Playlist vs Overall, Duration Matching & Composite Keys)', () => {
    const sampleTracks = [
        {
            sourcePlaylist: { id: 'p1', name: 'B Playlist' },
            track: { id: '1', uri: 'spotify:track:1', name: 'El Bakht', duration_ms: 215000, artists: [{ name: 'Wegz' }] }
        },
        {
            sourcePlaylist: { id: 'p2', name: 'A Playlist' },
            track: { id: '2', uri: 'spotify:track:2', name: 'el bakht', duration_ms: 220000, artists: [{ name: 'Wegz' }] }
        }
    ];

    assert.equal(DuplicateDetector.getSelectionKey(sampleTracks[0]), 'p1::spotify:track:1');
    assert.equal(DuplicateDetector.getSelectionKey({}), 'SINGLE::');
    assert.equal(DuplicateDetector.extractUriFromKey('p1::spotify:track:1'), 'spotify:track:1');
    assert.equal(DuplicateDetector.extractUriFromKey('p1::spotify:track:1::0'), 'spotify:track:1');
    assert.equal(DuplicateDetector.extractUriFromKey('spotify:track:1'), 'spotify:track:1');
    assert.equal(DuplicateDetector.extractUriFromKey(''), '');

    const strictClusters = DuplicateDetector.clusterTracks(
        [
            sampleTracks[0],
            { ...sampleTracks[0], sourcePlaylist: { id: 'p2', name: 'A Playlist' } }
        ],
        { matchCriteria: 'strict', scope: 'cross' }
    );
    assert.equal(strictClusters.length, 1);

    const fuzzyClustersWithin5s = DuplicateDetector.clusterTracks(sampleTracks, {
        matchCriteria: 'fuzzy',
        durationTolerance: 5,
        scope: 'cross'
    });
    assert.equal(fuzzyClustersWithin5s.length, 1);

    const fuzzyClustersSplit1s = DuplicateDetector.clusterTracks(sampleTracks, {
        matchCriteria: 'fuzzy',
        durationTolerance: 1,
        scope: 'cross'
    });
    assert.equal(fuzzyClustersSplit1s.length, 0);
    assert.deepEqual(DuplicateDetector.findDuplicates([]), []);

    assert.equal(DuplicateDetector.findDuplicates(sampleTracks, { isCombined: true, scope: 'overall', matchDuration: false }).length, 1);
    assert.equal(DuplicateDetector.findDuplicates(sampleTracks, { isCombined: true, scope: 'overall', matchDuration: true }).length, 0);
    assert.equal(DuplicateDetector.findDuplicates(sampleTracks, { isCombined: true, scope: 'playlist', matchDuration: false }).length, 0);

    // Multi-group per-playlist combined sort
    const multiPlaylistDupes = [
        ...sampleTracks,
        {
            sourcePlaylist: { id: 'p1', name: 'B Playlist' },
            track: { id: '1b', uri: 'spotify:track:1b', name: 'El Bakht', duration_ms: 215000, artists: [{ name: 'Wegz' }] }
        },
        {
            sourcePlaylist: { id: 'p2', name: 'A Playlist' },
            track: { id: '2b', uri: 'spotify:track:2b', name: 'el bakht', duration_ms: 220000, artists: [{ name: 'Wegz' }] }
        }
    ];
    const sortedGroups = DuplicateDetector.findDuplicates(multiPlaylistDupes, { isCombined: true, scope: 'playlist', matchDuration: false });
    assert.equal(sortedGroups.length, 2);
    assert.equal(sortedGroups[0][0].sourcePlaylist.name, 'A Playlist');
    assert.equal(sortedGroups[1][0].sourcePlaylist.name, 'B Playlist');
});

test('Suite 7 — ExcelExporter Builder, Custom Row Mapper, & File Download', () => {
    const sampleItem = {
        added_at: '2026-01-01T00:00:00Z',
        sourcePlaylists: ['Playlist 1', 'Liked Songs'],
        sourcePlaylist: { name: 'Playlist 1' },
        matchReasons: ['Arabic Script in Title'],
        track: {
            id: 't1',
            uri: 'spotify:track:t1',
            name: 'Song "A"',
            popularity: 85,
            duration_ms: 200000,
            explicit: true,
            track_number: 2,
            disc_number: 1,
            artists: [{ id: 'a1', name: 'Artist 1' }],
            album: { id: 'al1', name: 'Album 1', release_date: '2024-01-01', album_type: 'single' },
            external_ids: { isrc: 'US12345' },
            audio_features: { danceability: 0.82 },
            external_urls: { spotify: 'https://open.spotify.com/track/t1' }
        }
    };

    // Empty export early return
    new ExcelExporter([]).download('empty.xlsx');

    const exporter = new ExcelExporter([sampleItem])
        .withFields(EXPORT_FIELDS.map(f => f.key))
        .withContextPlaylist({ name: 'Context' })
        .withSheetName('All Fields');

    const rows = exporter.buildRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]['Artist Names'], 'Artist 1');
    assert.equal(rows[0]['Available in Playlists'], 'Playlist 1, Liked Songs');
    assert.equal(rows[0]['Explicit'], 'Yes');
    assert.equal(rows[0]['ISRC'], 'US12345');
    assert.match(rows[0]['Track Name'], /^=HYPERLINK\(/);

    // Download & exportQuickTrackList to temporary files
    const tmpFile1 = path.join(os.tmpdir(), `toolkit_test_1_${Date.now()}.xlsx`);
    const tmpFile2 = path.join(os.tmpdir(), `toolkit_test_2_${Date.now()}.xlsx`);
    try {
        exporter.download(tmpFile1);
        assert.ok(fs.existsSync(tmpFile1));

        ExcelExporter.exportQuickTrackList([sampleItem], tmpFile2);
        assert.ok(fs.existsSync(tmpFile2));
    } finally {
        if (fs.existsSync(tmpFile1)) fs.unlinkSync(tmpFile1);
        if (fs.existsSync(tmpFile2)) fs.unlinkSync(tmpFile2);
    }
});

test('Suite 8 — Analysis Utilities (Top Artists, Timeline, Playlist Stats)', () => {
    const tracks = [
        {
            track: {
                id: 't1',
                name: 'Old Song',
                duration_ms: 180000,
                explicit: false,
                popularity: 70,
                artists: [{ name: 'Amr Diab' }, { name: 'Collab Artist' }],
                album: { release_date: '1996-06-01' }
            }
        },
        {
            track: {
                id: 't2',
                name: 'New Song',
                duration_ms: 240000,
                explicit: true,
                popularity: 90,
                artists: [{ name: 'Amr Diab' }],
                album: { release_date: '2024-01-15' }
            }
        }
    ];

    assert.deepEqual(calculateTopArtists([]), []);
    assert.equal(calculateTopArtists(tracks, false).length, 1);
    assert.equal(calculateTopArtists(tracks, true).length, 2);
    assert.deepEqual(filterTracksByArtists(tracks, new Set()), []);
    assert.equal(filterTracksByArtists(tracks, new Set(['Collab Artist']), true).length, 1);
    assert.equal(filterTracksByArtists(tracks, new Set(['Collab Artist']), false).length, 0);

    const timeline = calculateTimelineStats(tracks);
    assert.equal(timeline.totalWithDate, 2);
    assert.equal(timeline.oldest.name, 'Old Song');
    assert.equal(timeline.newest.name, 'New Song');

    const pStats = calculatePlaylistStats(tracks);
    assert.equal(pStats.totalTracks, 2);
    assert.equal(pStats.avgPopularity, 80);
});

test('Suite 9 — Spotify Service (All Endpoints, Pagination, Rate-Limit/Network Retry, & 401 Auto-Refresh)', async () => {
    const origFetch = global.fetch;
    const origLocalStorage = global.localStorage;
    const origWindow = global.window;

    const storageMap = new Map([['spotify_refresh_token', 'stored_rt_1']]);
    global.localStorage = {
        getItem: (k) => storageMap.get(k) || null,
        setItem: (k, v) => storageMap.set(k, v)
    };
    const dispatchedEvents = [];
    global.window = {
        dispatchEvent: (evt) => dispatchedEvents.push(evt)
    };

    try {
        // 1. Test 401 -> automatic token refresh -> retry succeeds
        let profileAttempts = 0;
        global.fetch = async (url, options = {}) => {
            if (url.startsWith('/refresh_token')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ access_token: 'refreshed_acc_tok', refresh_token: 'refreshed_rt_tok' })
                };
            }
            profileAttempts++;
            if (profileAttempts === 1) {
                return { ok: false, status: 401, json: async () => ({}) };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ id: 'u1', seenAuth: options.headers?.Authorization })
            };
        };

        const refreshedProfile = await spotifyService.fetchProfile('expired_tok');
        assert.equal(refreshedProfile.id, 'u1');
        assert.equal(refreshedProfile.seenAuth, 'Bearer refreshed_acc_tok');
        assert.equal(storageMap.get('spotify_access_token'), 'refreshed_acc_tok');

        // 2. Test 401 when refresh_token returns empty JSON (line 28) and when refresh_token endpoint fails (lines 30-33)
        global.fetch = async (url) => {
            if (url.startsWith('/refresh_token')) {
                return { ok: true, status: 200, json: async () => ({}) };
            }
            return { ok: false, status: 401, json: async () => ({ error: 'no_token_in_body' }) };
        };
        const emptyRefreshProfile = await spotifyService.fetchProfile('expired_tok');
        assert.equal(emptyRefreshProfile.error, 'no_token_in_body');

        global.fetch = async (url) => {
            if (url.startsWith('/refresh_token')) {
                return { ok: false, status: 500, json: async () => ({}) };
            }
            return { ok: false, status: 401, json: async () => ({ error: 'unauthorized' }) };
        };
        const failedRefreshProfile = await spotifyService.fetchProfile('expired_tok');
        assert.equal(failedRefreshProfile.error, 'unauthorized');

        // Also test 401 when no refresh token is in localStorage (line 13)
        storageMap.delete('spotify_refresh_token');
        const noStoredRtProfile = await spotifyService.fetchProfile('expired_tok');
        assert.equal(noStoredRtProfile.error, 'unauthorized');

        // 3. Test 429 rate-limit retry and network error retry
        let retryStep = 0;
        const origSetTimeout = global.setTimeout;
        global.setTimeout = (fn) => origSetTimeout(fn, 1);
        try {
            global.fetch = async () => {
                retryStep++;
                if (retryStep === 1) return { ok: false, status: 429 };
                if (retryStep === 2) throw new Error('Transient network error');
                return { ok: true, status: 200, json: async () => ({ items: [{ id: 'pl_retry' }] }) };
            };
            const retryPlaylists = await spotifyService.fetchUserPlaylists('tok', 10);
            assert.equal(retryPlaylists.items[0].id, 'pl_retry');

            // Exhaust all network retries so throw err (line 75) is reached
            global.fetch = async () => {
                throw new Error('Permanent network down');
            };
            await assert.rejects(() => spotifyService.fetchTracksBatch('tok', 'https://api.spotify.com/v1/test'), /Permanent network down/);
        } finally {
            global.setTimeout = origSetTimeout;
        }

        // 4. Test fetchTracksBatch, fetchPlaylist, multi-page fetchAllTracksForPlaylist (Playlist & Liked Songs)
        global.fetch = async (url) => {
            if (url.includes('offset=200')) {
                return { ok: false, status: 500, statusText: 'Server Error' };
            }
            if (url.includes('/playlists/p_big/tracks')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        items: [{ track: { id: 't_page', uri: 'spotify:track:t_page' } }],
                        total: 250
                    })
                };
            }
            if (url.includes('/me/tracks')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        items: [{ track: { id: 't_liked', uri: 'spotify:track:t_liked' } }],
                        total: 75
                    })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ id: 'pl_meta', name: 'Meta Playlist' })
            };
        };

        const batchData = await spotifyService.fetchTracksBatch('tok', 'https://api.spotify.com/v1/batch');
        assert.equal(batchData.id, 'pl_meta');

        const singlePlaylist = await spotifyService.fetchPlaylist('tok', 'p_big');
        assert.equal(singlePlaylist.id, 'pl_meta');

        const pagedPlaylistTracks = await spotifyService.fetchAllTracksForPlaylist('tok', 'p_big');
        assert.equal(pagedPlaylistTracks.length, 2); // first page + 1 successful remaining batch (offset 200 failed gracefully)

        const pagedLikedTracks = await spotifyService.fetchAllTracksForPlaylist('tok', PLAYLIST_IDS.LIKED_SONGS);
        assert.equal(pagedLikedTracks.length, 2);

        global.fetch = async (url) => {
            if (url.includes('/artists?ids=')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ artists: [{ id: 'art1', genres: ['egyptian pop'] }] })
                };
            }
            return { ok: false, status: 500 };
        };
        const artistsBatch = await spotifyService.fetchArtistsBatch('tok', ['art1']);
        assert.equal(artistsBatch.length, 1);
        assert.deepEqual(await spotifyService.fetchArtistsBatch('tok', []), []);

        // 5. Test non-OK error throws on fetchPlaylistTracks, fetchSavedTracks, removeTracksFromPlaylist
        global.fetch = async () => ({ ok: false, status: 403, statusText: 'Forbidden' });
        await assert.rejects(() => spotifyService.fetchPlaylistTracks('tok', 'p1'), { status: 403 });
        await assert.rejects(() => spotifyService.fetchSavedTracks('tok'), { status: 403 });
        await assert.rejects(() => spotifyService.removeTracksFromPlaylist('tok', 'p1', ['spotify:track:1']), { status: 403 });

        // 6. Test mutations (remove from playlist & Liked Songs, create, add) and buildGlobalTrackMap (both success and error paths)
        let likedTracksShouldFail = false;
        global.fetch = async (url) => {
            if (url.includes('/me/playlists')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        items: [
                            { id: 'p_ok', name: 'P_OK', tracks: { total: 1 } },
                            { id: 'p_err', name: 'P_ERR', tracks: { total: 1 } }
                        ],
                        next: null
                    })
                };
            }
            if (url.includes('/playlists/p_err/tracks')) {
                return { ok: false, status: 500, statusText: 'Err' };
            }
            if (url.includes('/playlists/p_ok/tracks')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ items: [{ track: { id: 't1', uri: 'spotify:track:t1' } }], total: 1 })
                };
            }
            if (url.includes('/me/tracks')) {
                if (likedTracksShouldFail) {
                    return { ok: false, status: 500, statusText: 'Liked Err' };
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ items: [{ track: { id: 't_liked', uri: 'spotify:track:t_liked' } }], total: 1 })
                };
            }
            return { ok: true, status: 200, json: async () => ({ id: 'new_pl', name: 'Created' }) };
        };

        await spotifyService.removeTracksFromPlaylist('tok', PLAYLIST_IDS.LIKED_SONGS, ['spotify:track:t_liked']);
        await spotifyService.removeTracksFromPlaylist('tok', 'p_ok', ['spotify:track:t1']);
        const created = await spotifyService.createPlaylist('tok', 'u1', 'New', 'Desc');
        assert.equal(created.id, 'new_pl');
        await spotifyService.addTracksToPlaylist('tok', 'new_pl', ['spotify:track:t1']);

        const progressLog = [];
        const globalMap = await spotifyService.buildGlobalTrackMap('tok', 'u1', (done, total) => progressLog.push({ done, total }));
        assert.deepEqual(globalMap['spotify:track:t1'], ['P_OK']);
        assert.deepEqual(globalMap['spotify:track:t_liked'], ['Liked Songs']);
        assert.ok(progressLog.length >= 2);

        likedTracksShouldFail = true;
        await spotifyService.buildGlobalTrackMap('tok', 'u1');
    } finally {
        global.fetch = origFetch;
        global.localStorage = origLocalStorage;
        global.window = origWindow;
    }
});

test('Suite 10 — ProviderFactory (Spotify Strategy & Link Parsing)', () => {
    const spotify = getMusicProvider(PROVIDERS.SPOTIFY);

    assert.equal(spotify.supportsWrite, true);
    assert.equal(spotify.extractPlaylistIdFromInput(''), null);
    assert.equal(
        spotify.extractPlaylistIdFromInput('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=123'),
        '37i9dQZF1DXcBWIGoYBM5M'
    );
    assert.equal(
        spotify.extractPlaylistIdFromInput('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M'),
        '37i9dQZF1DXcBWIGoYBM5M'
    );
});

test('Suite 11 — Analysis Module Registry & Client Logger Ring Buffer (including >100 overflow)', () => {
    assert.equal(ANALYSIS_MODULES.length, 5);
    assert.ok(ANALYSIS_MODULE_MAP.cleaner);

    const logger = createClientLogger('UnitTest');
    logger.debug('Debug log');
    logger.info('Bearer my_secret_jwt_token logged');
    logger.warn('Warn log');
    logger.error('Error log', new Error('Sample Err'));

    // Fill ring buffer past MAX_BUFFER_SIZE (100) to test shift() eviction
    for (let i = 0; i < 105; i++) {
        logger.info(`Buffer entry ${i} ?access_token=tok_${i}`);
    }

    const logs = getRecentClientLogs();
    assert.equal(logs.length, 100);
    assert.ok(logs.every(l => !l.message.includes('tok_')));
});
