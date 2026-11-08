/**
 * Shared formatting utilities (Single Source of Truth - DRY)
 */

export const formatDuration = (ms) => {
    if (!ms || typeof ms !== 'number' || ms < 0) return '0:00';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export const formatDurationMinutes = (ms) => {
    if (!ms || typeof ms !== 'number') return '';
    return `${(ms / 60000).toFixed(2)}m`;
};

export const formatDate = (dateString) => {
    if (!dateString) return '-';
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString();
};

export const extractReleaseYear = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return '';
    return dateString.substring(0, 4);
};
