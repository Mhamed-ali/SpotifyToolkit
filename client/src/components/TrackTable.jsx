import React, { memo } from 'react';
import '../App.css';

const TrackTable = memo(({ tracks, playlist, visibleColumns, formatDate, formatDuration }) => {
    return (
        <table className="track-table">
            <thead>
                <tr>
                    {visibleColumns.index && <th>#</th>}
                    <th>Title</th>
                    {visibleColumns.album && <th>Album</th>}
                    {visibleColumns.dateAdded && <th>Date Added</th>}
                    {visibleColumns.released && <th>Released</th>}
                    {visibleColumns.popularity && <th>Pop.</th>}
                    {visibleColumns.duration && <th>Duration</th>}
                </tr>
            </thead>
            <tbody>
                {tracks.length === 0 && playlist.tracks.total > 0 ? (
                    // Skeleton Loading Rows
                    Array.from({ length: 15 }).map((_, i) => (
                        <tr key={`skeleton-${i}`} className="track-row skeleton-row">
                            {visibleColumns.index && (
                                <td className="track-index">
                                    <div className="skeleton-box" style={{ width: '20px', height: '14px' }}></div>
                                </td>
                            )}
                            <td className="track-main">
                                <div className="track-info-cell">
                                    <div className="skeleton-box skeleton-thumb"></div>
                                    <div className="track-text" style={{ width: '100%' }}>
                                        <div className="skeleton-box skeleton-text"></div>
                                        <div className="skeleton-box skeleton-text short"></div>
                                    </div>
                                </div>
                            </td>
                            {visibleColumns.album && (
                                <td className="track-album">
                                    <div className="skeleton-box skeleton-text"></div>
                                </td>
                            )}
                            {visibleColumns.dateAdded && <td className="track-date"><div className="skeleton-box skeleton-text short"></div></td>}
                            {visibleColumns.released && <td className="track-released"><div className="skeleton-box skeleton-text short"></div></td>}
                            {visibleColumns.popularity && <td className="track-pop"><div className="skeleton-box skeleton-text short"></div></td>}
                            {visibleColumns.duration && (
                                <td className="track-duration">
                                    <div className="skeleton-box skeleton-text short" style={{ width: '40px' }}></div>
                                </td>
                            )}
                        </tr>
                    ))
                ) : (
                    tracks.map((item, index) => {
                        if (!item || !item.track) return null; // Handle null items or tracks
                        const track = item.track;
                        // Ensure track has minimal required fields
                        if (!track.id || !track.name || !track.album) return null;

                        return (
                            <tr key={`${track.id}-${index}`} className="track-row">
                                {visibleColumns.index && (
                                    <td className="track-index">
                                        {index + 1}
                                    </td>
                                )}
                                <td className="track-main">
                                    <div className="track-info-cell">
                                        {visibleColumns.art && track.album.images && track.album.images.length > 0 && (
                                            <img
                                                src={track.album.images[track.album.images.length - 1].url}
                                                alt={track.album.name}
                                                className="track-thumb"
                                                loading="lazy"
                                            />
                                        )}
                                        <div className="track-text">
                                            <span className="track-name">{track.name}</span>
                                            <span className="track-artist">
                                                {track.artists.map(a => a.name).join(', ')}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                {visibleColumns.album && (
                                    <td className="track-album">{track.album.name}</td>
                                )}
                                {visibleColumns.dateAdded && (
                                    <td className="track-date">{formatDate(item.added_at)}</td>
                                )}
                                {visibleColumns.released && (
                                    <td className="track-released">{formatDate(track.album.release_date).split('/')[2]}</td>
                                )}
                                {visibleColumns.popularity && (
                                    <td className="track-pop">
                                        <div className="popularity-bar" title={`${track.popularity}%`}>
                                            <div className="popularity-fill" style={{ width: `${track.popularity}%` }}></div>
                                        </div>
                                    </td>
                                )}
                                {visibleColumns.duration && (
                                    <td className="track-duration">{formatDuration(track.duration_ms)}</td>
                                )}
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
    );
});

export default TrackTable;
