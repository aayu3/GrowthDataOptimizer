import React, { useMemo } from 'react';
import skillsData from '../../data/skills.json';
import { AttackMode } from '../../utils/buildUtils';

interface DamageSimulationSettingsProps {
    simStats: any;
    setSimStats: React.Dispatch<React.SetStateAction<any>>;
    simIgnoredSkills: string[];
    setSimIgnoredSkills: React.Dispatch<React.SetStateAction<string[]>>;
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
}: DamageSimulationSettingsProps) {

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
            <h2>Damage Simulation Settings</h2>

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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {Object.entries(simStats).map(([stat, val]) => (
                    <div key={stat} className="input-group">
                        <label>{stat}</label>
                        <input
                            type="number"
                            value={val as number}
                            onChange={(e) => setSimStats((prev: any) => ({ ...prev, [stat]: parseFloat(e.target.value) || 0 }))}
                        />
                    </div>
                ))}
            </div>

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
                            console.log("[Damage Sim] User manually ignoring skill:", val);
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
