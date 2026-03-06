
import { getCatBadgeIconUrl } from '../../utils/relicUtils';
import { OptimizerConstraints } from '../../optimizer/types';

interface TargetConstraintsProps {
    constraints: OptimizerConstraints;
    handleCategoryConstraintChange: (category: string, value: string) => void;
    includeOtherEquipped: boolean;
    setIncludeOtherEquipped: (val: boolean) => void;
}

export function TargetConstraints({
    constraints,
    handleCategoryConstraintChange,
    includeOtherEquipped,
    setIncludeOtherEquipped
}: TargetConstraintsProps) {
    return (
        <section className="card glassmorphism" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>Target Constraints</h2>
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

            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius)', border: '1px solid rgba(255,255,255,0.1)' }}>
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

