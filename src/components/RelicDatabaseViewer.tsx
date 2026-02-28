import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { Relic } from '../optimizer/types';
import { RelicThumbnail } from './RelicThumbnail';
import { RelicInspector } from './RelicInspector';

export const RelicDatabaseViewer: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<string>('All');
    const [filterRarity, setFilterRarity] = useState<string>('All');
    const [sortReverse, setSortReverse] = useState<boolean>(false);
    const [selectedRelic, setSelectedRelic] = useState<Relic | null>(null);

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
            // Sort by Rarity (T4 > T3 > T2) then by total_level
            if (a.rarity !== b.rarity) {
                const cmp = b.rarity.localeCompare(a.rarity);
                return sortReverse ? -cmp : cmp;
            }
            const cmpLvl = b.total_level - a.total_level;
            return sortReverse ? -cmpLvl : cmpLvl;
        });

        return filtered;
    }, [relics, filterCategory, filterRarity, searchTerm, sortReverse]);

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

                    <button onClick={() => setSortReverse(!sortReverse)}>
                        Sort: {sortReverse ? '▲ Ascending' : '▼ Descending'}
                    </button>

                    <div style={{ marginLeft: 'auto', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Showing {displayRelics.length} items
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

            {/* Inspector Panel */}
            <div className="db-inspector-section">
                <RelicInspector selectedRelic={selectedRelic} />
            </div>
        </div>
    );
};
