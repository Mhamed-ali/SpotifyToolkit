import React, { useState, useEffect, useRef } from 'react';
import '../../App.css';

/**
 * Reusable searchable MultiSelect dropdown component (Extracted from DeepAnalysis.jsx - SRP).
 */
const MultiSelect = ({ options, selected, onChange, label, placeholder = 'Select...' }) => {
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
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                {label}
            </label>
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
                        filteredOptions.map(opt => {
                            const isChecked = selected.includes(opt);
                            return (
                                <div
                                    key={opt}
                                    onClick={() => toggleOption(opt)}
                                    style={{
                                        padding: '8px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-start',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        background: isChecked ? 'rgba(29, 185, 84, 0.1)' : 'transparent',
                                        color: isChecked ? 'var(--accent)' : 'var(--text-secondary)',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '4px',
                                        border: '1px solid ' + (isChecked ? 'var(--accent)' : 'rgba(255,255,255,0.3)'),
                                        background: isChecked ? 'var(--accent)' : 'transparent',
                                        marginRight: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        {isChecked && <span style={{ color: 'black', fontSize: '10px' }}>✓</span>}
                                    </div>
                                    <span style={{
                                        fontSize: '0.9rem',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        flex: 1
                                    }}>{opt}</span>
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ padding: '12px', color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem' }}>
                            No results
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSelect;
