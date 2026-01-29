import React, { useMemo, useState, useEffect, useRef } from 'react';
import '../App.css';
import TrackTable from './TrackTable';
import { removeTracksFromPlaylist, createPlaylist, addTracksToPlaylist } from '../services/spotify.service';
import { utils, writeFile } from 'xlsx';

const MultiSelect = ({ options, selected, onChange, label, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option) => {
        const newSelected = selected.includes(option)
            ? selected.filter(item => item !== option)
            : [...selected, option];
        onChange(newSelected);
    };

    const filteredOptions = options.filter(opt =>
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>{label}</label>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="glass-input"
                style={{
                    padding: '0.8rem',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}
            >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '8px' }}>
                    {selected.length > 0 ? `${selected.length} selected` : placeholder}
                </span>
                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>▼</span>
            </div>

            {isOpen && (
                <div className="custom-scrollbar" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    width: '100%',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    background: '#181818',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    marginTop: '4px',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}>
                    <div style={{ padding: '8px', position: 'sticky', top: 0, background: '#181818', zIndex: 1 }}>
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: 'none',
                                background: 'rgba(255,255,255,0.1)',
                                color: 'white',
                                outline: 'none'
                            }}
                        />
                    </div>
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <div
                                key={opt}
                                onClick={() => toggleOption(opt)}
                                style={{
                                    padding: '8px 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start', /* Explicit left align */
                                    textAlign: 'left',            /* Explicit left align text */
                                    cursor: 'pointer',
                                    background: selected.includes(opt) ? 'rgba(29, 185, 84, 0.1)' : 'transparent',
                                    color: selected.includes(opt) ? 'var(--accent)' : 'var(--text-secondary)',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = selected.includes(opt) ? 'rgba(29, 185, 84, 0.2)' : 'rgba(255,255,255,0.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = selected.includes(opt) ? 'rgba(29, 185, 84, 0.1)' : 'transparent'}
                            >
                                <div style={{
                                    width: '16px', height: '16px', borderRadius: '4px',
                                    border: '1px solid ' + (selected.includes(opt) ? 'var(--accent)' : 'rgba(255,255,255,0.3)'),
                                    background: selected.includes(opt) ? 'var(--accent)' : 'transparent',
                                    marginRight: '10px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {selected.includes(opt) && <span style={{ color: 'black', fontSize: '10px' }}>✓</span>}
                                </div>
                                <span style={{
                                    fontSize: '0.9rem',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    flex: 1
                                }}>{opt}</span>
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '12px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>No results</div>
                    )}
                </div>
            )}
        </div>
    )
};

// Helper: Detect Arabic Characters and Return Reason
const getArabicMatchReason = (text, type = 'Text') => {
    if (!text) return null;
    // 1. Arabic Unicode Range: \u0600-\u06FF
    if (/[\u0600-\u06FF]/.test(text)) return `Arabic Script in ${type}`;

    // 2. Enhanced Keyword Matching
    const keywords = [
        "Habibi", "Arabic", "Arab", "Middle East", "MENA", "Orient", "Shaabi", "Tarab",
        "Dabke", "Mahraganat", "Mawal", "Khaleeji", "Andalusian", "Baladi", "Mizmar",
        "Khaliji", "Maghreb", "Layali", "Gharam", "Ashqan", "Hob", "Albi", "Ahlan", "Ya Leil",
        "Omri", "Bint", "Rouh", "Samra", "Sahar", "Ahwak", "Enta", "Shams", "Zaman"
    ];
    // Use word boundaries for list matches to avoid false positives (e.g. "sary" in "Anniversary")
    const matchedKeyword = keywords.find(k => {
        const pattern = new RegExp(`\\b${k}\\b`, 'i');
        return pattern.test(text);
    });
    if (matchedKeyword) return `Keyword: ${matchedKeyword} (${type})`;

    // 3. Known Artists List (Broad Match - OK for unique names)
    // removed "ruby" from here to avoid "Ruby" (English band) or album/title false positives
    const knownArtists = [
        "cairokee", "sharmoofers", "ahmed", "saad", "mohammed", "saeed", "wegz", "zap", "tharwat", "perrie",
        "angham", "marwan", "pablo", "kamel", "shahyn", "mozmin", "laboudi", "sary", "hany", "telecom",
        "egypt", "mekky", "dina", "wedidi", "muslim", "zena", "emad", "chemix", "dartro", "mahmoud",
        "esseily", "hamza", "namira", "ghaliaa", "samer", "doumet", "eljoee", "chaama", "racha", "rizk",
        "ghizlane", "melih", "lubany", "amr diab", "mohamed mounir", "tamer hosny", "sherine", "hamo bika",
        "abdel halim hafez", "umm kulthum", "hakim", "ramadan", "hamaki", "mahragan", "sandy", "mostafa amar",
        "hisham abbas", "ehab tawfik", "fairuz", "elissa", "nancy ajram", "haifa wehbe", "wael kfoury", "fares karam",
        "carole samaha", "majida el roumi", "ragheb alama", "melhem zein", "myriam fares", "joseph attieh",
        "assi el hallani", "julia boutros", "ziad rahbani", "marwan khoury", "saber rebai", "assala nasri",
        "george wassouf", "samira tawfik", "omar souleyman", "faia younan", "balqees", "ibrahim tatlises",
        "sahar taha", "lena chamamyan", "fayrouz karawya", "kazem al saher", "saif nabeel", "hatem al iraqi",
        "rahma riad", "majid al mohandis", "ali jassim", "mohammed al salim", "aseel hameem", "hossam al rassam",
        "cheb khaled", "cheb mami", "cheb hasni", "zina daoudia", "saad lamjarred", "douzi", "fnaire", "balti",
        "l'artiste", "soolking", "hamid bouchnak", "reda taliani", "faudel", "samira said", "latifa", "amina",
        "abdul majeed abdullah", "ahlam", "rashed al majed", "hussain al jassmi", "talal maddah", "nawal el kuwaitia",
        "dalia mubarak", "shamma hamdan", "ayed", "omar al-abdallat", "diana karazon", "zade dirani", "mohamed wardi",
        "abdel karim al kabli", "sharhabil ahmed", "legecy", "ma3iz"
    ];

    const matchedArtist = knownArtists.find(artist => {
        const pattern = new RegExp(`\\b${artist}\\b`, 'i');
        return pattern.test(text);
    });
    if (matchedArtist) return `Artist Match: ${matchedArtist} (in ${type})`;

    return null;
};

