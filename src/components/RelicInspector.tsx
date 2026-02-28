import React from 'react';
import { Relic } from '../optimizer/types';
import { getSkillDescription, getDollImageUrl } from '../utils/relicUtils';

interface RelicInspectorProps {
    selectedRelic: Relic | null;
    onClose?: () => void;
}

export const RelicInspector: React.FC<RelicInspectorProps> = ({ selectedRelic, onClose }) => {
    if (!selectedRelic) {
        return (
            <div className="empty-inspector">
                Select a relic to view its details.
            </div>
        );
    }

    return (
        <div className="db-inspector-content">
            {onClose && (
                <button className="inspector-close-btn" onClick={onClose} style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '1.2rem'
                }}>×</button>
            )}
            <div className="db-inspector-header">
                <div className="db-inspector-title">
                    {selectedRelic.type} Relic
                </div>
                <div className="db-inspector-subtitle">
                    <span className="badge">{selectedRelic.rarity}</span>
                    <span>Lvl. {selectedRelic.total_level}</span>
                </div>
            </div>

            <div className="db-inspector-body">
                <div className="inspector-skill-group">
                    <div className="inspector-skill-title">Main Skill</div>
                    <div className="inspector-skill-item">
                        <div className="inspector-skill-name">
                            <span>{selectedRelic.main_skill.name}</span>
                            <span className="inspector-skill-level">Lv. {selectedRelic.main_skill.level}</span>
                        </div>
                        <div className="inspector-skill-desc">
                            {getSkillDescription(selectedRelic.main_skill.name, selectedRelic.main_skill.level)}
                        </div>
                    </div>
                </div>

                {selectedRelic.aux_skills.length > 0 && (
                    <div className="inspector-skill-group">
                        <div className="inspector-skill-title">Auxiliary Skills</div>
                        {selectedRelic.aux_skills.map((aux, idx) => (
                            <div key={idx} className="inspector-skill-item">
                                <div className="inspector-skill-name">
                                    <span>{aux.name}</span>
                                    <span className="inspector-skill-level">Lv. {aux.level}</span>
                                </div>
                                <div className="inspector-skill-desc">
                                    {getSkillDescription(aux.name, aux.level)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {selectedRelic.equipped && (
                    <div className="inspector-skill-group">
                        <div className="inspector-skill-title">Status</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <img src={getDollImageUrl(selectedRelic.equipped)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={selectedRelic.equipped} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                            <span style={{ color: 'var(--text-secondary)' }}>Equipped by <strong style={{ color: 'white' }}>{selectedRelic.equipped}</strong></span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
