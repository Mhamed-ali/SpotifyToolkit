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
