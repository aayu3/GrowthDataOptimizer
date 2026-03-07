import React from 'react';
import { getCatBadgeIconUrl, getSkillCategory } from '../../utils/relicUtils';

export interface PostGenerationFilterProps {
    postSkillFilters: Record<string, number>;
    setPostSkillFilters: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    categorizedSkills: Record<string, string[]>;
}

export function PostGenerationFilter({
    postSkillFilters,
    setPostSkillFilters,
    categorizedSkills
}: PostGenerationFilterProps) {
    const [filterCategory, setFilterCategory] = React.useState<string>('Bulwark');

    return (
        <div className="glass-panel" style={{ padding: '1.5rem', marginTop: '1rem', animation: 'slideDown 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Filter</h2>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {Object.keys(categorizedSkills).map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        style={{
                            background: filterCategory === cat ? `var(--cat-${cat.toLowerCase()})` : 'transparent',
                            border: `1px solid ${filterCategory === cat ? 'transparent' : `var(--cat-${cat.toLowerCase()})`}`,
                            color: filterCategory === cat ? 'white' : `var(--cat-${cat.toLowerCase()})`,
                            cursor: 'pointer',
                            padding: '0.4rem 1rem',
                            borderRadius: 'var(--radius-button)',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s'
                        }}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: Object.keys(postSkillFilters).length > 0 ? '1.5rem' : '0' }}>
                {categorizedSkills[filterCategory]?.map(skill => {
                    const isActive = postSkillFilters[skill] !== undefined;
                    return (
                        <button
                            key={skill}
                            onClick={() => {
                                setPostSkillFilters(prev => {
                                    const updated = { ...prev };
                                    if (isActive) delete updated[skill];
                                    else updated[skill] = 1;
                                    return updated;
                                });
                            }}
                            style={{
                                background: isActive ? `var(--cat-${filterCategory.toLowerCase()})` : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isActive ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                                color: isActive ? 'white' : 'var(--text-secondary)',
                                padding: '0.4rem 0.8rem',
                                borderRadius: 'var(--radius-button)',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {isActive && <span style={{ color: 'var(--accent-color)' }}>✓</span>}
                            {skill}
                        </button>
                    );
                })}
            </div>

            {Object.keys(postSkillFilters).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {Object.entries(postSkillFilters).map(([skill, minLvl]) => {
                        const cat = getSkillCategory(skill);
                        return (
                            <div key={skill} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: 'var(--radius)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '220px' }}>
                                    <img src={getCatBadgeIconUrl(cat)} alt={cat} style={{ width: '18px', height: '18px' }} />
                                    <span style={{ fontSize: '0.95rem' }}>{skill}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="6"
                                    value={minLvl}
                                    onChange={e => {
                                        const val = parseInt(e.target.value, 10);
                                        setPostSkillFilters(prev => ({ ...prev, [skill]: val }));
                                    }}
                                    style={{
                                        flex: 1,
                                        accentColor: 'var(--accent-color)',
                                        margin: 0
                                    }}
                                />
                                <span style={{ minWidth: '40px', textAlign: 'right', fontWeight: 'bold' }}>Lv. {minLvl}</span>
                                <button
                                    onClick={() => setPostSkillFilters(prev => {
                                        const updated = { ...prev };
                                        delete updated[skill];
                                        return updated;
                                    })}
                                    style={{ background: 'none', border: 'none', color: 'var(--error, #ff4c4c)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}
                                    title="Remove Filter"
                                >×</button>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
