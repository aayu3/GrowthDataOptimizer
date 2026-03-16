
import { DollDefinition, OptimizerConstraints } from '../../optimizer/types';
import { getCatBadgeIconUrl } from '../../utils/relicUtils';
import { ElementalText } from '../ElementalText';

interface CharacterPassivesProps {
    selectedDollData: DollDefinition;
    constraints: OptimizerConstraints;
    applyBonusRequirements: (bonus: any, isActive: boolean) => void;
}

const tierNames = ['Embryo', 'Seedling', 'Sprout', 'Shoot', 'Bud', 'Blossom'];

export function CharacterPassives({ selectedDollData, constraints, applyBonusRequirements }: CharacterPassivesProps) {
    return (
        <section className="card glassmorphism" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Character Passives</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {selectedDollData.bonuses && selectedDollData.bonuses.map((bonus: any, idx: number) => {
                    let isActive = true;
                    const requirements: Record<string, number> = {};

                    for (const [key, val] of Object.entries(bonus)) {
                        if (key !== 'tier' && key !== 'description' && key !== 'Buff') {
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
                            onClick={() => applyBonusRequirements(bonus, isActive)}
                            style={{
                                padding: '1rem',
                                background: isActive ? 'rgba(242, 108, 21, 0.1)' : 'rgba(0,0,0,0.3)',
                                border: `1px solid ${isActive ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)'}`,
                                borderRadius: 'var(--radius)',
                                transition: 'all 0.3s ease',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                            title="Click to set as Optimizer Target"
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <strong style={{ color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                                    {tierNames[bonus.tier - 1] || `Bonus Tier ${bonus.tier}`}
                                </strong>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {Object.entries(requirements).map(([cat, req]) => (
                                        <span key={cat} style={{ fontSize: '0.8rem', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: '0.3rem', color: (constraints.targetCategoryLevels[cat] || 0) >= req ? 'var(--success)' : 'var(--text-secondary)' }}>
                                            <img src={getCatBadgeIconUrl(cat)} alt={cat} style={{ width: '14px', height: '14px' }} />
                                            {req}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ fontSize: '0.9rem', color: isActive ? 'white' : 'var(--text-secondary)' }}><ElementalText text={bonus.description} /></div>
                            <div className="bonus-hover-hint">{isActive ? 'Remove Target' : 'Apply Target'}</div>
                        </div>
                    );
                })}
            </div>
            <div style={{ flex: 1 }} />
        </section>
    );
}

