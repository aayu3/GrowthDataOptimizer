import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import dollsData from '../data/dolls.json';
import { SelectionRelicIcon } from '../components/SelectionRelicIcon';
import { ImportInventoryModal } from '../components/modals/ImportInventoryModal';
import { ExportInventoryModal } from '../components/modals/ExportInventoryModal';

export function Home() {
    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];
    const characters = useLiveQuery(() => db.characters.toArray(), []) || [];
    const [searchQuery, setSearchQuery] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const navigate = useNavigate();

    const favoriteDolls = characters.filter(c => c.isFavorite).map(c => c.dollName);

    const toggleFavorite = async (e: React.MouseEvent, dollName: string) => {
        e.preventDefault();
        e.stopPropagation();

        const character = characters.find(c => c.dollName === dollName);
        if (character) {
            await db.characters.update(dollName, { isFavorite: !character.isFavorite });
        } else {
            await db.characters.add({ dollName, isFavorite: true });
        }
    };

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
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
    }, [isExiting, navigate]);

    const availableDolls = Object.keys(dollsData).filter(doll =>
        doll.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
        const aFav = favoriteDolls.includes(a);
        const bFav = favoriteDolls.includes(b);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
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
            `}</style>
            <header className="header-glow" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '1.5rem', background: 'var(--bg-panel)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--bg-panel-border)', marginBottom: '3rem' }}>
                <h1 style={{ fontSize: '2rem' }}>Choose your focus.</h1>
                <div className="nav-tabs" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                    <Link to="/database" className="back-btn" style={{ position: 'relative', textDecoration: 'none' }}>
                        Browse Database
                    </Link>
                    <button className="glow-btn" style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: 'var(--radius-button)' }} onClick={() => setShowImportModal(true)}>
                        Upload Inventory
                    </button>
                    <button className="glow-btn" style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: 'var(--radius-button)' }} onClick={() => setShowExportModal(true)}>
                        Export Inventory
                    </button>
                </div>
                <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {relics.length > 0 ? <span className="success">✓ Database holds {relics.length} Relics</span> : <span>No relics loaded.</span>}
                </div>
            </header>

            <main className="main-content">
                <section className="glass-panel" style={{ position: 'relative', minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem', marginTop: '1rem' }}>
                        <input
                            type="text"
                            className="search-dolls-input"
                            placeholder="Search Dolls..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="doll-gallery" style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center', paddingBottom: '4rem' }}>
                        {availableDolls.map((doll, index) => {
                            const imgPath = new URL(`../assets/doll_images/${doll}.webp`, import.meta.url).href;
                            const offsetY = index % 2 === 0 ? '20px' : '-20px';
                            return (
                                <Link
                                    key={doll}
                                    className="doll-btn glass-panel"
                                    to={`/doll/${doll}`}
                                    style={{
                                        textDecoration: 'none',
                                        transform: `translateY(${offsetY})`,
                                        width: '160px',
                                        padding: '1.5rem',
                                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                        position: 'relative'
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
                                    >
                                        <svg
                                            width="28"
                                            height="28"
                                            viewBox="0 0 24 24"
                                            fill={favoriteDolls.includes(doll) ? "currentColor" : "none"}
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                        </svg>
                                    </div>
                                    <div className="doll-img-container" style={{ width: '100px', height: '100px', marginBottom: '1rem' }}>
                                        <img src={imgPath} alt={doll} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
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
        </div >
    );
}

