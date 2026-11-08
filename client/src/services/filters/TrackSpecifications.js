import { ArabicDetector } from './ArabicDetector.js';

/**
 * Specification Pattern for Track Filtering (Open/Closed Principle).
 * Each criterion is encapsulated in its own Specification class with an `evaluate(track)` method
 * returning `{ isActive, matches, reason }`. New filters can be added without modifying the engine.
 */

export class PrimaryArtistSpecification {
    constructor(selectedArtists = []) {
        this.selectedArtists = selectedArtists;
    }

    get isActive() {
        return this.selectedArtists.length > 0;
    }

    evaluate(trackItem) {
        if (!this.isActive) return { isActive: false, matches: true, reason: null };
        const primaryName = trackItem?.track?.artists?.[0]?.name;
        const matched = this.selectedArtists.find(a => a === primaryName);
        return {
            isActive: true,
            matches: Boolean(matched),
            reason: matched ? `Primary: ${matched}` : null
        };
    }
}

export class CollaboratorSpecification {
    constructor(selectedArtists = []) {
        this.selectedArtists = selectedArtists;
    }

    get isActive() {
        return this.selectedArtists.length > 0;
    }

    evaluate(trackItem) {
        if (!this.isActive) return { isActive: false, matches: true, reason: null };
        const artists = trackItem?.track?.artists || [];
        const matched = this.selectedArtists.find(target =>
            artists.some(a => a.name === target)
        );
        return {
            isActive: true,
            matches: Boolean(matched),
            reason: matched ? `Collab: ${matched}` : null
        };
    }
}

export class ReleaseYearSpecification {
    constructor(selectedYears = []) {
        this.selectedYears = selectedYears;
    }

    get isActive() {
        return this.selectedYears.length > 0;
    }

    evaluate(trackItem) {
        if (!this.isActive) return { isActive: false, matches: true, reason: null };
        const releaseDate = trackItem?.track?.album?.release_date || '';
        const matched = this.selectedYears.find(y => releaseDate.startsWith(y));
        return {
            isActive: true,
            matches: Boolean(matched),
            reason: matched ? `Year: ${matched}` : null
        };
    }
}

export class ArabicTrackSpecification {
    constructor(enabled = false) {
        this.enabled = Boolean(enabled);
    }

    get isActive() {
        return this.enabled;
    }

    evaluate(trackItem) {
        if (!this.isActive) return { isActive: false, matches: true, reason: null };
        const reason = ArabicDetector.detectTrack(trackItem);
        return {
            isActive: true,
            matches: Boolean(reason),
            reason
        };
    }
}

export class TrackFilterEngine {
    static filterTracks(tracks = [], filterCriteria = {}, filterLogic = 'AND') {
        const standardSpecs = [
            new PrimaryArtistSpecification(filterCriteria.primaryArtists),
            new CollaboratorSpecification(filterCriteria.collabArtists),
            new ReleaseYearSpecification(filterCriteria.years)
        ];
        const arabicSpec = new ArabicTrackSpecification(filterCriteria.arabicOnly);

        const activeStandardSpecs = standardSpecs.filter(s => s.isActive);
        const hasAnyFilter = activeStandardSpecs.length > 0 || arabicSpec.isActive;

        if (!hasAnyFilter) return [];

        const results = [];

        tracks.forEach(item => {
            const t = item?.track;
            if (!t || !t.artists) return;

            const evaluations = standardSpecs.map(spec => spec.evaluate(item));
            const arabicEvaluation = arabicSpec.evaluate(item);

            const reasons = evaluations
                .filter(e => e.isActive && e.matches && e.reason)
                .map(e => e.reason);

            if (arabicEvaluation.isActive && arabicEvaluation.matches && arabicEvaluation.reason) {
                reasons.push(arabicEvaluation.reason);
            }

            let isStandardMatch = true;
            if (activeStandardSpecs.length > 0) {
                if (filterLogic === 'AND') {
                    isStandardMatch = evaluations.every(e => !e.isActive || e.matches);
                } else {
                    isStandardMatch = evaluations.some(e => e.isActive && e.matches);
                }
            }

            let isFinalMatch = isStandardMatch;
            if (arabicSpec.isActive) {
                isFinalMatch = activeStandardSpecs.length > 0
                    ? (isStandardMatch && arabicEvaluation.matches)
                    : arabicEvaluation.matches;
            }

            if (isFinalMatch) {
                results.push({ ...item, matchReasons: reasons });
            }
        });

        return results;
    }
}
