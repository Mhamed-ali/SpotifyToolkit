import React, { useState, useEffect } from 'react';
import '../App.css';

const ExportOptionsModal = ({ isOpen, onClose, onConfirm, availableFields }) => {
    const [selectedFields, setSelectedFields] = useState(new Set());

    // Initialize with all fields selected by default
    useEffect(() => {
        if (isOpen && availableFields) {
            setSelectedFields(new Set(availableFields.map(f => f.key)));
        }
    }, [isOpen, availableFields]);

    const toggleField = (key) => {
        const newSet = new Set(selectedFields);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setSelectedFields(newSet);
    };

    const handleSelectAll = () => {
        setSelectedFields(new Set(availableFields.map(f => f.key)));
    };

    const handleDeselectAll = () => {
        setSelectedFields(new Set());
    };

    const handleConfirm = () => {
        onConfirm(Array.from(selectedFields));
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="glass-card modal-content" onClick={e => e.stopPropagation()} style={{
                maxWidth: '600px',
                width: '90%',
                background: '#121212',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#ffffff'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, color: '#fff' }}>Export Options</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                </div>

                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
                    <button className="text-btn" onClick={handleSelectAll} style={{ color: 'var(--accent)', fontSize: '0.9rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>Select All</button>
                    <button className="text-btn" onClick={handleDeselectAll} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', background: 'transparent', border: 'none', cursor: 'pointer' }}>Deselect All</button>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.8rem',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    marginBottom: '2rem',
                    padding: '0.5rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px'
                }}>
                    {availableFields.map(field => (
                        <label key={field.key} style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: '0.8rem',
                            background: selectedFields.has(field.key) ? 'rgba(29, 185, 84, 0.15)' : 'rgba(255,255,255,0.05)',
                            borderRadius: '6px',
                            border: selectedFields.has(field.key) ? '1px solid var(--accent)' : '1px solid transparent',
                            transition: 'all 0.2s ease'
                        }}>
                            <input
                                type="checkbox"
                                checked={selectedFields.has(field.key)}
                                onChange={() => toggleField(field.key)}
                                style={{ marginRight: '10px', accentColor: 'var(--accent)' }}
                            />
                            <span style={{ fontSize: '0.9rem', color: '#eee' }}>{field.label}</span>
                        </label>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button className="spotify-btn action-btn-outline" onClick={onClose} style={{ color: '#fff', border: '1px solid white' }}>Cancel</button>
                    <button
                        className="spotify-btn"
                        onClick={handleConfirm}
                        disabled={selectedFields.size === 0}
                    >
                        Export Data
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportOptionsModal;
