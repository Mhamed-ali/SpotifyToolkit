/**
 * Registry Pattern for Analysis Modules (Open/Closed Principle).
 * Single source of truth for AnalysisModal cards and PlaylistDetailsPage tab bar.
 */

export const ANALYSIS_MODULES = [
    {
        id: 'vibe',
        icon: '🌊',
        title: 'Vibe Check',
        tabLabel: 'Vibe Check',
        desc: 'Mood, Energy, and Danceability',
        subOptions: [
            { id: 'mood', label: 'Mood' },
            { id: 'energy', label: 'Energy' },
            { id: 'dance', label: 'Danceability' }
        ]
    },
    {
        id: 'timeline',
        icon: '⏳',
        title: 'Timeline',
        tabLabel: 'Timeline',
        desc: 'Era breakdown and years',
        subOptions: []
    },
    {
        id: 'artists',
        icon: '🎤',
        title: 'Artist Breakdown',
        tabLabel: 'Artist Breakdown',
        desc: 'Top artists and collaborations',
        subOptions: [
            { id: 'collabs', label: 'Collabs' }
        ]
    },
    {
        id: 'cleaner',
        icon: '🧹',
        title: 'Deep Analysis',
        tabLabel: 'Deep Analysis',
        desc: 'Deduplicate & Filter (incl. Arabic)',
        subOptions: [
            { id: 'duplicates', label: 'Duplicates' },
            { id: 'advanced_filter', label: 'Advanced Filter' }
        ]
    },
    {
        id: 'stats',
        icon: '📈',
        title: 'Playlist Stats',
        tabLabel: 'Playlist Stats',
        desc: 'Length, scores, and more',
        subOptions: [
            { id: 'duration', label: 'Duration' },
            { id: 'explicit', label: 'Explicit %' },
            { id: 'popularity', label: 'Popularity' }
        ]
    }
];

export const ANALYSIS_MODULE_MAP = ANALYSIS_MODULES.reduce((acc, mod) => {
    acc[mod.id] = mod;
    return acc;
}, {});

/**
 * Registry Pattern for Toolkit v2.0 1-Click Workflows (5-Card Obsidian Dock).
 */
export const WORKFLOW_MODULES = [
    {
        id: 'arabic-playlist',
        icon: '🌙',
        title: 'Arabic Extractor',
        desc: '3-Pass Script, Franco-Arab, Curated Artist & Spotify Genre Detection'
    },
    {
        id: 'duplicates',
        icon: '🧹',
        title: 'Clean Duplicates',
        desc: 'Playable-First Strict & Fuzzy (±0-5s) Duplicate Clustering'
    },
    {
        id: 'compare',
        icon: '🔀',
        title: 'Compare & Sync',
        desc: 'Diff A−B, Shared A∩B & Union A∪B Across Playlists'
    },
    {
        id: 'top50',
        icon: '🏆',
        title: 'Top 50 & History',
        desc: 'Live Spotify 4-Week, 6-Month, All-Time Top 50 & Recently Played'
    },
    {
        id: 'insights',
        icon: '📊',
        title: 'Insights & Splitter',
        desc: 'Smart Genre Family Splitter, Top Artists, Decades & Dead Track Replacer'
    }
];

export const WORKFLOW_MODULE_MAP = WORKFLOW_MODULES.reduce((acc, mod) => {
    acc[mod.id] = mod;
    return acc;
}, {});
