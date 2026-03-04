
import { DollDefinition, OptimizerConstraints } from '../../optimizer/types';
import { getCatBadgeIconUrl } from '../../utils/relicUtils';

interface CharacterPassivesProps {
    selectedDollData: DollDefinition;
    constraints: OptimizerConstraints;
    applyBonusRequirements: (bonus: any) => void;
}

export function CharacterPassives({ selectedDollData, constraints, applyBonusRequirements }: CharacterPassivesProps) {
    return (
        <section className="card glassmorphism">
            <h2 style={{ fontSize: '1.25rem' }}>Character Passives</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedDollData.bonuses && selectedDollData.bonuses.map((bonus: any, idx: number) => {
                    let isActive = true;
                    const requirements: Record<string, number> = {};

                    for (const [key, val] of Object.entries(bonus)) {
                        if (key !== 'tier' && key !== 'description') {
                            requirements[key] = val as number;
                            const targetLvl = constraints.targetCategoryLevels[key] || 0;
                            if (targetLvl < (val as number)) {
                                isActive = false;
                            }
                        }
                    }

                    return (
                        <div
                            key={idx}
                            className="bonus-tier-card"
                            onClick={() => applyBonusRequirements(bonus)}
                            style={{
                                padding: '1rem',
                                background: isActive ? 'rgba(242, 108, 21, 0.1)' : 'rgba(0,0,0,0.3)',
                                border: `1px solid ${isActive ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)'}`,
                                borderRadius: '8px',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                            title="Click to set as Optimizer Target"
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <strong style={{ color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)' }}>Bonus Tier {bonus.tier}</strong>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {Object.entries(requirements).map(([cat, req]) => (
                                        <span key={cat} style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.3rem', color: (constraints.targetCategoryLevels[cat] || 0) >= req ? 'var(--success)' : 'var(--text-secondary)' }}>
                                            <img src={getCatBadgeIconUrl(cat)} alt={cat} style={{ width: '14px', height: '14px' }} />
                                            {req}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: isActive ? 'white' : 'var(--text-secondary)' }}>{bonus.description}</div>
                            <div className="bonus-hover-hint">Apply Targets</div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
