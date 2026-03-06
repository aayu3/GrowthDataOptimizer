import React from 'react';
import skillsData from '../../data/skills.json';

interface DamageSimulationSettingsProps {
    simStats: any;
    setSimStats: React.Dispatch<React.SetStateAction<any>>;
    simIgnoredSkills: string[];
    setSimIgnoredSkills: React.Dispatch<React.SetStateAction<string[]>>;
}

export function DamageSimulationSettings({ simStats, setSimStats, simIgnoredSkills, setSimIgnoredSkills }: DamageSimulationSettingsProps) {
    return (
        <section className="results-section glassmorphism" style={{ marginTop: '2rem' }}>
            <h2>Damage Simulation Settings</h2>
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
                {simIgnoredSkills.map(skill => (
                    <span key={skill} style={{ background: 'rgba(255,60,60,0.2)', color: '#ffaaaa', padding: '4px 8px', borderRadius: 'var(--radius)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {skill}
                        <button
                            onClick={() => setSimIgnoredSkills(prev => prev.filter(s => s !== skill))}
                            style={{ background: 'none', border: 'none', color: 'var(--error, #ff4c4c)', cursor: 'pointer', lineHeight: 1 }}
                        >×</button>
                    </span>
                ))}
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

