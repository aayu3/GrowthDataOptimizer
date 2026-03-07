import skillsData from '../data/skills.json';
import relicInfo from '../data/relicinfo.json';

const getSkillData = (skillName: string) => {
    for (const [category, skills] of Object.entries((skillsData as Record<string, any>))) {
        if (typeof skills === 'object' && skills !== null && skillName in skills) {
            return { category, data: skills[skillName] };
        }
    }
    return null;
};

// Helper to find the category of a specific skill name
export const getSkillCategory = (skillName: string): string => {
    const sd = getSkillData(skillName);
    if (sd) return sd.category;

    // Fallback to searching relicInfo
    if (relicInfo && (relicInfo as any).RELIC_TYPES) {
        for (const [catName, catData] of Object.entries<any>((relicInfo as any).RELIC_TYPES)) {
            if (catData.main_skills?.includes(skillName)) return catName;
            if (catData.aux_skills) {
                for (const rawName of Object.keys(catData.aux_skills)) {
                    if (skillName === rawName || (rawName.includes('{Element}') && (relicInfo as any).ELEMENTS?.some((el: string) => rawName.replace('{Element}', el) === skillName))) {
                        return catName;
                    }
                }
            }
        }
    }
    return 'Unknown';
};

export const getSkillMaxLevel = (skillStr: string) => {
    const sd = getSkillData(skillStr);
    if (sd && sd.data.x) return sd.data.x.length;

    let maxLvl = 6;
    if (relicInfo && (relicInfo as any).RELIC_TYPES) {
        for (const catData of Object.values<any>((relicInfo as any).RELIC_TYPES)) {
            if (catData.main_skills?.includes(skillStr)) maxLvl = 6;
            if (catData.aux_skills) {
                for (const [rawName, lvl] of Object.entries<number>(catData.aux_skills)) {
                    if (skillStr === rawName || (rawName.includes('{Element}') && (relicInfo as any).ELEMENTS?.some((el: string) => rawName.replace('{Element}', el) === skillStr))) {
                        maxLvl = lvl;
                    }
                }
            }
        }
    }
    return maxLvl;
};

// Helper to get description
export const getSkillDescription = (skillName: string, level: number): string => {
    const sd = getSkillData(skillName);
    if (sd && sd.data.effect && sd.data.x) {
        if (level === 0) {
            return sd.data.effect.replace(/{x}/g, '0');
        }
        const xList = sd.data.x;
        const idx = Math.max(0, Math.min(level - 1, xList.length - 1));
        const val = xList[idx];
        return sd.data.effect.replace(/{x}/g, val.toString());
    }
    return `Increases ${skillName} by level ${level} amount.`;
};

export const getDollImageUrl = (dollName: string) => {
    try {
        return new URL(`../assets/doll_images/${dollName}.webp`, import.meta.url).href;
    } catch {
        return '';
    }
};

export const getRelicMainIconUrl = (type: string) => {
    const colorMap: Record<string, string> = {
        'Bulwark': 'blue',
        'Vanguard': 'purple',
        'Support': 'green',
        'Sentinel': 'red'
    };
    const color = colorMap[type] || 'blue';
    try {
        return new URL(`../assets/relic_icons/${type.toLowerCase()}_${color}.webp`, import.meta.url).href;
    } catch {
        return '';
    }
};

export const getCatBadgeIconUrl = (cat: string) => {
    const colorMap: Record<string, string> = {
        'Bulwark': 'blue',
        'Vanguard': 'purple',
        'Support': 'green',
        'Sentinel': 'red'
    };
    const color = colorMap[cat] || 'blue';
    try {
        return new URL(`../assets/relic_icons/${cat.toLowerCase()}_${color}.webp`, import.meta.url).href;
    } catch {
        return '';
    }
};
