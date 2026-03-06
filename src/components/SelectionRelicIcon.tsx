import React from 'react';
import { Relic } from '../optimizer/types';
import { getRelicMainIconUrl } from '../utils/relicUtils';

interface SelectionRelicIconProps {
    relic: Relic;
}

export const SelectionRelicIcon: React.FC<SelectionRelicIconProps> = ({ relic }) => {
    return (
        <div
            className={`selection-relic-icon relic-thumb-rarity-${relic.rarity}`}
        >
            <img
                src={getRelicMainIconUrl(relic.type)}
                alt={relic.type}
                style={{ width: '80%', height: '80%', objectFit: 'contain', opacity: 0.9 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
        </div>
    );
};
