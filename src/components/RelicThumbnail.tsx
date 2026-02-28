import React from 'react';
import { Relic } from '../optimizer/types';
import { getSkillCategory, getDollImageUrl, getRelicMainIconUrl, getCatBadgeIconUrl } from '../utils/relicUtils';

interface RelicThumbnailProps {
    relic: Relic;
    isSelected?: boolean;
    onClick?: () => void;
}

export const RelicThumbnail: React.FC<RelicThumbnailProps> = ({ relic, isSelected = false, onClick }) => {
    // Aggregate category totals for the thumbnail badge
    const catTotals: Record<string, number> = {};
    const allSkills = [relic.main_skill, ...relic.aux_skills];

    allSkills.forEach(s => {
        const cat = getSkillCategory(s.name);
        if (cat && cat !== 'Unknown') {
            catTotals[cat] = (catTotals[cat] || 0) + s.level;
        }
    });

    return (
        <div
            className={`relic-thumbnail relic-thumb-rarity-${relic.rarity} ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
        >
            <div className="relic-thumb-bg">
                <img src={getRelicMainIconUrl(relic.type)} alt={relic.type} style={{ width: '80%', height: '80%', objectFit: 'contain', opacity: 0.9 }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>

            <div className="relic-thumb-categories">
                {Object.entries(catTotals).map(([cat, total]) => (
                    <div key={cat} className="relic-cat-badge-img" title={`${total} ${cat}`}>
                        <img src={getCatBadgeIconUrl(cat)} alt={cat} />
                        <span style={{ textShadow: '1px 1px 2px black, -1px -1px 2px black, 1px -1px 2px black, -1px 1px 2px black', fontWeight: 800 }}>{total}</span>
                    </div>
                ))}
            </div>

            {relic.equipped && (
                <div className="relic-thumb-equipped" title={`Equipped by ${relic.equipped}`}>
                    <img src={getDollImageUrl(relic.equipped)} alt={relic.equipped} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
            )}
        </div>
    );
};
