import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Relic } from '../optimizer/types';
import relicInfo from '../data/relicinfo.json';
import { RelicThumbnail } from './RelicThumbnail';
import { RelicInspector } from './RelicInspector';
import { RelicEditorModal } from './RelicEditorModal';
import { ConfirmationModal } from './modals/ConfirmationModal';

export interface RelicDatabaseViewerProps {
    mode?: 'view' | 'select';
    onSelect?: (relic: Relic) => void;
    excludeEquippedBy?: string;
}

export const RelicDatabaseViewer: React.FC<RelicDatabaseViewerProps> = ({ mode = 'view', onSelect, excludeEquippedBy }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [filterRarity, setFilterRarity] = useState<string>('All');
    const [filterMainSkill, setFilterMainSkill] = useState<string>('All');
    const [filterAuxSkill1, setFilterAuxSkill1] = useState<string>('All');
    const [filterAuxSkill2, setFilterAuxSkill2] = useState<string>('All');
    const [sortMethod, setSortMethod] = useState<string>('Level'); // 'Level' or 'Time'
    const [sortReverse, setSortReverse] = useState<boolean>(false);
    const [selectedRelic, setSelectedRelic] = useState<Relic | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [relicToEdit, setRelicToEdit] = useState<Relic | null>(null);

    // Confirmation Modal state
    const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
    const [relicToDelete, setRelicToDelete] = useState<Relic | null>(null);

    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];

    const availableMainSkills = useMemo(() => {
        let skills: string[] = [];
        for (const [catName, catData] of Object.entries((relicInfo as any).RELIC_TYPES)) {
            if (filterCategory === 'All' || filterCategory === catName) {
                skills.push(...(catData as any).main_skills);
            }
        }
        return Array.from(new Set(skills)).sort();
    }, [filterCategory]);

    const availableAuxSkills = useMemo(() => {
        let skills: string[] = [];
        for (const catData of Object.values((relicInfo as any).RELIC_TYPES)) {
            if ((catData as any).aux_skills) {
                for (const skillName of Object.keys((catData as any).aux_skills)) {
                    if (skillName.includes('{Element}')) {
                        for (const el of (relicInfo as any).ELEMENTS) {
                            skills.push(skillName.replace('{Element}', el));
                        }
                    } else {
                        skills.push(skillName);
                    }
                }
            }
        }
        return Array.from(new Set(skills)).sort();
    }, []);

    useEffect(() => {
        if (filterMainSkill !== 'All' && !availableMainSkills.includes(filterMainSkill)) {
            setFilterMainSkill('All');
        }
    }, [availableMainSkills, filterMainSkill]);

    const displayRelics = useMemo(() => {
        let filtered = relics;

        if (filterCategory !== 'All') {
            filtered = filtered.filter(r => r.type === filterCategory);
        }

        if (excludeEquippedBy) {
            filtered = filtered.filter(r => r.equipped !== excludeEquippedBy);
        }

        if (filterRarity !== 'All') {
            filtered = filtered.filter(r => r.rarity === filterRarity);
        }

        if (filterMainSkill !== 'All') {
            filtered = filtered.filter(r => r.main_skill.name === filterMainSkill);
        }

        if (filterAuxSkill1 !== 'All') {
            filtered = filtered.filter(r => r.aux_skills.some(s => s.name === filterAuxSkill1));
        }

        if (filterAuxSkill2 !== 'All') {
            filtered = filtered.filter(r => r.aux_skills.some(s => s.name === filterAuxSkill2));
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(r =>
                r.main_skill.name.toLowerCase().includes(term) ||
                r.aux_skills.some(s => s.name.toLowerCase().includes(term))
            );
        }

        filtered.sort((a, b) => {
            if (sortMethod === 'Time') {
                const timeA = a.createdAt || 0;
                const timeB = b.createdAt || 0;
                const cmpTime = timeA - timeB;
                // Default chronological is Oldest -> Newest. sortReverse means Newest -> Oldest.
                return sortReverse ? -cmpTime : cmpTime;
            } else {
                // Sort by Rarity (T4 > T3 > T2) then by total_level
                if (a.rarity !== b.rarity) {
                    const cmp = b.rarity.localeCompare(a.rarity);
                    return sortReverse ? -cmp : cmp;
                }
                const cmpLvl = b.total_level - a.total_level;
                return sortReverse ? -cmpLvl : cmpLvl;
            }
        });

        return filtered;
    }, [relics, filterCategory, filterRarity, filterMainSkill, filterAuxSkill1, filterAuxSkill2, searchTerm, sortMethod, sortReverse, excludeEquippedBy]);

    const handleConfirmDeleteAll = async () => {
        await db.relics.clear();
        setSelectedRelic(null);
        setShowConfirmDeleteAll(false);
    };

    const handleConfirmDeleteRelic = async () => {
        if (relicToDelete?.id) {
            await db.relics.delete(relicToDelete.id);
            if (selectedRelic?.id === relicToDelete.id) setSelectedRelic(null);
        }
        setRelicToDelete(null);
    };

    return (
        <div className="db-viewer-layout">
            <div className="db-inventory-section">
                <div className="db-toolbar">
                    <input
                        type="text"
                        placeholder="Search skill..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ width: '160px' }}
                    />

                    <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)}>
                        <option value="All">All Tiers</option>
                        <option value="T4">Tier 4 (Legendary)</option>
                        <option value="T3">Tier 3 (Epic)</option>
                        <option value="T2">Tier 2 (Rare)</option>
                    </select>

                    <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                        <option value="All">All Categories</option>
                        <option value="Bulwark">Bulwark</option>
                        <option value="Vanguard">Vanguard</option>
                        <option value="Support">Support</option>
                        <option value="Sentinel">Sentinel</option>
                    </select>

                    <select value={filterMainSkill} onChange={e => setFilterMainSkill(e.target.value)}>
                        <option value="All">All Main Skills</option>
                        {availableMainSkills.map(sk => <option key={sk} value={sk}>{sk}</option>)}
                    </select>

                    <select value={filterAuxSkill1} onChange={e => setFilterAuxSkill1(e.target.value)}>
                        <option value="All">All Aux Skills 1</option>
                        {availableAuxSkills.map(sk => <option key={sk} value={sk}>{sk}</option>)}
                    </select>

                    <select value={filterAuxSkill2} onChange={e => setFilterAuxSkill2(e.target.value)}>
                        <option value="All">All Aux Skills 2</option>
                        {availableAuxSkills.map(sk => <option key={sk} value={sk}>{sk}</option>)}
                    </select>

                    <select value={sortMethod} onChange={e => setSortMethod(e.target.value)}>
                        <option value="Level">Sort by Level</option>
                        <option value="Time">Sort by Time added</option>
                    </select>

                    <button onClick={() => setSortReverse(!sortReverse)}>
                        {sortReverse ? '▲ Ascending' : '▼ Descending'}
                    </button>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            Showing {displayRelics.length} items
                        </div>
                        {mode === 'view' && (
                            <>
                                <button
                                    className="glow-btn"
                                    onClick={() => setShowConfirmDeleteAll(true)}
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        fontSize: '0.85rem',
                                        background: 'rgba(255, 60, 60, 0.1)',
                                        borderColor: '#ff4c4c',
                                        color: '#ff4c4c'
                                    }}
                                >
                                    Delete All
                                </button>
                                <button className="glow-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => { setRelicToEdit(null); setIsEditing(true); }}>
                                    + Add Relic
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="db-grid-container">
                    <div className="db-grid">
                        {displayRelics.map((r, i) => {
                            const isSelected = selectedRelic?.id === r.id;

                            return (
                                <RelicThumbnail
                                    key={r.id || i}
                                    relic={r}
                                    isSelected={isSelected}
                                    onClick={() => {
                                        setSelectedRelic(r);
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="db-inspector-section">
                <RelicInspector
                    selectedRelic={selectedRelic}
                    onEdit={mode === 'view' ? (relic) => {
                        setRelicToEdit(relic);
                        setIsEditing(true);
                    } : undefined}
                    onDelete={mode === 'view' ? (relic) => {
                        setRelicToDelete(relic);
                    } : undefined}
                    onSelect={mode === 'select' ? onSelect : undefined}
                />
            </div>

            {isEditing && (
                <RelicEditorModal
                    relicToEdit={relicToEdit}
                    onClose={() => {
                        setIsEditing(false);
                        setRelicToEdit(null);
                    }}
                />
            )}

            {showConfirmDeleteAll && (
                <ConfirmationModal
                    title="Delete All Relics?"
                    message="Are you sure you want to delete ALL relics? This action cannot be undone."
                    onConfirm={handleConfirmDeleteAll}
                    onCancel={() => setShowConfirmDeleteAll(false)}
                    danger={true}
                />
            )}

            {relicToDelete && (
                <ConfirmationModal
                    title="Delete Relic?"
                    message="Are you sure you want to delete this relic?"
                    onConfirm={handleConfirmDeleteRelic}
                    onCancel={() => setRelicToDelete(null)}
                    danger={true}
                />
            )}
        </div>
    );
};
