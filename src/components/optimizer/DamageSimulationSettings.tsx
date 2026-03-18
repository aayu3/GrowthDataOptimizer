import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import skillsData from '../../data/skills.json';
import { AttackMode } from '../../utils/buildUtils';
import { DollDefinition } from '../../optimizer/types';

interface DamageSimulationSettingsProps {
    simStats: any;
    setSimStats: React.Dispatch<React.SetStateAction<any>>;
    simIgnoredSkills: string[];
    setSimIgnoredSkills: React.Dispatch<React.SetStateAction<string[]>>;
    simIgnoredPassives: string[];
    setSimIgnoredPassives: React.Dispatch<React.SetStateAction<string[]>>;
    selectedDollData?: DollDefinition;
}

const attackModeOptions: { value: AttackMode; label: string }[] = [
    { value: 'both', label: 'Both' },
    { value: 'single', label: 'Single Target' },
    { value: 'aoe', label: 'AoE' },
];

/** Collect all skills tagged with a specific attackType from skills.json */
function getSkillsByAttackType(type: 'aoe' | 'single'): string[] {
    const result: string[] = [];
    for (const category of Object.values(skillsData as Record<string, Record<string, any>>)) {
        for (const [skillName, skillDef] of Object.entries(category)) {
            if (skillDef.attackType === type) result.push(skillName);
        }
    }
    return result;
}

const AOE_ONLY_SKILLS = getSkillsByAttackType('aoe');
const SINGLE_ONLY_SKILLS = getSkillsByAttackType('single');
const ALL_MODE_SKILLS = [...AOE_ONLY_SKILLS, ...SINGLE_ONLY_SKILLS];

