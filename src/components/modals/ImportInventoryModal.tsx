import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../db/database';

interface ImportInventoryModalProps {
    onClose: () => void;
}

type Step = 'upload' | 'configure';
type ImportMode = 'replace' | 'merge';

export function ImportInventoryModal({ onClose }: ImportInventoryModalProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [pendingImport, setPendingImport] = useState<any[] | null>(null);
    const [importFileName, setImportFileName] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    // Step 2 state
    const [step, setStep] = useState<Step>('upload');
    const [importMode, setImportMode] = useState<ImportMode>('replace');
    const [equippedDolls, setEquippedDolls] = useState<string[]>([]);
    const [equipChecked, setEquipChecked] = useState<Set<string>>(new Set());
    const [favoriteChecked, setFavoriteChecked] = useState<Set<string>>(new Set());

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

    const goToConfigure = (mode: ImportMode) => {
        if (!pendingImport) return;
        const dolls = [...new Set(pendingImport.filter(r => r.equipped).map(r => r.equipped))] as string[];
        if (dolls.length === 0) {
            // No equipped dolls — execute directly
            executeImport(mode, pendingImport, new Set<string>(), new Set<string>());
            return;
        }
        setImportMode(mode);
        setEquippedDolls(dolls);
        setEquipChecked(new Set(dolls));
        setFavoriteChecked(new Set(dolls));
        setStep('configure');
    };

    const executeImport = async (
        mode: ImportMode,
        relics: any[],
        equip: Set<string>,
        favorite: Set<string>
    ) => {
        // Strip equipped field from dolls that are NOT in equip set
        const processedRelics = relics.map(r => {
            if (r.equipped && !equip.has(r.equipped)) {
                const { equipped, ...rest } = r;
                return rest;
            }
            return r;
        });

        if (mode === 'replace') {
            await db.relics.clear();
        }
        await db.relics.bulkAdd(processedRelics);

        // Handle favorites
        if (favorite.size > 0) {
            const allChars = await db.characters.toArray();
            let maxOrder = allChars.reduce((max, c) => Math.max(max, c.favoriteOrder ?? 0), -1);

            for (const doll of favorite) {
                const character = allChars.find(c => c.dollName === doll);
                if (character) {
                    if (!character.isFavorite) {
                        maxOrder++;
                        await db.characters.update(doll, { isFavorite: true, favoriteOrder: maxOrder });
                    }
                } else {
                    maxOrder++;
                    await db.characters.add({ dollName: doll, isFavorite: true, favoriteOrder: maxOrder });
                }
            }
        }

        // Ensure characters in equip (but not favorite) exist in DB
        if (equip.size > 0) {
            const allChars = await db.characters.toArray();
            for (const doll of equip) {
                if (!favorite.has(doll)) {
                    const exists = allChars.find(c => c.dollName === doll);
                    if (!exists) {
                        await db.characters.add({ dollName: doll });
                    }
                }
            }
        }

        onClose();
    };

    const handleConfirm = () => {
        if (!pendingImport) return;
        executeImport(importMode, pendingImport, equipChecked, favoriteChecked);
    };

    const toggleEquip = (doll: string) => {
        setEquipChecked(prev => {
            const next = new Set(prev);
            if (next.has(doll)) next.delete(doll); else next.add(doll);
            return next;
        });
    };

    const toggleFavorite = (doll: string) => {
        setFavoriteChecked(prev => {
            const next = new Set(prev);
            if (next.has(doll)) next.delete(doll); else next.add(doll);
            return next;
        });
    };

    const allEquipChecked = equippedDolls.every(d => equipChecked.has(d));
    const allFavoriteChecked = equippedDolls.every(d => favoriteChecked.has(d));

    const toggleAllEquip = () => {
        if (allEquipChecked) {
            setEquipChecked(new Set());
        } else {
            setEquipChecked(new Set(equippedDolls));
        }
    };

    const toggleAllFavorite = () => {
        if (allFavoriteChecked) {
            setFavoriteChecked(new Set());
        } else {
            setFavoriteChecked(new Set(equippedDolls));
        }
    };

    const renderUploadScreen = () => (
        <>
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
                    onClick={() => goToConfigure('replace')}
                >
                    Replace Inventory
                </button>
                <button
                    className="glow-btn"
                    disabled={!pendingImport}
                    style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'var(--success)', color: 'var(--success)', opacity: pendingImport ? 1 : 0.5, cursor: pendingImport ? 'pointer' : 'not-allowed' }}
                    onClick={() => goToConfigure('merge')}
                >
                    Merge Current
                </button>
                <button className="glow-btn" style={{ background: 'rgba(255, 60, 60, 0.1)', borderColor: '#ff4c4c', color: '#ff4c4c' }} onClick={onClose}>
                    Cancel
                </button>
            </div>
        </>
    );

    const renderConfigureScreen = () => (
        <>
            <h3 style={{ margin: 0 }}>Configure Import</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Choose which actions to apply to each equipped doll.
            </p>

            {/* Column headers with check-all buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Doll</span>
                <button
                    className="glow-btn"
                    onClick={toggleAllEquip}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', width: '80px' }}
                >
                    {allEquipChecked ? 'Equip ✓' : 'Equip'}
                </button>
                <button
                    className="glow-btn"
                    onClick={toggleAllFavorite}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', width: '80px' }}
                >
                    {allFavoriteChecked ? 'Fav ✓' : 'Favorite'}
                </button>
            </div>

            {/* Doll rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '280px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {equippedDolls.map(doll => (
                    <div key={doll} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: 'var(--radius)', background: 'rgba(255,255,255,0.03)' }}>
                        <span style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doll}</span>
                        {/* Equip checkbox */}
                        <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
                            <input
                                type="checkbox"
                                checked={equipChecked.has(doll)}
                                onChange={() => toggleEquip(doll)}
                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                            />
                        </div>
                        {/* Favorite checkbox */}
                        <div style={{ width: '80px', display: 'flex', justifyContent: 'center' }}>
                            <input
                                type="checkbox"
                                checked={favoriteChecked.has(doll)}
                                onChange={() => toggleFavorite(doll)}
                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-color)', cursor: 'pointer' }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button className="glow-btn" onClick={handleConfirm}>
                    Confirm Import
                </button>
                <button
                    className="glow-btn"
                    style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.2)', color: 'var(--text-secondary)' }}
                    onClick={() => setStep('upload')}
                >
                    ← Back
                </button>
            </div>
        </>
    );

    return createPortal(
        <div
            style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000 }}
            onClick={onClose}
        >
            <div
                className="card glassmorphism"
                style={{ width: '440px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
                onClick={(e) => e.stopPropagation()}
            >
                {step === 'upload' ? renderUploadScreen() : renderConfigureScreen()}
            </div>
        </div>,
        document.body
    );
}
