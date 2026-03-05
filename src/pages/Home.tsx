import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import dollsData from '../data/dolls.json';
import { RelicThumbnail } from '../components/RelicThumbnail';
import { ImportInventoryModal } from '../components/modals/ImportInventoryModal';
import { ExportInventoryModal } from '../components/modals/ExportInventoryModal';

export function Home() {
    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];
    const [searchQuery, setSearchQuery] = useState('');
    const [showImportModal, setShowImportModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);

    const availableDolls = Object.keys(dollsData).filter(doll =>
        doll.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="app-container">
            <header className="header-glow">
                <h1>GFL2 <span>Growth Data Optimizer</span></h1>
                <p className="subtitle">Import Inventory or Select a Character</p>
                <div className="nav-tabs" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
                    <Link to="/database" className="back-btn" style={{ position: 'relative', textDecoration: 'none' }}>
                        Browse Database
                    </Link>
                    <button className="glow-btn" style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => setShowImportModal(true)}>
                        Upload Inventory
                    </button>
                    <button className="glow-btn" style={{ position: 'relative', cursor: 'pointer', padding: '0.5rem 1rem', fontSize: '0.9rem' }} onClick={() => setShowExportModal(true)}>
                        Export Inventory
                    </button>
                </div>
                <div style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {relics.length > 0 ? <span className="success">✓ Database holds {relics.length} Relics</span> : <span>No relics loaded.</span>}
                </div>
            </header>

            <main className="main-content">
                <section className="card glassmorphism">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ margin: 0 }}>Available Dolls</h2>
                        <input
                            type="text"
                            placeholder="Search dolls..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)', color: 'white', width: '250px' }}
                        />
                    </div>
                    <div className="doll-grid">
                        {availableDolls.map(doll => {
                            const imgPath = new URL(`../assets/doll_images/${doll}.png`, import.meta.url).href;
                            return (
                                <Link
                                    key={doll}
                                    className="doll-btn"
                                    to={`/doll/${doll}`}
                                    style={{ textDecoration: 'none' }}
                                >
                                    <div className="doll-img-container">
                                        <img src={imgPath} alt={doll} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    </div>
                                    <span>{doll}</span>
                                    {relics.filter(r => r.equipped === doll).length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginTop: '4px' }}>
                                            {relics.filter(r => r.equipped === doll).map(r => (
                                                <div key={r.id} style={{ width: '24px', height: '24px' }}>
                                                    <RelicThumbnail relic={r} />
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

            {showImportModal && (
                <ImportInventoryModal onClose={() => setShowImportModal(false)} />
            )}
            {showExportModal && (
                <ExportInventoryModal relics={relics} onClose={() => setShowExportModal(false)} />
            )}
        </div>
    );
}
