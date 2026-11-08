import { PLAYLIST_IDS } from '../models/Playlist.js';
import { createClientLogger } from '../utils/logger.js';

const logger = createClientLogger('AnghamiService');

/**
 * Adapter Service for Anghami Integration (`sdk.anghami.com`).
 * Maps Anghami PlaylistService & Song catalog responses into the normalized
 * Toolkit track/playlist schema so all analysis, filter, duplicate, and Excel export
 * modules work identically across Spotify and Anghami.
 *
 * Also includes curated MENA/Arabic showcase playlists when operating in Public/Sandbox mode
 * (when ANGHAMI_CLIENT_ID / ANGHAMI_API_KEY are not yet configured in server/.env).
 */

const CURATED_ANGHAMI_PLAYLISTS = [
    {
        id: 'anghami_top_arabic',
        name: 'Top Arabic Hits - أغاني عربية',
        description: 'Anghami MENA Chart Toppers & Classics (Amr Diab, Cairokee, Wegz, Fairuz)',
        public: true,
        owner: { id: 'anghami', display_name: 'Anghami Editorial' },
        images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80' }],
        tracks: {
            total: 10,
            items: [
                {
                    added_at: '2026-02-10T12:00:00Z',
                    track: {
                        id: 'ang_101',
                        uri: 'anghami:track:101',
                        name: 'تملي معاك - Tamally Maak',
                        duration_ms: 268000,
                        popularity: 92,
                        explicit: false,
                        artists: [{ id: 'art_amr', name: 'Amr Diab' }],
                        album: {
                            id: 'alb_tamally',
                            name: 'Tamally Maak',
                            release_date: '2000-07-15',
                            images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/101' }
                    }
                },
                {
                    added_at: '2026-02-11T12:00:00Z',
                    track: {
                        id: 'ang_102',
                        uri: 'anghami:track:102',
                        name: 'البخت - El Bakht',
                        duration_ms: 215000,
                        popularity: 95,
                        explicit: false,
                        artists: [{ id: 'art_wegz', name: 'Wegz' }],
                        album: {
                            id: 'alb_bakht',
                            name: 'El Bakht Single',
                            release_date: '2022-02-26',
                            images: [{ url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/102' }
                    }
                },
                {
                    added_at: '2026-02-12T12:00:00Z',
                    track: {
                        id: 'ang_103',
                        uri: 'anghami:track:103',
                        name: 'روما - Roma',
                        duration_ms: 234000,
                        popularity: 89,
                        explicit: false,
                        artists: [{ id: 'art_cairokee', name: 'Cairokee' }],
                        album: {
                            id: 'alb_roma',
                            name: 'Roma',
                            release_date: '2022-09-20',
                            images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/103' }
                    }
                },
                {
                    added_at: '2026-02-13T12:00:00Z',
                    track: {
                        id: 'ang_104',
                        uri: 'anghami:track:104',
                        name: 'نور العين - Nour El Ein',
                        duration_ms: 305000,
                        popularity: 90,
                        explicit: false,
                        artists: [{ id: 'art_amr', name: 'Amr Diab' }],
                        album: {
                            id: 'alb_nour',
                            name: 'Nour El Ein',
                            release_date: '1996-06-01',
                            images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/104' }
                    }
                },
                {
                    added_at: '2026-02-14T12:00:00Z',
                    track: {
                        id: 'ang_105_dup',
                        uri: 'anghami:track:105',
                        name: 'تملي معاك - Tamally Maak',
                        duration_ms: 268000,
                        popularity: 88,
                        explicit: false,
                        artists: [{ id: 'art_amr', name: 'Amr Diab' }],
                        album: {
                            id: 'alb_tamally_remaster',
                            name: 'Best of Amr Diab (Remastered)',
                            release_date: '2020-01-10',
                            images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/105' }
                    }
                },
                {
                    added_at: '2026-02-15T12:00:00Z',
                    track: {
                        id: 'ang_106',
                        uri: 'anghami:track:106',
                        name: 'سألوني الناس - Saalouni El Nas',
                        duration_ms: 242000,
                        popularity: 87,
                        explicit: false,
                        artists: [{ id: 'art_fairuz', name: 'Fairuz' }, { id: 'art_ziad', name: 'Ziad Rahbani' }],
                        album: {
                            id: 'alb_fairuz',
                            name: 'Mais El Reem',
                            release_date: '1975-03-12',
                            images: [{ url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/106' }
                    }
                },
                {
                    added_at: '2026-02-16T12:00:00Z',
                    track: {
                        id: 'ang_107',
                        uri: 'anghami:track:107',
                        name: 'بنت الجيران - Bent El Geran',
                        duration_ms: 251000,
                        popularity: 86,
                        explicit: false,
                        artists: [{ id: 'art_shakoosh', name: 'Hassan Shakosh' }, { id: 'art_kamal', name: 'Omar Kamal' }],
                        album: {
                            id: 'alb_mahraganat',
                            name: 'Mahraganat Essentials',
                            release_date: '2019-12-05',
                            images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/107' }
                    }
                },
                {
                    added_at: '2026-02-17T12:00:00Z',
                    track: {
                        id: 'ang_108',
                        uri: 'anghami:track:108',
                        name: 'Ya Leil W Ya Ein',
                        duration_ms: 290000,
                        popularity: 84,
                        explicit: false,
                        artists: [{ id: 'art_sharmoofers', name: 'Sharmoofers' }],
                        album: {
                            id: 'alb_sharmoofers',
                            name: 'Baranoïa',
                            release_date: '2018-05-20',
                            images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/108' }
                    }
                },
                {
                    added_at: '2026-02-18T12:00:00Z',
                    track: {
                        id: 'ang_109',
                        uri: 'anghami:track:109',
                        name: 'غابات - Ghabat',
                        duration_ms: 198000,
                        popularity: 88,
                        explicit: true,
                        artists: [{ id: 'art_pablo', name: 'Marwan Pablo' }],
                        album: {
                            id: 'alb_ctrl',
                            name: 'CTRL',
                            release_date: '2021-03-01',
                            images: [{ url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/109' }
                    }
                },
                {
                    added_at: '2026-02-19T12:00:00Z',
                    track: {
                        id: 'ang_110_dup',
                        uri: 'anghami:track:110',
                        name: 'البخت - El Bakht',
                        duration_ms: 215000,
                        popularity: 91,
                        explicit: false,
                        artists: [{ id: 'art_wegz', name: 'Wegz' }],
                        album: {
                            id: 'alb_bakht_hits',
                            name: 'Arabic Rap Hits 2024',
                            release_date: '2024-01-15',
                            images: [{ url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/110' }
                    }
                }
            ]
        }
    },
    {
        id: 'anghami_indie_crossover',
        name: 'MENA Indie & Global Mix',
        description: 'Cross-border Arabic Indie & International Favorites on Anghami',
        public: true,
        owner: { id: 'anghami', display_name: 'Anghami Curators' },
        images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&auto=format&fit=crop&q=80' }],
        tracks: {
            total: 5,
            items: [
                {
                    added_at: '2026-03-01T10:00:00Z',
                    track: {
                        id: 'ang_201',
                        uri: 'anghami:track:201',
                        name: 'فاضي شوية - Fady Shewaya',
                        duration_ms: 249000,
                        popularity: 93,
                        explicit: false,
                        artists: [{ id: 'art_hamza', name: 'Hamza Namira' }],
                        album: {
                            id: 'alb_mawlood',
                            name: 'Mawlood Sanat 80',
                            release_date: '2020-12-30',
                            images: [{ url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/201' }
                    }
                },
                {
                    added_at: '2026-03-02T10:00:00Z',
                    track: {
                        id: 'ang_202',
                        uri: 'anghami:track:202',
                        name: 'Blinding Lights',
                        duration_ms: 200040,
                        popularity: 96,
                        explicit: false,
                        artists: [{ id: 'art_weeknd', name: 'The Weeknd' }],
                        album: {
                            id: 'alb_afterhours',
                            name: 'After Hours',
                            release_date: '2020-03-20',
                            images: [{ url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/202' }
                    }
                },
                {
                    added_at: '2026-03-03T10:00:00Z',
                    track: {
                        id: 'ang_203',
                        uri: 'anghami:track:203',
                        name: 'كنت فاكر - Kont Faker',
                        duration_ms: 221000,
                        popularity: 85,
                        explicit: false,
                        artists: [{ id: 'art_cairokee', name: 'Cairokee' }],
                        album: {
                            id: 'alb_abnaa',
                            name: 'Abnaa ElBatta ElSawdaa',
                            release_date: '2019-04-10',
                            images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/203' }
                    }
                },
                {
                    added_at: '2026-03-04T10:00:00Z',
                    track: {
                        id: 'ang_204',
                        uri: 'anghami:track:204',
                        name: 'C’est La Vie',
                        duration_ms: 230000,
                        popularity: 89,
                        explicit: false,
                        artists: [{ id: 'art_khaled', name: 'Cheb Khaled' }],
                        album: {
                            id: 'alb_cestlavie',
                            name: 'C’est La Vie',
                            release_date: '2012-09-03',
                            images: [{ url: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/204' }
                    }
                },
                {
                    added_at: '2026-03-05T10:00:00Z',
                    track: {
                        id: 'ang_103',
                        uri: 'anghami:track:103',
                        name: 'روما - Roma',
                        duration_ms: 234000,
                        popularity: 89,
                        explicit: false,
                        artists: [{ id: 'art_cairokee', name: 'Cairokee' }],
                        album: {
                            id: 'alb_roma',
                            name: 'Roma',
                            release_date: '2022-09-20',
                            images: [{ url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&auto=format&fit=crop&q=80' }]
                        },
                        external_urls: { spotify: 'https://play.anghami.com/song/103' }
                    }
                }
            ]
        }
    }
];

const adaptAnghamiSongToTrackItem = (song = {}) => {
    const id = String(song.id || song.songId || Math.random().toString(36).slice(2));
    const artists = Array.isArray(song.artists)
        ? song.artists.map(a => ({ id: String(a.id || a.name), name: a.name }))
        : [{ id: String(song.artistId || 'artist'), name: song.artistName || song.artist || 'Unknown Artist' }];

    const coverUrl = song.coverArt || song.albumArt || song.artworkUrl || null;
    const images = coverUrl ? [{ url: coverUrl }, { url: coverUrl }, { url: coverUrl }] : [];

    return {
        added_at: song.addedAt || song.added_at || new Date().toISOString(),
        track: {
            id,
            uri: `anghami:track:${id}`,
            name: song.title || song.name || 'Unknown Track',
            duration_ms: song.duration_ms || (song.duration ? Number(song.duration) * 1000 : 210000),
            popularity: song.popularity ?? 80,
            explicit: Boolean(song.explicit),
            artists,
            album: {
                id: String(song.albumId || song.album?.id || ''),
                name: song.albumName || song.album?.name || 'Anghami Single',
                release_date: song.releaseDate || song.album?.release_date || '2023-01-01',
                album_type: 'album',
                images
            },
            external_urls: {
                spotify: song.url || `https://play.anghami.com/song/${id}`
            }
        }
    };
};

const adaptAnghamiPlaylist = (rawPlaylist = {}) => {
    const items = Array.isArray(rawPlaylist.tracks?.items)
        ? rawPlaylist.tracks.items
        : Array.isArray(rawPlaylist.items)
            ? rawPlaylist.items.map(adaptAnghamiSongToTrackItem)
            : [];

    const cover = rawPlaylist.artworkUrl || rawPlaylist.coverArt || rawPlaylist.images?.[0]?.url;

    return {
        id: String(rawPlaylist.id || 'anghami_playlist'),
        name: rawPlaylist.title || rawPlaylist.name || 'Anghami Playlist',
        description: rawPlaylist.description || 'Loaded via Anghami SDK',
        public: rawPlaylist.public !== false,
        owner: {
            id: rawPlaylist.owner?.id || 'anghami_user',
            display_name: rawPlaylist.owner?.display_name || rawPlaylist.ownerName || 'Anghami User'
        },
        images: cover ? [{ url: cover }] : [],
        tracks: {
            total: rawPlaylist.itemCount ?? rawPlaylist.tracks?.total ?? items.length,
            items
        }
    };
};

export const fetchAnghamiProfile = async (token) => {
    if (token && token !== 'anghami_public_session') {
        try {
            const res = await fetch('/anghami/proxy?endpoint=me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                return {
                    id: data.id || 'anghami_user',
                    display_name: data.name || data.display_name || 'Anghami User',
                    product: data.plan || 'plus',
                    images: data.avatarUrl ? [{ url: data.avatarUrl }] : [],
                    provider: 'anghami'
                };
            }
        } catch (err) {
            logger.warn('Falling back to Anghami Public Profile', err);
        }
    }

    return {
        id: 'anghami_explorer',
        display_name: 'Anghami Explorer (MENA)',
        product: 'plus',
        images: [],
        provider: 'anghami'
    };
};

export const fetchAnghamiUserPlaylists = async (token) => {
    if (token && token !== 'anghami_public_session') {
        try {
            const res = await fetch('/anghami/proxy?endpoint=playlists/me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                const items = (data.items || data.playlists || []).map(adaptAnghamiPlaylist);
                if (items.length > 0) {
                    return { items, total: items.length };
                }
            }
        } catch (err) {
            logger.warn('Using curated Anghami playlists', err);
        }
    }

    return {
        items: CURATED_ANGHAMI_PLAYLISTS,
        total: CURATED_ANGHAMI_PLAYLISTS.length
    };
};

export const fetchAnghamiSavedTracks = async (token, offset = 0, limit = 50) => {
    const allLiked = CURATED_ANGHAMI_PLAYLISTS[0].tracks.items;
    return {
        items: allLiked.slice(offset, offset + limit),
        total: allLiked.length
    };
};

export const fetchAnghamiPlaylist = async (token, playlistId) => {
    const curated = CURATED_ANGHAMI_PLAYLISTS.find(p => p.id === playlistId);
    if (curated) return curated;

    try {
        const res = await fetch(`/anghami/proxy?endpoint=${encodeURIComponent(`playlists/${playlistId}`)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
            const data = await res.json();
            return adaptAnghamiPlaylist(data);
        }
    } catch (err) {
        logger.warn(`Anghami API lookup failed for playlist: ${playlistId}`, err);
    }

    // Fallback synthetic playlist if user enters a custom Anghami playlist ID/link while in offline/sandbox mode
    return {
        id: playlistId,
        name: `Anghami Playlist (#${playlistId})`,
        description: 'Public Anghami Playlist loaded via Adapter',
        public: true,
        owner: { id: 'anghami', display_name: 'Anghami User' },
        images: CURATED_ANGHAMI_PLAYLISTS[0].images,
        tracks: CURATED_ANGHAMI_PLAYLISTS[0].tracks
    };
};

export const fetchAnghamiPlaylistTracks = async (token, playlistId, offset = 0, limit = 100) => {
    if (playlistId === PLAYLIST_IDS.LIKED_SONGS) {
        return fetchAnghamiSavedTracks(token, offset, limit);
    }
    const playlist = await fetchAnghamiPlaylist(token, playlistId);
    const allItems = playlist.tracks?.items || [];
    return {
        items: allItems.slice(offset, offset + limit),
        total: allItems.length
    };
};

export const fetchAllAnghamiTracksForPlaylist = async (token, playlistId) => {
    const res = await fetchAnghamiPlaylistTracks(token, playlistId, 0, 500);
    return res.items || [];
};

export const buildAnghamiGlobalTrackMap = async (token, userId, onProgress) => {
    const { items: playlists } = await fetchAnghamiUserPlaylists(token);
    const trackMap = {};

    playlists.forEach((pl, idx) => {
        const tracks = pl.tracks?.items || [];
        tracks.forEach(item => {
            const uri = item?.track?.uri;
            if (!uri) return;
            if (!trackMap[uri]) trackMap[uri] = new Set();
            trackMap[uri].add(pl.name);
        });
        if (onProgress) onProgress(idx + 1, playlists.length);
    });

    const result = {};
    Object.keys(trackMap).forEach(uri => {
        result[uri] = Array.from(trackMap[uri]);
    });
    return result;
};