export function DamageSimulationSettings({
    simStats,
    setSimStats,
    simIgnoredSkills,
    setSimIgnoredSkills,
    simIgnoredPassives,
    setSimIgnoredPassives,
    selectedDollData,
}: DamageSimulationSettingsProps) {
    const [showInfo, setShowInfo] = useState(false);
    const [hoveredStat, setHoveredStat] = useState<string | null>(null);
    const [hoveredPassive, setHoveredPassive] = useState<string | null>(null);

    const tierNames = ['Embryo', 'Seedling', 'Sprout', 'Shoot', 'Bud', 'Blossom'];

    /** Derive the active mode by checking whether all AoE-only or all Single-only skills are ignored */
    const effectiveMode = useMemo<AttackMode>(() => {
        const hasAllAoe = AOE_ONLY_SKILLS.length > 0 && AOE_ONLY_SKILLS.every(s => simIgnoredSkills.includes(s));
        const hasAllSingle = SINGLE_ONLY_SKILLS.length > 0 && SINGLE_ONLY_SKILLS.every(s => simIgnoredSkills.includes(s));
        if (hasAllAoe && !hasAllSingle) return 'single';
        if (hasAllSingle && !hasAllAoe) return 'aoe';
        return 'both';
    }, [simIgnoredSkills]);

    const handleModeChange = (newMode: AttackMode) => {
        setSimIgnoredSkills(prev => {
            // Remove all previously mode-auto-added skills
            const stripped = prev.filter(s => !ALL_MODE_SKILLS.includes(s));
            if (newMode === 'single') {
                const toAdd = AOE_ONLY_SKILLS.filter(s => !stripped.includes(s));
                return [...stripped, ...toAdd];
            }
            if (newMode === 'aoe') {
                const toAdd = SINGLE_ONLY_SKILLS.filter(s => !stripped.includes(s));
                return [...stripped, ...toAdd];
            }
            return stripped; // 'both' — just remove mode skills
        });
    };

    return (
        <section className="results-section glassmorphism" style={{ marginTop: '2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
                <h2
                    onClick={() => setShowInfo(true)}
                    title="How damage is calculated"
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline solid'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                    style={{
                        margin: 0,
                        padding: 0,
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        textUnderlineOffset: '4px',
                        display: 'inline-block'
                    }}
                >
                    Damage Simulation Settings
                </h2>
            </div>

            {showInfo && createPortal(
                <div
                    onClick={() => setShowInfo(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="card glassmorphism"
                        style={{ width: '700px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
                    >
                        <h3 style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.1rem' }}>How Damage Is Estimated</h3>

                        {/* Formula 1 */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Damage</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap', background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', fontFamily: 'Georgia, serif', overflowX: 'auto' }}>
                                <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Base</span>
                                <span style={{ color: 'var(--text-secondary)' }}>=</span>
                                {/* Scaler and Fraction */}
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span>Scaler (ATK/HP/DEF)</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>×</span>
                                    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                                        <span style={{ borderBottom: '1px solid rgba(255,255,255,0.5)', paddingBottom: '2px', paddingLeft: '4px', paddingRight: '4px' }}>ATK</span>
                                        <span style={{ paddingTop: '2px', paddingLeft: '4px', paddingRight: '4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                            ATK + DEF
                                        </span>
                                    </span>
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>×</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                    (1 + <span style={{ color: '#a0d4ff' }}>Σ DMG Buffs</span>)
                                </span>
                            </div>
                        </div>

                        {/* Formula 2 */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average Damage</div>
                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', fontFamily: 'Georgia, serif', lineHeight: 2 }}>
                                <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Avg</span>
                                <span style={{ color: 'var(--text-secondary)' }}> = </span>
                                (1 − <span style={{ color: '#ffd580' }}>Crit Rate</span>)
                                <span style={{ color: 'var(--text-secondary)' }}> × </span>
                                <span style={{ color: 'var(--accent-color)' }}>Base</span>
                                <span style={{ color: 'var(--text-secondary)' }}> + </span>
                                <span style={{ color: '#ffd580' }}>Crit Rate</span>
                                <span style={{ color: 'var(--text-secondary)' }}> × </span>
                                <span style={{ color: '#ffb347' }}>Crit DMG</span>
                                <span style={{ color: 'var(--text-secondary)' }}> × </span>
                                <span style={{ color: 'var(--accent-color)' }}>Base</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Skill Base Damage</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: 'var(--radius)', fontFamily: 'Georgia, serif' }}>
                                <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>Skill DMG</span>
                                <span style={{ color: 'var(--text-secondary)' }}>=</span>
                                <span style={{ color: 'var(--accent-color)' }}>Avg</span>
                                <span style={{ color: 'var(--text-secondary)' }}>×</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                    <span style={{ color: '#a0d4ff' }}>Skill Multiplier</span>
                                </span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius)' }}>
                            <div style={{ fontSize: '0.8rem', color: 'white', marginBottom: '0.4rem', fontWeight: 600 }}>Determining External Buffs</div>
                            For help determining external attack and damage buffs, consider loading into <strong style={{ color: 'white' }}>Target Practice</strong> and viewing the character info screen in the bottom left.
                            <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.2rem' }}>
                                <li style={{ marginBottom: '0.3rem' }}><strong>External ATK Buff:</strong> Take the attack shown and divide it by the attack from the Refitting Room screen.</li>
                                <li><strong>External DMG Buff:</strong> Add up any buffs, weapon effects, etc.</li>
                            </ul>
                        </div>

                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, padding: '0.75rem', background: 'rgba(255,200,100,0.05)', border: '1px solid rgba(255,200,100,0.15)', borderRadius: 'var(--radius)' }}>
                            ⚠️ This damage number is best used for <strong style={{ color: 'white' }}>comparing builds against each other</strong>. It will not always accurately reflect in-game damage numbers.
                        </p>
                    </div>
                </div>,
                document.body
            )}

            {/* Attack Mode Toggle */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Attack Mode
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {attackModeOptions.map(opt => {
                        const isActive = effectiveMode === opt.value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => handleModeChange(opt.value)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.45rem 1rem',
                                    borderRadius: 'var(--radius-button)',
                                    border: `1px solid ${isActive ? 'var(--accent-color)' : 'rgba(255,255,255,0.15)'}`,
                                    background: isActive ? 'var(--accent-glow)' : 'rgba(255,255,255,0.04)',
                                    color: isActive ? 'white' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: isActive ? 700 : 400,
                                    transition: 'all 0.2s ease',
                                    boxShadow: isActive ? '0 0 12px rgba(242, 108, 21, 0.3)' : 'none',
                                }}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Weakness Exploit */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Weakness Exploit
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[0, 1, 2, 3].map(v => {
                        const isActive = (simStats.WeaknessExploit ?? 1) === v;
                        return (
                            <button
                                key={v}
                                onClick={() => setSimStats((prev: any) => ({ ...prev, WeaknessExploit: v }))}
                                style={{
                                    padding: '0.45rem 1rem',
                                    borderRadius: 'var(--radius-button)',
                                    border: `1px solid ${isActive ? 'var(--accent-color)' : 'rgba(255,255,255,0.15)'}`,
                                    background: isActive ? 'var(--accent-glow)' : 'rgba(255,255,255,0.04)',
                                    color: isActive ? 'white' : 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: isActive ? 700 : 400,
                                    transition: 'all 0.2s ease',
                                    boxShadow: isActive ? '0 0 12px rgba(242, 108, 21, 0.3)' : 'none',
                                }}
                                title={`${v} → ×${(1 + v / 10).toFixed(1)}`}
                            >
                                {v} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}></span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {Object.entries(simStats).filter(([stat]) => stat !== 'WeaknessExploit').map(([stat, val]) => {
                    let label = stat;
                    let tooltip = '';
                    if (stat === 'ExternalAtkBuff') { label = 'ATK Buffs (%)'; tooltip = 'Examples include Attachment Set Effects, Weapons, Mod Key effects, and skills from other dolls'; }
                    else if (stat === 'ExternalDmgBuff') { label = 'DMG Buffs (%)'; tooltip = 'Examples include Attachment Set Effects, Weapons, Mod Key effects, and skills from other dolls'; }
                    else if (stat === 'ExternalCritDmgBuff') { label = 'Crit DMG Buffs (%)'; tooltip = 'Examples include Attachment Set Effects, Weapons, Mod Key effects, and skills from other dolls'; }
                    else if (stat === 'SkillMultiplier') { label = 'Skill Multiplier (%)'; }

                    return (
                        <div key={stat} className="input-group" style={{ position: 'relative' }}>
                            <label
                                onMouseEnter={() => setHoveredStat(stat)}
                                onMouseLeave={() => setHoveredStat(null)}
                                onClick={() => setHoveredStat(prev => prev === stat ? null : stat)}
                                style={tooltip ? { textDecoration: 'underline dotted', cursor: 'help', display: 'inline-block' } : {}}
                            >
                                {label}
                            </label>
                            {tooltip && hoveredStat === stat && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: '0',
                                    marginBottom: '4px',
                                    background: 'rgba(0,0,0,0.85)',
                                    color: 'white',
                                    padding: '0.5rem 0.7rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    width: 'max-content',
                                    maxWidth: '220px',
                                    zIndex: 10,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                    pointerEvents: 'none',
                                    lineHeight: 1.4,
                                    fontWeight: 'normal',
                                    textTransform: 'none',
                                    letterSpacing: 'normal'
                                }}>
                                    {tooltip}
                                </div>
                            )}
                            <input
                                type="number"
                                value={val as number}
                                onChange={(e) => setSimStats((prev: any) => ({ ...prev, [stat]: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>
                    );
                })}
            </div>

            {selectedDollData?.bonuses?.some((b: any) => b.Buff) && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>
                        Imago Factor
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {(selectedDollData.bonuses as any[]).filter(b => b.Buff).map((bonus: any) => {
                            const isActive = !simIgnoredPassives.includes(bonus.description);
                            const label = tierNames[bonus.tier - 1] || `Tier ${bonus.tier}`;
                            return (
                                <div key={bonus.description} style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setSimIgnoredPassives(prev =>
                                            isActive
                                                ? [...prev, bonus.description]
                                                : prev.filter(d => d !== bonus.description)
                                        )}
                                        onMouseEnter={() => setHoveredPassive(bonus.description)}
                                        onMouseLeave={() => setHoveredPassive(null)}
                                        style={{
                                            padding: '0.45rem 1rem',
                                            borderRadius: 'var(--radius-button)',
                                            border: `1px solid ${isActive ? 'var(--accent-color)' : 'rgba(255,255,255,0.15)'}`,
                                            background: isActive ? 'var(--accent-glow)' : 'rgba(255,255,255,0.04)',
                                            color: isActive ? 'white' : 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            fontWeight: isActive ? 700 : 400,
                                            transition: 'all 0.2s ease',
                                            boxShadow: isActive ? '0 0 12px rgba(242, 108, 21, 0.3)' : 'none',
                                        }}
                                    >
                                        {label}
                                    </button>
                                    {hoveredPassive === bonus.description && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            marginBottom: '6px',
                                            background: 'rgba(0,0,0,0.92)',
                                            color: 'white',
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            width: 'max-content',
                                            maxWidth: '260px',
                                            zIndex: 100,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                                            pointerEvents: 'none',
                                            lineHeight: 1.5,
                                            whiteSpace: 'normal',
                                            textAlign: 'left',
                                        }}>
                                            {bonus.description}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <h3>Ignored Skills in Calculation</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {simIgnoredSkills.map(skill => {
                    const isModeSkill = ALL_MODE_SKILLS.includes(skill);
                    return (
                        <button
                            key={skill}
                            title={isModeSkill ? 'Auto-excluded by attack mode — click to re-enable' : 'Click to remove'}
                            onClick={() => setSimIgnoredSkills(prev => prev.filter(s => s !== skill))}
                            style={{
                                background: 'transparent',
                                color: isModeSkill ? '#ffcc88' : '#ffaaaa',
                                padding: '0.4rem 0.8rem',
                                borderRadius: 'var(--radius-button)',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                border: `1px solid ${isModeSkill ? 'rgba(255,160,40,0.6)' : 'rgba(255,80,80,0.6)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {skill}
                        </button>
                    );
                })}
            </div>
            <div className="input-group" style={{ maxWidth: '300px' }}>
                <select
                    className="bg-dropdown"
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val && !simIgnoredSkills.includes(val)) {
                            setSimIgnoredSkills(prev => [...prev, val].filter(Boolean));
                        }
                        e.target.value = '';
                    }}
                    value=""
                >
                    <option value="" disabled>Add Skill to Ignore...</option>
                    {[
                        ...Object.keys((skillsData as any).Sentinel || {}),
                        ...Object.keys((skillsData as any).Vanguard || {}),
                        ...Object.keys((skillsData as any).Support || {})
                    ].filter(s => !simIgnoredSkills.includes(s)).map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>
        </section>
    );
}
