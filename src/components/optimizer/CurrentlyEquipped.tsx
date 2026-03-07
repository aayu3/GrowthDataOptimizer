import { useState } from 'react';
import { db } from '../../db/database';
import { Relic, HistoryAction, BuildResult } from '../../optimizer/types';
import { RelicThumbnail } from '../RelicThumbnail';
import { RelicModal } from '../RelicModal';
import { RelicInventoryModal } from '../RelicInventoryModal';
import { getCatBadgeIconUrl, getSkillCategory, getSkillDescription } from '../../utils/relicUtils';
import { calculateBuildStats, calculateBuildDamage } from '../../utils/buildUtils';

interface CurrentlyEquippedProps {
    selectedDoll: string;
    relics: Relic[];
    undoStack: HistoryAction[];
    redoStack: HistoryAction[];
    handleUndo: () => void;
    handleRedo: () => void;
    pushAction: (action: HistoryAction) => void;
    setRelicToUnequip: (relic: Relic | null) => void;
    showDamageSimulation: boolean;
    simStats: any;
    simIgnoredSkills: string[];
    skillSortBy: 'lvl' | 'type';
    setSkillSortBy: (val: 'lvl' | 'type') => void;
}

export function CurrentlyEquipped({
    selectedDoll,
    relics,
    undoStack,
    redoStack,
    handleUndo,
    handleRedo,
    pushAction,
    setRelicToUnequip,
    showDamageSimulation,
    simStats,
    simIgnoredSkills,
    skillSortBy,
    setSkillSortBy
}: CurrentlyEquippedProps) {
    const [selectedEquippedRelic, setSelectedEquippedRelic] = useState<Relic | null>(null);
    const [isEditingEquip, setIsEditingEquip] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

    const equippedRelics = relics.filter(r => r.equipped === selectedDoll);

    return (
        <section className="card glassmorphism" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Currently Equipped</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                        className="glow-btn"
                        style={{ padding: '0.2rem 0.4rem', fontSize: '1rem', opacity: undoStack.length === 0 ? 0.5 : 1, cursor: undoStack.length === 0 ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', boxShadow: 'none', color: undoStack.length === 0 ? 'rgba(255, 255, 255, 0.3)' : 'var(--accent-color)' }}
                        disabled={undoStack.length === 0}
                        onClick={handleUndo}
                        title="Undo last equip/unequip action"
                    >↶
                    </button>
                    <button
                        className="glow-btn"
                        style={{ padding: '0.2rem 0.4rem', fontSize: '1rem', opacity: redoStack.length === 0 ? 0.5 : 1, cursor: redoStack.length === 0 ? 'not-allowed' : 'pointer', background: 'transparent', border: 'none', boxShadow: 'none', color: redoStack.length === 0 ? 'rgba(255, 255, 255, 0.3)' : 'var(--accent-color)' }}
                        disabled={redoStack.length === 0}
                        onClick={handleRedo}
                        title="Redo last undone action"
                    >↷
                    </button>
                    {equippedRelics.length > 0 && (
                        <button
                            className="export-btn"
                            title="Export equipped relics to share this build"
                            onClick={() => {
                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(equippedRelics, null, 2));
                                const dlAnchorElem = document.createElement('a');
                                dlAnchorElem.setAttribute("href", dataStr);
                                dlAnchorElem.setAttribute("download", `equipped_relics_${selectedDoll}.json`);
                                dlAnchorElem.click();
                            }}
                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            Export Build
                        </button>
                    )}
                    <button
                        className="glow-btn"
                        style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: isEditMode ? 'var(--accent-glow)' : 'white', color: isEditMode ? 'inherit' : 'black', border: isEditMode ? '1px solid transparent' : '1px solid white' }}
                        onClick={() => {
                            setIsEditMode(!isEditMode);
                            setSelectedEquippedRelic(null);
                        }}
                    >
                        {isEditMode ? 'Done Editing' : 'Edit Relics'}
                    </button>
                </div>
            </div>

            {(equippedRelics.length > 0 || isEditMode) ? (
                <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '0.75rem' }}>
                        {equippedRelics.map(r => (
                            <div key={r.id} style={{ width: '56px', height: '56px' }}>
                                <RelicThumbnail
                                    relic={r}
                                    isSelected={selectedEquippedRelic?.id === r.id}
                                    onClick={() => setSelectedEquippedRelic(r)}
                                    hideEquippedIcon={true}
                                    onUnequip={isEditMode ? () => {
                                        setRelicToUnequip(r);
                                        if (selectedEquippedRelic?.id === r.id) {
                                            setSelectedEquippedRelic(null);
                                        }
                                    } : undefined}
                                />
                            </div>
                        ))}
                        {isEditMode && (
                            <div style={{ width: '56px', height: '56px' }}>
                                <button
                                    onClick={() => {
                                        setIsEditingEquip(true);
                                        setSelectedEquippedRelic(null);
                                    }}
                                    style={{
                                        width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.4)', borderRadius: 'var(--radius-image)', color: 'rgba(255,255,255,0.6)', fontSize: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.color = 'white';
                                        e.currentTarget.style.borderColor = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
                                    }}
                                    title="Add Relic"
                                >
                                    +
                                </button>
                            </div>
                        )}
                    </div>

                    {equippedRelics.length > 0 && (() => {
                        const equippedStats = calculateBuildStats(equippedRelics);
                        return (
                            <div className="stats-row" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius)', marginTop: '1rem' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {Object.entries(equippedStats.rawCategoryLevels).map(([cat, lvl]) => (
                                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
                                            <img src={getCatBadgeIconUrl(cat)} alt={cat} style={{ width: '20px', height: '20px' }} />
                                            <span style={{ color: 'var(--text-primary)' }}>{lvl}</span>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Skills</div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className={`glow-btn ${skillSortBy === 'type' ? 'active' : ''}`}
                                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: skillSortBy === 'type' ? 'white' : 'transparent', color: skillSortBy === 'type' ? 'black' : 'white', border: '1px solid white' }}
                                            onClick={() => setSkillSortBy('type')}
                                        >
                                            Type
                                        </button>
                                        <button
                                            className={`glow-btn ${skillSortBy === 'lvl' ? 'active' : ''}`}
                                            style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: skillSortBy === 'lvl' ? 'white' : 'transparent', color: skillSortBy === 'lvl' ? 'black' : 'white', border: '1px solid white' }}
                                            onClick={() => setSkillSortBy('lvl')}
                                        >
                                            Lvl
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr)', gap: '0.5rem', fontSize: '0.85rem' }}>
                                    {Object.entries(equippedStats.effectiveSkillLevels)
                                        .sort((a, b) => {
                                            if (skillSortBy === 'lvl') {
                                                if (b[1] !== a[1]) return b[1] - a[1];
                                                return a[0].localeCompare(b[0]);
                                            } else {
                                                const catA = getSkillCategory(a[0]);
                                                const catB = getSkillCategory(b[0]);

                                                // Sort by category count (most amount of types first)
                                                // We can compute counts on the fly
                                                const counts: Record<string, number> = {};
                                                Object.keys(equippedStats.effectiveSkillLevels).forEach(k => {
                                                    const c = getSkillCategory(k);
                                                    counts[c] = (counts[c] || 0) + 1;
                                                });

                                                if (counts[catA] !== counts[catB]) {
                                                    return counts[catB] - counts[catA];
                                                }
                                                // If same count, sort by category name
                                                if (catA !== catB) return catA.localeCompare(catB);
                                                // If same category, sort by level
                                                return b[1] - a[1];
                                            }
                                        })
                                        .map(([skill, lvl]) => (
                                            <div key={skill} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <div
                                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: 'var(--radius)', outline: getSkillCategory(skill) !== 'Unknown' ? `1px solid var(--cat-${getSkillCategory(skill).toLowerCase()})` : 'none', cursor: 'pointer' }}
                                                    onClick={() => setExpandedSkill(expandedSkill === skill ? null : skill)}
                                                >
                                                    <span style={{ color: 'var(--text-secondary)' }}>{skill}</span>
                                                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Lv. {lvl}</span>
                                                </div>
                                                {expandedSkill === skill && (
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 'var(--radius)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>
                                                        {getSkillDescription(skill, lvl)}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                </div>
                                {showDamageSimulation && (
                                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '4px' }}>Simulated Average Damage</div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', textShadow: '0 0 10px rgba(242, 108, 21, 0.5)' }}>
                                            {Math.round(calculateBuildDamage(
                                                {
                                                    relics: equippedRelics,
                                                    rawCategoryLevels: equippedStats.rawCategoryLevels,
                                                    effectiveSkillLevels: equippedStats.effectiveSkillLevels
                                                } as BuildResult,
                                                simStats,
                                                simIgnoredSkills,
                                                true // log Details
                                            )).toLocaleString()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </>
            ) : (
                <p className="hint" style={{ margin: '1rem 0 0 0' }}>No relics equipped.</p>
            )}

            <div style={{ flex: 1 }} />

            {selectedEquippedRelic && (
                <RelicModal
                    relic={selectedEquippedRelic}
                    onClose={() => setSelectedEquippedRelic(null)}
                />
            )}

            {isEditingEquip && selectedDoll && (
                <RelicInventoryModal
                    selectedDoll={selectedDoll}
                    onClose={() => setIsEditingEquip(false)}
                    onEquip={async (r) => {
                        if (r.id) {
                            const fullRelic = relics.find(x => x.id === r.id);
                            pushAction({
                                type: 'EQUIP',
                                changes: [{ relicId: r.id, prevEquipped: fullRelic?.equipped, newEquipped: selectedDoll }]
                            });
                            await db.relics.update(r.id, { equipped: selectedDoll });
                        }
                    }}
                />
            )}
        </section>
    );
}

