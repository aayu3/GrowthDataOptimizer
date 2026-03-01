import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Relic } from '../optimizer/types';
import { RelicThumbnail } from './RelicThumbnail';
import { RelicModal } from './RelicModal';
import { RelicEditorModal } from './RelicEditorModal';

export const RelicDatabaseViewer: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [filterRarity, setFilterRarity] = useState<string>('All');
    const [sortMethod, setSortMethod] = useState<string>('Level'); // 'Level' or 'Time'
    const [sortReverse, setSortReverse] = useState<boolean>(false);
    const [selectedRelic, setSelectedRelic] = useState<Relic | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [relicToEdit, setRelicToEdit] = useState<Relic | null>(null);

    const relics = useLiveQuery(() => db.relics.toArray(), []) || [];

    const displayRelics = useMemo(() => {
        let filtered = relics;

        if (filterCategory !== 'All') {
            filtered = filtered.filter(r => r.type === filterCategory);
        }

        if (filterRarity !== 'All') {
            filtered = filtered.filter(r => r.rarity === filterRarity);
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
    }, [relics, filterCategory, filterRarity, searchTerm, sortMethod, sortReverse]);

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
                        <button className="glow-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => { setRelicToEdit(null); setIsEditing(true); }}>
                            + Add Relic
                        </button>
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
                                    onClick={() => setSelectedRelic(r)}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Inspector Modal */}
            {selectedRelic && (
                <RelicModal
                    relic={selectedRelic}
                    onClose={() => setSelectedRelic(null)}
                    onEdit={(relic) => {
                        setRelicToEdit(relic);
                        setIsEditing(true);
                    }}
                    onDelete={async (relic) => {
                        if (relic.id) {
                            if (window.confirm("Are you sure you want to delete this relic?")) {
                                await db.relics.delete(relic.id);
                                if (selectedRelic?.id === relic.id) setSelectedRelic(null);
                            }
                        }
                    }}
                />
            )}

            {isEditing && (
                <RelicEditorModal
                    relicToEdit={relicToEdit}
                    onClose={() => {
                        setIsEditing(false);
                        setRelicToEdit(null);
                    }}
                />
            )}
        </div>
    );
};