// Strict Artists: Only match if EXACLTY this name appears in the ARTISTS list.
// Does not match titles or albums, and does not match as a substring.
const strictArabicArtists = ["ruby", "sandy", "dina", "muslim", "nour"];

const DeepAnalysis = ({ tracks, playlist, token, onBack, initialTab = 'duplicates', isLoading = false, currentUserId }) => {
    // ... (existing state) ...


    const [analysisScope, setAnalysisScope] = useState('playlist'); // 'playlist' | 'overall'
    const [activeTab, setActiveTab] = useState(initialTab); // 'duplicates' | 'filter'
    const [matchDuration, setMatchDuration] = useState(false); // New state for duration check

    const canEdit = (p) => {
        if (!p) return false;
        if (p.id === 'LIKED_SONGS') return true;
        if (p.collaborative) return true;
        if (p.owner?.display_name === 'You') return true; // Fallback for some dummy objects
        return p.owner?.id === currentUserId;
    };

    const handleRemove = async (urisToRemove) => {
        if (urisToRemove.size === 0) return;

        const count = urisToRemove.size;
        if (!window.confirm(`Are you sure you want to remove ${count} tracks? This cannot be undone.`)) {
            return;
        }

        setIsProcessing(true);
        setStatusMessage(`Analyzing permissions...`);

        try {
            // Group tracks by playlist
            const tracksByPlaylist = {};
            const skippedPlaylists = new Set();
            let editableCount = 0;

            // Search source lists based on active tab
            const searchList = activeTab === 'filter'
                ? filteredTracks
                : duplicates.flat();

            searchList.forEach(item => {
                if (urisToRemove.has(item.track.uri)) {
                    // Identification: For Combined, sourcePlaylist is on item. For Single, it's the main playlist prop.
                    const source = item.sourcePlaylist || playlist;

                    if (canEdit(source)) {
                        if (!tracksByPlaylist[source.id]) {
                            tracksByPlaylist[source.id] = {
                                source: source,
                                uris: new Set()
                            };
                        }
                        // Avoid duplicates in the removal set
                        if (!tracksByPlaylist[source.id].uris.has(item.track.uri)) {
                            tracksByPlaylist[source.id].uris.add(item.track.uri);
                            editableCount++;
                        }
                    } else {
                        skippedPlaylists.add(source.name);
                    }
                }
            });

            if (Object.keys(tracksByPlaylist).length === 0 && skippedPlaylists.size > 0) {
                alert(`Cannot remove tracks: You do not have permission to edit: ${Array.from(skippedPlaylists).join(', ')}`);
                setIsProcessing(false);
                return;
            }

            if (skippedPlaylists.size > 0) {
                const proceed = window.confirm(
                    `Some tracks cannot be removed because you don't own the playlists:\n` +
                    `${Array.from(skippedPlaylists).join(', ')}\n\n` +
                    `Proceed with removing the remaining ${editableCount} tracks?`
                );
                if (!proceed) {
                    setIsProcessing(false);
                    return;
                }
            }

            setStatusMessage(`Removing ${editableCount} tracks...`);

            // Execute Removals per Playlist
            const promises = Object.values(tracksByPlaylist).map(({ source, uris }) =>
                removeTracksFromPlaylist(token, source.id, Array.from(uris))
            );

            await Promise.all(promises);

            // Cleanup local state
            const removedUris = new Set();
            Object.values(tracksByPlaylist).forEach(g => g.uris.forEach(u => removedUris.add(u)));

            // Update UI State
            if (activeTab === 'duplicates') {
                setDuplicates(prev => {
                    return prev.map(group => group.filter(item => !removedUris.has(item.track.uri)))
                        .filter(group => group.length > 1);
                });
                setSelectedDuplicates(prev => {
                    const next = new Set(prev);
                    removedUris.forEach(u => next.delete(u));
                    return next;
                });
            } else {
                setFilteredTracks(prev => prev.filter(item => !removedUris.has(item.track.uri)));
                setSelectedFiltered(prev => {
                    const next = new Set(prev);
                    removedUris.forEach(u => next.delete(u));
                    return next;
                });
            }

            setStatusMessage('Done!');
            setTimeout(() => {
                setIsProcessing(false);
                // Optional: reload parent if needed, but local update is smoother
            }, 1000);

        } catch (err) {
            console.error('Removal failed', err);
            alert('Failed to remove some tracks: ' + (err.message || 'Unknown error'));
            setIsProcessing(false);
        }
    };

    // State for Duplicates
    const [duplicates, setDuplicates] = useState([]);
    const [selectedDuplicates, setSelectedDuplicates] = useState(new Set());

    // State for Advanced Filter
    const [filterCriteria, setFilterCriteria] = useState({
        primaryArtists: [],
        collabArtists: [],
        years: [],
        arabicOnly: false // New Arabic filter state
    });


    const [filterLogic, setFilterLogic] = useState('AND'); // 'AND' | 'OR'
    const [filteredTracks, setFilteredTracks] = useState([]);
    const [selectedFiltered, setSelectedFiltered] = useState(new Set());
    const [filterViewMode, setFilterViewMode] = useState('unified'); // 'unified' | 'per_playlist'

    // Processing State
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

    const isCombined = playlist.id === 'COMBINED_ANALYSIS';

    // --- Duplicate Logic ---
    useEffect(() => {
        if (tracks.length === 0) return;

        const findDuplicatesInList = (list) => {
            const groups = {};
            list.forEach(item => {
                if (!item.track) return;
                const t = item.track;

                // Skip episodes or items without necessary data
                if (!t.name || !t.artists) return;

                const primaryArtist = t.artists[0]?.name.toLowerCase() || 'unknown artist';
                const title = t.name.toLowerCase().replace(/\s+/g, ' ').trim();
                let key = `${title}|${primaryArtist}`;
                if (matchDuration) key += `|${t.duration_ms}`;

                if (!groups[key]) groups[key] = [];
                groups[key].push(item);
            });
            return Object.values(groups).filter(g => g.length > 1);
        };

        let allDupeGroups = [];

        if (isCombined && analysisScope === 'playlist') {
            // Per-Playlist Scoping
            const byPlaylist = tracks.reduce((acc, t) => {
                const pid = t.sourcePlaylist?.id || 'unknown';
                if (!acc[pid]) acc[pid] = [];
                acc[pid].push(t);
                return acc;
            }, {});

            Object.values(byPlaylist).forEach(list => {
                const found = findDuplicatesInList(list);
                allDupeGroups = [...allDupeGroups, ...found];
            });
        } else {
            // Overall / Single Playlist Scoping
            allDupeGroups = findDuplicatesInList(tracks);
        }

        // Sort groups by playlist name for better display if combined
        if (isCombined) {
            allDupeGroups.sort((a, b) => {
                const pa = a[0]?.sourcePlaylist?.name || '';
                const pb = b[0]?.sourcePlaylist?.name || '';
                return pa.localeCompare(pb);
            });
        }

        setDuplicates(allDupeGroups);
        setSelectedDuplicates(new Set());

    }, [tracks, matchDuration, analysisScope, isCombined]);

    const toggleDuplicateSelection = (uri) => {
        const next = new Set(selectedDuplicates);
        if (next.has(uri)) next.delete(uri);
        else next.add(uri);
        setSelectedDuplicates(next);
    };

    const selectAllDuplicates = () => {
        const allExtraUris = new Set();
        duplicates.forEach(group => {
            for (let i = 1; i < group.length; i++) {
                allExtraUris.add(group[i].track.uri);
            }
        });

        const isAllSelected = Array.from(allExtraUris).every(uri => selectedDuplicates.has(uri)) &&
            selectedDuplicates.size === allExtraUris.size;

        if (isAllSelected) {
            setSelectedDuplicates(new Set());
        } else {
            setSelectedDuplicates(allExtraUris);
        }
    };

    const allExtrasCount = duplicates.reduce((acc, group) => acc + (group.length - 1), 0);
    const isAllExtrasSelected = selectedDuplicates.size === allExtrasCount && allExtrasCount > 0;

    const duplicateUris = useMemo(() => {
        const uris = new Set();
        duplicates.forEach(group => {
            // All items in a duplicate group are considered duplicates of each other
            group.forEach(item => uris.add(item.track.uri));
        });
        return uris;
    }, [duplicates]);

    // --- Filter Logic ---
    const allArtists = useMemo(() => {
        const artists = new Set();
        tracks.forEach(item => {
            item.track?.artists?.forEach(a => artists.add(a.name));
        });
        return Array.from(artists).sort();
    }, [tracks]);

    const allYears = useMemo(() => {
        const years = new Set();
        tracks.forEach(item => {
            const y = item.track?.album?.release_date?.substring(0, 4);
            if (y) years.add(y);
        });
        return Array.from(years).sort().reverse();
    }, [tracks]);

    useEffect(() => {
        const hasPrimary = filterCriteria.primaryArtists.length > 0;
        const hasCollab = filterCriteria.collabArtists.length > 0;
        const hasYear = filterCriteria.years.length > 0;
        const hasArabic = filterCriteria.arabicOnly;
        const hasAnyFilter = hasPrimary || hasCollab || hasYear || hasArabic;

        if (!hasAnyFilter) {
            setFilteredTracks([]);
            return;
        }

        const res = [];
        tracks.forEach(item => {
            const t = item.track;
            if (!t || !t.artists) return;

            const reasons = [];
            // Individual Checks
            const matchedPrimaryStr = filterCriteria.primaryArtists.find(a => t.artists[0]?.name === a);
            const matchesPrimary = !hasPrimary || !!matchedPrimaryStr;
            if (matchedPrimaryStr) reasons.push(`Primary: ${matchedPrimaryStr}`);

            const matchedCollabStr = filterCriteria.collabArtists.find(target => t.artists.some(a => a.name === target));
            const matchesCollab = !hasCollab || !!matchedCollabStr;
            if (matchedCollabStr) reasons.push(`Collab: ${matchedCollabStr}`);

            const matchedYearStr = filterCriteria.years.find(y => t.album?.release_date?.startsWith(y));
            const matchesYear = !hasYear || !!matchedYearStr;
            if (matchedYearStr) reasons.push(`Year: ${matchedYearStr}`);

            // Arabic Filter Check
            let arabicReason = null;
            if (filterCriteria.arabicOnly) {
                // Check in priority order: Title, Artist, Album
                const titleMatch = getArabicMatchReason(t.name, 'Title');
                if (titleMatch) {
                    arabicReason = titleMatch;
                } else {
                    // Check artists
                    for (const artist of t.artists) {
                        // 1. Strict Match for common names
                        if (strictArabicArtists.includes(artist.name.toLowerCase())) {
                            arabicReason = `Known Artist: ${artist.name}`;
                            break;
                        }
                        // 2. Standard Fuzzy/Broad Match
                        const artistMatch = getArabicMatchReason(artist.name, 'Artist');
                        if (artistMatch) {
                            arabicReason = artistMatch;
                            break;
                        }
                    }
                    // Check album if still no match
                    if (!arabicReason) {
                        const albumMatch = getArabicMatchReason(t.album?.name, 'Album');
                        if (albumMatch) arabicReason = albumMatch;
                    }
                }
            }

            if (filterCriteria.arabicOnly && arabicReason) reasons.push(arabicReason);

            const isArabicMatch = !filterCriteria.arabicOnly || !!arabicReason;

            let isMatch = false;
            // AND/OR Logic applies to the multi-select filters
            if (filterLogic === 'AND') {
                isMatch = (!hasPrimary || matchesPrimary) && (!hasCollab || matchesCollab) && (!hasYear || matchesYear);
            } else {
                isMatch = (hasPrimary && matchesPrimary) || (hasCollab && matchesCollab) || (hasYear && matchesYear);
            }

            // Arabic filter is a strict AND condition on top of others
            // OR if no other filters are active, it acts as the primary filter
            const hasOtherFilters = hasPrimary || hasCollab || hasYear;

            if (filterCriteria.arabicOnly) {
                if (!isArabicMatch) {
                    isMatch = false;
                } else if (!hasOtherFilters) {
                    isMatch = true; // Match if just Arabic is on and it matches
                }
            } else if (!hasOtherFilters) {
                // No filters at all -> No match (default behavior)
                isMatch = false;
            }

            if (isMatch) {
                res.push({ ...item, matchReasons: reasons });
            }
        });
        setFilteredTracks(res);
        setSelectedFiltered(new Set());
    }, [filterCriteria, tracks, filterLogic]);

    const toggleFilteredSelection = (uri) => {
        const next = new Set(selectedFiltered);
        if (next.has(uri)) next.delete(uri);
        else next.add(uri);
        setSelectedFiltered(next);
    };

    const selectAllFiltered = () => {
        if (selectedFiltered.size === filteredTracks.length) {
            setSelectedFiltered(new Set());
        } else {
            const all = new Set(filteredTracks.map(t => t.track.uri));
            setSelectedFiltered(all);
        }
    };


    // --- Actions ---
    const handleRemove_OLD = async (urisToRemove) => {
        if (urisToRemove.size === 0) return;

        const count = urisToRemove.size;
        if (!window.confirm(`Are you sure you want to remove ${count} tracks? This cannot be undone.`)) {
            return;
        }

        setIsProcessing(true);
        setStatusMessage(`Removing ${count} tracks...`);

        try {
            if (isCombined) {
                // Determine source playlist for each URI
                // We need to find the track object for these URIs to know the source
                // Optimization: Map URIs to playlists using the `tracks` prop
                // Note: A URI might appear in multiple playlists. 
                // However, `urisToRemove` is a Set of URIs. 
                // If the same song is in Playlist A and Playlist B (and we are in 'Overall' mode), they might have same URI?
                // Wait. Spotify URIs are unique per track content.
                // If "Overall" dupes found the same Track URI in Playlist A and Playlist B.
                // Which one did we select to remove?
                // The `duplicates` view renders specific `item` instances.
                // But `selectedDuplicates` currently stores just URI strings.
                // ISSUE: If same URI exists in multiple playlists, deleting by URI is ambiguous if we don't know the target playlist.
                // Should `selectedDuplicates` store `${uri}::${playlistId}`?
                // OR `handleRemove` should scan all `tracks` to find which playlist(s) contain these URIs and try to remove?
                // If I select to remove a specific instance shown in the UI, I expect THAT instance to go.
                // If I am in 'Per Playlist' mode, no ambiguity really.
                // If I am in 'Overall' mode, and I see 2 copies: one in A, one in B.
                // If I select the one in B, I want B's copy gone.
                // CURRENT IMPLEMENTATION: `toggleDuplicateSelection(item.track.uri)` stores the URI.
                // This loses context of which playlist it came from if the URI is identical.
                // Solution: Use `item.generatedId` or store `{uri, playlistId}` strings?
                // Let's store composite keys: `${uri}::${sourcePlaylist.id}`.

                // CRITICAL: We need to update toggleDuplicateSelection and selection Set to use composite keys.
                // I will do this in a separate step or right here?
                // Actually, let's keep it simple for now and iterate `duplicates` (the groups) to match selected URIs? 
                // No, duplicates is derived state.

                // Let's assume for now we scan `duplicates` state to find the source playlist for selected items?
                // No, `duplicates` groups contain the `item`.
                // Let's Update `toggleDuplicateSelection` to accept the whole item or composite key.
                // But `selectedDuplicates` is passed to handleRemove.

                // Let's proceed with finding standard handling for single playlist first.
                // For combined, I'll fallback to: Find ALL instances of this URI in the current `tracks` list,
                // and if I selected it... wait.
                // If I have identical URIs in A and B. I check "Remove" on the B copy.
                // `selectedDuplicates` has `spotify:track:123`.
                // `handleRemove` sees `spotify:track:123`. 
                // It searches `tracks`. Finds it in A and B.
                // Don't know which one to remove.

                // Fix: Change `toggleDuplicateSelection` to use Composite Keys if combined.
                // But `DeepAnalysis` prop `tracks` items have `sourcePlaylist`.

                // Let's defer complexity: standard removal is by URI.
                // If I remove a URI from "Combined", I probably want to remove it from ALL playlists it's in?
                // Or just the one I clicked?
                // User expects "Cleaner" to be precise.

                // I will update toggle loop below to use composite key if combined.
                // Let's just update `handleRemove` to be smart first, assuming simple URI for now 
                // (risky but matches existing single-playlist logic).
                // Actually, standard `removeTracksFromPlaylist` API takes URIs. 
                // If I call it on Playlist A with URI X, it removes it from A.
                // So I just need to bucket URIs by Playlist.

                // But if I only selected the copy in B, but not A.
                // My `selectedDuplicates` set only has the URI.
                // So I can't distinguish.
                // I MUST CHANGE SELECTION STATE KEY. 
                // I'll leave `selectedDuplicates` as URIs for now to avoid breaking view logic heavily in one go,
                // BUT I will try to infer playlist from the `duplicates` groups that are visible.
                // IF we are in 'Per Playlist' scope, duplicates don't cross playlists. 
                // So a group belongs to ONE playlist.
                // So if I find the group containing this URI, I know the playlist.

                // IF we are in 'Overall' scope, a group has mixed playlists.
                // If I selected a URI, and duplicates are confirmed (same URI),
                // do I mean "remove this song from everywhere"?
                // Usually yes, if it's a "duplicate", I want to keep one and delete the rest.
                // So deleting the URI from the playlist it resides in is correct.
                // If it's in A and B, and I select B's copy... 
                // `handleRemove` must know to delete from B.

                // OK, I will Refactor `handleRemove` to scan `duplicates` (the visible state) 
                // to find identifying info for `selectedDuplicates` URIs.

                // Iterate `duplicates` groups. For each item:
                // If `selectedDuplicates.has(item.track.uri)`:
                //    Add to bucket `playlists[item.sourcePlaylist.id]`.

                const uriToPlaylists = {};

                duplicates.forEach(group => {
                    group.forEach(item => {
                        if (selectedDuplicates.has(item.track.uri)) {
                            const pid = item.sourcePlaylist?.id || playlist.id;
                            if (!uriToPlaylists[pid]) uriToPlaylists[pid] = new Set();
                            uriToPlaylists[pid].add(item.track.uri);
                        }
                    });
                });

                const promises = Object.entries(uriToPlaylists).map(([pid, uris]) =>
                    removeTracksFromPlaylist(token, pid, Array.from(uris))
                );

                await Promise.all(promises);

            } else {
                // Single Playlist
                await removeTracksFromPlaylist(token, playlist.id, Array.from(urisToRemove));
            }

            setStatusMessage('Done! Reloading...');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            console.error(err);
            setStatusMessage('Error removing tracks.');
            setIsProcessing(false);
            alert("Failed to remove tracks. See console.");
        }
    };

    const handleCreatePlaylist = async (urisToUse) => {
        if (urisToUse.size === 0) return;
        const name = prompt(`Enter a name for your new playlist (${urisToUse.size} tracks):`);
        if (!name) return;

        setIsProcessing(true);
        setStatusMessage('Creating playlist...');

        try {
            const description = `Autogenerated by Spotify Toolkit. Contains ${urisToUse.size} tracks from analysis.`;
            const newPlaylist = await createPlaylist(token, currentUserId, name, description, false); // Private by default

            setStatusMessage(`Adding ${urisToUse.size} tracks...`);
            await addTracksToPlaylist(token, newPlaylist.id, Array.from(urisToUse));

            setStatusMessage('Done! Playlist Created.');
            setTimeout(() => {
                setIsProcessing(false);
                setStatusMessage('');
            }, 2000);
        } catch (err) {
            console.error('Playlist creation failed', err);
            alert('Failed to create playlist: ' + (err.message || 'Unknown error'));
            setIsProcessing(false);
        }
    };

    const handleExportExcel = (tracksToExport, fileName = "Spotify_Export.xlsx") => {
        if (!tracksToExport || tracksToExport.length === 0) return;

        const data = tracksToExport.map(item => {
            const t = item.track || item; // Handle both wrapper objects and raw tracks
            return {
                "Track Name": t.name,
                "Artist": t.artists?.map(a => a.name).join(', ') || 'Unknown',
                "Album": t.album?.name || 'Unknown',
                "Duration (m)": t.duration_ms ? (t.duration_ms / 60000).toFixed(2) : '',
                "Release Date": t.album?.release_date || '',
                "URI": t.uri,
                "Match Reason": item.matchReasons?.join(', ') || ''
            };
        });

        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Tracks");
        writeFile(wb, fileName);
    };

    // Shared columns
    const columns = { index: true, art: true, title: true, album: true, duration: true };


    return (
        <div className="analysis-container" style={{ padding: '2rem', animation: 'fadeIn 0.3s ease-out', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            {/* Header */}
            <div className="analysis-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
                <button onClick={onBack} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer', marginRight: '1rem' }}>←</button>
                <div style={{ flex: 1 }}>
                    <h2 className="title-gradient" style={{ margin: 0 }}>Deep Analysis</h2>
                    <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manager & Cleaner Tool</p>
                </div>

                {/* Scope Toggle for Combined Analysis */}
                {isCombined && activeTab === 'duplicates' && (
                    <div style={{
                        display: 'flex', alignItems: 'center',
                        background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px', marginRight: '1rem'
                    }}>
                        <button
                            onClick={() => setAnalysisScope('playlist')}
                            style={{
                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                background: analysisScope === 'playlist' ? 'var(--accent)' : 'transparent',
                                color: analysisScope === 'playlist' ? '#000' : 'var(--text-secondary)',
                                fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer'
                            }}
                        >
                            Per Playlist
                        </button>
                        <button
                            onClick={() => setAnalysisScope('overall')}
                            style={{
                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                background: analysisScope === 'overall' ? 'var(--accent)' : 'transparent',
                                color: analysisScope === 'overall' ? '#000' : 'var(--text-secondary)',
                                fontWeight: 500, fontSize: '0.85rem', cursor: 'pointer'
                            }}
                        >
                            Overall
                        </button>
                    </div>
                )}

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '8px',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '4px',
                    borderRadius: '12px',
                    marginLeft: '1rem'
                }}>
                    <button
                        onClick={() => setActiveTab('duplicates')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: activeTab === 'duplicates' ? 'var(--accent)' : 'transparent',
                            color: activeTab === 'duplicates' ? '#000' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Duplicates
                    </button>
                    <button
                        onClick={() => setActiveTab('advanced_filter')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: 'none',
                            background: activeTab === 'advanced_filter' ? 'var(--accent)' : 'transparent',
                            color: activeTab === 'advanced_filter' ? '#000' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Advanced Filter
                    </button>
                </div>
            </div>

            {isProcessing && (
                <div className="status-box success" style={{ marginBottom: '1rem', textAlign: 'center' }}>
                    {statusMessage}
                </div>
            )}

            {activeTab === 'duplicates' && (
                <div className="max-w-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>
                                {analysisScope === 'playlist' && isCombined ? 'Per-Playlist Duplicates' : 'Duplicate Groups'}
                            </h3>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Found {duplicates.length} groups of potential duplicates
                            </span>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                marginTop: '0.5rem',
                                fontSize: '0.9rem',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={matchDuration}
                                    onChange={(e) => setMatchDuration(e.target.checked)}
                                    style={{ marginRight: '8px', accentColor: 'var(--accent)' }}
                                />
                                Match Duration (Exact play time)
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                className="spotify-btn action-btn-outline"
                                onClick={() => handleExportExcel(duplicates.flat(), 'Duplicates_Export.xlsx')}
                                disabled={duplicates.length === 0}
                                style={{ borderColor: '#2e7d32', color: '#2e7d32' }}
                            >
                                📥 Export
                            </button>
                            <button
                                className="spotify-btn action-btn-outline"
                                onClick={() => handleCreatePlaylist(selectedDuplicates)}
                                disabled={selectedDuplicates.size === 0 || isProcessing}
                                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                            >
                                + New Playlist
                            </button>
                            <button className="spotify-btn action-btn-outline" onClick={selectAllDuplicates} disabled={duplicates.length === 0}>
                                {isAllExtrasSelected ? 'Deselect All' : 'Select All'}
                            </button>
                            <button
                                className="spotify-btn"
                                style={{ background: '#ff5555' }}
                                onClick={() => handleRemove(selectedDuplicates)}
                                disabled={selectedDuplicates.size === 0 || isProcessing}
                            >
                                Remove Selected ({selectedDuplicates.size})
                            </button>
                        </div>
                    </div>

                    {duplicates.length === 0 ? (
                        (isLoading || (playlist.tracks?.total && tracks.length < playlist.tracks.total)) ? (
                            <div className="glass-card flex-center" style={{ padding: '4rem', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                                <div className="spinner-small" style={{ width: '40px', height: '40px', marginBottom: '1rem' }}></div>
                                <p>Analyzing playlist...</p>
                                <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
                                    Scanned {tracks.length} of {playlist.tracks?.total || '?'} tracks
                                </p>
                            </div>
                        ) : (
                            <div className="glass-card flex-center" style={{ padding: '4rem', flexDirection: 'column', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
                                <p>Your playlist is clean! No exact name+artist duplicates found.</p>
                            </div>
                        )
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {duplicates.map((group, i) => {
                                // Add header for grouping if in Playlist scope and it's the first group of that playlist
                                // Simpler: Just show playlist name in the group header always if combined
                                const groupPlaylistName = group[0].sourcePlaylist?.name;
                                return (
                                    <div key={i} className="glass-card" style={{ padding: 0, overflow: 'hidden', width: '100%', maxWidth: '800px', alignItems: 'stretch' }}>
                                        <div style={{
                                            padding: '1rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600, marginRight: '1rem' }}>{group[0].track.name}</span>
                                                {isCombined && (
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '2px' }}>
                                                        {analysisScope === 'overall' ? 'Found across playlists' : groupPlaylistName}
                                                    </span>
                                                )}
                                            </div>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{group.length} copies</span>
                                        </div>
                                        <div>
                                            {group.map((item, idx) => {
                                                const isSelected = selectedDuplicates.has(item.track.uri);
                                                return (
                                                    <div key={item.track.uri + idx}
                                                        onClick={() => toggleDuplicateSelection(item.track.uri)}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', padding: '1rem',
                                                            borderBottom: idx < group.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                                            background: isSelected ? 'rgba(255, 85, 85, 0.15)' : 'transparent',
                                                            cursor: 'pointer',
                                                            transition: 'background 0.2s',
                                                            width: '100%',
                                                            boxSizing: 'border-box'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '20px', height: '20px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.3)',
                                                            background: isSelected ? '#ff5555' : 'transparent', marginRight: '1rem',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                        }}>
                                                            {isSelected && <span style={{ color: 'white', fontSize: '12px' }}>✓</span>}
                                                        </div>

                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                            {item.track.album?.images?.[2]?.url ? (
                                                                <img src={item.track.album.images[2].url} style={{ width: '40px', height: '40px', borderRadius: '4px' }} alt="" />
                                                            ) : (
                                                                <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <span style={{ fontSize: '10px' }}>🎵</span>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <div style={{ fontSize: '0.95rem' }}>{item.track.name}</div>
                                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                                    {item.track.artists?.map(a => a.name).join(', ') || 'Unknown Artist'} • {item.track.album?.name || 'Unknown Album'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
                                                            {item.track.duration_ms ? (item.track.duration_ms / 60000).toFixed(2) + 'm' : ''}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'advanced_filter' && (
                <div style={{ width: '95%', maxWidth: 'none', margin: '0 auto', display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>

                    {/* Left Column: Filters */}
                    <div className="glass-card" style={{ padding: '1.5rem', width: '300px', flexShrink: 0, position: 'sticky', top: '20px' }}>
                        <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.1rem' }}>Filter Options</h3>

                        {/* Quick Filters */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Quick Filters
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {[
                                    { label: 'Recent Bangers', years: ['2023', '2024', '2025', '2026'] },
                                    { label: '2020s Era', years: ['2020', '2021', '2022', '2023', '2024', '2025', '2026'] },
                                    { label: 'Standard 2010s', years: Array.from({ length: 10 }, (_, i) => String(2010 + i)) },
                                    { label: '90s Throwback', years: Array.from({ length: 10 }, (_, i) => String(1990 + i)) },
                                ].map((preset) => {
                                    // Check if active
                                    const isActive = preset.years.length === filterCriteria.years.length &&
                                        preset.years.every(y => filterCriteria.years.includes(y));

                                    return (
                                        <button
                                            key={preset.label}
                                            onClick={() => {
                                                const newYears = isActive ? [] : preset.years.filter(y => allYears.includes(y));
                                                setFilterCriteria(prev => ({
                                                    ...prev,
                                                    years: newYears
                                                }));
                                            }}
                                            style={{
                                                background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                                                color: isActive ? 'black' : 'var(--text-secondary)',
                                                border: isActive ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '4px',
                                                padding: '6px 10px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                transition: 'all 0.2s',
                                                fontWeight: isActive ? 600 : 400
                                            }}
                                        >
                                            {preset.label}
                                        </button>
                                    );
                                })}
                                {/* Arabic Toggle */}
                                <button
                                    onClick={() => setFilterCriteria(prev => ({ ...prev, arabicOnly: !prev.arabicOnly }))}
                                    style={{
                                        gridColumn: '1 / -1',
                                        background: filterCriteria.arabicOnly ? '#1db954' : 'rgba(255,255,255,0.05)',
                                        color: filterCriteria.arabicOnly ? 'black' : 'var(--text-secondary)',
                                        border: filterCriteria.arabicOnly ? '1px solid #1db954' : '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        padding: '8px',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        fontWeight: filterCriteria.arabicOnly ? 600 : 400
                                    }}
                                >
                                    <span>🌙</span> Arabic Songs Only
                                </button>

                                <button
                                    onClick={() => setFilterCriteria({ primaryArtists: [], collabArtists: [], years: [], arabicOnly: false })}
                                    style={{
                                        gridColumn: '1 / -1',
                                        background: 'transparent',
                                        color: '#ff5555',
                                        border: '1px dashed rgba(255, 85, 85, 0.3)',
                                        borderRadius: '4px',
                                        padding: '6px 10px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        marginTop: '4px'
                                    }}
                                >
                                    Clear Config
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            <MultiSelect
                                label="Primary Artists"
                                options={allArtists}
                                selected={filterCriteria.primaryArtists}
                                onChange={(val) => setFilterCriteria({ ...filterCriteria, primaryArtists: val })}
                                placeholder="Any Artist"
                            />
                            <MultiSelect
                                label="Collaborators"
                                options={allArtists}
                                selected={filterCriteria.collabArtists}
                                onChange={(val) => setFilterCriteria({ ...filterCriteria, collabArtists: val })}
                                placeholder="Any Artist"
                            />
                            <MultiSelect
                                label="Release Years"
                                options={allYears}
                                selected={filterCriteria.years}
                                onChange={(val) => setFilterCriteria({ ...filterCriteria, years: val })}
                                placeholder="Any Year"
                            />
                        </div>

                        {/* Logic Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: 'auto' }}>Match Mode:</span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                    onClick={() => setFilterLogic('AND')}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid ' + (filterLogic === 'AND' ? 'var(--accent)' : 'rgba(255,255,255,0.1)'),
                                        background: filterLogic === 'AND' ? 'var(--accent)' : 'transparent',
                                        color: filterLogic === 'AND' ? 'black' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        fontWeight: 600
                                    }}
                                >
                                    ALL
                                </button>
                                <button
                                    onClick={() => setFilterLogic('OR')}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid ' + (filterLogic === 'OR' ? 'var(--accent)' : 'rgba(255,255,255,0.1)'),
                                        background: filterLogic === 'OR' ? 'var(--accent)' : 'transparent',
                                        color: filterLogic === 'OR' ? 'black' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '0.75rem',
                                        fontWeight: 600
                                    }}
                                >
                                    ANY
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Results */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Results ({filteredTracks.length})</h3>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    className="spotify-btn action-btn-outline"
                                    onClick={() => handleExportExcel(filteredTracks, 'Filtered_Export.xlsx')}
                                    disabled={filteredTracks.length === 0}
                                    style={{ borderColor: '#2e7d32', color: '#2e7d32', padding: '8px 16px', fontSize: '0.9rem' }}
                                >
                                    📥 Export
                                </button>
                                <button
                                    className="spotify-btn action-btn-outline"
                                    onClick={() => handleCreatePlaylist(selectedFiltered)}
                                    disabled={selectedFiltered.size === 0 || isProcessing}
                                    style={{ borderColor: 'var(--accent)', color: 'var(--accent)', padding: '8px 16px', fontSize: '0.9rem' }}
                                >
                                    + New Playlist
                                </button>
                                <button
                                    className="spotify-btn action-btn-outline"
                                    onClick={selectAllFiltered}
                                    disabled={filteredTracks.length === 0}
                                    style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                                >
                                    {selectedFiltered.size === filteredTracks.length && filteredTracks.length > 0 ? 'Deselect All' : 'Select All'}
                                </button>
                                <button
                                    className="spotify-btn"
                                    style={{ background: '#ff5555', padding: '8px 16px', fontSize: '0.9rem' }}
                                    onClick={() => handleRemove(selectedFiltered)}
                                    disabled={selectedFiltered.size === 0 || isProcessing}
                                >
                                    Remove Selected ({selectedFiltered.size})
                                </button>
                            </div>
                        </div>

                        {/* View Mode Toggle (Combined Analysis Only) */}
                        {isCombined && (
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                                <button
                                    onClick={() => setFilterViewMode('unified')}
                                    style={{
                                        background: filterViewMode === 'unified' ? 'var(--accent)' : 'transparent',
                                        color: filterViewMode === 'unified' ? 'black' : 'var(--text-secondary)',
                                        border: '1px solid ' + (filterViewMode === 'unified' ? 'var(--accent)' : 'rgba(255,255,255,0.2)'),
                                        padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem'
                                    }}
                                >
                                    Unified View (Show Once)
                                </button>
                                <button
                                    onClick={() => setFilterViewMode('per_playlist')}
                                    style={{
                                        background: filterViewMode === 'per_playlist' ? 'var(--accent)' : 'transparent',
                                        color: filterViewMode === 'per_playlist' ? 'black' : 'var(--text-secondary)',
                                        border: '1px solid ' + (filterViewMode === 'per_playlist' ? 'var(--accent)' : 'rgba(255,255,255,0.2)'),
                                        padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem'
                                    }}
                                >
                                    Filter per Playlist
                                </button>
                            </div>
                        )}

                        <div className="glass-card" style={{ padding: 0, width: '100%', maxWidth: '100%', alignItems: 'stretch' }}>
                            {(() => {
                                let tracksToRender = filteredTracks;
                                let groups = {};

                                if (isCombined && filterViewMode === 'unified') {
                                    const seen = new Set();
                                    tracksToRender = filteredTracks.filter(item => {
                                        if (seen.has(item.track.uri)) return false;
                                        seen.add(item.track.uri);
                                        return true;
                                    });
                                } else if (isCombined && filterViewMode === 'per_playlist') {
                                    filteredTracks.forEach(item => {
                                        const pid = item.sourcePlaylist?.id || 'unknown';
                                        if (!groups[pid]) groups[pid] = { name: item.sourcePlaylist?.name || 'Unknown', items: [] };
                                        groups[pid].items.push(item);
                                    });
                                }

                                const renderTrackList = (list) => list.map((item, idx) => {
                                    const isSelected = selectedFiltered.has(item.track.uri);
                                    return (
                                        <div key={item.track.uri + idx}
                                            onClick={() => toggleFilteredSelection(item.track.uri)}
                                            style={{
                                                display: 'flex', alignItems: 'center', padding: '0.8rem 1rem',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                background: isSelected ? 'rgba(255, 85, 85, 0.15)' : 'transparent',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s',
                                                justifyContent: 'flex-start', /* Explicit left align */
                                                textAlign: 'left'
                                            }}>
                                            <div style={{
                                                width: '18px', height: '18px', borderRadius: '50%', border: isSelected ? 'none' : '2px solid rgba(255,255,255,0.3)',
                                                background: isSelected ? '#ff5555' : 'transparent', marginRight: '1rem',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                            }}>
                                                {isSelected && <span style={{ color: 'white', fontSize: '10px' }}>✓</span>}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, overflow: 'hidden' }}>
                                                {item.track.album?.images?.[2]?.url ? (
                                                    <img src={item.track.album.images[2].url} style={{ width: '40px', height: '40px', borderRadius: '4px' }} alt="" />
                                                ) : (
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <span style={{ fontSize: '10px' }}>🎵</span>
                                                    </div>
                                                )}
                                                <div style={{ overflow: 'hidden', flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                        <div style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontSize: '0.95rem', fontWeight: 500 }}>{item.track.name}</div>

                                                        {/* Duplicate Badge */}
                                                        {duplicateUris.has(item.track.uri) && (
                                                            <span style={{
                                                                fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px',
                                                                background: 'rgba(255, 85, 85, 0.2)', color: '#ff5555', border: '1px solid rgba(255, 85, 85, 0.3)',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                Duplicate
                                                            </span>
                                                        )}

                                                        {/* Match Reasons Badges */}
                                                        {item.matchReasons?.map((reason, i) => (
                                                            <span key={i} style={{
                                                                fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px',
                                                                background: 'rgba(29, 185, 84, 0.15)', color: '#1db954', border: '1px solid rgba(29, 185, 84, 0.3)',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {reason}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.track.artists?.map(a => a.name).join(', ') || 'Unknown Artist'}</div>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
                                                {item.track.album?.release_date?.substring(0, 4)}
                                            </div>
                                        </div>
                                    )
                                });

                                if (isCombined && filterViewMode === 'per_playlist') {
                                    return Object.values(groups).map((group) => (
                                        <div key={group.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <div style={{
                                                padding: '1rem',
                                                background: 'rgba(255,255,255,0.05)',
                                                fontWeight: 'bold',
                                                color: 'var(--accent)',
                                                fontSize: '0.9rem',
                                                position: 'sticky', top: 0, zIndex: 1
                                            }}>
                                                {group.name} ({group.items.length})
                                            </div>
                                            {renderTrackList(group.items)}
                                        </div>
                                    ));
                                } else {
                                    return renderTrackList(tracksToRender);
                                }
                            })()}
                            {filteredTracks.length === 0 && (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    Use the filters on the left to find tracks.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeepAnalysis;
