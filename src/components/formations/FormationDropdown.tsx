import React, { useState, useRef, useEffect } from 'react';
import { db, Formation, MAX_FORMATIONS } from '../../db/database';

interface FormationDropdownProps {
    formations: Formation[];
    activeFormationId: string | null;
    onSelect: (id: string | null) => void;
}

const iconBtn: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '2px 5px',
    lineHeight: 1,
    flexShrink: 0,
    borderRadius: 'var(--radius)',
};

export function FormationDropdown({ formations, activeFormationId, onSelect }: FormationDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameName, setRenameName] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const activeFormation = formations.find(f => f.id === activeFormationId);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                setIsOpen(false);
                setIsCreating(false);
                setRenamingId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed || formations.length >= MAX_FORMATIONS) return;
        const maxOrder = formations.reduce((m, f) => Math.max(m, f.order), -1);
        const id = crypto.randomUUID();
        await db.formations.add({
            id,
            name: trimmed,
            order: maxOrder + 1,
            dolls: [],
            relicAssignments: {},
            createdAt: Date.now(),
        });
        onSelect(id);
        setNewName('');
        setIsCreating(false);
        setIsOpen(false);
    };

    const handleRename = async (id: string) => {
        const trimmed = renameName.trim();
        if (trimmed) await db.formations.update(id, { name: trimmed });
        setRenamingId(null);
    };

    const handleDelete = async (id: string) => {
        await db.formations.delete(id);
        if (activeFormationId === id) onSelect(null);
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
                className="glow-btn"
                onClick={() => setIsOpen(o => !o)}
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '150px', justifyContent: 'space-between' }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeFormation ? activeFormation.name : 'General View'}
                </span>
                <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0, opacity: 0.6 }}>
                    <polyline points="1,3 5,7 9,3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>

            {isOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300, background: 'var(--bg-panel)', border: '1px solid var(--bg-panel-border)', borderRadius: 'var(--radius)', minWidth: '210px', boxShadow: '0 8px 28px rgba(0,0,0,0.55)', overflow: 'hidden' }}>

                    {/* General View */}
                    <DropdownRow
                        isActive={!activeFormationId}
                        onClick={() => { onSelect(null); setIsOpen(false); }}
                        label="General View"
                    />

                    {formations.length > 0 && <Divider />}

                    {/* Formation rows */}
                    {formations.map(f => (
                        <div
                            key={f.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', padding: '0.4rem 0.6rem', background: activeFormationId === f.id ? 'rgba(255,255,255,0.07)' : 'transparent', fontSize: '0.85rem' }}
                            onMouseEnter={e => { if (activeFormationId !== f.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                            onMouseLeave={e => { if (activeFormationId !== f.id) e.currentTarget.style.background = 'transparent'; }}
                        >
                            {activeFormationId === f.id
                                ? <span style={{ color: 'var(--accent-color)', fontSize: '0.6rem', flexShrink: 0 }}>●</span>
                                : <span style={{ width: '0.6rem', flexShrink: 0 }} />
                            }

                            {renamingId === f.id ? (
                                <input
                                    autoFocus
                                    className="glass-input"
                                    value={renameName}
                                    maxLength={30}
                                    onChange={e => setRenameName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRename(f.id); if (e.key === 'Escape') setRenamingId(null); }}
                                    onClick={e => e.stopPropagation()}
                                    style={{ flex: 1, fontSize: '0.8rem', padding: '0.15rem 0.35rem' }}
                                />
                            ) : (
                                <span
                                    style={{ flex: 1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                    onClick={() => { onSelect(f.id); setIsOpen(false); }}
                                >
                                    {f.name}
                                </span>
                            )}

                            {renamingId === f.id ? (
                                <>
                                    <button onClick={() => handleRename(f.id)} style={{ ...iconBtn, color: 'var(--accent-color)' }} title="Save">✓</button>
                                    <button onClick={() => setRenamingId(null)} style={{ ...iconBtn, opacity: 0.5 }} title="Cancel">✕</button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={e => { e.stopPropagation(); setRenamingId(f.id); setRenameName(f.name); }}
                                        style={iconBtn}
                                        title="Rename"
                                    >✎</button>
                                    <button
                                        onClick={e => { e.stopPropagation(); handleDelete(f.id); }}
                                        style={{ ...iconBtn, color: 'rgba(255,100,100,0.7)' }}
                                        title="Delete"
                                    >✕</button>
                                </>
                            )}
                        </div>
                    ))}

                    <Divider />

                    {/* New formation */}
                    {formations.length < MAX_FORMATIONS ? (
                        isCreating ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.6rem' }}>
                                <input
                                    autoFocus
                                    className="glass-input"
                                    placeholder="Formation name..."
                                    maxLength={30}
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsCreating(false); }}
                                    style={{ flex: 1, fontSize: '0.8rem', padding: '0.15rem 0.35rem' }}
                                />
                                <button onClick={handleCreate} style={{ ...iconBtn, color: 'var(--accent-color)' }}>✓</button>
                            </div>
                        ) : (
                            <div
                                onClick={() => setIsCreating(true)}
                                style={{ padding: '0.45rem 0.75rem', cursor: 'pointer', color: 'var(--accent-color)', fontSize: '0.85rem' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                + New Formation
                            </div>
                        )
                    ) : (
                        <div style={{ padding: '0.45rem 0.75rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            Max {MAX_FORMATIONS} formations reached
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function DropdownRow({ isActive, onClick, label }: { isActive: boolean; onClick: () => void; label: string }) {
    return (
        <div
            onClick={onClick}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.75rem', cursor: 'pointer', background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent', fontSize: '0.85rem' }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
        >
            {isActive
                ? <span style={{ color: 'var(--accent-color)', fontSize: '0.6rem' }}>●</span>
                : <span style={{ width: '0.6rem' }} />
            }
            {label}
        </div>
    );
}

function Divider() {
    return <div style={{ height: '1px', background: 'var(--bg-panel-border)', margin: '2px 0' }} />;
}
