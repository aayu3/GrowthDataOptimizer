import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Formation } from '../../db/database';
import dollsData from '../../data/dolls.json';

const ALL_DOLLS = Object.keys(dollsData).sort();

interface AddDollModalProps {
    formation: Formation;
    onAdd: (dollName: string) => Promise<void>;
    onClose: () => void;
}

export function AddDollModal({ formation, onAdd, onClose }: AddDollModalProps) {
    const [search, setSearch] = useState('');

    const available = ALL_DOLLS.filter(
        d => !formation.dolls.includes(d) && d.toLowerCase().includes(search.toLowerCase())
    );

    const content = (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
            onClick={onClose}
        >
            <div
                className="card glassmorphism"
                style={{ width: '340px', maxHeight: '480px', display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '0.75rem' }}
                onClick={e => e.stopPropagation()}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>Add Doll — {formation.name}</h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'rgba(255,0,0,0.2)', color: '#ff4c4c', border: '1px solid rgba(255,0,0,0.4)', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}
                    >×</button>
                </div>

                <input
                    autoFocus
                    className="glass-input"
                    placeholder="Search by name..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />

                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {available.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem', marginTop: '1rem' }}>
                            {search ? 'No dolls match.' : 'All dolls are already in this formation.'}
                        </p>
                    ) : (
                        available.map(doll => {
                            const imgPath = new URL(`../../assets/doll_images/${doll}.webp`, import.meta.url).href;
                            return (
                                <div
                                    key={doll}
                                    onClick={async () => { await onAdd(doll); onClose(); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.5rem', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <img
                                        src={imgPath}
                                        alt={doll}
                                        style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }}
                                        onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                                    />
                                    <span style={{ fontSize: '0.9rem' }}>{doll}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}
