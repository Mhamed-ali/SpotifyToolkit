import React, { useState } from 'react';
import TrackTable from '../TrackTable';

/**
 * Reusable Collapsible Playlist Accordion for Combined Analysis view (SRP).
 */
const PlaylistAccordion = ({ title, tracks, playlist, visibleColumns, formatDate, formatDuration }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="playlist-accordion" style={{ marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', overflow: 'hidden' }}>
            <div
                className="accordion-header"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.05)',
                    borderBottom: isOpen ? '1px solid rgba(255,255,255,0.1)' : 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ transform: `rotate(${isOpen ? 90 : 0}deg)`, transition: 'transform 0.2s' }}>▶</span>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h3>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>({tracks.length})</span>
                </div>
            </div>

            {isOpen && (
                <div className="accordion-content">
                    <TrackTable
                        tracks={tracks}
                        playlist={playlist}
                        visibleColumns={visibleColumns}
                        formatDate={formatDate}
                        formatDuration={formatDuration}
                    />
                </div>
            )}
        </div>
    );
};

export default PlaylistAccordion;
