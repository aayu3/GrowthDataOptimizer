import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Formation } from '../../db/database';
import { Relic } from '../../optimizer/types';
import dollsData from '../../data/dolls.json';

const ALL_DOLLS = Object.keys(dollsData).sort();

interface AddDollModalProps {
    formation: Formation;
    relics: Relic[];
    onAdd: (dollName: string, importRelics?: boolean) => Promise<void>;
    onClose: () => void;
}

export function AddDollModal({ formation, relics, onAdd, onClose }: AddDollModalProps) {
    const [search, setSearch] = useState('');
    const [importEnabled, setImportEnabled] = useState<Set<string>>(new Set());

    const available = ALL_DOLLS.filter(
        d => !formation.dolls.includes(d) && d.toLowerCase().includes(search.toLowerCase())
    );

    const toggleImport = (e: React.MouseEvent, doll: string) => {
        e.stopPropagation();
        setImportEnabled(prev => {
            const next = new Set(prev);
            next.has(doll) ? next.delete(doll) : next.add(doll);
            return next;
        });
    };

    const content = (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
            onClick={onClose}
        >
            <div
                className="card glassmorphism"
                style={{ width: '380px', maxHeight: '480px', display: 'flex', flexDirection: 'column', padding: '1.25rem', gap: '0.75rem' }}
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

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.7 }}>Import relics</span>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {available.length === 0 ? (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.85rem', marginTop: '1rem' }}>
                            {search ? 'No dolls match.' : 'All dolls are already in this formation.'}
                        </p>
                    ) : (
                        available.map(doll => {
                            const imgPath = new URL(`../../assets/doll_images/${doll}.webp`, import.meta.url).href;
                            const equippedCount = relics.filter(r => r.equipped === doll).length;
                            const checked = importEnabled.has(doll);
                            return (
                                <div
                                    key={doll}
                                    onClick={async () => { await onAdd(doll, importEnabled.has(doll)); onClose(); }}
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
                                    <span style={{ fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doll}</span>
                                    <button
                                        onClick={e => equippedCount > 0 && toggleImport(e, doll)}
                                        title={equippedCount > 0 ? `${checked ? 'Disable' : 'Enable'} import of ${equippedCount} equipped relic${equippedCount !== 1 ? 's' : ''}` : 'No relics equipped in general view'}
                                        style={{
                                            flexShrink: 0,
                                            width: '32px',
                                            height: '28px',
                                            background: checked ? 'rgba(242,108,21,0.25)' : 'transparent',
                                            border: `1px solid ${equippedCount > 0 ? 'var(--accent-color)' : 'rgba(255,255,255,0.15)'}`,
                                            borderRadius: 'var(--radius)',
                                            color: equippedCount > 0 ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)',
                                            cursor: equippedCount > 0 ? 'pointer' : 'default',
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >✓</button>
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
