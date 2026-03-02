import skillsData from '../data/skills.json';
import relicInfo from '../data/relicinfo.json';

// Helper to find the category of a specific skill name
export const getSkillCategory = (skillName: string): string => {
    // Try precise match from skills.json first
    if ((skillsData as any)[skillName]?.type) {
        return (skillsData as any)[skillName].type;
    }

    // Fallback to searching relicInfo
    if (relicInfo && relicInfo.RELIC_TYPES) {
        for (const [catName, catData] of Object.entries<any>(relicInfo.RELIC_TYPES)) {
            if (catData.main_skills?.includes(skillName)) return catName;
            if (catData.aux_skills) {
                for (const rawName of Object.keys(catData.aux_skills)) {
                    if (skillName === rawName || (rawName.includes('{Element}') && relicInfo.ELEMENTS?.some((el: string) => rawName.replace('{Element}', el) === skillName))) {
                        return catName;
                    }
                }
            }
        }
    }
    return 'Unknown';
};

export const getSkillMaxLevel = (skillStr: string) => {
    if ((skillsData as any)[skillStr]) return (skillsData as any)[skillStr].maxlevel;

    let maxLvl = 6;
    if (relicInfo && relicInfo.RELIC_TYPES) {
        for (const catData of Object.values<any>(relicInfo.RELIC_TYPES)) {
            if (catData.main_skills?.includes(skillStr)) maxLvl = 6;
            if (catData.aux_skills) {
                for (const [rawName, lvl] of Object.entries<number>(catData.aux_skills)) {
                    if (skillStr === rawName || (rawName.includes('{Element}') && relicInfo.ELEMENTS?.some((el: string) => rawName.replace('{Element}', el) === skillStr))) {
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
    if ((skillsData as any)[skillName]?.description) {
        return (skillsData as any)[skillName].description;
    }
    return `Increases ${skillName} by level ${level} amount.`;
};

export const getDollImageUrl = (dollName: string) => {
    try {
        return new URL(`../assets/doll_images/${dollName}.png`, import.meta.url).href;
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
        return new URL(`../assets/relic_icons/${type.toLowerCase()}_${color}.png`, import.meta.url).href;
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
        return new URL(`../assets/relic_icons/${cat.toLowerCase()}_${color}.png`, import.meta.url).href;
    } catch {
        return '';
    }
};
