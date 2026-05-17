import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Formation, MAX_FORMATIONS, MAX_FORMATION_DOLLS } from '../../db/database';
import dollsData from '../../data/dolls.json';

const ALL_DOLLS = Object.keys(dollsData).sort();

interface FormationsModalProps {
    onClose: () => void;
    activeFormationId: string | null;
    onSetActive: (id: string | null) => void;
}

export const FormationsModal: React.FC<FormationsModalProps> = ({ onClose, activeFormationId, onSetActive }) => {
    const navigate = useNavigate();
    const formations = useLiveQuery(() => db.formations.orderBy('order').toArray(), []) || [];

    const [newName, setNewName] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [addingDollToId, setAddingDollToId] = useState<string | null>(null);

    const handleCreate = async () => {
        const trimmed = newName.trim();
        if (!trimmed || formations.length >= MAX_FORMATIONS) return;
        const maxOrder = formations.reduce((m, f) => Math.max(m, f.order), -1);
        await db.formations.add({
            id: crypto.randomUUID(),
            name: trimmed,
            order: maxOrder + 1,
            dolls: [],
            relicAssignments: {},
            createdAt: Date.now(),
        });
        setNewName('');
        setIsCreating(false);
    };

    const handleRename = async (formation: Formation) => {
        const trimmed = editingName.trim();
        if (trimmed && trimmed !== formation.name) {
            await db.formations.update(formation.id, { name: trimmed });
        }
        setEditingId(null);
    };

    const handleDelete = async (formation: Formation) => {
        await db.formations.delete(formation.id);
        if (activeFormationId === formation.id) onSetActive(null);
    };

    const handleAddDoll = async (formation: Formation, dollName: string) => {
        if (formation.dolls.includes(dollName) || formation.dolls.length >= MAX_FORMATION_DOLLS) return;
        await db.formations.update(formation.id, { dolls: [...formation.dolls, dollName] });
        setAddingDollToId(null);
    };

    const handleRemoveDoll = async (formation: Formation, dollName: string) => {
        const newDolls = formation.dolls.filter(d => d !== dollName);
        const newAssignments = { ...formation.relicAssignments };
        for (const [relicId, doll] of Object.entries(newAssignments)) {
            if (doll === dollName) delete newAssignments[relicId];
        }
        await db.formations.update(formation.id, { dolls: newDolls, relicAssignments: newAssignments });
    };

    const handleNavigateToDoll = (formation: Formation, dollName: string) => {
        onClose();
        navigate(`/formation/${formation.id}/doll/${dollName}`);
    };

    const content = (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
            onClick={onClose}
        >
            <div
                className="card glassmorphism"
                style={{ position: 'relative', width: '90vw', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.5rem' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>
                        Formations
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                            ({formations.length}/{MAX_FORMATIONS})
                        </span>
                    </h2>
                    <button
                        onClick={onClose}
                        style={{ background: 'rgba(255,0,0,0.2)', color: '#ff4c4c', border: '1px solid rgba(255,0,0,0.4)', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >×</button>
                </div>

                {/* New formation row */}
                <div style={{ marginBottom: '1rem' }}>
                    {isCreating ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                autoFocus
                                className="glass-input"
                                placeholder="Formation name..."
                                maxLength={30}
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsCreating(false); }}
                                style={{ flex: 1 }}
                            />
                            <button className="glow-btn" onClick={handleCreate} style={{ padding: '0.4rem 0.8rem' }}>Create</button>
                            <button className="glow-btn" onClick={() => setIsCreating(false)} style={{ padding: '0.4rem 0.8rem', opacity: 0.6 }}>Cancel</button>
                        </div>
                    ) : (
                        <button
                            className="glow-btn"
                            onClick={() => setIsCreating(true)}
                            disabled={formations.length >= MAX_FORMATIONS}
                            style={{ opacity: formations.length >= MAX_FORMATIONS ? 0.4 : 1 }}
                        >
                            + New Formation
                        </button>
                    )}
                </div>

                {/* Formation list */}
                <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                    {formations.length === 0 && (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>
                            No formations yet. Create one to get started.
                        </p>
                    )}
                    {formations.map(f => (
                        <FormationCard
                            key={f.id}
                            formation={f}
                            isActive={activeFormationId === f.id}
                            editingId={editingId}
                            editingName={editingName}
                            addingDollToId={addingDollToId}
                            onSetEditingId={setEditingId}
                            onSetEditingName={setEditingName}
                            onRename={handleRename}
                            onDelete={handleDelete}
                            onSetActive={onSetActive}
                            onClearActive={() => onSetActive(null)}
                            onAddDoll={handleAddDoll}
                            onRemoveDoll={handleRemoveDoll}
                            onNavigateToDoll={handleNavigateToDoll}
                            onSetAddingDollToId={setAddingDollToId}
                        />
                    ))}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

interface FormationCardProps {
    formation: Formation;
    isActive: boolean;
    editingId: string | null;
    editingName: string;
    addingDollToId: string | null;
    onSetEditingId: (id: string | null) => void;
    onSetEditingName: (name: string) => void;
    onRename: (f: Formation) => void;
    onDelete: (f: Formation) => void;
    onSetActive: (id: string) => void;
    onClearActive: () => void;
    onAddDoll: (f: Formation, doll: string) => void;
    onRemoveDoll: (f: Formation, doll: string) => void;
    onNavigateToDoll: (f: Formation, doll: string) => void;
    onSetAddingDollToId: (id: string | null) => void;
}

function FormationCard({
    formation,
    isActive,
    editingId,
    editingName,
    addingDollToId,
    onSetEditingId,
    onSetEditingName,
    onRename,
    onDelete,
    onSetActive,
    onClearActive,
    onAddDoll,
    onRemoveDoll,
    onNavigateToDoll,
    onSetAddingDollToId,
}: FormationCardProps) {
    const isEditingThis = editingId === formation.id;
    const isAddingDollHere = addingDollToId === formation.id;
    const availableDolls = ALL_DOLLS.filter(d => !formation.dolls.includes(d));

    return (
        <div
            className="glassmorphism"
            style={{ padding: '1rem', borderRadius: 'var(--radius)', border: isActive ? '1px solid var(--accent-color)' : '1px solid var(--bg-panel-border)' }}
        >
            {/* Formation header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {isEditingThis ? (
                    <input
                        autoFocus
                        className="glass-input"
                        value={editingName}
                        maxLength={30}
                        onChange={e => onSetEditingName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') onRename(formation); if (e.key === 'Escape') onSetEditingId(null); }}
                        style={{ flex: 1, fontSize: '1rem' }}
                    />
                ) : (
                    <span style={{ flex: 1, fontWeight: 'bold', fontSize: '1rem' }}>
                        {formation.name}
                        {isActive && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', borderRadius: 'var(--radius)', padding: '1px 5px' }}>
                                Active
                            </span>
                        )}
                    </span>
                )}

                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {formation.dolls.length}/{MAX_FORMATION_DOLLS} dolls
                </span>

                {/* Rename */}
                {isEditingThis ? (
                    <>
                        <button className="glow-btn" onClick={() => onRename(formation)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>Save</button>
                        <button className="glow-btn" onClick={() => onSetEditingId(null)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', opacity: 0.6 }}>Cancel</button>
                    </>
                ) : (
                    <button
                        className="glow-btn"
                        onClick={() => { onSetEditingId(formation.id); onSetEditingName(formation.name); }}
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        title="Rename"
                    >✎</button>
                )}

                {/* Set active / clear */}
                {isActive ? (
                    <button className="glow-btn" onClick={onClearActive} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', opacity: 0.7 }}>Clear</button>
                ) : (
                    <button className="glow-btn" onClick={() => onSetActive(formation.id)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>Set Active</button>
                )}

                {/* Delete */}
                <button
                    onClick={() => onDelete(formation)}
                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'rgba(255,0,0,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,0,0,0.3)', borderRadius: 'var(--radius-button)', cursor: 'pointer' }}
                    title="Delete formation"
                >✕</button>
            </div>

            {/* Doll list */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                {formation.dolls.map(doll => (
                    <DollChip
                        key={doll}
                        dollName={doll}
                        onNavigate={() => onNavigateToDoll(formation, doll)}
                        onRemove={() => onRemoveDoll(formation, doll)}
                    />
                ))}

                {/* Add doll */}
                {formation.dolls.length < MAX_FORMATION_DOLLS && (
                    isAddingDollHere ? (
                        <div style={{ position: 'relative' }}>
                            <div
                                style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'var(--bg-panel)', border: '1px solid var(--bg-panel-border)', borderRadius: 'var(--radius)', padding: '0.5rem', maxHeight: '200px', overflowY: 'auto', minWidth: '160px', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                            >
                                {availableDolls.length === 0 ? (
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '0.25rem' }}>All dolls added</div>
                                ) : (
                                    availableDolls.map(doll => (
                                        <div
                                            key={doll}
                                            onClick={() => onAddDoll(formation, doll)}
                                            style={{ padding: '0.3rem 0.5rem', cursor: 'pointer', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            {doll}
                                        </div>
                                    ))
                                )}
                                <div
                                    onClick={() => onSetAddingDollToId(null)}
                                    style={{ borderTop: '1px solid var(--bg-panel-border)', marginTop: '0.25rem', paddingTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer', textAlign: 'center' }}
                                >
                                    Cancel
                                </div>
                            </div>
                            <button
                                className="glow-btn"
                                onClick={() => onSetAddingDollToId(null)}
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                            >
                                + Add Doll
                            </button>
                        </div>
                    ) : (
                        <button
                            className="glow-btn"
                            onClick={() => onSetAddingDollToId(formation.id)}
                            style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                        >
                            + Add Doll
                        </button>
                    )
                )}
            </div>

            {formation.dolls.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0.5rem 0 0 0' }}>
                    No dolls added yet. Use "+ Add Doll" to build this formation.
                </p>
            )}
        </div>
    );
}

interface DollChipProps {
    dollName: string;
    onNavigate: () => void;
    onRemove: () => void;
}

function DollChip({ dollName, onNavigate, onRemove }: DollChipProps) {
    const imgPath = new URL(`../../assets/doll_images/${dollName}.webp`, import.meta.url).href;

    return (
        <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--radius-button)', padding: '0.2rem 0.4rem 0.2rem 0.3rem', cursor: 'pointer' }}
            onClick={onNavigate}
            title={`Open ${dollName} in formation optimizer`}
        >
            <img
                src={imgPath}
                alt={dollName}
                style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '50%' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <span style={{ fontSize: '0.8rem' }}>{dollName}</span>
            <button
                onClick={e => { e.stopPropagation(); onRemove(); }}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1, padding: '0 2px' }}
                title="Remove from formation"
            >✕</button>
        </div>
    );
}
