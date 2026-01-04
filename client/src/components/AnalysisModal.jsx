import React, { useState } from 'react';
import '../App.css';

const AnalysisModal = ({ isOpen, onClose, onRun }) => {
    // State: { [cardId]: [subOptionId1, subOptionId2] }
    // If a key exists, the card is selected. The value is the list of active sub-options.
    const [selections, setSelections] = useState({});

    if (!isOpen) return null;

    const options = [
        {
            id: 'vibe',
            icon: '🌊',
            title: 'Vibe Check',
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
            desc: 'Era breakdown and years',
            subOptions: []
        },
        {
            id: 'artists',
            icon: '🎤',
            title: 'Artist Breakdown',
            desc: 'Top artists and collaborations',
            subOptions: [
                { id: 'collabs', label: 'Collabs' }
            ]
        },
        {
            id: 'cleaner',
            icon: '🧹',
            title: 'Deep Analysis',
            desc: 'Deduplicate & Filter',
            subOptions: [
                { id: 'duplicates', label: 'Duplicates' },
                { id: 'advanced_filter', label: 'Advanced Filter' }
            ]
        },
        {
            id: 'stats',
            icon: '📈',
            title: 'Playlist Stats',
            desc: 'Length, scores, and more',
            subOptions: [
                { id: 'duration', label: 'Duration' },
                { id: 'explicit', label: 'Explicit %' },
                { id: 'popularity', label: 'Popularity' }
            ]
        }
    ];

    const toggleCard = (option) => {
        setSelections(prev => {
            const next = { ...prev };
            if (next[option.id]) {
                delete next[option.id];
            } else {
                // Select with all sub-options enabled by default
                next[option.id] = option.subOptions.map(so => so.id);
            }
            return next;
        });
    };

    const toggleSubOption = (cardId, subId, e) => {
        e.stopPropagation(); // Prevent card toggle
        setSelections(prev => {
            const currentSubOptions = prev[cardId] || []; // Should exist if visible
            const isActive = currentSubOptions.includes(subId);

            let newSubOptions;
            if (isActive) {
                newSubOptions = currentSubOptions.filter(id => id !== subId);
            } else {
                newSubOptions = [...currentSubOptions, subId];
            }

            return {
                ...prev,
                [cardId]: newSubOptions
            };
        });
    };

    const handleRun = () => {
        onRun(selections);
        setSelections({}); // Reset
    };

    const selectedCount = Object.keys(selections).length;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Choose Analysis</h2>
                    <button className="modal-close-btn" onClick={onClose}>×</button>
                </div>
                <p className="description-text" style={{ marginBottom: '2rem' }}>
                    Select analysis modules and configure their settings.
                </p>

                <div className="analysis-options-grid">
                    {options.map(option => {
                        const isSelected = !!selections[option.id];
                        const activeSubOptions = selections[option.id] || [];

                        return (
                            <div
                                key={option.id}
                                className={`analysis-option-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => toggleCard(option)}
                            >
                                <div className="option-icon">{option.icon}</div>
                                <h3 className="option-title">{option.title}</h3>
                                <p className="option-desc">{option.desc}</p>

                                {isSelected && (
                                    <div className="analysis-sub-options">
                                        {option.subOptions.map(sub => (
                                            <span
                                                key={sub.id}
                                                className={`sub-option-pill ${activeSubOptions.includes(sub.id) ? 'active' : ''}`}
                                                onClick={(e) => toggleSubOption(option.id, sub.id, e)}
                                            >
                                                {sub.label}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="modal-actions">
                    <button
                        className="spotify-btn full-width"
                        onClick={handleRun}
                        disabled={selectedCount === 0}
                        style={{ opacity: selectedCount === 0 ? 0.5 : 1, cursor: selectedCount === 0 ? 'not-allowed' : 'pointer' }}
                    >
                        Run Analysis {selectedCount > 0 ? `(${selectedCount} Modules)` : ''}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisModal;
