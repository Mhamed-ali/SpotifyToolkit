import React, { useState } from 'react';
import '../App.css';
import { ANALYSIS_MODULES } from '../config/analysisRegistry';

const AnalysisModal = ({ isOpen, onClose, onRun }) => {
    const [selections, setSelections] = useState({});

    if (!isOpen) return null;

    const toggleCard = (option) => {
        setSelections(prev => {
            const next = { ...prev };
            if (next[option.id]) {
                delete next[option.id];
            } else {
                next[option.id] = option.subOptions.map(so => so.id);
            }
            return next;
        });
    };

    const toggleSubOption = (cardId, subId, e) => {
        e.stopPropagation();
        setSelections(prev => {
            const currentSubOptions = prev[cardId] || [];
            const isActive = currentSubOptions.includes(subId);
            const newSubOptions = isActive
                ? currentSubOptions.filter(id => id !== subId)
                : [...currentSubOptions, subId];

            return {
                ...prev,
                [cardId]: newSubOptions
            };
        });
    };

    const handleRun = () => {
        onRun(selections);
        setSelections({});
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
                    {ANALYSIS_MODULES.map(option => {
                        const isSelected = Boolean(selections[option.id]);
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

                                {isSelected && option.subOptions.length > 0 && (
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
