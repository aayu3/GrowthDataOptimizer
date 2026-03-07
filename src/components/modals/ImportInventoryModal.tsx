import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../db/database';

interface ImportInventoryModalProps {
    onClose: () => void;
}

export function ImportInventoryModal({ onClose }: ImportInventoryModalProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [pendingImport, setPendingImport] = useState<any[] | null>(null);
    const [importFileName, setImportFileName] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const processFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (Array.isArray(json)) {
                    let skippedCount = 0;
                    const validRelics = [];

                    for (const r of json) {
                        const hasUnknownType = r.type === "Unknown" || !r.type;
                        const hasNoMainSkill = !r.main_skill || !r.main_skill.name || r.main_skill.name.toLowerCase() === 'unknown';
                        const hasNullAuxSkill = !r.aux_skills;
                        const hasInvalidAuxSkills = r.aux_skills && r.aux_skills.some((s: any) => !s || !s.name || s.name.toLowerCase() === 'unknown');

                        if (hasUnknownType || hasNoMainSkill || hasNullAuxSkill || hasInvalidAuxSkills) {
                            skippedCount++;
                            continue;
                        }

                        const { id, ...rest } = r;
                        validRelics.push({ ...rest, createdAt: Date.now() });
                    }

                    setPendingImport(validRelics);
                    setImportFileName(file.name);
                    if (skippedCount > 0) {
                        setErrorMsg(`Skipped ${skippedCount} relics with unknown/missing types or skills.`);
                    } else {
                        setErrorMsg('');
                    }
                } else {
                    setErrorMsg('Invalid inventory format. Expected an array of relics.');
                }
            } catch (err) {
                setErrorMsg('Failed to parse JSON file.');
            }
        };
        reader.readAsText(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    return createPortal(
        <div
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
            onClick={onClose}
        >
            <div
                className="card glassmorphism"
                style={{ width: '400px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 style={{ margin: 0 }}>Import Relics</h3>
                <p>Upload a JSON file containing relics to import.</p>

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1rem',
                        border: `2px dashed ${isDragging ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)'}`,
                        borderRadius: 'var(--radius)',
                        padding: '2rem 1rem',
                        background: isDragging ? 'rgba(242, 108, 21, 0.1)' : 'rgba(0,0,0,0.2)',
                        transition: 'all 0.3s ease'
                    }}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        Drag and drop your JSON file here, or
                    </span>
                    <label className="glow-btn" style={{ cursor: 'pointer', padding: '0.4rem 0.8rem', fontSize: '0.9rem', flexShrink: 0 }}>
                        Browse Files
                        <input type="file" accept=".json" onChange={handleFileUpload} hidden />
                    </label>
                    <span style={{ fontSize: '0.9rem', color: 'var(--accent-glow)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', marginTop: '0.5rem' }}>
                        {importFileName}
                    </span>
                </div>

                {errorMsg && (
                    <p style={{ margin: 0, color: 'var(--error, #ff4c4c)' }}>{errorMsg}</p>
                )}
                {pendingImport && (
                    <p style={{ margin: 0, color: 'var(--accent-glow)' }}>Loaded {pendingImport.length} relics.</p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    <button
                        className="glow-btn"
                        disabled={!pendingImport}
                        style={{ opacity: pendingImport ? 1 : 0.5, cursor: pendingImport ? 'pointer' : 'not-allowed' }}
                        onClick={async () => {
                            if (!pendingImport) return;
                            await db.relics.clear();
                            await db.relics.bulkAdd(pendingImport);

                            // Auto-favorite equipped dolls
                            const equippedDolls = [...new Set(pendingImport.filter(r => r.equipped).map(r => r.equipped))];
                            for (const doll of equippedDolls) {
                                const character = await db.characters.get(doll);
                                if (character) {
                                    if (!character.isFavorite) {
                                        await db.characters.update(doll, { isFavorite: true });
                                    }
                                } else {
                                    await db.characters.add({ dollName: doll, isFavorite: true });
                                }
                            }

                            onClose();
                        }}>
                        Replace Inventory
                    </button>
                    <button
                        className="glow-btn"
                        disabled={!pendingImport}
                        style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--success)', color: 'var(--success)', opacity: pendingImport ? 1 : 0.5, cursor: pendingImport ? 'pointer' : 'not-allowed' }}
                        onClick={async () => {
                            if (!pendingImport) return;
                            await db.relics.bulkAdd(pendingImport);

                            // Auto-favorite equipped dolls
                            const equippedDolls = [...new Set(pendingImport.filter(r => r.equipped).map(r => r.equipped))];
                            for (const doll of equippedDolls) {
                                const character = await db.characters.get(doll);
                                if (character) {
                                    if (!character.isFavorite) {
                                        await db.characters.update(doll, { isFavorite: true });
                                    }
                                } else {
                                    await db.characters.add({ dollName: doll, isFavorite: true });
                                }
                            }

                            onClose();
                        }}>
                        Merge Current
                    </button>
                    <button className="glow-btn" style={{ background: 'rgba(255, 60, 60, 0.1)', borderColor: '#ff4c4c', color: '#ff4c4c' }} onClick={onClose}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
