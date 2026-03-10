import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import dollsData from '../data/dolls.json';
import { SelectionRelicIcon } from '../components/SelectionRelicIcon';
import { ImportInventoryModal } from '../components/modals/ImportInventoryModal';
import { ExportInventoryModal } from '../components/modals/ExportInventoryModal';
import { GoogleDriveSyncModal } from '../components/modals/GoogleDriveSyncModal';

export function Home() {
    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];
    const characters = useLiveQuery(() => db.characters.toArray(), []) || [];
    const [searchQuery, setSearchQuery] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showGoogleDriveModal, setShowGoogleDriveModal] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [draggedDoll, setDraggedDoll] = useState<string | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [liveFavorites, setLiveFavorites] = useState<string[]>([]);
    const pressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!draggedDoll) {
            const sorted = characters
                .filter(c => c.isFavorite)
                .sort((a, b) => {
                    const orderA = a.favoriteOrder ?? 0;
                    const orderB = b.favoriteOrder ?? 0;
                    if (orderA !== orderB) return orderA - orderB;
                    return a.dollName.localeCompare(b.dollName);
                })
                .map(c => c.dollName);

            // Only update if different to avoid infinite loops
            if (JSON.stringify(sorted) !== JSON.stringify(liveFavorites)) {
                setLiveFavorites(sorted);
            }
        }
    }, [characters, draggedDoll, liveFavorites]);

    const toggleFavorite = async (e: React.MouseEvent, dollName: string) => {
        e.preventDefault();
        e.stopPropagation();

        const character = characters.find(c => c.dollName === dollName);
        if (character?.isFavorite) {
            await db.characters.update(dollName, { isFavorite: false, favoriteOrder: undefined });
        } else {
            const maxOrder = characters.reduce((max, c) => Math.max(max, c.favoriteOrder ?? 0), -1);
            if (character) {
                await db.characters.update(dollName, { isFavorite: true, favoriteOrder: maxOrder + 1 });
            } else {
                await db.characters.add({ dollName, isFavorite: true, favoriteOrder: maxOrder + 1 });
            }
        }
    };

    const handlePressStart = (doll: string) => {
        if (!liveFavorites.includes(doll)) return;

        pressTimer.current = setTimeout(() => {
            setIsEditMode(true);
        }, 500); // 500ms long press
    };

    const handlePressEnd = () => {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // If they click on empty space (not a doll button), exit edit mode
            const target = e.target as HTMLElement;
            if (!target.closest('.doll-btn') && !target.closest('.delete-favorite-btn')) {
                setIsEditMode(false);
            }
        };

        if (isEditMode) {
            document.addEventListener('click', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [isEditMode]);

    const handleDragStart = (e: React.DragEvent, doll: string) => {
        // Only allow dragging favorite dolls in edit mode
        if (!liveFavorites.includes(doll) || !isEditMode) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', doll);

        // Delay setting state so the drag ghost image is captured *before* opacity drops
        setTimeout(() => setDraggedDoll(doll), 0);
    };

    const handleDragEnter = (targetDoll: string) => {
        if (!draggedDoll || draggedDoll === targetDoll || !liveFavorites.includes(targetDoll)) {
            return;
        }

        const draggedIdx = liveFavorites.indexOf(draggedDoll);
        const targetIdx = liveFavorites.indexOf(targetDoll);

        if (draggedIdx === -1 || targetIdx === -1) return;

        const newFavorites = [...liveFavorites];
        newFavorites.splice(draggedIdx, 1);
        newFavorites.splice(targetIdx, 0, draggedDoll);
        setLiveFavorites(newFavorites);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();

        if (!draggedDoll) return;

        // Commit all live favorites changes
        const updates = liveFavorites.map((name, index) => {
            return db.characters.update(name, { favoriteOrder: index });
        });

        await Promise.all(updates);
        setDraggedDoll(null);
    };

    const handleDragEnd = () => {
        setDraggedDoll(null);
    };

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            // Don't navigate while a modal is open
            if (showImportModal || showExportModal || showGoogleDriveModal) return;
            // If scrolling UP and we are at the top of the page
            if (e.deltaY < -50 && window.scrollY <= 0) {
                if (!isExiting) {
                    setIsExiting(true);
                    setTimeout(() => {
                        navigate('/');
                    }, 500);
                }
            }
        };

        window.addEventListener('wheel', handleWheel);
        return () => window.removeEventListener('wheel', handleWheel);
    }, [isExiting, navigate, showGoogleDriveModal, showImportModal, showExportModal]);

    const availableDolls = Object.keys(dollsData).filter(doll =>
        doll.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
        const aFavIdx = liveFavorites.indexOf(a);
        const bFavIdx = liveFavorites.indexOf(b);
        if (aFavIdx !== -1 && bFavIdx === -1) return -1;
        if (aFavIdx === -1 && bFavIdx !== -1) return 1;
        if (aFavIdx !== -1 && bFavIdx !== -1) return aFavIdx - bFavIdx;
        return a.localeCompare(b);
    });

    return (
        <div className={`app-container ${isExiting ? 'page-exit-down' : 'page-enter-down'}`}>
            <style>{`
                .page-exit-down {
                    animation: slide-down-fade 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards !important;
                }
                .page-enter-down {
                    animation: slide-up-fade-in 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                }
                @keyframes slide-down-fade {
                    0% { transform: translateY(0); opacity: 1; }
                    100% { transform: translateY(20vh); opacity: 0; filter: blur(10px); }
                }
                @keyframes slide-up-fade-in {
                    0% { transform: translateY(20vh); opacity: 0; filter: blur(10px); }
                    100% { transform: translateY(0); opacity: 1; filter: blur(0px); }
                }
                @keyframes jiggle {
                    0% { transform: rotate(-1deg); }
                    50% { transform: rotate(1.5deg); }
                    100% { transform: rotate(-1deg); }
                }
                .jiggling {
                    animation: jiggle 0.3s infinite linear;
                    z-index: 10;
                }
                .jiggling:nth-child(even) {
                    animation-direction: reverse;
                    animation-duration: 0.35s;
                }
                .jiggling:nth-child(3n) {
                    animation-duration: 0.25s;
                }
            `}</style>
            <header className="header-glow" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '1.5rem', background: 'var(--bg-panel)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--bg-panel-border)', marginBottom: '3rem' }}>
                <div className="nav-tabs" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                    <Link to="/database" className="back-btn" style={{ position: 'relative', textDecoration: 'none' }}>
                        Browse Database
                    </Link>
                    <button className="glow-btn" style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: 'var(--radius-button)' }} onClick={() => setShowImportModal(true)}>
                        Import Data
                    </button>
                    <button className="glow-btn" style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: 'var(--radius-button)' }} onClick={() => setShowExportModal(true)}>
                        Export Data
                    </button>
                    <button
                        className="glow-btn"
                        style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: 'var(--radius-button)', display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}
                        onClick={() => setShowGoogleDriveModal(true)}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#4285F4" d="M21.35 11.1H12v2.98h5.33c-.23 1.5-1.88 4.4-5.33 4.4-3.21 0-5.83-2.66-5.83-5.94s2.62-5.94 5.83-5.94c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.69 4.05 14.58 3 12 3 6.92 3 2.8 7.12 2.8 12.2S6.92 21.4 12 21.4c6.92 0 8.62-6.07 8.62-8.96 0-.6-.06-1.03-.14-1.34Z" />
                            <path fill="#FBBC05" d="M3 12.2c0 1.64.39 3.19 1.08 4.56l2.85-2.2c-.17-.5-.26-1.04-.26-1.6 0-.56.09-1.1.26-1.6l-2.85-2.2C3.39 9.01 3 10.56 3 12.2Z" />
                            <path fill="#34A853" d="M12 21.4c2.52 0 4.64-.83 6.19-2.25l-3.03-2.35c-.81.56-1.85.95-3.16.95-3.44 0-5.1-2.9-5.33-4.39l-2.83 2.18C5.38 18.78 8.42 21.4 12 21.4Z" />
                            <path fill="#EA4335" d="M21.35 11.1H12v2.98h5.33c-.11.72-.54 1.81-1.5 2.72l3.03 2.35c1.82-1.68 2.76-4.16 2.76-7.11 0-.6-.06-1.03-.14-1.34Z" />
                        </svg>
                        Sync
                    </button>
                    {liveFavorites.length > 0 && (
                        <button
                            className="glow-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditMode(!isEditMode);
                            }}
                            style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: 'var(--radius-button)' }}
                        >
                            {isEditMode ? 'Done' : 'Edit Favorites'}
                        </button>
                    )}
                </div>
                <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {relics.length > 0 ? <span className="success">✓ Database holds {relics.length} Relics</span> : <span>No relics loaded.</span>}
                </div>
            </header>

            <main className="main-content">
                <section className="glass-panel" style={{ position: 'relative', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem', marginTop: '1rem', position: 'relative' }}>
                        <input
                            type="text"
                            className="search-dolls-input"
                            placeholder="Search Dolls..."
                            onFocus={(e) => e.target.placeholder = ''}
                            onBlur={(e) => e.target.placeholder = 'Search Dolls...'}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="doll-gallery" style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center', paddingBottom: '4rem' }}>
                        {availableDolls.map((doll, index) => {
                            const imgPath = new URL(`../assets/doll_images/${doll}.webp`, import.meta.url).href;
                            const offsetY = index % 2 === 0 ? '20px' : '-20px';
                            const isFavorite = liveFavorites.includes(doll);
                            const shouldJiggle = isFavorite && isEditMode;

                            return (
                                <Link
                                    key={doll}
                                    className={`doll-btn glass-panel ${draggedDoll === doll ? 'dragging' : ''} ${shouldJiggle ? 'jiggling' : ''}`}
                                    to={isEditMode ? '#' : `/doll/${doll}`}
                                    draggable={isFavorite && isEditMode}
                                    onMouseDown={() => handlePressStart(doll)}
                                    onTouchStart={() => handlePressStart(doll)}
                                    onMouseUp={handlePressEnd}
                                    onMouseLeave={handlePressEnd}
                                    onTouchEnd={handlePressEnd}
                                    onDragStart={(e) => handleDragStart(e, doll)}
                                    onDragEnter={() => handleDragEnter(doll)}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    onDragEnd={handleDragEnd}
                                    onClick={(e) => {
                                        if (isEditMode) e.preventDefault();
                                    }}
                                    style={{
                                        textDecoration: 'none',
                                        transform: `translateY(${offsetY})`,
                                        width: '160px',
                                        padding: '1.5rem',
                                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                        position: 'relative',
                                        opacity: draggedDoll === doll ? 0.3 : 1
                                    }}
                                >
                                    <div
                                        onClick={(e) => toggleFavorite(e, doll)}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '12px',
                                            zIndex: 10,
                                            cursor: 'pointer',
                                            color: '#ffffff',
                                            filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        draggable={false}
                                    >
                                        <svg
                                            width="28"
                                            height="28"
                                            viewBox="0 0 24 24"
                                            fill={liveFavorites.includes(doll) ? "currentColor" : "none"}
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
                                    </div>
                                    <div className="doll-img-container" style={{ width: '100px', height: '100px', marginBottom: '1rem' }}>
                                        <img src={imgPath} alt={doll} draggable={false} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    </div>
                                    <span style={{ fontSize: '1.1rem', letterSpacing: '0.5px' }}>{doll}</span>
                                    {relics.filter(r => r.equipped === doll).length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginTop: '1rem' }}>
                                            {relics.filter(r => r.equipped === doll).map(r => (
                                                <div key={r.id} style={{ width: '24px', height: '24px' }}>
                                                    <SelectionRelicIcon relic={r} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </section>
            </main>

            {
                showImportModal && (
                    <ImportInventoryModal onClose={() => setShowImportModal(false)} />
                )
            }
            {
                showExportModal && (
                    <ExportInventoryModal relics={relics} onClose={() => setShowExportModal(false)} />
                )
            }
            {
                showGoogleDriveModal && (
                    <GoogleDriveSyncModal onClose={() => setShowGoogleDriveModal(false)} />
                )
            }
        </div >
    );
}

