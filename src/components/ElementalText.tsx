import React from 'react';

// Element keyword → { icon file, color }
const ELEMENT_MAP: Record<string, { icon: string; color: string }> = {
    Corrosion: { icon: 'corrosion', color: '#8474e7' },
    Corrosive: { icon: 'corrosion', color: '#8474e7' },
    Burning: { icon: 'burn', color: '#e16b2b' },
    Burn: { icon: 'burn', color: '#e16b2b' },
    Electric: { icon: 'electric', color: '#eabf26' },
    Freezing: { icon: 'freeze', color: '#48cada' },
    Freeze: { icon: 'freeze', color: '#48cada' },
    Hydro: { icon: 'hydro', color: '#3ba7da' },
    Physical: { icon: 'physical', color: '#ffffff' },
};

// Ordered so longer/more-specific matches come first (e.g. "Burning" before "Burn")
const KEYWORDS = ['Corrosive', 'Corrosion', 'Burning', 'Burn', 'Electric', 'Freezing', 'Freeze', 'Hydro', 'Physical'];
const ELEMENT_REGEX = new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'g');

const elementIconUrls: Record<string, string> = {};
function getElementIconUrl(iconName: string): string {
    if (!elementIconUrls[iconName]) {
        elementIconUrls[iconName] = new URL(`../assets/elements/${iconName}.webp`, import.meta.url).href;
    }
    return elementIconUrls[iconName];
}

interface ElementalTextProps {
    text: string;
    /** Icon size in px (default: 14) */
    iconSize?: number;
}

/**
 * Renders a text string with elemental keywords highlighted:
 * an inline icon followed by the keyword in its element color.
 */
export function ElementalText({ text, iconSize = 14 }: ElementalTextProps) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    ELEMENT_REGEX.lastIndex = 0; // reset stateful regex
    while ((match = ELEMENT_REGEX.exec(text)) !== null) {
        const keyword = match[1];
        const info = ELEMENT_MAP[keyword];

        // Plain text before the match
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }

        // Icon + colored keyword
        parts.push(
            <span
                key={match.index}
                style={{ color: info.color, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
                <img
                    src={getElementIconUrl(info.icon)}
                    alt={keyword}
                    style={{ width: iconSize, height: iconSize, display: 'inline', verticalAlign: 'middle', marginRight: '2px' }}
                />
                {keyword}
            </span>
        );

        lastIndex = match.index + match[0].length;
    }

    // Remaining plain text
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return <>{parts}</>;
}
