
import { getCatBadgeIconUrl, getSkillCategory, getSkillMaxLevel } from '../../utils/relicUtils';
import { OptimizerConstraints } from '../../optimizer/types';

interface TargetConstraintsProps {
    constraints: OptimizerConstraints;
    handleCategoryConstraintChange: (category: string, value: string) => void;
    handleTargetSkillChange: (skillName: string, value: string) => void;
    categorizedSkills: Record<string, string[]>;
    activeSkillFilters: string[];
    selectedCategoryForFilter: string;
    setSelectedCategoryForFilter: (cat: string) => void;
    selectedSkillForFilter: string;
    setSelectedSkillForFilter: (skill: string) => void;
    addSkillFilter: () => void;
    removeSkillFilter: (skill: string) => void;
    includeOtherEquipped: boolean;
    setIncludeOtherEquipped: (val: boolean) => void;
}

export function TargetConstraints({
    constraints,
    handleCategoryConstraintChange,
    handleTargetSkillChange,
    categorizedSkills,
    activeSkillFilters,
    selectedCategoryForFilter,
    setSelectedCategoryForFilter,
    selectedSkillForFilter,
    setSelectedSkillForFilter,
    addSkillFilter,
    removeSkillFilter,
    includeOtherEquipped,
    setIncludeOtherEquipped
}: TargetConstraintsProps) {
    return (
        <section className="card glassmorphism">
            <h2>1. Target Constraints</h2>
            <p className="hint">Select minimum category points (e.g., Bulwark: 12)</p>
            <div className="constraints-grid">
                {['Bulwark', 'Vanguard', 'Support', 'Sentinel'].map(cat => (
                    <div key={cat} className="input-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <img src={getCatBadgeIconUrl(cat)} alt={cat} style={{ width: '16px', height: '16px' }} />
                            Min {cat} Points
                        </label>
                        <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={constraints.targetCategoryLevels[cat] || ''}
                            onChange={(e) => handleCategoryConstraintChange(cat, e.target.value)}
                        />
                    </div>
                ))}
            </div>

            <h3 style={{ marginTop: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Specific Skill Targets</h3>
            <p className="hint">Optionally require minimum levels of specific skills (e.g. 6 levels of HP Boost)</p>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'flex-end', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                <div className="input-group" style={{ flex: 1 }}>
                    <label>Category</label>
                    <select
                        value={selectedCategoryForFilter}
                        onChange={(e) => {
                            setSelectedCategoryForFilter(e.target.value);
                            setSelectedSkillForFilter('');
                        }}
                        className="bg-dropdown"
                    >
                        {Object.keys(categorizedSkills).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div className="input-group" style={{ flex: 2 }}>
                    <label>Skill</label>
                    <select
                        value={selectedSkillForFilter}
                        onChange={(e) => setSelectedSkillForFilter(e.target.value)}
                        className="bg-dropdown"
                    >
                        <option value="">-- Select a Skill --</option>
                        {categorizedSkills[selectedCategoryForFilter]?.map(skill => (
                            <option key={skill} value={skill} disabled={activeSkillFilters.includes(skill)}>{skill}</option>
                        ))}
                    </select>
                </div>
                <button
                    className="glow-btn"
                    style={{ padding: '0.6rem 1.5rem', height: 'max-content' }}
                    onClick={() => addSkillFilter()}
                    disabled={!selectedSkillForFilter}
                >
                    + Add Filter
                </button>
            </div>

            {activeSkillFilters.length > 0 && (
                <div className="constraints-grid" style={{ marginTop: '1.5rem' }}>
                    {activeSkillFilters.map(skill => (
                        <div key={skill} className="input-group" style={{ position: 'relative' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <img src={getCatBadgeIconUrl(getSkillCategory(skill))} alt="cat" style={{ width: '14px', height: '14px' }} />
                                    <span>Min {skill} Lvl</span>
                                </div>
                                <button
                                    onClick={() => removeSkillFilter(skill)}
                                    style={{ background: 'none', border: 'none', color: 'var(--error, #ff4c4c)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
                                    title="Remove Filter"
                                >×</button>
                            </label>
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
                        </div>
                    ))}
                </div>
            )}

            <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <input
                    type="checkbox"
                    id="includeEquipped"
                    checked={includeOtherEquipped}
                    onChange={(e) => setIncludeOtherEquipped(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-color)' }}
                />
                <label htmlFor="includeEquipped" style={{ cursor: 'pointer', fontSize: '0.95rem' }}>
                    Include relics equipped by other characters
                </label>
            </div>
        </section>
    );
}
