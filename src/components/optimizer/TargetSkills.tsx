import { useState } from 'react';
import { getCatBadgeIconUrl, getSkillCategory, getSkillMaxLevel, getSkillDescription } from '../../utils/relicUtils';
import { OptimizerConstraints } from '../../optimizer/types';

interface TargetSkillsProps {
    constraints: OptimizerConstraints;
    handleTargetSkillChange: (skillName: string, value: string) => void;
    categorizedSkills: Record<string, string[]>;
    activeSkillFilters: string[];
    selectedCategoryForFilter: string;
    setSelectedCategoryForFilter: (cat: string) => void;
    addSkillFilter: (skill: string) => void;
    removeSkillFilter: (skill: string) => void;
}

export function TargetSkills({
    constraints,
    handleTargetSkillChange,
    categorizedSkills,
    activeSkillFilters,
    selectedCategoryForFilter,
    setSelectedCategoryForFilter,
    addSkillFilter,
    removeSkillFilter
}: TargetSkillsProps) {
    const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

    return (
        <section className="card glassmorphism" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Specific Skill Targets</h2>
            <p className="hint">Optionally require minimum levels of specific skills (e.g. 6 levels of HP Boost)</p>

            <div style={{ marginTop: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {Object.keys(categorizedSkills).map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategoryForFilter(cat)}
                            style={{
                                background: selectedCategoryForFilter === cat ? `var(--cat-${cat.toLowerCase()})` : 'transparent',
                                border: `1px solid ${selectedCategoryForFilter === cat ? 'transparent' : `var(--cat-${cat.toLowerCase()})`}`,
                                color: selectedCategoryForFilter === cat ? 'white' : `var(--cat-${cat.toLowerCase()})`,
                                cursor: 'pointer',
                                padding: '0.4rem 1rem',
                                borderRadius: 'var(--radius-button)',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {categorizedSkills[selectedCategoryForFilter]?.map(skill => {
                        const isActive = activeSkillFilters.includes(skill);
                        return (
                            <button
                                key={skill}
                                onClick={() => isActive ? removeSkillFilter(skill) : addSkillFilter(skill)}
                                style={{
                                    background: isActive ? `var(--cat-${selectedCategoryForFilter.toLowerCase()})` : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${isActive ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                                    color: isActive ? 'white' : 'var(--text-secondary)',
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: 'var(--radius-button)',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                {isActive && <span style={{ color: 'var(--accent-color)' }}>✓</span>}
                                {skill}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="constraints-grid" style={{ marginTop: '1rem', flex: 1, alignContent: 'flex-start' }}>
                {activeSkillFilters.length > 0 ? (
                    activeSkillFilters.map(skill => (
                        <div key={skill} className="input-group" style={{ position: 'relative' }}>
                            <div
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                onClick={() => setExpandedSkills(prev => { const next = new Set(prev); next.has(skill) ? next.delete(skill) : next.add(skill); return next; })}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <img src={getCatBadgeIconUrl(getSkillCategory(skill))} alt="cat" style={{ width: '14px', height: '14px' }} />
                                    <span>Min {skill} Lvl</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeSkillFilter(skill); }}
                                    style={{ background: 'none', border: 'none', color: 'var(--error, #ff4c4c)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                                    title="Remove Filter"
                                >×</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', marginTop: '0.5rem' }}>
                                {(() => {
                                    const skillMax = getSkillMaxLevel(skill);
                                    const currentVal = constraints.targetSkillLevels[skill] || 0;
                                    const pct = skillMax > 0 ? (currentVal / skillMax) * 100 : 0;
                                    return (
                                        <input
                                            type="range"
                                            min="0"
                                            max={skillMax}
                                            value={currentVal}
                                            onChange={(e) => handleTargetSkillChange(skill, e.target.value)}
                                            style={{
                                                flex: 1,
                                                accentColor: 'var(--accent-color)',
                                                margin: 0,
                                                background: `linear-gradient(to right, var(--accent-color) ${pct}%, rgba(0, 0, 0, 0.4) ${pct}%)`
                                            }}
                                        />
                                    );
                                })()}
                                <span style={{ minWidth: '20px', textAlign: 'right', fontWeight: 'bold' }}>{constraints.targetSkillLevels[skill] || 0}</span>
                            </div>
                            {expandedSkills.has(skill) && (
                                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: 'var(--radius)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)', marginTop: '0.5rem' }}>
                                    {getSkillDescription(skill, constraints.targetSkillLevels[skill] || 0)}
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)', opacity: 0.5, fontStyle: 'italic', padding: '2rem 0' }}>
                        No specific skills targeted.
                    </div>
                )}
            </div>
        </section>
    );
}
